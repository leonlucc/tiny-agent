"""LLM 客户端配置与流式调用服务。"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from openai import AsyncOpenAI


BACKEND_DIR = Path(__file__).resolve().parents[2]

_client: Optional[AsyncOpenAI] = None
_model: Optional[str] = None


def _get_client() -> tuple[AsyncOpenAI, str]:
    """延迟初始化客户端，从环境变量读取配置。"""
    global _client, _model

    if _client is not None and _model is not None:
        return _client, _model

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

    _client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    _model = model
    return _client, _model


async def stream_chat_events(
    message: str,
) -> AsyncIterator[dict[str, str]]:
    """调用 LLM 流式接口，并输出与传输协议无关的业务事件。"""
    client, model = _get_client()
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
            yield {"type": "reasoning", "chunk": reasoning_content}

        content = delta.content or ""
        if content:
            yield {"type": "content", "chunk": content}


async def close_client() -> None:
    """关闭客户端连接。"""
    global _client, _model
    if _client is not None:
        await _client.close()
        _client = None
        _model = None
