"""会话服务：用内存数据结构管理多轮对话历史。"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal


DATE_FORMAT = "%Y%m%d%H%M%S"
DEFAULT_MAX_MESSAGES = max(
    1,
    int(os.getenv("MAX_MESSAGES_PER_SESSION", "100")),
)
SYSTEM_PROMPT = "你是 Tiny Agent，一个简洁、友好的 AI 助手。"
MessageRole = Literal["system", "user", "assistant"]


@dataclass
class Message:
    """一条符合 LLM Message Protocol 的消息。"""

    role: MessageRole
    content: str
    reasoning: str | None = None

    def to_dict(self) -> dict[str, str | None]:
        return {
            "role": self.role,
            "content": self.content,
            "reasoning": self.reasoning,
        }

    def to_llm_dict(self) -> dict[str, str]:
        """模型只需要 role 和 content，reasoning 仅用于历史展示。"""
        return {"role": self.role, "content": self.content}


@dataclass
class ChatSession:
    """一个会话及其按时间排列的消息历史。"""

    session_id: str
    session_name: str
    created_at: str
    messages: list[Message] = field(default_factory=list)

    def to_summary_dict(self) -> dict[str, str]:
        """返回会话列表所需的摘要字段。"""
        return {
            "session_id": self.session_id,
            "session_name": self.session_name,
            "created_at": self.created_at,
        }

    def to_dict(self) -> dict[str, object]:
        return {
            **self.to_summary_dict(),
            "messages": [message.to_dict() for message in self.messages],
        }


class SessionService:
    """管理会话的创建、查询、重命名、删除和消息追加。"""

    def __init__(self) -> None:
        self.sessions: dict[str, ChatSession] = {}
        self._counter = 0

    async def create_session(self) -> ChatSession:
        create_time = datetime.now().strftime(DATE_FORMAT)
        self._counter += 1
        session = ChatSession(
            session_id=f"session_{create_time}_{self._counter}",
            session_name=f"新对话-{self._counter}",
            created_at=create_time,
            messages=[Message(role="system", content=SYSTEM_PROMPT)],
        )
        self.sessions[session.session_id] = session
        return session

    async def get_session(self, session_id: str) -> ChatSession | None:
        return self.sessions.get(session_id)

    async def list_sessions(self) -> list[ChatSession]:
        return sorted(
            self.sessions.values(),
            key=lambda session: session.created_at,
            reverse=True,
        )

    async def rename_session(
        self, session_id: str, new_name: str
    ) -> ChatSession | None:
        session = self.sessions.get(session_id)
        if session is None:
            return None
        session.session_name = new_name
        return session

    async def delete_session(self, session_id: str) -> bool:
        return self.sessions.pop(session_id, None) is not None

    async def add_messages(
        self,
        session_id: str,
        messages: list[Message],
    ) -> bool:
        """一次追加同一轮中的多条消息，并统一裁剪历史。"""
        session = self.sessions.get(session_id)
        if session is None:
            return False

        session.messages.extend(messages)
        if len(session.messages) > DEFAULT_MAX_MESSAGES:
            first_message = session.messages[0]
            if first_message.role == "system" and DEFAULT_MAX_MESSAGES > 1:
                recent_start = -(DEFAULT_MAX_MESSAGES - 1)
                session.messages = [
                    first_message,
                    *session.messages[recent_start:],
                ]
            else:
                session.messages = session.messages[-DEFAULT_MAX_MESSAGES:]
        return True


session_service = SessionService()
