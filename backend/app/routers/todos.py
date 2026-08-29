from typing import Annotated

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.deps import current_scope
from app.models import Todo
from app.schemas import TodoRead
from app.services import list_todos

router = APIRouter(prefix="/todos", tags=["todos"])

SessionDep = Annotated[Session, Depends(get_session)]
OwnerDep = Annotated[str | None, Depends(current_scope)]


@router.get("", response_model=list[TodoRead])
def list_all(session: SessionDep, owner: OwnerDep) -> list[Todo]:
    return list_todos(session, owner)
