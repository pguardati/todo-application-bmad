from datetime import datetime

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from sqlmodel import SQLModel

DESCRIPTION_MAX_LENGTH = 200


class ApiSchema(SQLModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class TodoCreate(ApiSchema):
    description: str


class TodoRead(ApiSchema):
    id: str
    description: str
    completed: bool
    created_at: datetime


class HealthRead(ApiSchema):
    status: str
    database: str
