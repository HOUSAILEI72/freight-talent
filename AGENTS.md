# AGENTS.md — FreightTalent 协作规则

每次对话开始前请读取本文件，作为所有任务的基准上下文。

---

## 1. 项目定位

货代垂直招聘撮合平台（FreightTalent）。

目标不是纯视觉 demo，而是**可演示、可联调、可继续上线的 MVP**：
- 高保真前端（已完成）
- 最小真实 Flask 后端（进行中）
- 关键页面逐步从 mock 切换为真实 API
- 基础登录鉴权 + 角色区分
- 结构清晰，便于后续迭代上线

---

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + Vite + Tailwind CSS v4 + React Router v7 |
| 前端请求 | axios，统一从 `src/api/client.js` 发出，代理到 `/api` |
| 后端 | Flask 3 + SQLAlchemy + Flask-JWT-Extended + Flask-Bcrypt |
| 数据库 | MySQL 8（本地：root@localhost，库名 freight_talent） |
| 鉴权 | JWT（token 存 localStorage，请求头 `Authorization: Bearer <token>`） |

---

## 3. 目录结构

```
货代招聘/
├── src/
│   ├── api/              # axios 封装层（client.js、auth.js、后续 jobs.js 等）
│   ├── context/          # 全局状态（AuthContext.jsx）
│   ├── components/
│   │   ├── layout/       # Navbar、Footer
│   │   └── ui/           # Button、Badge、TagList、MatchScore、StatCard
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── auth/Login.jsx
│   │   ├── candidate/    # UploadResume、CandidateProfile
│   │   ├── employer/     # Dashboard、PostJob、MatchResult
│   │   └── admin/        # Overview
│   ├── mock/             # candidates.js、jobs.js、stats.js（逐步废弃）
│   └── router/index.jsx  # 路由 + RequireAuth 守卫
├── backend/
│   ├── app/
│   │   ├── __init__.py   # Flask app factory
│   │   ├── config.py
│   │   ├── extensions.py # db、jwt、bcrypt、cors
│   │   ├── models/       # user.py（已有），后续 job.py、candidate.py
│   │   └── routes/       # auth.py（已有），后续 jobs.py、candidates.py
│   ├── .env
│   ├── requirements.txt
│   └── run.py
├── vite.config.js        # /api → http://127.0.0.1:5000 代理
└── AGENTS.md
```

---

## 4. 已有页面

| 路径 | 页面 | 角色 | 数据状态 |
|---|---|---|---|
| `/` | Home | 全部 | mock |
| `/login` | Login | 全部 | **真实 API** || `/candidate/upload` | UploadResume | candidate | **真实 API** |
| `/candidate/profile/:id` | CandidateProfile | candidate/employer/admin | **真实 API（数字 id：自身 + 企业视角）/ mock（c001 等演示路径）** |
| `/messages` | Messages | employer/candidate/admin | **真实 API** |
| `/messages/:threadId` | Messages | employer/candidate/admin | **真实 API** |
| `/candidates` | CandidatePool | employer/admin | **真实 API** |
| `/candidate/invitations` | MyInvitations | candidate | **真实 API** |
| `/jobs` | JobMarketplace | candidate/employer/admin | **真实 API** |
| `/employer/dashboard` | Dashboard | employer | **真实 API（岗位列表）/ mock（统计数字）** |
| `/employer/post-job` | PostJob | employer | **真实 API** |
| `/employer/match/:jobId` | MatchResult | employer | **真实 API** |
| `/admin/overview` | Overview | admin | **真实 API** |
| `/admin/import` | ImportManager（含标签库/待审批/审批开关） | admin | **真实 API** |
| `/admin/tags` | → 重定向到 `/admin/import` | — | — |

---

## 5. 开发原则

- **一次只做一个小任务**，完成后报告再继续
- **不大范围重构**现有前端页面或组件
- **优先保证核心流程真实可跑**，再补边界处理
- **mock 数据逐步替换**，不要一次全删，保留作为回退
- **复用现有组件**（Button、Badge、TagList、MatchScore、StatCard）
- **新增代码保持结构一致**，便于接生产环境
- 后端校验与前端校验**都要做**，不能只做一边
- 不追求一次做完所有生产级能力（日志、限流、迁移等 Phase 4+ 再做）

---

## 6. 阶段规划

| 阶段 | 内容 | 状态 |
|---|---|---|
| Phase 1 | 用户认证（注册/登录/JWT/路由守卫） | **完成** |
| Phase 2 | 企业发布岗位 + 候选人上传资料（真实 CRUD） | **完成** |
| Phase 3 | 匹配结果 + 邀约流程 | **完成** |
| Phase 4 | 管理后台统计（替换 mock stats） | **完成** |
| Phase 5 | 生产加固（迁移脚本、限流、日志、HTTPS） | **进行中（限流+迁移完成）** |
| Phase 6 | 动态标签体系 + 候选人隐私字段 + 统一导入工作流 | **完成** |
| Phase 7 | 企业 Dashboard Freightos Terminal 风格改造 | **完成（7-A/B/C/D/E/F/G 全部完成）** |

### Phase 7 子阶段

| 子阶段 | 内容 | 状态 |
|---|---|---|
| 7-A | 企业 Dashboard 全屏深色 Terminal 壳层（隐藏白色 Navbar/Footer，IconRail，TerminalHeader） | **完成** |
| 7-B | FunctionRail（hover 展开）+ AreaSidebar（始终展开）+ 紫色柱状图 + ActionBar | **完成** |
| 7-C | 真实 Function/Area 数据接入：新增 `GET /api/employer/terminal-dashboard` 聚合接口（functions / areas / chart 一次返回） | **完成** |
| 7-D | 企业端老页面接入 Terminal 壳层 + 全屏布局规范化（外层铺满 + 内层限宽） | **完成** |
| 7-E | 业务页面 Terminal 视觉精修（card/input/tag-chip/empty-state 等逐组件 token 化） | **完成（6/6 单页完成）** |
| 7-E-1 | `/employer/messages` token 化（ConvItem / DateDivider / Bubble / MessagePanel / 返回按钮 / ConnectionBanner / TypingIndicator / InvBadge） | **完成** |
| 7-E-2 | `/employer/jobs` + `/candidate/jobs` token 化（左栏 / 选中态 / hover / 搜索框 / Empty / JobDetailPanel；候选人端默认隐藏 New Job） | **完成** |
| 7-E-3 | `/employer/candidates` token 化（左栏 / 筛选 / 列表 / 选中态 / hover / CandidateDetailPanel / 联系方式 / 工作教育经历 / 证书 / 标签 / 邀约&沟通按钮） | **完成** |
| 7-E-4 | `/employer/jobs/new` PostJob token 化（Step indicator / 表单卡 / input / textarea / chip / AI 标签卡 / 错误条 / 成功态） | **完成** |
| 7-E-5 | `/employer/jobs/:jobId/match` MatchResult token 化（Toast / FreshBadge / 岗位摘要卡 / 4 项统计 / 过滤栏 / Empty / 候选人卡片 / 排名 chip / 头像 / 推荐理由 panel / 邀约按钮）；同步兼容旧路由 `/employer/match/:jobId` | **完成** |
| 7-E-6 | `/employer/tags` MyTags 内部精修 | **完成** |
| 7-F | 共享组件批量 token 化（Button / Badge / StatusBadge / TagList / MatchScore / ChartTagSelector） | **完成** |
| 7-G | 数据回填验收 + 端到端跑通 employer 全链路（PostJob → Jobs → Match → Invite → Messages） | **完成** |

### Phase 7 关键修复（与视觉无直接关系，但必须记录）

- **DB 迁移版本断点修复（2026-04-29）**：MySQL `alembic_version` 卡在 `454b5c374e8a`（`fe77249f9144` 链路降级前的旧版本），但代码 head 是 `0007_taxonomy_extensions`。导致 `jobs` 缺 `province / city_name / district`、`candidates` 缺 `email/phone/address/contact_visible/age/work_experiences/education_experiences/certificates`。
  - 修复步骤：
    1. `mysqldump` 备份
    2. `ALTER TABLE alembic_version MODIFY version_num VARCHAR(64)`（旧的 32 长度装不下 38 字符 revision id）
    3. `flask db stamp 0002_drop_invitation_unique_constraint`
    4. `flask db upgrade` → 顺序跑 `0003 → 0007`
  - **注意**：未来若从空库重建，Alembic 默认建出来的 `version_num` 还是 32 长。需要在 `0008` 迁移里固化为 64。
- **`/api/conversations` 500 修复**：上述 schema 缺列导致 `joinedload(Job)` 选 `jobs_1.province` 时报 `Unknown column`。`backend/app/routes/conversations.py` 的 `get_my_conversations` 已加 `try/except + current_app.logger.exception` + 结构化 500 JSON（`detail` 仅在 `current_app.debug=True` 时返回）。前端 `Messages.jsx` 的 `fetchConversations.catch` 也加了 `console.error` 和多字段 message 兜底（`data?.message || data?.error || data?.detail || data?.msg`）。

### Phase 7 已交付的前端组件（路径速查）

**Terminal 壳层与导航**
- `src/components/terminal/TerminalLayout.jsx` — 100vw/100vh 深色壳层；含 `IconRail`（接收 `navItems` prop） + `TerminalHeader`（接收 `title` prop）；Dashboard 顶栏「发布岗位」按钮已移除（仅保留通知 / 用户胶囊 / 退出）
- `src/components/terminal/navItems.js` — 导出 `EMPLOYER_ICON_NAV` / `CANDIDATE_ICON_NAV` 两套图标导航
- `src/components/terminal/TerminalPageSurface.jsx` — 标准页面外壳：`flex-1 w-full min-w-0 + terminal-mode`；`split=true` 时切到双栏 row 布局；**所有企业 Terminal 页面外层统一用它**，不允许 `mx-auto` 放在最外层
- `src/components/terminal/FunctionRail.jsx` — 单实例 hover 展开（60px ↔ 228px），导出 `DEFAULT_FUNCTIONS`
- `src/components/terminal/AreaSidebar.jsx` — 始终 210px 展开，`Global` 为汇总项；导出 `DEFAULT_AREAS`（含 `Great China / East China / North China / South China / West China / Taiwan / Hong Kong`）
- `src/components/terminal/CandidateChartPanel.jsx` — Recharts 紫色柱状图 + 深色 tooltip + 空态；接收 `unitLabel` / `emptyText` prop
- `src/components/terminal/TerminalActionBar.jsx` — 接收 `actions` 数组；默认两条：发布岗位 → `/employer/jobs/new`、候选人池 → `/employer/candidates`

**Terminal 包装页**
- `src/pages/employer/TerminalJobs.jsx` → `<JobMarketplace terminal showNewJobButton />`
- `src/pages/employer/TerminalCandidates.jsx` → `<CandidatePool terminal messagesBasePath="/employer/messages" />`
- `src/pages/employer/TerminalMessages.jsx` → `<Messages terminal basePath="/employer/messages" />`
- `src/pages/employer/TerminalTags.jsx` → `<MyTags terminal />`
- `src/pages/employer/TerminalPostJob.jsx` → `<TerminalLayout title="JOBS"><PostJob terminal /></TerminalLayout>`
- `src/pages/employer/TerminalMatchResult.jsx` → `<TerminalLayout title="JOBS"><MatchResult terminal messagesBasePath="/employer/messages" /></TerminalLayout>`
- `src/pages/candidate/TerminalCandidateJobs.jsx` → `<JobMarketplace terminal />`（无 New Job 按钮）
- `src/pages/candidate/TerminalCandidateMessages.jsx` → `<Messages terminal basePath="/candidate/messages" />`
- `src/pages/candidate/TerminalCandidateTags.jsx`

**路由**
- `src/router/index.jsx` —
  - 企业 Terminal 路由：`/employer/dashboard`、`/employer/jobs`、`/employer/jobs/new`、`/employer/jobs/:jobId/match`、`/employer/candidates`、`/employer/messages` + `/employer/messages/:threadId`、`/employer/tags`
  - 旧路由兼容：`/employer/post-job` → `<Navigate to="/employer/jobs/new" replace />`、`/employer/match/:jobId` 直挂 `TerminalMatchResult`（避免重定向白屏）
  - 候选人 Terminal 路由：`/candidate/jobs`、`/candidate/messages` + `/candidate/messages/:threadId`、`/candidate/tags`
  - 公共浅色路由保留：`/jobs`、`/candidates`、`/messages` + `/messages/:threadId`、`/tags` 字符级未动
- `src/App.jsx` — `TERMINAL_PREFIXES` 列出走 Terminal 壳的路由前缀（employer/dashboard|jobs|candidates|post-job|match|messages|tags + candidate/home|jobs|messages|tags），命中时不渲染 Navbar/Footer

**样式 & 设计 token**
- `src/styles/terminal.css` — 设计 token + `.terminal-scrollbar` 工具类 + `.terminal-mode` scoped CSS 重映射（Tailwind 工具类如 `bg-white / border-slate-* / text-slate-* / .card / input/textarea / hover:bg-slate-* / shadow / bg-emerald-100 / bg-blue-100 / bg-amber-100 / border-blue-100 / border-emerald-100 / text-blue-800 / text-emerald-800` 等映射到 token）

### Phase 7 视觉改造规则（强制约束）

1. **页面采用 `terminal` prop 双分支**：所有共享业务页面（JobMarketplace / CandidatePool / Messages / MyTags / PostJob / MatchResult）必须保留 `terminal=false` 公共浅色分支字符级不变；token 化只在 `terminal=true` 分支生效。
2. **不允许 `mx-auto` / `maxWidth` 放在最外层**：外层用 `TerminalPageSurface` 或 `flex-1 w-full min-w-0` 铺满，内层用 `<div className="mx-auto w-full max-w-*">` 限宽。
3. **hover 切换用 JS `onMouseEnter/Leave`**，而非 Tailwind `hover:bg-*`，避免污染公共路径。
4. **InviteModal 已带 `terminal` prop**：从 CandidatePool / MatchResult 调用处透传 `terminal={terminal}`。
5. **`Messages.jsx` 内部跳转用 `basePath` prop**：`/messages/...` 公共默认；`/employer/messages/...`、`/candidate/messages/...` 由 wrapper 注入。`CandidatePool` / `MatchResult` 内部「进入沟通」用 `messagesBasePath` prop。
6. **顶部「返回」按钮 terminal 模式不用 `navigate(-1)`**：`Messages` 改为 `navigate('/employer/dashboard')`，避免跳出 Terminal 壳。
7. **Dashboard `selectedArea === 'Global'` 映射为后端 `regionValue: 'ALL'`**：UI 显示 Global，API 仍用 ALL，不破坏 `/api/employer/dashboard-chart` 现有契约。

### Phase 7 不要破坏的边界

- `src/api/client.js` / `AuthContext` / `RequireAuth` / `src/lib/socket.js` / `useSocket` 未改动，**继续保持不动**
- 后端、数据库 schema、迁移、Socket 服务端逻辑未改动（除 7-D 期间的 `conversations.py` try/except 增强）
- candidate 公共浅色路由 `/jobs` `/messages` `/tags` 未污染（candidate Terminal 走 `/candidate/jobs|messages|tags`）
- admin 页面未改动
- 登录注册页未改动
- `employerDashboardApi` 仍指向现有 `/api/employer/dashboard-chart`；下一步若上线 `/api/employer/terminal-dashboard`，应在 `src/api/employerDashboard.js` 内新增方法并在 Dashboard 中切换，不要替换现有方法
- `MatchScore` / `Badge` / `StatusBadge` / `TagList` / `Button` / `ChartTagSelector` 共享组件源码本轮 7-E 全部未触动，依赖 `.terminal-mode` scoped CSS 兜底；7-F 阶段统一加 `terminal` prop

### Phase 7 品牌名

`FreightTalent` → `ACE-Talent`（已全局替换：Navbar、Footer、Home、Login、TerminalLayout 顶栏品牌串、`index.html title`）

---

## 7. 已完成的 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | liveness probe（进程存活） |
| GET | `/api/ready` | readiness probe（DB + Redis 状态） |
| POST | `/api/auth/register` | 注册（employer/candidate/admin） |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/me` | 获取当前用户（需 token） |
| POST | `/api/auth/logout` | 登出（客户端清 token） |
| POST | `/api/jobs` | 创建岗位（employer/admin） |
| GET | `/api/jobs/my` | 获取当前企业自己的岗位列表 |
| GET | `/api/jobs/<id>` | 获取单个岗位详情 |
| GET | `/api/candidates/me` | 获取当前候选人自己的档案 |
| PUT | `/api/candidates/me` | 创建或更新候选人档案 |
| POST | `/api/candidates/upload-resume` | 上传简历文件（PDF/DOC/DOCX，≤10MB） |
| GET | `/api/candidates` | 候选人列表（employer/admin，支持 city/business_type/job_type/availability_status/q 过滤） |
| GET | `/api/candidates/<id>` | 候选人公开档案（employer/admin，不含敏感字段） |
| GET | `/api/jobs/<id>/match` | 计算匹配结果，upsert match_results，返回排序列表 |
| GET | `/api/jobs/public` | 公开岗位列表（所有已发布，支持 city/business_type/job_type/q 筛选） |
| POST | `/api/invitations` | 发起邀约（employer/admin，幂等） |
| GET | `/api/invitations/my` | 候选人查看收到的邀约（candidate/admin） |
| GET | `/api/invitations/company-summary` | 企业邀约汇总（total/replied/accepted/declined，employer/admin） |
| PATCH | `/api/invitations/<id>/status` | 候选人回复邀约（candidate/admin，pending→accepted/declined） |
| GET | `/api/conversations` | 当前用户的所有会话列表（employer/candidate/admin） |
| GET | `/api/conversations/<id>/messages` | 某条会话的消息列表（双方均可，权限校验） |
| POST | `/api/conversations/<id>/messages` | 发送消息到某条会话（双方均可，权限校验） |
| GET | `/api/invitations/sent` | 企业查看已发出邀约列表（employer/admin） |
| GET | `/api/admin/overview` | 管理后台运营总览（admin only，含统计/动态/趋势） |
| GET | `/api/v2/tags` | 查询 active 标签（?category= / ?q=） |
| GET | `/api/v2/tags/categories` | 所有 active category 列表 |
| POST | `/api/v2/tags` | 申请/创建新标签（admin→active，其余→pending） |
| GET | `/api/v2/tags/pending` | admin：待审批标签列表 |
| PATCH | `/api/v2/tags/{id}/review` | admin：通过/拒绝标签申请 |
| POST | `/api/v2/tags/import` | admin：Excel 批量导入标签 |
| GET | `/api/v2/tags/{id}/notes` | 某标签的所有 active 描述（公开） |
| GET | `/api/v2/tags/{id}/notes/me` | 当前用户对某标签的描述 |
| POST | `/api/v2/tags/{id}/notes` | 写/改当前用户对某标签的描述 |
| GET | `/api/v2/tags/notes/pending` | admin：待审批描述列表 |
| PATCH | `/api/v2/tags/notes/{id}/review` | admin：通过/拒绝描述申请 |
| GET | `/api/v2/settings/tag-approval` | admin：查询审批开关状态 |
| PATCH | `/api/v2/settings/tag-approval` | admin：切换审批开关 |

---

## 8. 角色权限

| 角色 | 可访问路由 |
|---|---|
| `employer` | `/employer/*`、`/candidates`、`/jobs` |
| `candidate` | `/candidate/*`（含 `/candidate/invitations`）、`/jobs` |
| `admin` | `/admin/*`、`/candidates`、`/jobs`、`/candidate/profile/:id` |
| 未登录 | `/`、`/login` |

路由守卫在 `src/router/index.jsx` 的 `RequireAuth` 组件中实现。

---

## 9. 每次任务完成后的输出格式

```
### 完成情况
- 修改了哪些文件（列出路径）
- 完成了什么功能

### 还缺什么
- 列出本次未覆盖的边界或已知问题

### 下一步建议
- 具体的下一个小任务
```

---

## 10. 部署架构（生产）

```
Internet (80/443)
    │
Nginx (frontend container) — 唯一对外入口
├── /api/v2/*   → FastAPI (fastapi:8000, 内网)
├── /api/*      → Flask   (backend:5000, 内网)
├── /socket.io/ → Flask   (backend:5000, 内网, WebSocket)
└── /*          → React SPA dist/

内网 app_net（不暴露端口）：
  backend / fastapi → db (mysql:3306) + redis (redis:6379)
```

**生产启动**：见 `DEPLOY.md`，核心命令：
```bash
cp .env.example .env           # 填写 DB_PASSWORD / JWT_SECRET_KEY / CORS_ORIGINS
docker compose build && docker compose up -d
docker compose exec backend flask db upgrade
```

---

## 11. 启动方式

```bash
# ── 前置：启动 Redis（本地 Docker 一行命令） ──────────────────────────────
docker run -d -p 6379:6379 redis:7-alpine

# ── 后端 Flask（在 backend/ 目录下，激活 .venv） ─────────────────────────
cd backend
../.venv/Scripts/activate   # Windows

pip install -r requirements.txt   # 首次安装

flask db upgrade                  # 首次建表 / 新迁移

python run.py                     # 开发启动（port 5000）

# 生产 Gunicorn：
gunicorn -c gunicorn.conf.py "app:create_app()"

# ── FastAPI 新模块（同目录，另开终端） ────────────────────────────────────
python fastapi_run.py             # 开发启动（port 8000，--reload）

# 生产 uvicorn：
uvicorn fastapi_app.main:app --host 0.0.0.0 --port 8000 --workers 4

# ── 前端（项目根目录） ──────────────────────────────────────────────────
npm run dev

# ── 测试 ───────────────────────────────────────────────────────────────
cd backend
pytest tests/ -v
```

路由约定：
- `/api/*`     → Flask（port 5000，存量接口）
- `/api/v2/*`  → FastAPI（port 8000，新增模块）
- `/socket.io` → Flask（eventlet WebSocket）
- Vite 代理自动按前缀分发

架构说明：
- Flask 继续承载：auth、jobs、candidates、invitations、conversations（存量）、Socket.IO、admin
- FastAPI 承载：新业务模块、性能敏感接口、后台任务入口（路由前缀 /api/v2）
- 两服务共用同一个 MySQL 数据库和 Redis 实例
- JWT 互通：Flask-JWT-Extended 颁发的 token 可在 FastAPI 侧直接验证（同一 secret + HS256）

前端默认 http://localhost:5173，Vite 代理按路径前缀分发到正确后端。
