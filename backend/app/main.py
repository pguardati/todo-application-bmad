import logging
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db import init_db
from app.errors import AppError
from app.routers import health, todos

logger = logging.getLogger(__name__)


def configure_logging(debug: bool) -> None:
    logging.basicConfig(
        stream=sys.stdout,
        level=logging.DEBUG if debug else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        force=True,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.debug)

    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.code, "message": exc.message},
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={"error": "VALIDATION_ERROR", "message": "Invalid request."},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error while processing %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"error": "INTERNAL_ERROR", "message": "Internal server error"},
        )

    app.include_router(health.router, prefix="/api")
    app.include_router(todos.router, prefix="/api")
    return app


app = create_app()
