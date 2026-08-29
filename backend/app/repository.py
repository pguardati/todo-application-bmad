from sqlmodel import Session, col, select

from app.models import Todo


def check_connection(session: Session) -> None:
    session.exec(select(Todo.id).limit(1)).first()


def list_todos(session: Session, owner: str | None) -> list[Todo]:
    # `== owner` compiles to `IS NULL` for the v1 implicit owner and to `= :param` once
    # current_scope returns a real id (AD-15), so one expression serves both.
    statement = select(Todo).where(col(Todo.user_id) == owner).order_by(col(Todo.created_at).desc())
    return list(session.exec(statement).all())
