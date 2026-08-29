from collections.abc import Iterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import create_engine

import app.db as db
from app.main import app as fastapi_app


@pytest.fixture
def database_url(tmp_path) -> str:
    return f"sqlite:///{tmp_path / 'test.db'}"


@pytest.fixture
def engine(database_url: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[object]:
    test_engine = create_engine(database_url, connect_args={"check_same_thread": False})
    monkeypatch.setattr(db, "engine", test_engine)
    db.init_db()
    yield test_engine
    test_engine.dispose()


@pytest.fixture
async def client(engine) -> Iterator[AsyncClient]:
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
