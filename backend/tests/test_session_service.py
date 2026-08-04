"""`app.services.session_service` 模块单元测试。"""

from __future__ import annotations

import pytest

from app.services.session_service import (
    DEFAULT_MAX_MESSAGES,
    ChatSession,
    Message,
    SessionService,
)

pytestmark = pytest.mark.asyncio


class TestMessage:
    def test_to_dict_returns_correct_structure(self) -> None:
        # Arrange
        message = Message(role="user", content="Hello", reasoning="Thought")

        # Act
        result = message.to_dict()

        # Assert
        assert result == {"role": "user", "content": "Hello", "reasoning": "Thought"}

    def test_to_llm_dict_excludes_reasoning(self) -> None:
        # Arrange
        message = Message(role="assistant", content="Hi", reasoning="Thought")

        # Act
        result = message.to_llm_dict()

        # Assert
        assert result == {"role": "assistant", "content": "Hi"}


class TestChatSession:
    def test_to_summary_dict_returns_no_messages(self) -> None:
        # Arrange
        session = ChatSession(
            session_id="test-id",
            session_name="Test Session",
            created_at="20230101000000",
        )

        # Act
        result = session.to_summary_dict()

        # Assert
        assert result == {
            "session_id": "test-id",
            "session_name": "Test Session",
            "created_at": "20230101000000",
        }
        assert "messages" not in result

    def test_to_dict_includes_messages(self) -> None:
        # Arrange
        messages = [Message(role="user", content="Hello")]
        session = ChatSession(
            session_id="test-id",
            session_name="Test Session",
            created_at="20230101000000",
            messages=messages,
        )

        # Act
        result = session.to_dict()

        # Assert
        assert result["messages"] == [{"role": "user", "content": "Hello", "reasoning": None}]


class TestSessionService:
    @pytest.fixture
    def service(self) -> SessionService:
        return SessionService()

    @pytest.mark.asyncio
    async def test_create_session_initializes_correctly(self, service: SessionService) -> None:
        # Act
        session = await service.create_session()

        # Assert
        assert session.session_name == "新对话-1"
        assert len(session.messages) == 1
        assert session.messages[0].role == "system"
        assert session.session_id in service.sessions

    @pytest.mark.asyncio
    async def test_get_session_returns_existing_session(self, service: SessionService) -> None:
        # Arrange
        created = await service.create_session()

        # Act
        session = await service.get_session(created.session_id)

        # Assert
        assert session is not None
        assert session.session_id == created.session_id

    @pytest.mark.asyncio
    async def test_get_session_returns_none_for_missing_session(self, service: SessionService) -> None:
        # Act
        session = await service.get_session("non-existent-id")

        # Assert
        assert session is None

    @pytest.mark.asyncio
    async def test_list_sessions_returns_sorted_by_created_at_desc(self, service: SessionService) -> None:
        # Arrange
        session1 = await service.create_session()
        # Add a small delay to ensure different timestamps (since format is second-level)
        import asyncio
        await asyncio.sleep(1.1)
        session2 = await service.create_session()

        # Act
        sessions = await service.list_sessions()

        # Assert
        assert len(sessions) == 2
        # session2 should be first because it was created later
        assert sessions[0].session_id == session2.session_id
        assert sessions[1].session_id == session1.session_id

    @pytest.mark.asyncio
    async def test_rename_session_returns_renamed_session(self, service: SessionService) -> None:
        # Arrange
        session = await service.create_session()

        # Act
        renamed = await service.rename_session(session.session_id, "New Name")

        # Assert
        assert renamed is not None
        assert renamed.session_name == "New Name"

    @pytest.mark.asyncio
    async def test_rename_session_returns_none_for_missing_session(self, service: SessionService) -> None:
        # Act
        result = await service.rename_session("non-existent", "Name")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_session_returns_true_on_success(self, service: SessionService) -> None:
        # Arrange
        session = await service.create_session()

        # Act
        deleted = await service.delete_session(session.session_id)

        # Assert
        assert deleted is True
        assert session.session_id not in service.sessions

    @pytest.mark.asyncio
    async def test_delete_session_returns_false_for_missing_session(self, service: SessionService) -> None:
        # Act
        deleted = await service.delete_session("non-existent")

        # Assert
        assert deleted is False

    @pytest.mark.asyncio
    async def test_add_messages_appends_to_session(self, service: SessionService) -> None:
        # Arrange
        session = await service.create_session()
        new_messages = [Message(role="user", content="Hello")]

        # Act
        success = await service.add_messages(session.session_id, new_messages)

        # Assert
        assert success is True
        retrieved = await service.get_session(session.session_id)
        assert len(retrieved.messages) == 2

    @pytest.mark.asyncio
    async def test_add_messages_returns_false_for_missing_session(self, service: SessionService) -> None:
        # Arrange
        new_messages = [Message(role="user", content="Hello")]

        # Act
        success = await service.add_messages("non-existent", new_messages)

        # Assert
        assert success is False

    @pytest.mark.asyncio
    async def test_add_messages_trims_history_when_exceeding_max(self, service: SessionService, monkeypatch) -> None:
        # Arrange
        # Set a small max messages to test trimming
        monkeypatch.setattr("app.services.session_service.DEFAULT_MAX_MESSAGES", 3)
        
        session = await service.create_session()
        # Initial messages: 1 system message

        # Act
        # Add 2 more messages to reach the limit (total 3)
        await service.add_messages(session.session_id, [Message(role="user", content="1")])
        await service.add_messages(session.session_id, [Message(role="assistant", content="2")])
        
        # Now add one more, which should trigger trimming
        await service.add_messages(session.session_id, [Message(role="user", content="3")])

        # Assert
        retrieved = await service.get_session(session.session_id)
        # Should keep the system message and the last 2 messages
        assert len(retrieved.messages) == 3
        assert retrieved.messages[0].role == "system"
        assert retrieved.messages[-1].content == "3"
