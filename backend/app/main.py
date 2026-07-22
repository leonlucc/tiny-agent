"""Tiny Agent 运行入口，负责创建并启动 Web 服务。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.endpoint import router
from app.service.llm_service import close_client

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """管理应用生命周期，在关闭时清理资源。"""
    yield
    await close_client()

def create_app() -> FastAPI:
    """创建 FastAPI 应用，注册接口路由并托管前端静态页面。"""
    app = FastAPI(title="Tiny Agent", lifespan=lifespan)
    app.include_router(router, prefix="/api")
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
    return app

def main() -> None:
    """启动本地 Web 服务。"""
    app = create_app()
    uvicorn.run(app, host="0.0.0.0", port=8000)

if __name__ == "__main__":
    main()
