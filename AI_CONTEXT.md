# AI_CONTEXT.md

## 项目定位

本项目是 **FreightTalent / ACE-Talent** 货代招聘平台，面向货代行业企业用户和候选人用户。

目标不是纯视觉 demo，而是**可演示、可联调、可继续上线的 MVP**。

---

## 当前开发原则

- **DeepSeek-v4-pro** 是默认执行模型，负责大量代码阅读、修改、测试和调试。
- **官方 Claude** 是高价值架构顾问和审查器，只在必要时通过脚本调用。
- 日常开发入口是 `scripts/ai/cc_deepseek_master.sh`。
- 每个需求必须通过 `requirements → plans → execution logs → status` 形成闭环。
- 官方 Claude 的 plan/review 阶段**禁止使用工具**，只能看脚本传入的文本。
- 如需代码上下文，必须由 DeepSeek 先生成 `tasks/context/xxx-code-summary.md`，再传给官方 Claude。

---

## 技术栈摘要

### 前端
- **框架**: React 19 + Vite + Tailwind CSS v4 + React Router v7
- **请求**: axios，统一从 `src/api/client.js` 发出，代理到 `/api`
- **状态**: AuthContext（`src/context/AuthContext.jsx`）
- **主要目录**:
  - `src/api/` — axios 封装层（client.js、auth.js、jobs.js 等）
  - `src/components/` — layout、ui、terminal 组件
  - `src/pages/` — Home、auth、candidate、employer、admin
  - `src/router/` — 路由 + RequireAuth 守卫

### 后端
- **框架**: Flask 3 + SQLAlchemy + Flask-JWT-Extended + Flask-Bcrypt
- **新模块**: FastAPI（路由前缀 `/api/v2`，新业务模块）
- **数据库**: MySQL 8（本地：root@localhost，库名 freight_talent）
- **鉴权**: JWT（token 存 localStorage，请求头 `Authorization: Bearer <token>`）
- **WebSocket**: Flask + eventlet + Socket.IO
- **主要目录**:
  - `backend/app/` — Flask app factory、models、routes、extensions
  - `backend/fastapi_app/` — FastAPI 新模块
  - `backend/tests/` — pytest 测试

### 路由约定
- `/api/*` → Flask（port 5000，存量接口）
- `/api/v2/*` → FastAPI（port 8000，新增模块）
- `/socket.io` → Flask（eventlet WebSocket）
- Vite 代理自动按前缀分发

### 测试方式
- 后端：`cd backend && pytest tests/ -v`
- 前端：`npm run dev`（开发服务器）、`npx vite build`（构建验证）

### 部署方式
- 生产：Docker Compose（nginx 前端容器 + backend + fastapi + mysql + redis）
- 本地开发：
  - Redis: `docker run -d -p 6379:6379 redis:7-alpine`
  - Flask: `cd backend && python run.py`
  - FastAPI: `cd backend && python fastapi_run.py`
  - 前端: `npm run dev`

---

## 高风险模块

以下模块必须谨慎处理，必要时调用官方 Claude：

1. **登录注册** — `backend/app/routes/auth.py`、`src/pages/auth/Login.jsx`
2. **JWT / token refresh** — Flask-JWT-Extended 配置
3. **权限系统** — 角色守卫（employer/candidate/admin）
4. **订阅和支付** — 未实现，如涉及必须官方 Claude 审查
5. **数据库迁移** — `backend/migrations/`，Alembic 版本链
6. **消息系统** — `backend/app/routes/conversations.py`、Socket.IO
7. **邀请系统** — `backend/app/routes/invitations.py`
8. **候选人匹配** — `backend/app/routes/jobs.py` 的 `/api/jobs/<id>/match`
9. **生产部署** — Docker Compose、Nginx 配置

---

## 当前阶段

- **Phase 1-6**: 已完成（认证、CRUD、匹配、邀约、管理后台、动态标签）
- **Phase 7**: 进行中（企业 Dashboard Terminal 风格改造，5/N 单页完成）

详见 `AGENTS.md` 第 6 节。

---

## 停止条件

DeepSeek 遇到以下情况必须停止并报告：

1. 认证、权限、支付、订阅、数据库迁移、消息系统核心逻辑不确定
2. diff 超过 500 行
3. 连续修复 3 次失败
4. 测试环境缺失
5. 需要读取密钥
6. 需要执行破坏性命令（git push --force、rm -rf、docker compose down -v）
7. 需求不清楚

---

## 持久上下文文件

- `AI_CONTEXT.md` — 本文件，项目技术摘要
- `PROJECT_DECISIONS.md` — 架构决策日志
- `AGENTS.md` — 项目规则和阶段规划（不要修改）
- `tasks/requirements/` — 需求文件
- `tasks/plans/` — 计划文件
- `tasks/status/` — 状态文件
- `tasks/context/` — 代码摘要（供官方 Claude 使用）
- `logs/ai/` — 执行日志和 diff

---

## 密钥管理

- 所有密钥只放在 `scripts/ai/deepseek_env.sh` 和 `scripts/ai/official_claude_env.sh`
- 这两个文件已加入 `.gitignore`
- **禁止读取、打印、提交密钥文件**
- **禁止读取 `.env`、`.env.*`、`*.sql` 备份**
