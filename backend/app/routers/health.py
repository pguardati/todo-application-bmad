from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlmodel import Session

from app.db import get_session
from app.schemas import HealthRead
from app.services import check_health

router = APIRouter(tags=["health"])

SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/health", response_model=HealthRead)
def health(response: Response, session: SessionDep) -> dict[str, str]:
    payload = check_health(session)
    response.status_code = 200 if payload["database"] == "ok" else 503
    return payload
