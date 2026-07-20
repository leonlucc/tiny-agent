## 安装和启动

当前版本是 `v0.2 Streaming Web`，提供一个极简 Web 页面，通过 SSE 实时渲染大模型流式输出。

### 1. 创建虚拟环境

```bash
cd backend

python -m venv .venv

.venv/bin/python -m pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

根据实际情况修改 `.env` 中的配置：

```bash
LLM_API_KEY=你的 API Key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
```

### 3. 启动 Web 服务

```bash
.venv/bin/python -m app.main
```

启动后打开浏览器访问：

```bash
http://127.0.0.1:8000
```

在页面输入一条文本消息，模型回复会逐段显示在结果区域。

---

## 常见问题

### 提示未配置 API Key

```bash
错误：未配置 LLM_API_KEY。
```

请确认已经执行 `cp .env.example .env`，并在 `.env` 中填入真实 API Key。

### 如何切换模型

修改 `.env`：

```bash
LLM_MODEL=deepseek-v4-pro
```
