# ACE-Talent 基础设施与配置全量审计

**项目路径：** `/Users/edy/Desktop/货代招聘/`
**审计日期：** 2026-05-09

---

## 1. 项目元信息

### 1.1 `package.json`

```json
{
  "name": "-",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@province-city-china/data": "^8.5.8",
    "@tailwindcss/vite": "^4.2.2",
    "axios": "^1.15.0",
    "lucide-react": "^1.8.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.14.0",
    "recharts": "^3.8.1",
    "socket.io-client": "^4.7.5",
    "tailwindcss": "^4.2.2"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "vite": "^8.0.4"
  }
}
```

### 1.2 `backend/requirements.txt`

```
flask==3.1.0
flask-socketio==5.4.1
python-socketio==5.11.3
eventlet==0.38.2
flask-sqlalchemy==3.1.1
flask-jwt-extended==4.7.1
flask-cors==5.0.1
flask-bcrypt==1.0.1
flask-migrate==4.0.7
flask-limiter==3.8.0
pymysql==1.1.1
python-dotenv==1.0.1
cryptography==44.0.3
gunicorn==22.0.0
redis==5.2.1
openpyxl==3.1.5
apscheduler>=3.10.4,<4.0
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic-settings==2.7.0
PyJWT==2.10.1
httpx==0.28.1
pytest==8.3.4
pytest-flask==1.3.0
```

### 1.3 `backend/requirements-fastapi.txt`

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic-settings==2.7.0
PyJWT==2.10.1
redis==5.2.1
pymysql==1.1.1
sqlalchemy==2.0.36
python-dotenv==1.0.1
cryptography==44.0.3
httpx==0.28.1
python-multipart==0.0.20
openpyxl==3.1.5
apscheduler>=3.10.4,<4.0
```

---

## 2. Vite 配置 (`vite.config.js`)

```js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/v2':   { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/api':      { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/socket.io':{ target: 'http://127.0.0.1:5000', changeOrigin: true, ws: true },
    },
  },
})
```

---

## 3. HTML 入口 (`index.html`)

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ACE-Talent · 货代精准招聘平台</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

---

## 4. Docker — 5 服务

### 4.1 `Dockerfile` (根目录) — 前端

- **Stage 1 (builder):** `node:22-alpine`, Aliyun mirrors, `npm ci`, `npm run build`
- **Stage 2 (production):** `nginx:alpine`, copies `dist/` + `nginx.conf`
- EXPOSE 80, HEALTHCHECK `wget -qO- http://127.0.0.1/health`
- CMD: `nginx -g "daemon off;"`

### 4.2 `backend/Dockerfile` — Flask

- Base: `python:3.11-slim`
- Installs: `default-libmysqlclient-dev gcc pkg-config curl`
- Non-root `appuser`, EXPOSE 5000
- HEALTHCHECK: `curl -fsS http://localhost:5000/api/health`
- CMD: `gunicorn -c gunicorn.conf.py "app:create_app()"`

### 4.3 `backend/Dockerfile.fastapi` — FastAPI

- Base: `python:3.11-slim`, same mirror pattern
- Installs: `requirements-fastapi.txt` only (lighter)
- EXPOSE 8000
- CMD: `uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000 --workers 4`

### 4.4 `docker-compose.yml`

5 服务同在一个 `app_net` 桥接网络：

| 服务 | 镜像 | 端口映射 | 健康检查依赖 |
|---|---|---|---|
| `db` | mysql:8.0 | expose 3306 | — |
| `redis` | redis:7-alpine | expose 6379 | — |
| `backend` | ./backend/Dockerfile | expose 5000 | db + redis |
| `fastapi` | ./backend/Dockerfile.fastapi | expose 8000 | db + redis |
| `frontend` | ./Dockerfile | 80:80 | backend + fastapi |

环境变量：FLASK_ENV, DB_HOST/PORT/USER/PASSWORD/NAME, JWT_SECRET_KEY, JWT_ACCESS_TOKEN_EXPIRES_MINUTES, JWT_REFRESH_TOKEN_EXPIRES_DAYS, REDIS_URL, RATELIMIT_STORAGE_URI, CORS_ORIGINS, MAIL_*

3 个命名卷：`db_data`, `redis_data`, `uploads_data`

---

## 5. Nginx 生产配置 (`nginx.conf`)

**HTTP 服务器 (port 80)：**
- `server_name _`, `client_max_body_size 15m`
- ACME challenge location (Let's Encrypt)
- Gzip level 5
- 安全头：X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy
- 静态资源 1 年强缓存 (immutable)
- `/api/v2/` → `http://fastapi:8000` (120s read timeout)
- `/api/` → `http://backend:5000` (120s read timeout)
- `/socket.io/` → `http://backend:5000` (ws 升级, 3600s timeout, no buffering)
- `/health` → 直接 200 (容器健康检查)
- `/` → `try_files $uri $uri/ /index.html` (SPA)

**HTTPS 服务器块（注释）：** TLS 1.2/1.3, Let's Encrypt 证书, HSTS

---

## 6. Gunicorn 生产配置 (`backend/gunicorn.conf.py`)

```python
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:5000")
workers = 1              # Flask-SocketIO + Eventlet 需要单 worker
worker_class = "eventlet"
worker_connections = 1000
timeout = 60
keepalive = 5
graceful_timeout = 30
preload_app = False      # Eventlet 不兼容
```

---

## 7. 开发入口

| 文件 | 行数 | 说明 |
|---|---|---|
| `backend/run.py` | 22 | eventlet monkey_patch → create_app() → socketio.run(5000) |
| `backend/fastapi_run.py` | 15 | uvicorn --reload (8000) |
| `npm run dev` | — | Vite 开发服务器 (5173) |

---

## 8. ESLint (`eslint.config.js`)

Flat config：
- 全局忽略：dist, .venv, venv, backend, node_modules
- 目标：**/*.{js,jsx}
- 扩展：js recommended, react-hooks recommended, react-refresh/vite
- ECMA 2020, browser globals, JSX
- `no-unused-vars`: warn (忽略大写变量和 _ 前缀参数)
- 无 Prettier 配置

---

## 9. CI/CD (`.github/workflows/ci.yml`)

**触发：** push main/develop, PR main

**3 个 Job：**

| Job | 运行条件 | 内容 |
|---|---|---|
| `frontend` | 始终 | Node 22, npm ci, lint, build |
| `backend` | 始终 | Python 3.12, install requirements.txt + flake8, lint (max-line 120, 排除 migrations) |
| `docker-build` | main 分支, 依赖 frontend+backend | 构建 backend + frontend Docker 镜像 |

---

## 10. `.gitignore`

排除：logs, node_modules, dist, .venv, __pycache__, backend/.env*, backend/uploads/, .claude/settings.local.json*, .codex/, scripts/ai/env.*.local.sh, scripts/ai_backup_*/, *.sql, *.secret, *.key, *.pem

---

## 11. 日志配置 (`backend/logging_config.py`)

- 统一 Flask + FastAPI 日志
- 环境变量控制：LOG_LEVEL (默认 INFO), LOG_DIR (默认 backend/logs/), LOG_TO_FILE, LOG_MAX_BYTES (10MB), LOG_BACKUP_COUNT (5)
- 双输出：stdout 控制台 + 轮转文件（app.log + error.log）
- 幂等初始化
- 抑制噪音：urllib3, PIL, openpyxl, passlib, asyncio

---

## 12. 文档

| 文件 | 大小 | 内容 |
|---|---|---|
| `AGENTS.md` | 21KB/344行 | 项目协作守则：技术栈/目录/页面清单/开发原则/阶段规划/API清单/权限/启动/部署 |
| `DEPLOY.md` | 7KB | 部署手册：首次部署/HTTPS/Let's Encrypt/日常运维/本地开发/预发布清单/故障排查 |
| `docs/architecture.md` | 6KB | 系统架构：分层/数据模型/权限/认证链/匹配引擎(7维/10维)/消息链/Socket事件/迁移历史 |
| `docs/api-contract.md` | 7KB | API 契约：对象类型/请求响应格式/20+端点规格/8 Socket 事件 |
| `docs/frontend-handoff.md` | 7KB | 前端接手：关注点分离/目录建议/全局能力/接手顺序/页面-API映射/9常见陷阱/12项移交清单 |

---

## 13. `.claude/settings.json`

项目级 Claude Code 权限：
- **Allow：** git, npm, npx, node, python, pytest, pip, flask, curl, docker, mysql, mkdir, ls, grep, find, stat, cat, tail, wc, sed, awk, rsync, chmod +x/600, 特定 bash 脚本, Read/Edit/Write/WebSearch/WebFetch
- **Deny：** 读写任何 `.env` 文件或 `.sql` 文件；读取 `.pem`/`.key` 文件；`git push --force`, `rm -rf`, `chmod 777`, `docker compose down -v`

---

## 14. 敏感文件风险

- `.codex/config.toml` — 含 `ANTHROPIC_AUTH_TOKEN` (DeepSeek API 密钥)，已在 `.gitignore` 排除但可能已被提交
