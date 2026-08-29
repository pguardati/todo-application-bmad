import logging

from sqlmodel import Session

from app import repository
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
