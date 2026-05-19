# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 技术栈

- **前端**：React 19 + Vite 8 + Tailwind CSS v4 + React Router v7
- **后端（存量）**：Flask 3 + SQLAlchemy + Flask-Migrate + Flask-SocketIO + Redis（`backend/app/`）
- **后端（新增）**：FastAPI + SQLAlchemy AsyncSession（`backend/fastapi_app/`），挂载在 `/api/v2/`
- **DB**：MySQL 8（本地：root@localhost，库名 `freight_talent`）
- **前端请求**：统一走 `src/api/client.js`（axios），baseURL `/api`，Vite proxy 按前缀分发

---

## 常用命令

```bash
# 前端
npm run dev          # 开发服务器，默认 :5173
npm run build        # 生产构建（完成前必须通过此步）
npm run lint         # ESLint

# Flask 后端（在 backend/ 目录下）
source ../.venv/bin/activate       # Mac/Linux
../.venv/Scripts/activate          # Windows
python run.py                      # 开发 :5000
flask db upgrade                   # 执行待跑迁移
flask db migrate -m "描述"         # 生成新迁移文件
python -m pytest tests/ -x -q     # 全量测试（-x 遇错即停）
python -m pytest tests/test_foo.py::test_bar -x -q  # 单个测试

# FastAPI 后端
python fastapi_run.py              # 开发 :8000 --reload

# 验收前必跑（两条都要过）
cd backend && python -m pytest tests/ -x -q 2>&1 | tail -5
npx vite build --mode production 2>&1 | tail -5
```

---

## 整体架构

### 双后端并行
Vite dev proxy 和 Nginx 生产配置都按前缀分流：
- `/api/v2/*` → FastAPI（port 8000）
- `/api/*` → Flask（port 5000）
- `/socket.io` → Flask（WebSocket，eventlet）

JWT 互通：Flask-JWT-Extended 颁发的 token，FastAPI 侧 `backend/fastapi_app/core/auth.py` 用同一 secret 验证。

### 前端路由结构

`src/App.jsx` 中 `TERMINAL_PREFIXES` 决定是否渲染 Navbar/Footer：
- **Terminal 路由**（`/employer/*`、`/candidate/home|jobs|messages|tags|...`）：不渲染 Navbar/Footer，走全屏 Terminal 壳层
- **公共浅色路由**（`/jobs`、`/messages`、`/candidates`、`/tags`）：渲染标准 Navbar/Footer

**Terminal 壳层模式**：所有企业/候选人业务页面都有对应的 `Terminal*.jsx` wrapper（`src/pages/employer/` 和 `src/pages/candidate/`），wrapper 仅做两件事：包裹 `<TerminalLayout>` + 向共享业务组件传 `terminal={true}`。

业务组件（JobMarketplace / CandidatePool / Messages / MyTags / PostJob 等）均通过 **`terminal` prop 做双分支**：`terminal=false` 是公共浅色路径，字符级不动；`terminal=true` 是 Terminal 深色分支，全部用 `var(--t-*)` token。

### Terminal 主要组件（`src/components/terminal/`）

| 组件 | 职责 |
|---|---|
| `TerminalLayout` | 100vw/100vh 深色壳层；含 `IconRail`（图标导航）+ `TerminalHeader` |
| `TerminalPageSurface` | 标准页面容器，`flex-1 w-full min-w-0 terminal-mode`，`split=true` 时双栏 |
| `FunctionRail` | 60px↔228px hover 展开左侧职能导航 |
| `AreaSidebar` | 始终 210px 展开的大区侧边栏 |
| `TerminalThemeContext` | 管理 Light/Dark/System 切换，写 `data-terminal-theme` 到 `.terminal-shell` |

### Design Token 系统（`src/styles/terminal.css`）

所有 Terminal 颜色通过 CSS 变量：`--t-bg`、`--t-bg-panel`、`--t-bg-elevated`、`--t-bg-hover`、`--t-bg-active`、`--t-bg-input`、`--t-border`、`--t-border-subtle`、`--t-border-focus`、`--t-text`、`--t-text-secondary`、`--t-text-muted`、`--t-primary`、`--t-primary-muted`、`--t-primary-hover`、`--t-danger`、`--t-success`、`--t-warning` 等。

Token 值在 `.terminal-shell[data-terminal-theme="dark"]` 和 `[data-terminal-theme="light"]` 下分别定义。`.terminal-mode` scoped CSS 把 Tailwind 的 `bg-white / text-slate-* / border-slate-*` 等工具类重映射到 token，使共享组件在 Terminal 下自动适配。

### 认证与权限

- JWT 存 `localStorage`（`token` + `refresh_token`）
- `src/api/client.js` 内置 401 拦截：自动用 refresh token 换新 access token，失败则触发 `auth:session-expired` 事件
- `AuthContext` 监听该事件清空用户态
- 路由守卫：`src/router/RequireAuth.jsx`，通过 `roles` prop 控制角色访问
- 三种角色：`employer`、`candidate`、`admin`

### 消息系统（`src/features/messages/`）

架构分层：
- `hooks/useConversations.js`：会话列表拉取 + Socket 实时更新
- `hooks/useConversationMessages.js`：单会话消息 + 分页加载历史
- `hooks/useSendMessage.js`：发送 + 乐观更新 + 失败重试
- `hooks/useSocketMessages.js`：Socket 事件监听适配
- `services/messagesSocket.js`：Socket 事件名常量

Socket 连接单例在 `src/lib/socket.js`，`useSocket` hook 管理生命周期。`ENABLE_SOCKETIO` 环境变量控制 Flask 端是否初始化 Socket.IO。

### 候选人隐私解锁（订阅制）

`backend/app/utils/subscription_access.py` 是单一事实来源。employer 能看到候选人私密字段（邮件/电话/地址等）当且仅当其有覆盖该候选人 `function_code` + `business_area_code` 的 active subscription。`candidate_privacy.py` 仅做 re-export，老路由不用改 import。

### 匹配算法（`backend/app/services/matching.py`）

双边匹配：`employer_fit_score`（岗位视角，权重 0.65）+ `candidate_fit_score`（候选人视角，权重 0.35）= `final_score`（满分 100）。缺字段时降级为 0，不抛异常。

---

## 开发约束（硬性）

### 禁止改动的文件/路径
- `src/pages/candidate/UploadResume.jsx`（公共上传，走独立 Terminal wrapper）
- `src/api/client.js`、`src/context/AuthContext.jsx`、`src/router/RequireAuth.jsx`、`src/lib/socket.js`、`src/hooks/useSocket.js`
- 公共浅色路由 `/jobs`、`/messages`、`/messages/:threadId`、`/candidates`、`/tags` 的 `terminal=false` 分支（字符级不动）

### Terminal UI 强制规则
1. 颜色全用 `var(--t-*)` token，禁止硬编码 `bg-gray-900`、`#1e293b` 等深色值
2. Hover 状态用 JS `onMouseEnter/onMouseLeave`，不用 CSS `:hover`（避免公共路径污染）
3. 外层容器用 `flex-1 w-full min-w-0` 铺满，禁止在最外层用 `mx-auto`
4. 新增 scoped 样式追加到 `src/styles/terminal.css`，必须在 `.terminal-mode` 或 `.terminal-shell` 下
5. Terminal 页面内部跳转用绝对路径（如 `/employer/dashboard`），不用 `navigate(-1)`（防止跳出 Terminal 壳）

### Flask → FastAPI 迁移规则
- 每次只迁移一个 Phase，完成后停下报告，等确认再继续
- Flask 路由保留不动，直到对应 FastAPI 路由线上验证完毕
- FastAPI 路由挂 `/api/v2/` 前缀，Pydantic schema 放 `backend/fastapi_app/schemas/`
- ORM 保留 SQLAlchemy（AsyncSession），不引入 SQLModel

### 迁移进度

| Phase | 模块 | 状态 |
|---|---|---|
| 1 | 图表/统计 (`chart.py`) | 🔄 骨架已建 |
| 2 | 标签/设置 (`tags.py` / `settings.py`) | 🔄 骨架已建 |
| 3 | 对话 | ⬜ 待迁 |
| 4 | 候选人池 | ⬜ 待迁 |
| 5 | 职位 | ⬜ 待迁 |
| 6 | 雇主看板 | ⬜ 待迁 |
| 7 | 认证 | ⬜ 待迁 |
| 8 | 订阅 | ⬜ 待迁 |

---

## 数据库迁移注意事项

`alembic_version.version_num` 字段历史上曾是 VARCHAR(32)，但 revision ID 最长 38 字符——若从空库重建需手动 `ALTER TABLE alembic_version MODIFY version_num VARCHAR(64)`，或在新迁移里固化此长度。迁移链头文件：`fe77249f9144_initial_schema.py`。
