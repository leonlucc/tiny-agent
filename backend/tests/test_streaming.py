"""流式对话核心链路的回归测试。"""

from __future__ import annotations

import json
import logging
from types import SimpleNamespace

import pytest

from app.api.endpoint import _stream_sse
from app.services.llm_service import stream_chat_events


async def _collect(iterator):
    return [item async for item in iterator]


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
        events = await _collect(stream_chat_events(messages))

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


class TestStreamSse:
    @pytest.mark.asyncio
    async def test_stream_with_events_encodes_data_and_sends_done_once(
        self,
    ) -> None:
        # Arrange
        async def _events():
            yield {"type": "content", "chunk": "你好"}

        # Act
        chunks = await _collect(_stream_sse(_events()))

        # Assert
        assert json.loads(chunks[0][6:]) == {
            "type": "content",
            "chunk": "你好",
        }
        assert chunks.count("data: [DONE]\n\n") == 1

    @pytest.mark.asyncio
    async def test_stream_with_internal_error_hides_detail_and_sends_done(
        self, caplog
    ) -> None:
        # Arrange
        async def _events():
            yield {"type": "content", "chunk": "部分内容"}
            raise RuntimeError("secret upstream detail")

        # Act
        with caplog.at_level(logging.ERROR, logger="app.api.endpoint"):
            chunks = await _collect(_stream_sse(_events()))

        # Assert
        output = "".join(chunks)
        assert "secret upstream detail" not in output
        assert "模型服务暂时不可用" in output
        assert chunks.count("data: [DONE]\n\n") == 1

    @pytest.mark.asyncio
    async def test_stream_without_response_returns_error(self) -> None:
        # Arrange
        async def _events():
            if False:
                yield

        # Act
        chunks = await _collect(_stream_sse(_events()))

        # Assert
        output = "".join(chunks)
        assert "模型未返回有效回复" in output
        assert chunks.count("data: [DONE]\n\n") == 1
