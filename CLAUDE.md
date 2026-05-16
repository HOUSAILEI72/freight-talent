# ACE-Talent 项目指令

## 技术栈
- 前端：React 19 + Vite + Tailwind CSS
- 后端（现状）：Flask 3 + Flask-SQLAlchemy + MySQL + Redis
- 后端（目标）：FastAPI（异步）逐步替代 Flask，ORM 保留 SQLAlchemy（AsyncSession）
- 迁移路径：`backend/fastapi_app/` 已存在骨架，Flask 和 FastAPI 双进程并行，按 Phase 切流量

---

## Flask → FastAPI 迁移任务（长期进行中）

### 迁移原则
1. Flask（`backend/app/`）和 FastAPI（`backend/fastapi_app/`）**并行运行**，不得删除 Flask 路由直到对应 FastAPI 路由经过验证
2. 每次只迁移一个模块（一个 Phase），完成后停下报告，等用户确认再进入下一个
3. ORM 层保留 SQLAlchemy，AsyncSession 驱动；不引入 SQLModel
4. FastAPI 路由统一挂载在 `/api/v2/` 前缀下
5. 每个迁移的路由必须有对应的 Pydantic schema（放 `backend/fastapi_app/schemas/`）
6. 认证：复用 `backend/fastapi_app/core/auth.py` 的 JWT 依赖，不重复实现

### 迁移顺序（Phase）
| Phase | 模块 | Flask 文件 | FastAPI 目标路径 | 状态 |
|-------|------|-----------|----------------|------|
| 1 | 图表/统计 | `fastapi_app/api/v2/chart.py`（已存在） | 已完成骨架 | 🔄 进行中 |
| 2 | 标签/设置 | `fastapi_app/api/v2/tags.py` / `settings.py` | 已完成骨架 | 🔄 进行中 |
| 3 | 对话 | `app/routes/conversations.py` | `fastapi_app/api/v2/conversations.py` | ⬜ 待迁 |
| 4 | 候选人池 | `app/routes/candidates.py` | `fastapi_app/api/v2/candidates.py` | ⬜ 待迁 |
| 5 | 职位 | `app/routes/jobs.py` | `fastapi_app/api/v2/jobs.py` | ⬜ 待迁 |
| 6 | 雇主看板 | `app/routes/employer_dashboard.py` | `fastapi_app/api/v2/dashboard.py` | ⬜ 待迁 |
| 7 | 认证 | `app/routes/auth.py` | `fastapi_app/api/v2/auth.py` | ⬜ 待迁 |
| 8 | 订阅 | `app/routes/subscriptions.py` | `fastapi_app/api/v2/subscriptions.py` | ⬜ 待迁 |
| 9 | 其余路由 | admin / invitations / headhunting 等 | 待规划 | ⬜ 待迁 |

### 每个 Phase 的交付标准
- [ ] FastAPI 路由文件创建，挂载到 `main.py`
- [ ] Pydantic schema 文件创建
- [ ] 本地 `uvicorn` 启动无报错
- [ ] 对应 Flask 路由**保留不动**（等线上验证后再下线）
- [ ] 向用户报告：迁移了哪些端点、Breaking change、前端是否需要改 API 路径

---

## 通用开发规范

### 禁止事项
- 不得动 `src/pages/candidate/UploadResume.jsx`（公共上传路径）
- 不得修改 Navbar 的公共浅色样式（只能加 Terminal scoped token）
- 不得硬编码深色颜色值（必须用 CSS token）
- 不得删除 Flask 路由直到对应 FastAPI 路由上线验证完毕

### Terminal UI 规范
- 所有 Terminal 页面样式必须 scoped 在 `.terminal-theme` 下
- 颜色全部用 `var(--t-*)` token，不得写 `bg-gray-900` 等硬编码 Tailwind 深色类
- Hover 状态用 JS state 控制，不用 CSS `:hover`（移动端兼容）
- 不使用 `mx-auto` 居中

### 完成报告前必须执行
```bash
# 后端 smoke test
cd backend && python -m pytest tests/ -x -q 2>&1 | tail -5

# 前端构建验证
npx vite build --mode production 2>&1 | tail -5
```
