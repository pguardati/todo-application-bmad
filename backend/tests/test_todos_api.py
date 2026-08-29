from datetime import UTC, datetime
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlmodel import Session

from app import repository
from app.models import Todo
from app.schemas import DESCRIPTION_MAX_LENGTH


def seed(engine) -> None:
    with Session(engine) as session:
        session.add(Todo(description="Buy groceries", created_at=datetime(2026, 8, 27, 9, 0, 0)))
        session.add(
            Todo(
                description="Morning standup",
                completed=True,
                created_at=datetime(2026, 8, 28, 9, 0, 0),
            )
        )
        session.add(Todo(description="Fix the auth bug", created_at=datetime(2026, 8, 29, 9, 0, 0)))
        session.commit()


async def test_list_returns_a_bare_array_newest_first(client: AsyncClient, engine) -> None:
    empty = await client.get("/api/todos")
    assert empty.status_code == 200
    assert empty.json() == []

    seed(engine)
    response = await client.get("/api/todos")

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert [item["description"] for item in body] == [
        "Fix the auth bug",
        "Morning standup",
        "Buy groceries",
    ]
    assert [item["completed"] for item in body] == [False, True, False]


async def test_payload_is_camel_case_without_the_owner_column(client: AsyncClient, engine) -> None:
    seed(engine)

    item = (await client.get("/api/todos")).json()[0]

    assert set(item) == {"id", "description", "completed", "createdAt"}
    assert item["createdAt"] == "2026-08-29T09:00:00Z"


async def test_rows_belonging_to_another_owner_are_excluded(client: AsyncClient, engine) -> None:
    seed(engine)
    with Session(engine) as session:
        session.add(Todo(description="Someone else's todo", user_id="other"))
        session.commit()

    body = (await client.get("/api/todos")).json()

    assert [item["description"] for item in body] == [
        "Fix the auth bug",
        "Morning standup",
        "Buy groceries",
    ]

    with Session(engine) as session:
        mine = repository.list_todos(session, "other")
    assert [row.description for row in mine] == ["Someone else's todo"]


async def test_create_trims_and_returns_the_stored_row(client: AsyncClient, engine) -> None:
    response = await client.post("/api/todos", json={"description": "  Buy milk  "})

    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "description", "completed", "createdAt"}
    assert body["description"] == "Buy milk"
    assert body["completed"] is False
    assert UUID(body["id"]).version == 4
    created_at = datetime.fromisoformat(body["createdAt"].replace("Z", "+00:00"))
    assert abs((datetime.now(UTC) - created_at).total_seconds()) < 60


@pytest.mark.parametrize(
    "payload",
    [
        {"description": ""},
        {"description": "   "},
        {"description": "x" * (DESCRIPTION_MAX_LENGTH + 1)},
        {},
        {"description": 12},
    ],
)
async def test_rejected_bodies_answer_with_the_one_validation_envelope(
    client: AsyncClient, engine, payload: dict
) -> None:
    response = await client.post("/api/todos", json=payload)

    assert response.status_code == 400
    assert response.json() == {"error": "VALIDATION_ERROR", "message": "Invalid request."}


async def test_non_json_body_is_rejected_the_same_way(client: AsyncClient, engine) -> None:
    response = await client.post(
        "/api/todos", content="not json", headers={"Content-Type": "application/json"}
    )

    assert response.status_code == 400
    assert response.json()["error"] == "VALIDATION_ERROR"


async def test_a_created_todo_heads_the_list(client: AsyncClient, engine) -> None:
    seed(engine)
    created = (await client.post("/api/todos", json={"description": "Ship it"})).json()

    body = (await client.get("/api/todos")).json()

    assert body[0] == created
    assert [item["description"] for item in body] == [
        "Ship it",
        "Fix the auth bug",
        "Morning standup",
        "Buy groceries",
    ]


async def test_patch_toggles_completion_in_both_directions(client: AsyncClient, engine) -> None:
    created = (await client.post("/api/todos", json={"description": "Ship it"})).json()

    done = await client.patch(f"/api/todos/{created['id']}", json={"completed": True})

    assert done.status_code == 200
    assert done.json() == {**created, "completed": True}

    undone = await client.patch(f"/api/todos/{created['id']}", json={"completed": False})

    assert undone.status_code == 200
    assert undone.json() == created


async def test_patch_leaves_every_other_field_untouched(client: AsyncClient, engine) -> None:
    created = (await client.post("/api/todos", json={"description": "Ship it"})).json()

    response = await client.patch(
        f"/api/todos/{created['id']}",
        json={"completed": True, "description": "hacked", "userId": "other"},
    )

    assert response.status_code == 200
    assert response.json() == {**created, "completed": True}
    with Session(engine) as session:
        stored = session.get(Todo, created["id"])
    assert stored is not None
    assert stored.description == "Ship it"
    assert stored.user_id is None


async def test_patch_on_an_unknown_id_answers_the_not_found_envelope(
    client: AsyncClient, engine
) -> None:
    response = await client.patch("/api/todos/does-not-exist", json={"completed": True})

    assert response.status_code == 404
    assert response.json() == {"error": "NOT_FOUND", "message": "Todo not found."}


async def test_delete_removes_the_row_and_answers_204_without_a_body(
    client: AsyncClient, engine
) -> None:
    seed(engine)
    created = (await client.post("/api/todos", json={"description": "Ship it"})).json()

    response = await client.delete(f"/api/todos/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    body = (await client.get("/api/todos")).json()
    assert [item["description"] for item in body] == [
        "Fix the auth bug",
        "Morning standup",
        "Buy groceries",
    ]


async def test_delete_on_an_unknown_id_answers_the_not_found_envelope(
    client: AsyncClient, engine
) -> None:
    response = await client.delete("/api/todos/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {"error": "NOT_FOUND", "message": "Todo not found."}
