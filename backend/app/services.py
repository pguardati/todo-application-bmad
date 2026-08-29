import logging

from sqlmodel import Session

from app import errors, repository
from app.models import Todo

logger = logging.getLogger(__name__)


def check_health(session: Session) -> dict[str, str]:
    try:
        repository.check_connection(session)
    except Exception:
        logger.exception("Health check database round-trip failed")
        session.rollback()
        return {"status": "error", "database": "error"}
    return {"status": "ok", "database": "ok"}


def list_todos(session: Session, owner: str | None) -> list[Todo]:
    return repository.list_todos(session, owner)


def create_todo(session: Session, description: str, owner: str | None) -> Todo:
    return repository.create_todo(session, description, owner)


def set_completed(session: Session, todo_id: str, completed: bool, owner: str | None) -> Todo:
    todo = repository.get_todo(session, todo_id, owner)
    if todo is None:
        raise errors.NotFoundError("Todo not found.")
    return repository.update_completed(session, todo, completed)


def delete_todo(session: Session, todo_id: str, owner: str | None) -> None:
    todo = repository.get_todo(session, todo_id, owner)
    if todo is None:
        raise errors.NotFoundError("Todo not found.")
    repository.delete_todo(session, todo)
