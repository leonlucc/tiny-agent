"""项目配置，集中管理路径和环境相关常量。"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)


def load_llm_config() -> tuple[str, str, str]:
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
