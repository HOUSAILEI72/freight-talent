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
| `/admin/overview` | Overview | admin | mock |

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

---

## 7. 已完成的 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
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

## 10. 启动方式

```bash
# 后端（在 backend/ 目录下，激活 .venv）
cd backend
../.venv/Scripts/activate   # Windows

# 首次 / 新环境：安装依赖
pip install -r requirements.txt

# 首次 / 新建数据库：迁移建表（替代原 db.create_all）
flask db upgrade            # 应用全部迁移脚本，自动建表

# 日常开发：运行后端
python run.py

# 新增模型字段后：生成并应用新迁移
flask db migrate -m "describe your change"
flask db upgrade

# 前端（项目根目录）
npm run dev
```

前端默认 http://localhost:5173，后端 http://127.0.0.1:5000，Vite 代理自动转发 `/api/*`。
