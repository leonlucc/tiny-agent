"""Tiny Agent v0.0.1：通过 CLI 完成一次大模型调用。"""

from __future__ import annotations

import os
import sys
from dotenv import load_dotenv
from openai import OpenAI


def create_client() -> tuple[OpenAI, str]:
    """从环境变量创建兼容 OpenAI 协议的 LLM 客户端，并返回模型名称。"""
    load_dotenv()

    # 提前检查环境变量是否配置完整
    api_key = os.getenv("LLM_API_KEY")
    base_url = os.getenv("LLM_BASE_URL")
    model = os.getenv("LLM_MODEL")

    if not api_key or api_key == "your_api_key_here":
        print("错误：未配置 LLM_API_KEY。", file=sys.stderr)
        print("请复制 .env.example 为 .env，并填写你的 API Key。", file=sys.stderr)
        raise SystemExit(1)

    if not base_url:
        print("错误：未配置 LLM_BASE_URL。", file=sys.stderr)
        print("请复制 .env.example 为 .env，并填写你的模型服务地址。", file=sys.stderr)
        raise SystemExit(1)

    if not model:
        print("错误：未配置 LLM_MODEL。", file=sys.stderr)
        print("请复制 .env.example 为 .env，并填写你的模型名称。", file=sys.stderr)
        raise SystemExit(1)

    # 构造 LLM 请求客户端
    return OpenAI(api_key=api_key, base_url=base_url), model


def chat_once(client: OpenAI, model: str, message: str) -> str:
    """向大模型发送一条用户消息，并返回模型回复文本。"""
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": message}],
        timeout=30.0,
    )

    content = response.choices[0].message.content
    return content or ""


def main() -> None:
    """运行最小 CLI，实现单轮文本输入与输出。"""
    # 打印启动提示
    print("=" * 50)
    print("Tiny Agent - Hello LLM")
    print("=" * 50)
    print("输入一条消息发送给大模型，输入 exit 退出。")
    print()
    sys.stdout.flush()

    # 启动时先创建 LLM 请求客户端
    client, model = create_client()

    while True:
        try:
            # 读取用户输入，并去掉首尾空白字符。
            user_input = input("你: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见！")
            return

        # 空输入不发送给模型，直接等待下一次输入。
        if not user_input:
            continue

        # 支持exit退出命令
        if user_input.lower() == "exit":
            print("再见！")
            return

        try:
            # 发起一次 LLM 调用，并将回复直接打印到终端。
            print("AI: ", end="", flush=True)
            print(chat_once(client, model, user_input))
            print()
        except Exception as exc:
            print(f"\n调用失败：{exc}\n", file=sys.stderr)


if __name__ == "__main__":
    main()
