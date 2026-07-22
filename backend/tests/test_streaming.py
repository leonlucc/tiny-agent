"""流式对话核心链路的回归测试。"""

from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.api.endpoint import _stream_sse
from app.service.llm_service import stream_chat_events


async def collect(iterator):
    return [item async for item in iterator]


class StreamChatEventsTest(unittest.IsolatedAsyncioTestCase):
    async def test_maps_reasoning_and_content_to_business_events(self) -> None:
        async def response():
            delta = SimpleNamespace(reasoning_content="思考", content="回答")
            yield SimpleNamespace(choices=[SimpleNamespace(delta=delta)])

        create = AsyncMock(return_value=response())
        client = SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(create=create)),
            close=AsyncMock(),
        )

        with patch(
            "app.service.llm_service.create_client",
            return_value=(client, "demo-model"),
        ):
            events = await collect(stream_chat_events("你好"))

        self.assertEqual(
            events,
            [
                {"type": "reasoning", "chunk": "思考"},
                {"type": "content", "chunk": "回答"},
            ],
        )
        create.assert_awaited_once_with(
            model="demo-model",
            messages=[{"role": "user", "content": "你好"}],
            stream=True,
            timeout=30.0,
        )
        client.close.assert_awaited_once()


class StreamSseTest(unittest.IsolatedAsyncioTestCase):
    async def test_encodes_events_and_sends_done_once(self) -> None:
        async def events():
            yield {"type": "content", "chunk": "你好"}

        chunks = await collect(_stream_sse(events()))

        self.assertEqual(json.loads(chunks[0][6:]), {"type": "content", "chunk": "你好"})
        self.assertEqual(chunks.count("data: [DONE]\n\n"), 1)

    async def test_hides_internal_error_and_still_finishes(self) -> None:
        async def events():
            yield {"type": "content", "chunk": "部分内容"}
            raise RuntimeError("secret upstream detail")

        with self.assertLogs("app.api.endpoint", level="ERROR"):
            chunks = await collect(_stream_sse(events()))

        output = "".join(chunks)
        self.assertNotIn("secret upstream detail", output)
        self.assertIn("模型服务暂时不可用", output)
        self.assertEqual(chunks.count("data: [DONE]\n\n"), 1)


if __name__ == "__main__":
    unittest.main()
