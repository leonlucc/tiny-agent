"""Tiny Agent 后端接口。"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.llm_service import stream_chat_events
from app.services.session_service import Message, session_service


logger = logging.getLogger(__name__)

router = APIRouter()


class ChatRequest(BaseModel):
    """发送消息时必须指定它所属的会话。"""

    session_id: str
    message: str


class UpdateSessionRequest(BaseModel):
    """会话重命名请求。"""

    name: str


@router.get("/health")
async def health() -> dict[str, str]:
    """用于前端检测后端服务是否可用。"""
    return {"status": "ok"}


@router.get("/sessions")
async def list_sessions() -> list[dict[str, object]]:
    """获取会话列表。"""
    sessions = await session_service.list_sessions()
    return [session.to_dict() for session in sessions]


@router.post("/sessions", status_code=201)
async def create_session() -> dict[str, object]:
    """创建一个带 System 消息的新会话。"""
    session = await session_service.create_session()
    return session.to_dict()


@router.get("/sessions/{session_id}")
async def get_session(session_id: str) -> dict[str, object]:
    """获取指定会话及其完整消息历史。"""
    session = await session_service.get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session.to_dict()


@router.put("/sessions/{session_id}")
async def update_session(
    session_id: str, payload: UpdateSessionRequest
) -> dict[str, object]:
    """重命名指定会话。"""
    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="缺少 name 参数")

    session = await session_service.rename_session(session_id, new_name)
    if session is None:
        raise HTTPException(status_code=404, detail="会话不存在")
    return session.to_dict()


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str) -> dict[str, bool]:
    """删除指定会话。"""
    if not await session_service.delete_session(session_id):
        raise HTTPException(status_code=404, detail="会话不存在")
    return {"success": True}


@router.post("/chat/stream")
async def chat_stream(request: ChatRequest) -> StreamingResponse:
    """把用户消息加入历史，并以 SSE 形式返回和保存 Assistant 回复。"""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="message 不能为空")

    session = await session_service.get_session(request.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="会话不存在")

    await session_service.add_message(
        request.session_id,
        Message(role="user", content=message),
    )
    messages = [item.to_llm_dict() for item in session.messages]

    return StreamingResponse(
        _stream_sse(
            stream_chat_events(messages),
            session_id=request.session_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_sse(
    events: AsyncIterator[dict[str, str]],
    session_id: str | None = None,
) -> AsyncIterator[str]:
    """编码 SSE；流正常结束后，把片段合并为一条 Assistant 历史消息。"""
    content_parts: list[str] = []
    reasoning_parts: list[str] = []
    try:
        async for event in events:
            if event.get("type") == "content":
                content_parts.append(event.get("chunk", ""))
            elif event.get("type") == "reasoning":
                reasoning_parts.append(event.get("chunk", ""))
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
    except Exception:
        logger.exception("LLM 流式调用失败")
        error = {"type": "error", "message": "模型服务暂时不可用，请稍后重试。"}
        yield f"data: {json.dumps(error, ensure_ascii=False)}\n\n"
    else:
        if session_id is not None:
            await session_service.add_message(
                session_id,
                Message(
                    role="assistant",
                    content="".join(content_parts),
                    reasoning="".join(reasoning_parts) or None,
                ),
            )

    yield "data: [DONE]\n\n"
