## 安装和启动
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

根据实际情况修改 `.env` 中的配置。

### 3. 启动服务

方式一：

```bash
.venv/bin/python -m app.main
```

方式二：

```bash
.venv/bin/python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8080
```

---

## 访问服务

| 页面          | 地址                          |
| ----------- | --------------------------- |
| Web UI      | http://localhost:8080/      |
| Swagger API | http://localhost:8080/docs  |
| ReDoc API   | http://localhost:8080/redoc |

