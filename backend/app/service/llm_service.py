"""LLM 客户端配置与流式调用服务。"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator
from openai import AsyncOpenAI


_client: AsyncOpenAI | None = None
_model: str = ""


def _load_config() -> tuple[str, str, str]:
    """从环境变量读取并校验 LLM 配置，纯函数不涉及任何状态。"""
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL")
    model = os.getenv("LLM_MODEL")

    if not api_key or api_key == "your_api_key_here":
        raise RuntimeError("未配置 LLM_API_KEY，请先在 backend/.env 中填写 API Key。")
    if not base_url:
        raise RuntimeError("未配置 LLM_BASE_URL，请先在 backend/.env 中填写模型服务地址。")
    if not model:
        raise RuntimeError("未配置 LLM_MODEL，请先在 backend/.env 中填写模型名称。")

    return api_key, base_url, model


async def init_client() -> None:
    """启动时调用：创建并缓存 AsyncOpenAI 客户端。"""
    global _client, _model
    api_key, base_url, model = _load_config()
    _client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    _model = model


async def stream_chat_events(
    message: str,
) -> AsyncIterator[dict[str, str]]:
    """调用 LLM 流式接口，并输出与传输协议无关的业务事件。"""
    assert _client is not None, "client 未初始化，请先调用 init_client()"
    response = await _client.chat.completions.create(
        model=_model,
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
    """关闭客户端连接（不涉及配置状态）。"""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
