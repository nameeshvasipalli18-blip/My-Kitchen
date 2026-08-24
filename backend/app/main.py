from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.migrations import run_migrations
from app.routers.auth import router as auth_router
from app.routers.bills import router as bills_router
from app.routers.kitchens import router as kitchens_router
from app.routers.receipt import router as receipt_router


def create_app() -> FastAPI:
    run_migrations()
    app = FastAPI(title="My Kitchen API")
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    frontend_url = os.getenv("FRONTEND_URL")
    if frontend_url:
        origins.append(frontend_url.rstrip("/"))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=(
            r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
            r"|https://my-kitchen-[a-z0-9-]+\.vercel\.app"
        ),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    def root():
        return {"message": "My Kitchen API"}

    app.include_router(auth_router)
    app.include_router(kitchens_router)
    app.include_router(bills_router)
    app.include_router(receipt_router)
    return app


app = create_app()
