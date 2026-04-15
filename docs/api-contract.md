# API 契约

本文档以当前代码实现为准，不以历史说明或页面文案为准。

## 1. 通用约定

### 1.1 基础地址

- 开发环境：`http://127.0.0.1:5000/api`
- 前端开发代理：统一走 `/api`

### 1.2 鉴权

除 `/api/health` 外，当前接口基本都要求登录。

请求头：

```http
Authorization: Bearer <access_token>
```

refresh token 的使用方式：

- 接口：`POST /api/auth/refresh`
- 请求头：`Authorization: Bearer <refresh_token>`

### 1.3 时间格式

后端主要返回 ISO 8601 字符串，格式略有两类：

- `2026-04-15T12:34:56`
- `2026-04-15T12:34:56Z`

前端接入时应统一做时间解析，不要假设所有时间都带 `Z`。

### 1.4 ID 规则

- `user.id`、`job.id`、`candidate.id`、`invitation.id`、`thread.id`、`message.id` 均为数字
- 候选人公开档案接口只接受数字候选人 ID

### 1.5 错误返回

当前后端错误响应并不完全统一，前端适配时必须兼容两种主流形态：

```json
{ "success": false, "message": "..." }
```

```json
{ "message": "..." }
```

429 已统一为：

```json
{
  "success": false,
  "message": "请求过于频繁，请稍后再试",
  "retry_after": null
}
```

## 2. 主要对象

## 2.1 User

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 用户 ID |
| `email` | string | 登录邮箱 |
| `role` | string | `employer` / `candidate` / `admin` |
| `name` | string | 用户显示名 |
| `company_name` | string \| null | 企业用户公司名 |
| `created_at` | string \| null | 创建时间 |

## 2.2 Job

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 岗位 ID |
| `company_id` | number | 发布者用户 ID |
| `company_name` | string \| null | 企业名称 |
| `title` | string | 岗位标题 |
| `city` | string | 工作城市 |
| `salary_min` / `salary_max` | number \| null | 解析后的薪资范围 |
| `salary_label` | string \| null | 原始薪资文本 |
| `experience_required` | string \| null | 经验要求 |
| `degree_required` | string \| null | 学历要求 |
| `headcount` | number \| null | 招聘人数 |
| `description` | string | 岗位职责 |
| `requirements` | string \| null | 任职要求 |
| `business_type` | string \| null | 行业方向 |
| `job_type` | string \| null | 岗位类型 |
| `route_tags` | string[] | 航线标签 |
| `skill_tags` | string[] | 技能标签 |
| `urgency_level` | number \| null | `1/2/3` |
| `status` | string | `draft/published/paused/closed` |
| `created_at` / `updated_at` | string \| null | 时间戳 |

## 2.3 CandidatePrivate

候选人本人查看或保存自己的档案时使用。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 候选人档案 ID |
| `user_id` | number | 绑定用户 ID |
| `full_name` | string | 姓名 |
| `current_title` | string | 当前职务 |
| `current_company` | string \| null | 当前公司 |
| `current_city` | string | 当前城市 |
| `expected_city` | string \| null | 期望城市 |
| `expected_salary_min` / `expected_salary_max` | number \| null | 薪资数值 |
| `expected_salary_label` | string \| null | 薪资文案 |
| `experience_years` | number \| null | 工作年限 |
| `education` | string \| null | 学历 |
| `english_level` | string \| null | 英语等级 |
| `summary` | string \| null | 个人简介 |
| `business_type` | string \| null | 行业方向 |
| `job_type` | string \| null | 岗位类型 |
| `route_tags` / `skill_tags` | string[] | 标签 |
| `all_tags` | string[] | 聚合标签 |
| `availability_status` | string | `open/passive/closed` |
| `resume_file_name` | string \| null | 简历文件名 |
| `resume_uploaded_at` | string \| null | 简历上传时间 |
| `profile_confirmed_at` | string \| null | 档案确认时间 |
| `freshness_days` | number | 新鲜度天数 |
| `last_active_at` | string \| null | 最近活跃时间 |
| `created_at` / `updated_at` | string \| null | 时间戳 |

## 2.4 CandidatePublic

企业或管理员查看候选人时使用。

与 `CandidatePrivate` 相比，移除了：

- `user_id`
- `resume_file_path`

其他主要字段保留，用于筛选与展示。

## 2.5 MatchResult

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 记录 ID |
| `job_id` | number | 岗位 ID |
| `candidate_id` | number | 候选人 ID |
| `score` | number | 总分 0-100 |
| `matched_tags` | string[] | 命中标签 |
| `score_breakdown` | object | 各维度评分 |
| `reason_list` | string[] | 推荐理由 |
| `candidate` | CandidatePublic | 候选人公开档案 |

## 2.6 Invitation

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 邀约 ID |
| `job_id` | number | 岗位 ID |
| `candidate_id` | number | 候选人 ID |
| `employer_id` | number | 发起方用户 ID |
| `message` | string \| null | 邀约说明 |
| `status` | string | `pending/accepted/declined` |
| `created_at` / `updated_at` | string \| null | 时间戳 |
| `thread_id` | number \| null | 会话线程 ID，部分接口会附带 |

## 2.7 ConversationSummary

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 线程 ID |
| `invitation_id` | number | 邀约 ID |
| `invitation_status` | string | 邀约状态 |
| `job_id` | number | 岗位 ID |
| `job_title` | string | 岗位名 |
| `company_name` | string | 企业名 |
| `candidate_id` | number | 候选人 ID |
| `candidate_name` | string | 候选人名 |
| `employer_id` | number | 企业用户 ID |
| `latest_message` | string \| null | 最新消息摘要 |
| `latest_message_at` | string \| null | 最新消息时间 |
| `updated_at` | string \| null | 线程更新时间 |
| `unread_count` | number | 当前用户未读数 |

## 2.8 Message

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 消息 ID |
| `thread_id` | number | 线程 ID |
| `sender_user_id` | number | 发送者用户 ID |
| `sender_role` | string | 发送者角色 |
| `sender_name` | string \| null | 发送者展示名 |
| `content` | string | 消息内容 |
| `is_read` | boolean | 是否已读 |
| `created_at` | string \| null | 发送时间 |

## 3. 接口总览

| 方法 | 路径 | 角色 | 说明 |
| --- | --- | --- | --- |
| GET | `/health` | 无 | 健康检查 |
| POST | `/auth/register` | 无 | 注册 employer/candidate |
| POST | `/auth/login` | 无 | 登录 |
| GET | `/auth/me` | 已登录 | 获取当前用户 |
| POST | `/auth/logout` | 可选 JWT | 登出并拉黑 token |
| POST | `/auth/refresh` | refresh token | 刷新 access token |
| POST | `/jobs` | employer/admin | 创建岗位 |
| GET | `/jobs/public` | candidate/employer/admin | 已发布岗位列表 |
| GET | `/jobs/my` | employer/admin | 当前企业岗位列表 |
| GET | `/jobs/:id` | 已登录 | 单岗位详情 |
| GET | `/jobs/:id/match` | employer/admin | 计算并获取匹配结果 |
| GET | `/candidates/me` | candidate/admin | 自己的候选人档案 |
| PUT | `/candidates/me` | candidate/admin | 创建或更新档案 |
| POST | `/candidates/upload-resume` | candidate/admin | 上传简历 |
| GET | `/candidates` | employer/admin | 候选人池 |
| GET | `/candidates/:id` | employer/admin | 候选人公开档案 |
| POST | `/invitations` | employer/admin | 发起邀约 |
| GET | `/invitations/sent` | employer/admin | 已发邀约 |
| GET | `/invitations/my` | candidate/admin | 收到邀约 |
| GET | `/invitations/company-summary` | employer/admin | 企业邀约汇总 |
| PATCH | `/invitations/:id/status` | candidate/admin | 回复邀约 |
| GET | `/conversations` | employer/candidate/admin | 会话列表 |
| GET | `/conversations/:id/messages` | employer/candidate/admin | 会话消息 |
| POST | `/conversations/:id/messages` | employer/candidate/admin | 发送消息 |
| GET | `/admin/overview` | admin | 平台总览 |

## 4. 认证接口

## 4.1 POST `/auth/register`

用途：注册企业或候选人账号。

请求体：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `email` | 是 | 邮箱 |
| `password` | 是 | 至少 6 位 |
| `name` | 是 | 姓名 |
| `role` | 是 | `employer` / `candidate` |
| `company_name` | 企业必填 | 企业名 |

注意：

- `admin` 不允许公开注册
- 已注册邮箱返回 `409`

成功响应：

```json
{
  "success": true,
  "token": "...",
  "refresh_token": "...",
  "user": { "...": "User" }
}
```

## 4.2 POST `/auth/login`

请求体：

| 字段 | 必填 |
| --- | --- |
| `email` | 是 |
| `password` | 是 |

成功响应同注册。

限流：

- `20 per hour; 5 per minute`

## 4.3 GET `/auth/me`

返回：

```json
{
  "success": true,
  "user": { "...": "User" }
}
```

## 4.4 POST `/auth/logout`

鉴权：`@jwt_required(optional=True)`

请求体可带：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `refresh_token` | 否 | 用于同时撤销 refresh token |

响应：

```json
{ "success": true, "message": "已退出登录" }
```

## 4.5 POST `/auth/refresh`

要求：

- 请求头里的 Bearer token 必须是 refresh token

响应：

```json
{
  "success": true,
  "token": "...",
  "refresh_token": "..."
}
```

## 5. 岗位接口

## 5.1 POST `/jobs`

角色：`employer` / `admin`

请求体：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 岗位标题 |
| `city` | 是 | 工作城市 |
| `description` | 是 | 岗位职责 |
| `salary_label` | 否 | 例：`20k-30k` / `面议` |
| `experience_required` | 否 | 文本 |
| `degree_required` | 否 | 文本 |
| `headcount` | 否 | 1-9999 |
| `requirements` | 否 | 任职要求 |
| `business_type` | 否 | 行业方向 |
| `job_type` | 否 | 岗位类型 |
| `route_tags` | 否 | string[] |
| `skill_tags` | 否 | string[] |
| `urgency_level` | 否 | 1 / 2 / 3 |
| `status` | 否 | 默认 `published` |

成功响应：

```json
{
  "success": true,
  "job": { "...": "Job" }
}
```

## 5.2 GET `/jobs/public`

角色：已登录的 `candidate` / `employer` / `admin`

查询参数：

| 参数 | 说明 |
| --- | --- |
| `city` | 精确匹配 |
| `business_type` | 精确匹配 |
| `job_type` | 精确匹配 |
| `q` | 模糊匹配 `title` / `city` |

返回：

```json
{
  "success": true,
  "jobs": [],
  "total": 0
}
```

## 5.3 GET `/jobs/my`

角色：`employer` / `admin`

返回当前企业自己发布的岗位列表。

## 5.4 GET `/jobs/:job_id`

权限规则：

- `candidate` 只能查看 `published`
- `employer` 只能查看自己的岗位
- `admin` 不限制

## 5.5 GET `/jobs/:job_id/match`

角色：`employer` / `admin`

响应：

```json
{
  "success": true,
  "job": { "...": "Job" },
  "matches": [
    {
      "...": "MatchResult",
      "candidate": { "...": "CandidatePublic" }
    }
  ],
  "total": 3
}
```

说明：

- 每次请求都会重新计算匹配结果
- 只返回 `score > 0` 的候选人

## 6. 候选人接口

## 6.1 GET `/candidates/me`

角色：`candidate` / `admin`

返回：

```json
{
  "success": true,
  "profile": null
}
```

或

```json
{
  "success": true,
  "profile": { "...": "CandidatePrivate" }
}
```

## 6.2 PUT `/candidates/me`

角色：`candidate` / `admin`

请求体常用字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `full_name` | 是 | 姓名 |
| `current_title` | 是 | 当前职务 |
| `current_city` | 是 | 当前城市 |
| `current_company` | 否 | 当前公司 |
| `expected_city` | 否 | 期望城市 |
| `expected_salary_label` | 否 | 文本薪资 |
| `experience_years` | 否 | 0-60 |
| `education` | 否 | 学历 |
| `english_level` | 否 | 英语等级 |
| `summary` | 否 | 自我介绍 |
| `business_type` | 否 | 行业方向 |
| `job_type` | 否 | 岗位类型 |
| `route_tags` / `skill_tags` | 否 | 标签数组 |
| `availability_status` | 否 | `open/passive/closed` |

说明：

- 该接口同时承担“创建”与“更新”
- 保存时会刷新 `profile_confirmed_at` 与 `last_active_at`

## 6.3 POST `/candidates/upload-resume`

角色：`candidate` / `admin`

请求类型：

- `multipart/form-data`
- 字段名：`file`

限制：

- 仅支持 `pdf/doc/docx`
- 最大 10 MB

返回：

```json
{
  "success": true,
  "file_name": "resume.pdf",
  "uploaded_at": "2026-04-15T12:34:56",
  "profile": { "...": "CandidatePrivate" }
}
```

重要行为：

- 如果候选人还没有档案，上传时会先自动创建一份“未完整填写”的档案
- 这份档案默认 `availability_status = "closed"`
- 前端必须继续调用 `PUT /candidates/me` 才算真正发布档案

## 6.4 GET `/candidates`

角色：`employer` / `admin`

查询参数：

| 参数 | 说明 |
| --- | --- |
| `city` | 匹配 `current_city` 或 `expected_city` |
| `business_type` | 精确匹配 |
| `job_type` | 精确匹配 |
| `availability_status` | `open` / `passive` / `all` |
| `q` | 模糊匹配 `full_name/current_title/current_city` |

注意：

- 不传 `availability_status` 时，默认只返回 `open`
- `all` 也只会返回 `open + passive`，不会返回 `closed`

响应：

```json
{
  "success": true,
  "candidates": [],
  "total": 0
}
```

## 6.5 GET `/candidates/:candidate_id`

角色：`employer` / `admin`

返回候选人公开档案。

企业侧限制：

- `availability_status = closed` 的候选人，企业不可查看

## 7. 邀约接口

## 7.1 POST `/invitations`

角色：`employer` / `admin`

请求体：

| 字段 | 必填 |
| --- | --- |
| `job_id` | 是 |
| `candidate_id` | 是 |
| `message` | 否 |

响应分两种：

### 新建成功

状态码：`201`

```json
{
  "message": "邀约已发出",
  "invitation": { "...": "Invitation" },
  "thread_id": 123,
  "already_existed": false
}
```

### 已存在 pending/accepted 邀约

状态码：`200`

```json
{
  "message": "已存在邀约",
  "invitation": { "...": "Invitation" },
  "thread_id": 123,
  "already_existed": true
}
```

业务约束：

- `employer` 只能对自己岗位发邀约
- 岗位必须是 `published`
- `candidate.availability_status = closed` 时不可邀约
- `declined` 后允许重新发起一条新邀约

## 7.2 GET `/invitations/sent`

角色：`employer` / `admin`

返回：

```json
{
  "invitations": [],
  "total": 0
}
```

## 7.3 GET `/invitations/my`

角色：`candidate` / `admin`

返回项会附带：

- `job_title`
- `company_name`
- `job_city`
- `thread_id`

## 7.4 GET `/invitations/company-summary`

角色：`employer` / `admin`

返回：

```json
{
  "total": 10,
  "replied": 6,
  "accepted": 4,
  "declined": 2
}
```

## 7.5 PATCH `/invitations/:inv_id/status`

角色：`candidate` / `admin`

请求体：

```json
{ "status": "accepted" }
```

允许值：

- `accepted`
- `declined`

注意：

- 只有 `pending` 能修改
- 已回复的邀约再次修改会返回 `409`

## 8. 会话与消息接口

## 8.1 GET `/conversations`

角色：`employer` / `candidate` / `admin`

返回：

```json
{
  "success": true,
  "conversations": [],
  "total_unread": 0
}
```

## 8.2 GET `/conversations/:thread_id/messages`

角色：`employer` / `candidate` / `admin`

查询参数：

| 参数 | 默认 | 说明 |
| --- | --- | --- |
| `limit` | 20 | 1-100 |
| `before` | 无 | 加载更旧消息，传 message id |

返回：

```json
{
  "success": true,
  "thread": { "...": "ConversationSummary" },
  "messages": [],
  "has_more": true,
  "next_before": 456
}
```

注意：

- 首次打开线程时，后端会把“对方发来的未读消息”标记为已读
- `before` 模式只做分页，不触发自动已读

## 8.3 POST `/conversations/:thread_id/messages`

角色：`employer` / `candidate` / `admin`

请求体：

```json
{ "content": "你好，方便沟通吗？" }
```

限制：

- 不能为空
- 最长 2000 字

返回：

```json
{
  "success": true,
  "message": { "...": "Message" }
}
```

发送后还会触发 Socket 广播。

## 9. 管理后台接口

## 9.1 GET `/admin/overview`

角色：`admin`

返回结构：

```json
{
  "stats": {
    "total_users": 0,
    "total_candidates": 0,
    "total_employers": 0,
    "total_admins": 0,
    "total_jobs": 0,
    "published_jobs": 0,
    "total_invitations": 0,
    "pending_invitations": 0,
    "accepted_invitations": 0,
    "declined_invitations": 0,
    "total_match_results": 0,
    "new_users_7d": 0,
    "new_jobs_7d": 0,
    "new_candidates_7d": 0,
    "new_invitations_7d": 0
  },
  "activity": [],
  "trend_7d": [],
  "fetched_at": "2026-04-15T12:34:56Z"
}
```

说明：

- `activity` 为最近邀约、岗位、候选人动态聚合
- `trend_7d` 为近 7 天 candidates/jobs/invitations 数量趋势

## 10. 健康检查

## 10.1 GET `/health`

无鉴权。

正常示例：

```json
{
  "status": "ok",
  "service": "freight-talent-api",
  "checks": {
    "database": "ok"
  }
}
```

数据库异常时会返回 `503`。

## 11. Socket.IO 契约

连接地址：

- 开发：`/socket.io`
- 当前前端连接方式：`io('/', { path: '/socket.io', query: { token } })`

### client -> server

| 事件 | 载荷 |
| --- | --- |
| `join_thread` | `{ thread_id }` |
| `leave_thread` | `{ thread_id }` |
| `typing` | `{ thread_id, is_typing }` |
| `mark_read` | `{ thread_id }` |

### server -> client

| 事件 | 载荷 |
| --- | --- |
| `connected` | `{ status, user_id }` |
| `joined` | `{ thread_id }` |
| `new_message` | `Message` |
| `conversation_updated` | `{ thread_id, latest_message, latest_message_at, updated_at, sender_user_id }` |
| `typing` | `{ thread_id, user_id, is_typing }` |
| `messages_read` | `{ thread_id, reader_user_id, read_by }` |

## 12. 接入建议

给公司前端的最低建议是：

1. 在请求层统一兼容两类错误结构
2. 把时间字符串统一转成本地时间对象或格式化函数
3. 把 `Invitation`、`ConversationSummary`、`CandidatePublic/Private` 做成独立类型
4. 对消息模块同时保留 Socket 与轮询兜底
