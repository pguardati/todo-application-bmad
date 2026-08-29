from sqlmodel import Session, col, select

from app.models import Todo


def check_connection(session: Session) -> None:
    session.exec(select(Todo.id).limit(1)).first()


def list_todos(session: Session, owner: str | None) -> list[Todo]:
    # `== owner` compiles to `IS NULL` for the v1 implicit owner and to `= :param` once
    # current_scope returns a real id (AD-15), so one expression serves both.
    statement = select(Todo).where(col(Todo.user_id) == owner).order_by(col(Todo.created_at).desc())
    return list(session.exec(statement).all())


def create_todo(session: Session, description: str, owner: str | None) -> Todo:
    todo = Todo(description=description, user_id=owner)
    session.add(todo)
    session.flush()
    session.refresh(todo)
    return todo


def get_todo(session: Session, todo_id: str, owner: str | None) -> Todo | None:
    statement = select(Todo).where(col(Todo.id) == todo_id, col(Todo.user_id) == owner)
    return session.exec(statement).first()


def update_completed(session: Session, todo: Todo, completed: bool) -> Todo:
    todo.completed = completed
    session.add(todo)
    session.flush()
    session.refresh(todo)
    return todo


def delete_todo(session: Session, todo: Todo) -> None:
    session.delete(todo)
