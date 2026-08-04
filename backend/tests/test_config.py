"""`app.config` 模块单元测试。"""

from __future__ import annotations

import pytest

from app.config import load_llm_config


class TestLoadLlmConfig:
    def test_load_llm_config_returns_values_when_all_env_vars_set(self, monkeypatch) -> None:
        # Arrange
        monkeypatch.setenv("LLM_API_KEY", "test-api-key")
        monkeypatch.setenv("LLM_BASE_URL", "http://test-url.com")
        monkeypatch.setenv("LLM_MODEL", "test-model")

        # Act
        api_key, base_url, model = load_llm_config()

        # Assert
        assert api_key == "test-api-key"
        assert base_url == "http://test-url.com"
        assert model == "test-model"

    def test_load_llm_config_raises_when_api_key_missing(self, monkeypatch) -> None:
        # Arrange
        monkeypatch.delenv("LLM_API_KEY", raising=False)
        monkeypatch.setenv("LLM_BASE_URL", "http://test-url.com")
        monkeypatch.setenv("LLM_MODEL", "test-model")

        # Act & Assert
        with pytest.raises(RuntimeError, match="未配置 LLM_API_KEY"):
            load_llm_config()

    def test_load_llm_config_raises_when_api_key_is_default(self, monkeypatch) -> None:
        # Arrange
        monkeypatch.setenv("LLM_API_KEY", "your_api_key_here")
        monkeypatch.setenv("LLM_BASE_URL", "http://test-url.com")
        monkeypatch.setenv("LLM_MODEL", "test-model")

        # Act & Assert
        with pytest.raises(RuntimeError, match="未配置 LLM_API_KEY"):
            load_llm_config()

    def test_load_llm_config_raises_when_base_url_missing(self, monkeypatch) -> None:
        # Arrange
        monkeypatch.setenv("LLM_API_KEY", "test-api-key")
        monkeypatch.delenv("LLM_BASE_URL", raising=False)
        monkeypatch.setenv("LLM_MODEL", "test-model")

        # Act & Assert
        with pytest.raises(RuntimeError, match="未配置 LLM_BASE_URL"):
            load_llm_config()

    def test_load_llm_config_raises_when_model_missing(self, monkeypatch) -> None:
        # Arrange
        monkeypatch.setenv("LLM_API_KEY", "test-api-key")
        monkeypatch.setenv("LLM_BASE_URL", "http://test-url.com")
        monkeypatch.delenv("LLM_MODEL", raising=False)

        # Act & Assert
        with pytest.raises(RuntimeError, match="未配置 LLM_MODEL"):
            load_llm_config()
