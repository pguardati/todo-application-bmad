import pytest
from httpx import AsyncClient

import app.services as services
from app.config import Settings


@pytest.mark.asyncio
async def test_health_ok(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


@pytest.mark.asyncio
async def test_health_degraded(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(session):
        raise RuntimeError("database unreachable")

    monkeypatch.setattr(services.repository, "check_connection", boom)

    response = await client.get("/api/health")
    assert response.status_code == 503
    assert response.json() == {"status": "error", "database": "error"}


@pytest.mark.asyncio
async def test_unknown_route_is_not_a_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/healthz")
    assert response.status_code == 404


def test_settings_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in ("DATABASE_URL", "APP_NAME", "DEBUG"):
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)

    assert settings.database_url == "sqlite:///./todo.db"
    assert settings.app_name == "Todo App"
    assert settings.debug is False


@pytest.fixture
def error_client(engine) -> AsyncClient:
    from typing import Annotated

    from fastapi import Depends
    from httpx import ASGITransport
    from pydantic import BaseModel
    from sqlmodel import Session

    from app.db import get_session
    from app.errors import NotFoundError
    from app.main import create_app
    from app.models import Todo

    probe_app = create_app()

    class Body(BaseModel):
        count: int

    @probe_app.post("/api/probe/validate")
    def validate(body: Body) -> dict[str, int]:
        return {"count": body.count}

    @probe_app.get("/api/probe/missing")
    def missing() -> None:
        raise NotFoundError("Todo not found")

    @probe_app.post("/api/probe/persist")
    def persist(body: Body, session: Annotated[Session, Depends(get_session)]) -> dict[str, str]:
        session.add(Todo(description=str(body.count)))
        return {"status": "added"}

    @probe_app.get("/api/probe/boom")
    def boom(session: Annotated[Session, Depends(get_session)]) -> None:
        session.add(Todo(description="uncommitted"))
        raise RuntimeError("kaboom")

    @probe_app.post("/api/probe/leak")
    def leak(body: Body) -> None:
        raise RuntimeError(
            f"SELECT id FROM todo WHERE owner = '{body.count}' "
            f"at /srv/app/repository.py line 42 (sqlmodel 0.0.31)"
        )

    return AsyncClient(
        transport=ASGITransport(app=probe_app, raise_app_exceptions=False),
        base_url="http://test",
    )


@pytest.mark.asyncio
async def test_not_found_envelope(error_client: AsyncClient) -> None:
    async with error_client as http:
        response = await http.get("/api/probe/missing")
    assert response.status_code == 404
    assert response.json() == {"error": "NOT_FOUND", "message": "Todo not found"}


@pytest.mark.asyncio
async def test_validation_error_is_remapped_to_400(error_client: AsyncClient) -> None:
    async with error_client as http:
        response = await http.post("/api/probe/validate", json={"count": "not-a-number"})
    assert response.status_code == 400
    assert response.json()["error"] == "VALIDATION_ERROR"


@pytest.mark.asyncio
async def test_unhandled_error_returns_generic_500_and_rolls_back(
    error_client: AsyncClient, engine
) -> None:
    from sqlmodel import Session, select

    from app.models import Todo

    async with error_client as http:
        response = await http.get("/api/probe/boom")

    assert response.status_code == 500
    assert response.json() == {"error": "INTERNAL_ERROR", "message": "Internal server error"}

    with Session(engine) as session:
        assert session.exec(select(Todo)).all() == []


LEAK_TOKENS = (
    "Traceback",
    "RuntimeError",
    "SELECT",
    "todo",
    "owner",
    "/srv/app",
    "repository.py",
    "sqlmodel",
    "8675309",
    'File "',
)


def assert_generic_500_body(response) -> None:
    assert response.status_code == 500

    payload = response.json()
    assert set(payload) == {"error", "message"}
    assert payload["error"] == "INTERNAL_ERROR"

    for leaked in LEAK_TOKENS:
        assert leaked not in response.text, f"the 500 body leaked {leaked!r}: {response.text}"


def assert_exception_was_logged(caplog: pytest.LogCaptureFixture, path: str) -> str:
    import logging

    records = [r for r in caplog.records if r.name == "app.main" and r.levelno == logging.ERROR]
    assert records, f"app.main logged no ERROR record; saw {[r.name for r in caplog.records]}"

    record = records[0]
    assert record.exc_info is not None, "the handler logged no exception detail"

    detail = record.getMessage() + "\n" + logging.Formatter().formatException(record.exc_info)
    assert path in detail
    return detail


@pytest.mark.asyncio
async def test_forced_500_leaks_nothing_while_the_log_keeps_the_detail(
    error_client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    import logging

    with caplog.at_level(logging.ERROR, logger="app.main"):
        async with error_client as http:
            response = await http.post("/api/probe/leak", json={"count": 8675309})

    assert_generic_500_body(response)

    detail = assert_exception_was_logged(caplog, "/api/probe/leak")
    assert "RuntimeError" in detail
    assert "SELECT id FROM todo" in detail
    assert "8675309" in detail


@pytest.mark.asyncio
async def test_a_failing_service_on_a_real_route_answers_the_generic_envelope(
    engine, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    import logging

    from httpx import ASGITransport

    import app.routers.todos as todos_router
    from app.main import app as shipped_app

    def boom(session, owner):
        raise RuntimeError(
            "SELECT id, description, owner FROM todo -- /srv/app/repository.py:42 sqlmodel 0.0.31"
        )

    monkeypatch.setattr(todos_router, "list_todos", boom)

    transport = ASGITransport(app=shipped_app, raise_app_exceptions=False)
    with caplog.at_level(logging.ERROR, logger="app.main"):
        async with AsyncClient(transport=transport, base_url="http://test") as http:
            response = await http.get("/api/todos")

    assert_generic_500_body(response)
    assert response.json()["message"] == "Internal server error"

    detail = assert_exception_was_logged(caplog, "/api/todos")
    assert "RuntimeError" in detail
    assert "SELECT id, description, owner FROM todo" in detail


def test_current_scope_is_unset_in_v1() -> None:
    from app.deps import current_scope

    assert current_scope() is None


@pytest.mark.asyncio
async def test_session_commits_on_success(error_client: AsyncClient, engine) -> None:
    from sqlmodel import Session, select

    from app.models import Todo

    async with error_client as http:
        response = await http.post("/api/probe/persist", json={"count": 7})

    assert response.status_code == 200

    with Session(engine) as session:
        rows = session.exec(select(Todo)).all()
    assert [row.description for row in rows] == ["7"]


def test_todo_read_serializes_camel_case_with_a_utc_offset() -> None:
    from datetime import UTC, datetime

    from app.schemas import TodoCreate, TodoRead

    read = TodoRead(
        id="7f9d0a3e-0000-4000-8000-000000000000",
        description="Buy groceries",
        completed=False,
        created_at=datetime(2026, 8, 29, 12, 30, 45, tzinfo=UTC),
    )

    assert set(read.model_dump(by_alias=True)) == {"id", "description", "completed", "createdAt"}
    assert '"createdAt":"2026-08-29T12:30:45Z"' in read.model_dump_json(by_alias=True)
    assert TodoCreate.model_validate({"description": "Reply to Marco"}).description == (
        "Reply to Marco"
    )


def test_naive_timestamps_are_stamped_utc() -> None:
    from datetime import UTC, datetime

    from app.schemas import TodoRead

    read = TodoRead(
        id="7f9d0a3e-0000-4000-8000-000000000000",
        description="Buy groceries",
        completed=False,
        created_at=datetime(2026, 8, 29, 12, 30, 45),
    )

    assert read.created_at.tzinfo is not None
    assert read.created_at.utcoffset() == datetime.now(UTC).utcoffset()
    assert read.model_dump_json(by_alias=True).endswith('"createdAt":"2026-08-29T12:30:45Z"}')


def test_persisted_timestamps_survive_the_round_trip_with_an_offset(engine) -> None:
    from sqlmodel import Session, select

    from app.models import Todo
    from app.schemas import TodoRead

    with Session(engine) as session:
        session.add(Todo(description="Fix the auth bug"))
        session.commit()

    with Session(engine) as session:
        row = session.exec(select(Todo)).one()

    assert row.created_at.tzinfo is None
    assert TodoRead.model_validate(row).model_dump_json(by_alias=True).count("Z") == 1


def test_init_db_is_idempotent(database_url: str, monkeypatch: pytest.MonkeyPatch) -> None:
    from sqlalchemy import inspect
    from sqlmodel import Session, create_engine, select

    import app.db as db
    from app.models import Todo

    fresh = create_engine(database_url, connect_args={"check_same_thread": False})
    monkeypatch.setattr(db, "engine", fresh)

    db.init_db()
    after_first = sorted(inspect(fresh).get_table_names())
    db.init_db()
    after_second = sorted(inspect(fresh).get_table_names())

    assert after_first == ["todo"]
    assert after_second == after_first

    with Session(fresh) as session:
        assert session.exec(select(Todo)).all() == []

    fresh.dispose()
