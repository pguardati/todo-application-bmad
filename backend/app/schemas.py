from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import SQLModel

DESCRIPTION_MAX_LENGTH = 200


def _as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _normalize_description(value: str) -> str:
    trimmed = value.strip()
    if not 1 <= len(trimmed) <= DESCRIPTION_MAX_LENGTH:
        raise ValueError(f"Description must be 1-{DESCRIPTION_MAX_LENGTH} characters.")
    return trimmed


# SQLite drops tzinfo on the round-trip, so naive values are stamped back to UTC (AD-3).
UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]
Description = Annotated[str, AfterValidator(_normalize_description)]


class ApiSchema(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TodoCreate(ApiSchema):
    description: Description


class TodoRead(ApiSchema):
    id: str
    description: str
    completed: bool
    created_at: UtcDatetime


class HealthRead(ApiSchema):
    status: str
    database: str
