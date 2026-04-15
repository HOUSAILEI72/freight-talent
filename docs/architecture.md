# 系统架构

## 1. 总体结构

```text
Browser
  ├─ React SPA
  │   ├─ AuthContext
  │   ├─ axios client
  │   ├─ page components
  │   └─ Socket.IO client
  ├─ /api/* HTTP
  └─ /socket.io/* WebSocket / polling

Vite Dev Server or Nginx
  ├─ /api      -> Flask
  └─ /socket.io -> Flask-SocketIO

Flask App
  ├─ auth / jobs / candidates / invitations / conversations / admin
  ├─ SQLAlchemy
  ├─ JWT + refresh rotation
  ├─ Flask-Limiter
  └─ Socket.IO events

MySQL
  └─ users / jobs / candidates / match_results / invitations / conversation_threads / messages

Redis
  ├─ rate limit storage
  └─ JWT blocklist
```

## 2. 前端架构

### 2.1 入口与路由

- 入口：`src/main.jsx`
- 根组件：`src/App.jsx`
- 路由定义：`src/router/index.jsx`
- 鉴权守卫：`src/router/RequireAuth.jsx`

路由模式为 `createBrowserRouter`，所有业务页面都挂在根布局下。`Navbar` 始终显示，`Footer` 在 `/admin` 下隐藏。

### 2.2 认证层

核心文件：

- `src/context/AuthContext.jsx`
- `src/api/client.js`
- `src/api/auth.js`

职责拆分：

- `AuthContext` 管理 `user`、`loading`、`login`、`register`、`logout`
- `client.js` 负责：
  - 自动附带 `Authorization: Bearer <access_token>`
  - 401 时自动用 `refresh_token` 调 `/api/auth/refresh`
  - 刷新成功后重试原请求
  - 刷新失败后清除本地 session，并派发 `auth:session-expired`

前端当前把以下内容放在 `localStorage`：

- `token`
- `refresh_token`

### 2.3 API 封装层

`src/api/` 已按领域拆分：

- `auth.js`
- `jobs.js`
- `candidates.js`
- `matches.js`
- `invitations.js`
- `conversations.js`
- `admin.js`

这层是公司前端接入时最适合直接复用或一比一迁移的边界。

### 2.4 Socket 架构

核心文件：

- `src/lib/socket.js`
- `src/hooks/useSocket.js`
- `src/pages/messages/Messages.jsx`

设计特点：

- `socket.js` 使用单例，避免每个组件重复创建连接
- 连接参数通过 `query.token` 传 JWT
- `useSocket(enabled)` 管理连接生命周期和状态
- 支持 `websocket` 优先，失败后降级 `polling`
- 消息页同时保留轮询兜底

当前轮询策略：

- Navbar 未读数：30s
- 消息会话列表：60s
- 当前会话消息：30s

## 3. 后端架构

### 3.1 Flask app factory

入口：`backend/app/__init__.py`

初始化内容：

- `db`
- `jwt`
- `bcrypt`
- `cors`
- `migrate`
- `limiter`
- `socketio`

注册蓝图：

- `auth_bp` -> `/api/auth`
- `jobs_bp` -> `/api/jobs`
- `candidates_bp` -> `/api/candidates`
- `invitations_bp` -> `/api/invitations`
- `admin_bp` -> `/api/admin`
- `conversations_bp` -> `/api/conversations`

还包含：

- `/api/health`
- JWT blocklist 回调
- 429 JSON 统一错误处理
- `SERVE_STATIC=true` 时的 SPA 静态托管

### 3.2 扩展与基础设施

文件：`backend/app/extensions.py`

扩展说明：

- `db`: SQLAlchemy
- `jwt`: Flask-JWT-Extended
- `bcrypt`: 密码哈希
- `cors`: 仅放行 `/api/*`
- `migrate`: Alembic 集成
- `limiter`: 限流，默认不全局限，按接口单独配置
- `socketio`: Flask-SocketIO

JWT blocklist 策略：

- 生产：优先 Redis
- 开发：无 Redis 时退回内存 set

## 4. 配置模型

文件：`backend/app/config.py`

配置层次：

- `Config`
- `DevelopmentConfig`
- `ProductionConfig`

关键约束：

- `JWT_SECRET_KEY` 未配置会直接抛错，后端无法启动
- 生产环境要求显式配置 `RATELIMIT_STORAGE_URI`
- access token 默认 15 分钟
- refresh token 默认 7 天
- 上传目录默认 `backend/uploads`
- 最大上传体积 10 MB

## 5. 数据模型

## 5.1 表关系

| 表 | 作用 | 关键关系 |
| --- | --- | --- |
| `users` | 用户主表 | 1 对多 `jobs`、`messages`、`threads` |
| `jobs` | 企业岗位 | `company_id -> users.id` |
| `candidates` | 候选人档案 | `user_id -> users.id`，一对一 |
| `match_results` | 岗位与候选人匹配结果 | `job_id + candidate_id` 唯一 |
| `invitations` | 邀约记录 | 关联岗位、候选人、企业 |
| `conversation_threads` | 会话线程 | 一个邀约一个线程 |
| `messages` | 消息记录 | 属于 `conversation_threads` |

## 5.2 核心字段

### `users`

- `role`: `employer | candidate | admin`
- `company_name`: 仅企业用户使用
- `is_active`: 账户启停开关

### `jobs`

- 结构化字段：`title`、`city`、`salary_*`、`experience_required`、`degree_required`
- 业务标签：`business_type`、`job_type`
- JSON 标签：`route_tags`、`skill_tags`
- `status`: `draft | published | paused | closed`

### `candidates`

- 结构化字段：`full_name`、`current_title`、`current_city`、`expected_salary_*`
- 业务标签：`business_type`、`job_type`
- JSON 标签：`route_tags`、`skill_tags`
- `availability_status`: `open | passive | closed`
- 简历字段：`resume_file_path`、`resume_file_name`、`resume_uploaded_at`

### `match_results`

- `score`: 0-100
- `matched_tags`
- `score_breakdown`
- `reason_list`

### `invitations`

- `status`: `pending | accepted | declined`
- 当前已允许 declined 后再次发起新邀约

### `conversation_threads`

- 与 `invitation_id` 一对一
- 额外冗余保存 `job_id`、`candidate_id`、`employer_id`

### `messages`

- `sender_user_id`
- `sender_role`
- `content`
- `is_read`

## 6. 权限模型

| 角色 | 可访问能力 |
| --- | --- |
| `employer` | 发布岗位、查看自有岗位、候选人池、匹配、发邀约、消息 |
| `candidate` | 上传简历、维护档案、查看岗位广场、查看邀约、消息 |
| `admin` | 平台总览、查看所有会话、全局邀约与数据 |

前端路由守卫按 `roles.includes(user.role)` 实现；后端接口全部再次校验。

## 7. 认证链路

## 7.1 注册 / 登录

1. 前端调用 `/api/auth/register` 或 `/api/auth/login`
2. 后端返回：
   - `token`
   - `refresh_token`
   - `user`
3. 前端写入 `localStorage`
4. `AuthContext` 更新内存态

## 7.2 页面刷新恢复登录

1. `AuthProvider` 启动时读取 `localStorage.token`
2. 调 `/api/auth/me`
3. 成功则恢复 `user`
4. 失败则清除 token 与 refresh token

## 7.3 access token 续期

1. 任一请求返回 401
2. `axios` 响应拦截器检查本地 `refresh_token`
3. 向 `/api/auth/refresh` 发请求
4. 获取新 token 后重放原请求
5. 若刷新失败，派发 `auth:session-expired`

## 7.4 登出

前端会把 refresh token 一并传给 `/api/auth/logout`，后端同时撤销 access token 与 refresh token。

## 8. 匹配引擎

位置：`backend/app/routes/jobs.py::_compute_match`

当前权重：

| 维度 | 分值 |
| --- | --- |
| `skill_tags` | 40 |
| `route_tags` | 15 |
| `business_type` | 12 |
| `job_type` | 8 |
| `city` | 10 |
| `freshness` | 10 |
| `experience` | 5 |

说明：

- 只对 `availability_status="open"` 的候选人计算匹配
- 每次请求 `/api/jobs/<id>/match` 都会重新计算并 upsert 到 `match_results`
- 前端展示的推荐理由来自 `reason_list`

## 9. 消息链路

### 9.1 会话创建

触发入口：`POST /api/invitations`

逻辑：

1. 创建邀约
2. 自动创建 `conversation_threads`
3. 返回 `thread_id`

如果同一 `job + candidate` 已存在 `pending/accepted` 邀约：

- 不重复创建邀约
- 直接返回现有 `thread_id`

### 9.2 会话列表

入口：`GET /api/conversations`

按角色返回：

- 企业：自己的线程
- 候选人：与自己的候选人档案关联的线程
- 管理员：全部线程

### 9.3 消息发送

入口：`POST /api/conversations/<thread_id>/messages`

后端会：

1. 写入 `messages`
2. 更新 `thread.updated_at`
3. 向 `thread_{id}` 广播 `new_message`
4. 向 `user_{employer_id}` / `user_{candidate_user_id}` 广播 `conversation_updated`

### 9.4 已读

HTTP 与 Socket 双通路：

- 拉取消息第一页时，后端会把对方未读消息标记为已读
- 当前线程打开后，前端还会发 `mark_read`
- 后端向线程广播 `messages_read`

### 9.5 typing

前端在输入时发：

```json
{ "thread_id": 123, "is_typing": true }
```

后端向同线程其他在线成员广播：

```json
{ "thread_id": 123, "user_id": 9, "is_typing": true }
```

## 10. Socket 事件约定

| 方向 | 事件 | 载荷 |
| --- | --- | --- |
| client -> server | `join_thread` | `{ thread_id }` |
| client -> server | `leave_thread` | `{ thread_id }` |
| client -> server | `typing` | `{ thread_id, is_typing }` |
| client -> server | `mark_read` | `{ thread_id }` |
| server -> client | `new_message` | `Message` |
| server -> client | `conversation_updated` | `{ thread_id, latest_message, latest_message_at, updated_at, sender_user_id }` |
| server -> client | `typing` | `{ thread_id, user_id, is_typing }` |
| server -> client | `messages_read` | `{ thread_id, reader_user_id, read_by }` |

说明：

- `read_by` 是兼容字段
- 当前前端主要依赖 `reader_user_id`

## 11. 页面与真实数据边界

| 页面 | 真实 API 状态 | 说明 |
| --- | --- | --- |
| `Home` | 静态 | 不依赖后端 |
| `Login` | 真实 | 登录 / 注册 |
| `UploadResume` | 真实 | 上传文件 + 保存候选人档案 |
| `CandidateProfile` | 真实 | 自己档案与企业公开视角 |
| `MyInvitations` | 真实 | 收到邀约 + 回复 |
| `JobMarketplace` | 真实 | 岗位广场 |
| `CandidatePool` | 真实 | 候选人列表、筛选、邀约 |
| `PostJob` | 真实 | 创建岗位 |
| `MatchResult` | 真实 | 匹配结果与邀约 |
| `Dashboard` | 真实 | 岗位列表、邀约汇总 |
| `Messages` | 真实 | 会话和消息 |
| `Admin/Overview` | 真实 | 统计、动态、趋势 |

## 12. 部署结构

### 12.1 开发环境

- 前端：Vite
- 后端：`python run.py`
- Vite 代理 HTTP 与 Socket.IO

### 12.2 Docker 环境

- 前端：Nginx 托管 `dist/`
- 后端：Gunicorn + eventlet
- Nginx 已代理：
  - `/api/`
  - `/socket.io/`

### 12.3 后端托管静态资源

可通过 `SERVE_STATIC=true` 让 Flask 直接托管前端 `dist/`，适合单体部署。

## 13. 迁移现状

当前推荐基线是：

- `0001_baseline_schema`

说明：

- 早期迁移历史存在“数据库先手工建表、再补迁移”的痕迹
- `backend/migrations/MIGRATION_NOTES.md` 已记录基线化处理方式
- 新环境应直接执行 `flask db upgrade`

## 14. 当前已修正的对接问题

本次整理中已同步修正以下与实际联调强相关的问题：

- `Socket.IO typing` 事件现在会携带 `thread_id`
- `messages_read` 事件现在会返回 `reader_user_id`
- Nginx 现在会代理 `/socket.io/`
- `backend/Dockerfile` 已切换为 `gunicorn + eventlet`，与 Flask-SocketIO 设计一致
