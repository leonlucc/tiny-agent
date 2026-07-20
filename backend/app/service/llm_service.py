"""LLM 客户端创建与流式调用服务。"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI


BACKEND_DIR = Path(__file__).resolve().parents[2]


def create_client() -> tuple[AsyncOpenAI, str]:
    """从 backend/.env 创建兼容 OpenAI 协议的 LLM 客户端，并返回模型名称。"""
    load_dotenv(BACKEND_DIR / ".env")

    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL")
    model = os.getenv("LLM_MODEL")

    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError("未配置 LLM_API_KEY，请先在 backend/.env 中填写 API Key。")
    if not base_url:
        raise RuntimeError("未配置 LLM_BASE_URL，请先在 backend/.env 中填写模型服务地址。")
    if not model:
        raise RuntimeError("未配置 LLM_MODEL，请先在 backend/.env 中填写模型名称。")

    return AsyncOpenAI(api_key=api_key, base_url=base_url), model


async def stream_chat_completion(message: str) -> AsyncIterator[str]:
    """调用 LLM 流式接口，并将增量文本转换为浏览器可读的 SSE。"""
    try:
        client, model = create_client()
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": message}],
            stream=True,
            timeout=30.0,
        )

        async for chunk in response:
            if not chunk.choices:
                continue

            delta = chunk.choices[0].delta
            if not delta:
                continue

            reasoning_content = getattr(delta, "reasoning_content", None)
            if reasoning_content:
                yield _sse_data({"type": "reasoning", "chunk": reasoning_content})

            content = delta.content or ""
            if content:
                yield _sse_data({"type": "content", "chunk": content})

        yield "data: [DONE]\n\n"
    except Exception as exc:
        yield _sse_data({"type": "error", "message": str(exc)})
        yield "data: [DONE]\n\n"


def _sse_data(payload: dict[str, str]) -> str:
    """将 JSON 对象包装成 SSE data 事件。"""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
