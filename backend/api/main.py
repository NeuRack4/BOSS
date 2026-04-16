from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.core.config import get_settings
from backend.api.routers import health, founders, triggers, drafts, subsidies, tax, location, sales, insights, rag, pdf_forms, expenses, marketing, ocr, menus, sales_items, map as map_router, recommend, hire, menu_analysis
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
        version="0.14.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 미처리 예외(500)도 CORS 헤더를 포함하도록 글로벌 핸들러 등록
    # FastAPI CORSMiddleware가 500 응답에 헤더를 누락하는 경우 방어
    origins_set = set(settings.cors_origins)

    @app.exception_handler(Exception)
    async def _global_exc_handler(request: Request, exc: Exception):
        origin = request.headers.get("origin", "")
        cors_origin = origin if origin in origins_set else (settings.cors_origins[0] if settings.cors_origins else "*")
        return JSONResponse(
            status_code=500,
            content={"detail": f"내부 서버 오류: {type(exc).__name__}"},
            headers={
                "Access-Control-Allow-Origin": cors_origin,
                "Access-Control-Allow-Credentials": "true",
            },
        )

    app.include_router(health.router, tags=["health"])
    app.include_router(founders.router, prefix="/founders", tags=["founders"])
    app.include_router(triggers.router, prefix="/triggers", tags=["triggers"])
    app.include_router(drafts.router, prefix="/drafts", tags=["drafts"])
    app.include_router(subsidies.router, prefix="/subsidies", tags=["subsidies"])
    app.include_router(tax.router, prefix="/tax", tags=["tax"])
    app.include_router(location.router, prefix="/location", tags=["location"])
    app.include_router(sales.router, prefix="/sales", tags=["sales"])
    app.include_router(insights.router, prefix="/insights", tags=["insights"])
    app.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
    app.include_router(marketing.router, prefix="/marketing", tags=["marketing"])
    app.include_router(ocr.router, prefix="/ocr", tags=["ocr"])
    app.include_router(menus.router, prefix="/menus", tags=["menus"])
    app.include_router(sales_items.router, prefix="/sales-items", tags=["sales-items"])
    app.include_router(map_router.router, prefix="/map", tags=["map"])
    app.include_router(recommend.router, prefix="/recommend", tags=["recommend"])
    app.include_router(rag.router, prefix="/rag", tags=["rag"])
    app.include_router(hire.router, prefix="/hire", tags=["hire"])
    app.include_router(menu_analysis.router, prefix="/menu-analysis", tags=["menu-analysis"])
    app.include_router(pdf_forms.router)  # prefix="/drafts" 내부 정의

    return app


app = create_app()
