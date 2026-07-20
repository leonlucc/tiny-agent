"""Tiny Agent 后端接口。"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.service.llm_service import stream_chat_completion


router = APIRouter()


class ChatRequest(BaseModel):
    """浏览器发送给流式接口的最小消息结构。"""

    message: str


@router.get("/health")
def health() -> dict[str, str]:
    """用于前端检测后端服务是否可用。"""
    return {"status": "ok"}


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """接收单条用户消息，并以 SSE 形式返回 LLM 流式输出。"""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message 不能为空")

    return StreamingResponse(
        stream_chat_completion(message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
