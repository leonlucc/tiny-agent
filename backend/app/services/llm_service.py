"""LLM 客户端管理与流式调用服务。"""

from __future__ import annotations

from collections.abc import AsyncIterator
from openai import AsyncOpenAI
from app.config import load_llm_config


_client: AsyncOpenAI | None = None
_model: str = ""


async def init_client() -> None:
    """启动时调用：创建并缓存 AsyncOpenAI 客户端。"""
    global _client, _model
    api_key, base_url, model = load_llm_config()
    _client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    _model = model


async def stream_chat_events(
    messages: list[dict[str, str]],
) -> AsyncIterator[dict[str, str]]:
    """携带完整消息历史调用 LLM，并输出与传输协议无关的业务事件。"""
    if _client is None:
        raise RuntimeError("LLM 客户端尚未初始化")
    response = await _client.chat.completions.create(
        model=_model,
        messages=messages,
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
    """关闭客户端连接（不涉及配置状态）。"""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
