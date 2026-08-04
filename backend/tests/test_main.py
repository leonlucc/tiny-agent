"""`app.main` 模块单元测试。"""

from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import app.main as main_module


class TestLifespan:
    async def test_lifespan_initializes_and_closes_client(self, mocker) -> None:
        # Arrange
        mock_init = mocker.AsyncMock()
        mock_close = mocker.AsyncMock()
        mocker.patch.object(main_module, "init_client", mock_init)
        mocker.patch.object(main_module, "close_client", mock_close)

        # Act
        app = FastAPI()
        # Manually iterate the async generator
        agen = main_module.lifespan(app)
        # Start the lifespan
        await agen.__anext__()
        # Close the lifespan (should trigger finally block)
        await agen.aclose()

        # Assert
        mock_init.assert_awaited_once()
        mock_close.assert_awaited_once()


class TestCreateApp:
    def test_create_app_returns_configured_fastapi_app(self, mocker) -> None:
        # Arrange
        # We mock the lifespan to avoid actual LLM client init/close
        # and mock the router to test if it's included
        mock_init = mocker.AsyncMock()
        mock_close = mocker.AsyncMock()
        mocker.patch.object(main_module, "init_client", mock_init)
        mocker.patch.object(main_module, "close_client", mock_close)

        # Act
        app = main_module.create_app()

        # Assert
        assert isinstance(app, FastAPI)
        assert app.title == "Tiny Agent"
        
        # Check if routes are registered
        # Use a recursive approach to find all routes
        def get_all_routes(routes, prefix=""):
            all_routes = []
            for route in routes:
                if hasattr(route, 'original_router'):
                    # It's an _IncludedRouter, get the original APIRouter
                    original_router = route.original_router
                    # Get the prefix from include_context
                    route_prefix = getattr(route.include_context, 'prefix', '')
                    if hasattr(original_router, 'routes'):
                        all_routes.extend(get_all_routes(original_router.routes, prefix + route_prefix))
                elif hasattr(route, 'routes'):
                    # It's an APIRouter or Mount with nested routes
                    route_prefix = getattr(route, 'path', '') or getattr(route, 'prefix', '')
                    all_routes.extend(get_all_routes(route.routes, prefix + route_prefix))
                elif hasattr(route, 'path'):
                    # It's a Route
                    all_routes.append(prefix + route.path)
            return all_routes

        route_paths = get_all_routes(app.routes)
                
        assert "/api/health" in route_paths
        assert "/api/sessions" in route_paths


class TestMain:
    def test_main_creates_app_and_runs_uvicorn(self, mocker) -> None:
        # Arrange
        mock_create_app = mocker.patch.object(main_module, "create_app")
        mock_uvicorn_run = mocker.patch("app.main.uvicorn.run")
        
        mock_app = mocker.MagicMock()
        mock_create_app.return_value = mock_app

        # Act
        main_module.main()

        # Assert
        mock_create_app.assert_called_once()
        mock_uvicorn_run.assert_called_once_with(mock_app, host="0.0.0.0", port=8000)
