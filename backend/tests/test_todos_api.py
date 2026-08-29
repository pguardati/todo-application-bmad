from datetime import datetime

from httpx import AsyncClient
from sqlmodel import Session

from app import repository
from app.models import Todo


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
