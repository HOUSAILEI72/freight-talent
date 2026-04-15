# FreightTalent

货代垂直招聘撮合平台 MVP。

当前代码不是纯视觉 Demo，而是一个已经具备真实后端、JWT 鉴权、岗位发布、候选人档案、匹配、邀约、消息会话、管理后台统计的可联调项目。

## 文档索引

- [系统架构](./docs/architecture.md)
- [API 契约](./docs/api-contract.md)
- [前端交接指南](./docs/frontend-handoff.md)

## 技术栈

| 层 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | React 19 + Vite 8 + Tailwind CSS v4 + React Router v7 | SPA，按角色路由控制 |
| 请求层 | axios | 统一由 `src/api/client.js` 发起，自动带 token、自动刷新 access token |
| 实时通信 | Socket.IO Client + Flask-SocketIO | 用于消息、输入状态、已读回执 |
| 后端 | Flask 3 + SQLAlchemy + Flask-JWT-Extended + Flask-Bcrypt | Blueprint + app factory 结构 |
| 数据库 | MySQL 8 | 主业务库 |
| 迁移 | Flask-Migrate / Alembic | 已补 baseline 迁移 |
| 限流 / token blocklist | Flask-Limiter + Redis（生产）/ memory fallback（开发） | 429 JSON 已统一 |
| 部署 | Nginx + Gunicorn(eventlet) + Docker Compose | 前后端可分容器部署 |

## 当前功能范围

| 模块 | 状态 | 说明 |
| --- | --- | --- |
| 用户认证 | 已完成 | 注册、登录、`/me`、刷新 token、登出、角色路由守卫 |
| 候选人档案 | 已完成 | 简历上传、档案保存、公开档案查看、候选人池过滤 |
| 岗位模块 | 已完成 | 发布岗位、企业岗位列表、岗位广场、单岗位详情 |
| 匹配引擎 | 已完成 | 基于标签/城市/行业/经验/鲜度计算分数并写入 `match_results` |
| 邀约流程 | 已完成 | 幂等邀约、候选人接收/拒绝、企业邀约汇总 |
| 消息中心 | 已完成 | 会话列表、分页消息、Socket.IO 实时消息、已读、typing |
| 管理后台 | 已完成 | `/api/admin/overview` 已真实化 |
| 首页营销内容 | 静态内容 | 目前仍是营销页，不直接拉真实 API |

## 项目结构

```text
货代招聘/
├── src/
│   ├── api/                  # 前端 API 封装
│   ├── components/           # Layout / UI / Messages 组件
│   ├── context/              # AuthContext
│   ├── hooks/                # useSocket
│   ├── lib/                  # Socket.IO 单例
│   ├── pages/                # Home / Auth / Candidate / Employer / Admin / Messages
│   ├── router/               # 路由与 RequireAuth
│   └── styles/               # 全局 Tailwind v4 主题
├── backend/
│   ├── app/
│   │   ├── __init__.py       # Flask app factory
│   │   ├── config.py         # 环境配置
│   │   ├── extensions.py     # db/jwt/bcrypt/cors/migrate/limiter/socketio
│   │   ├── models/           # users/jobs/candidates/match/invitation/conversation/message
│   │   └── routes/           # auth/jobs/candidates/invitations/admin/conversations/socket
│   ├── migrations/           # Alembic 迁移
│   ├── requirements.txt
│   └── run.py                # 本地开发入口
├── docs/                     # 项目技术文档
├── docker-compose.yml
├── Dockerfile                # 前端 Nginx 镜像
├── nginx.conf
└── vite.config.js
```

## 本地开发

### 依赖前提

- Node.js 22+
- Python 3.10+（Docker 镜像使用 3.12）
- MySQL 8
- Redis 可选
  开发环境可不装，限流与 JWT blocklist 会回退到内存

### 1. 后端

在 `backend/` 下准备 `.env`，至少包含以下变量：

```env
FLASK_ENV=development
DB_USER=root
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=3306
DB_NAME=freight_talent
JWT_SECRET_KEY=replace_with_at_least_32_random_chars
JWT_ACCESS_TOKEN_EXPIRES_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRES_DAYS=7
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
RATELIMIT_STORAGE_URI=memory://
```

启动：

```bash
cd backend
..\.venv\Scripts\activate   # Windows，按你的虚拟环境实际路径调整
pip install -r requirements.txt
flask db upgrade
python run.py
```

后端默认地址：`http://127.0.0.1:5000`

### 2. 前端

```bash
npm install
npm run dev
```

前端默认地址：`http://localhost:5173`

Vite 已内置代理：

- `/api` -> `http://127.0.0.1:5000`
- `/socket.io` -> `http://127.0.0.1:5000`

## 环境变量

| 变量 | 位置 | 用途 |
| --- | --- | --- |
| `FLASK_ENV` | backend | `development` / `production` |
| `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` / `DB_NAME` | backend | MySQL 连接 |
| `JWT_SECRET_KEY` | backend | JWT 签名密钥，必须配置 |
| `JWT_ACCESS_TOKEN_EXPIRES_MINUTES` | backend | access token 过期时间 |
| `JWT_REFRESH_TOKEN_EXPIRES_DAYS` | backend | refresh token 过期时间 |
| `CORS_ORIGINS` | backend | 允许的前端来源，逗号分隔 |
| `RATELIMIT_STORAGE_URI` | backend | 限流存储，开发可 `memory://`，生产应使用 Redis |
| `REDIS_URL` | backend | JWT blocklist 也会优先读取 |
| `SERVE_STATIC` | backend | `true` 时由 Flask 托管前端 `dist/` |
| `STATIC_FOLDER` | backend | 前端静态目录路径 |

## 生产部署

### 方案 A：Docker Compose

```bash
docker compose up --build
```

Compose 结构：

- `db`: MySQL 8
- `redis`: Redis 7
- `backend`: Flask + Gunicorn(eventlet)
- `frontend`: Nginx 托管 `dist/`，并反代 `/api` 与 `/socket.io`

### 方案 B：后端托管前端静态文件

配置：

```env
SERVE_STATIC=true
```

然后：

1. 前端执行 `npm run build`
2. 后端通过 `create_app()` 中的静态托管逻辑直接返回 `dist/index.html`

## 迁移

数据库迁移说明见：

- [系统架构](./docs/architecture.md)
- [API 契约](./docs/api-contract.md)
- `backend/migrations/MIGRATION_NOTES.md`

新环境建库后直接执行：

```bash
flask db upgrade
```

## 已验证状态

基于当前工作区，已执行过以下校验：

- 后端 `python -m compileall backend/app` 通过
- 前端 `npm run build` 通过
- 当前前端产物存在 500 kB+ 单 chunk 警告，属于性能优化项，不影响构建成功

## 补充说明

- 管理员不能通过公开注册接口创建，只能用 CLI：
  `flask auth create-admin --email admin@example.com`
- `/api/jobs/public` 名称虽为 `public`，但当前实现仍要求登录后访问
- 候选人公开档案当前只接受数字 ID；旧的 mock 风格 `c001` 路径不再是实际接口契约
