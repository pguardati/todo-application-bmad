import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class Todo(SQLModel, table=True):
    __tablename__ = "todo"

    id: str = Field(default_factory=_new_id, primary_key=True)
    description: str
    completed: bool = Field(default=False)
    created_at: datetime = Field(default_factory=_now)
    user_id: str | None = Field(default=None, index=True)
