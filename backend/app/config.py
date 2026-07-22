"""项目配置，集中管理路径和环境相关常量。"""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1].parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)  # 加载环境变量
