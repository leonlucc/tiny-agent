"""会话 REST API 与多轮消息历史测试。"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.api.endpoint import router
from app.services.session_service import session_service


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    session_service.sessions.clear()
    session_service._counter = 0
    app = FastAPI()
    app.include_router(router, prefix="/api")
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as test_client:
        yield test_client
    session_service.sessions.clear()


async def _create_session(client: AsyncClient) -> dict[str, object]:
    response = await client.post("/api/sessions")
    return response.json()


class TestSessionApi:
    @pytest.mark.asyncio
    async def test_create_session_returns_system_message(
        self, client: AsyncClient
    ) -> None:
        # Arrange
        endpoint = "/api/sessions"

        # Act
        response = await client.post(endpoint)

        # Assert
        assert response.status_code == 201
        assert response.json()["messages"][0]["role"] == "system"

    @pytest.mark.asyncio
    async def test_list_sessions_returns_created_session(
        self, client: AsyncClient
    ) -> None:
        # Arrange
        session = await _create_session(client)

        # Act
        response = await client.get("/api/sessions")

        # Assert
        assert response.status_code == 200
        assert [item["session_id"] for item in response.json()] == [
            session["session_id"]
        ]

    @pytest.mark.asyncio
    async def test_update_session_with_valid_name_returns_renamed_session(
        self, client: AsyncClient
    ) -> None:
        # Arrange
        session = await _create_session(client)
        session_id = session["session_id"]

        # Act
        response = await client.put(
            f"/api/sessions/{session_id}",
            json={"name": "学习 Message Protocol"},
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["session_name"] == "学习 Message Protocol"

    @pytest.mark.asyncio
    async def test_update_session_with_blank_name_returns_bad_request(
        self, client: AsyncClient
    ) -> None:
        # Arrange
        session = await _create_session(client)
        session_id = session["session_id"]

        # Act
        response = await client.put(
            f"/api/sessions/{session_id}",
            json={"name": "   "},
        )

        # Assert
        assert response.status_code == 400
        assert response.json()["detail"] == "缺少 name 参数"

    @pytest.mark.asyncio
    async def test_delete_existing_session_removes_session(
        self, client: AsyncClient
    ) -> None:
        # Arrange
        session = await _create_session(client)
        session_id = session["session_id"]

        # Act
        delete_response = await client.delete(f"/api/sessions/{session_id}")
        get_response = await client.get(f"/api/sessions/{session_id}")

        # Assert
        assert delete_response.status_code == 200
        assert delete_response.json() == {"success": True}
        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_chat_with_history_sends_messages_and_saves_assistant(
        self, client: AsyncClient, mocker
    ) -> None:
        # Arrange
        session = await _create_session(client)
        session_id = session["session_id"]
        received_calls: list[list[dict[str, str]]] = []

        async def _fake_stream(messages: list[dict[str, str]]):
            received_calls.append(messages)
            yield {"type": "reasoning", "chunk": "先理解上下文"}
            yield {"type": "content", "chunk": "这是"}
            yield {"type": "content", "chunk": "连续回复"}

        mocker.patch(
            "app.api.endpoint.stream_chat_events",
            new=_fake_stream,
        )

        # Act
        first_response = await client.post(
            "/api/chat/stream",
            json={
                "session_id": session_id,
                "message": "介绍 Message Protocol",
            },
        )
        second_response = await client.post(
            "/api/chat/stream",
            json={"session_id": session_id, "message": "继续刚才的话题"},
        )
        history_response = await client.get(f"/api/sessions/{session_id}")

        # Assert
        assert first_response.status_code == 200
        assert second_response.status_code == 200
        assert [message["role"] for message in received_calls[1]] == [
            "system",
            "user",
            "assistant",
            "user",
        ]
        events = [
            json.loads(line.removeprefix("data: "))
            for line in second_response.text.splitlines()
            if line.startswith("data: {")
        ]
        assert events[-1] == {"type": "content", "chunk": "连续回复"}

        history = history_response.json()
        assert [message["role"] for message in history["messages"]] == [
            "system",
            "user",
            "assistant",
            "user",
            "assistant",
        ]
        assert history["messages"][-1]["content"] == "这是连续回复"
        assert history["messages"][-1]["reasoning"] == "先理解上下文"

    @pytest.mark.asyncio
    async def test_chat_with_unknown_session_returns_not_found(
        self, client: AsyncClient
    ) -> None:
        # Arrange
        request = {"session_id": "missing", "message": "你好"}

        # Act
        response = await client.post("/api/chat/stream", json=request)

        # Assert
        assert response.status_code == 404
        assert response.json()["detail"] == "会话不存在"
