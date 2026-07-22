"""Tiny Agent 后端接口。"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.service.llm_service import stream_chat_events

router = APIRouter()

class ChatRequest(BaseModel):
    """浏览器发送给流式接口的最小消息结构。"""
    message: str


@router.get("/health")
async def health() -> dict[str, str]:
    """用于前端检测后端服务是否可用。"""
    return {"status": "ok"}


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """接收单条用户消息，并以 SSE 形式返回 LLM 流式输出。"""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message 不能为空")

    return StreamingResponse(
        _stream_sse(stream_chat_events(message)),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_sse(events: AsyncIterator[dict[str, str]]) -> AsyncIterator[str]:
    """将业务事件编码为 SSE，并统一处理流式接口异常与结束标记。"""
    try:
        async for event in events:
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    except Exception:
        print("LLM 流式调用失败")
        error = {"type": "error", "message": "模型服务暂时不可用，请稍后重试。"}
        yield f"data: {json.dumps(error, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
