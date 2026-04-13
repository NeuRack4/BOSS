from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import get_settings
from backend.api.routers import health, founders, triggers, drafts, subsidies, tax, location, sales
from backend.triggers.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="BOSS API",
        description="Business Operations Support System — Proactive AI 비서",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["health"])
    app.include_router(founders.router, prefix="/founders", tags=["founders"])
    app.include_router(triggers.router, prefix="/triggers", tags=["triggers"])
    app.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
    app.include_router(subsidies.router, prefix="/subsidies", tags=["subsidies"])
    app.include_router(tax.router, prefix="/tax", tags=["tax"])
    app.include_router(location.router, prefix="/location", tags=["location"])
    app.include_router(sales.router, prefix="/sales", tags=["sales"])

    return app


app = create_app()
