"""LLM 服务相关测试。"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import app.services.llm_service as llm_service
from app.services.llm_service import close_client, init_client, stream_chat_events

pytestmark = pytest.mark.asyncio


class TestInitClient:
    @pytest.mark.asyncio
    async def test_init_client_creates_client_with_config(self, mocker) -> None:
        # Arrange
        mock_config = ("test-key", "http://test-url.com", "test-model")
        mocker.patch("app.services.llm_service.load_llm_config", return_value=mock_config)
        mock_openai = mocker.AsyncMock()
        mocker.patch("app.services.llm_service.AsyncOpenAI", return_value=mock_openai)

        # Act
        # Reset globals
        llm_service._client = None
        llm_service._model = ""
        await init_client()

        # Assert
        assert llm_service._client is mock_openai
        assert llm_service._model == "test-model"
        llm_service.AsyncOpenAI.assert_called_once_with(
            api_key="test-key", base_url="http://test-url.com"
        )

    @pytest.fixture(autouse=True)
    def reset_globals(self):
        # Reset state before each test
        llm_service._client = None
        llm_service._model = ""
        yield
        llm_service._client = None
        llm_service._model = ""


class TestCloseClient:
    @pytest.mark.asyncio
    async def test_close_client_closes_existing_client(self, mocker) -> None:
        # Arrange
        mock_client = mocker.AsyncMock()
        llm_service._client = mock_client

        # Act
        await close_client()

        # Assert
        mock_client.close.assert_awaited_once()
        assert llm_service._client is None

    @pytest.mark.asyncio
    async def test_close_client_does_nothing_when_no_client(self) -> None:
        # Arrange
        llm_service._client = None

        # Act
        await close_client()

        # Assert
        assert llm_service._client is None


class TestStreamChatEvents:
    @pytest.mark.asyncio
    async def test_stream_with_reasoning_and_content_returns_business_events(
        self, mocker
    ) -> None:
        # Arrange
        async def _response():
            delta = SimpleNamespace(reasoning_content="思考", content="回答")
            yield SimpleNamespace(choices=[SimpleNamespace(delta=delta)])

        create = mocker.AsyncMock(return_value=_response())
        client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(create=create),
            ),
        )
        messages = [
            {"role": "system", "content": "你是助手"},
            {"role": "user", "content": "你好"},
        ]
        mocker.patch("app.services.llm_service._client", client)
        mocker.patch("app.services.llm_service._model", "demo-model")

        # Act
        events = [item async for item in stream_chat_events(messages)]

        # Assert
        assert events == [
            {"type": "reasoning", "chunk": "思考"},
            {"type": "content", "chunk": "回答"},
        ]
        create.assert_awaited_once_with(
            model="demo-model",
            messages=messages,
            stream=True,
            timeout=30.0,
        )

    @pytest.mark.asyncio
    async def test_stream_raises_runtime_error_when_client_not_initialized(
        self, mocker
    ) -> None:
        # Arrange
        mocker.patch("app.services.llm_service._client", None)
        messages = [{"role": "user", "content": "你好"}]

        # Act & Assert
        with pytest.raises(RuntimeError, match="LLM 客户端尚未初始化"):
            async for _ in stream_chat_events(messages):
                pass

    @pytest.mark.asyncio
    async def test_stream_skips_chunks_without_choices(self, mocker) -> None:
        # Arrange
        async def _response():
            yield SimpleNamespace(choices=[])
            yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content="有效内容"))])

        create = mocker.AsyncMock(return_value=_response())
        client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(create=create),
            ),
        )
        mocker.patch("app.services.llm_service._client", client)
        mocker.patch("app.services.llm_service._model", "demo-model")

        # Act
        events = [item async for item in stream_chat_events([])]

        # Assert
        assert len(events) == 1
        assert events[0]["chunk"] == "有效内容"

    @pytest.mark.asyncio
    async def test_stream_handles_missing_delta_gracefully(self, mocker) -> None:
        # Arrange
        async def _response():
            yield SimpleNamespace(choices=[SimpleNamespace(delta=None)])

        create = mocker.AsyncMock(return_value=_response())
        client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(create=create),
            ),
        )
        mocker.patch("app.services.llm_service._client", client)
        mocker.patch("app.services.llm_service._model", "demo-model")

        # Act
        events = [item async for item in stream_chat_events([])]

        # Assert
        assert len(events) == 0

    @pytest.mark.asyncio
    async def test_stream_yields_content_when_reasoning_is_empty(self, mocker) -> None:
        # Arrange
        async def _response():
            delta = SimpleNamespace(reasoning_content="", content="只有内容")
            yield SimpleNamespace(choices=[SimpleNamespace(delta=delta)])

        create = mocker.AsyncMock(return_value=_response())
        client = SimpleNamespace(
            chat=SimpleNamespace(
                completions=SimpleNamespace(create=create),
            ),
        )
        mocker.patch("app.services.llm_service._client", client)
        mocker.patch("app.services.llm_service._model", "demo-model")

        # Act
        events = [item async for item in stream_chat_events([])]

        # Assert
        assert len(events) == 1
        assert events[0] == {"type": "content", "chunk": "只有内容"}

