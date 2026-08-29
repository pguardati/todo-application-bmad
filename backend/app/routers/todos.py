from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlmodel import Session

from app.db import get_session
from app.deps import current_scope
from app.models import Todo
from app.schemas import TodoCreate, TodoRead, TodoUpdate
from app.services import create_todo, delete_todo, list_todos, set_completed

router = APIRouter(prefix="/todos", tags=["todos"])

SessionDep = Annotated[Session, Depends(get_session)]
OwnerDep = Annotated[str | None, Depends(current_scope)]


@router.get("", response_model=list[TodoRead])
def list_all(session: SessionDep, owner: OwnerDep) -> list[Todo]:
    return list_todos(session, owner)


@router.post("", response_model=TodoRead, status_code=201)
def create(payload: TodoCreate, session: SessionDep, owner: OwnerDep) -> Todo:
    return create_todo(session, payload.description, owner)


@router.patch("/{todo_id}", response_model=TodoRead)
def update(payload: TodoUpdate, todo_id: str, session: SessionDep, owner: OwnerDep) -> Todo:
    return set_completed(session, todo_id, payload.completed, owner)


@router.delete("/{todo_id}", status_code=204, response_class=Response)
def remove(todo_id: str, session: SessionDep, owner: OwnerDep) -> None:
    delete_todo(session, todo_id, owner)
