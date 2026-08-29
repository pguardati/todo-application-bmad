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

    @probe_app.get("/api/probe/boom")
    def boom(session: Annotated[Session, Depends(get_session)]) -> None:
        session.add(Todo(description="uncommitted"))
        raise RuntimeError("kaboom")

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


def test_current_scope_is_unset_in_v1() -> None:
    from app.deps import current_scope

    assert current_scope() is None
