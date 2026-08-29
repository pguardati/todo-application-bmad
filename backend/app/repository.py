from sqlmodel import Session, select

from app.models import Todo


def check_connection(session: Session) -> None:
    session.exec(select(Todo.id).limit(1)).first()
