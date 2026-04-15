# 前端交接指南

本文档面向“公司已有前端团队，需要接入当前 FreightTalent 后端能力”的场景。

目标不是继续复用本仓库 UI，而是把当前项目沉淀出的真实接口、权限、状态机、实时消息能力稳定交给新的前端实现。

## 1. 先明确交接边界

建议把交接范围分成两层：

### 1.1 必须复用的后端能力

- 用户认证：注册、登录、刷新、登出、`me`
- 岗位能力：发岗位、看岗位、岗位广场
- 候选人能力：上传简历、编辑档案、候选人池
- 邀约能力：发邀约、候选人回复、企业统计
- 消息能力：会话列表、消息分页、Socket 实时消息
- 管理能力：`/api/admin/overview`

### 1.2 可以完全重写的前端层

- 页面 UI
- 组件设计系统
- 状态管理实现方式
- 路由结构命名
- BFF 或网关层适配

也就是说，公司前端不需要继承当前 React 页面，但必须遵守当前后端契约。

## 2. 推荐接入方式

不要直接在新前端页面里散落调用接口，建议保持和当前项目相同的分层：

```text
company-frontend/
├── api/
│   ├── client.ts            # axios/fetch 封装、Bearer token、refresh 续期
│   ├── auth.ts
│   ├── jobs.ts
│   ├── candidates.ts
│   ├── invitations.ts
│   ├── conversations.ts
│   └── admin.ts
├── auth/
│   ├── auth-store.ts
│   └── permission.ts
├── modules/
│   ├── employer/
│   ├── candidate/
│   ├── admin/
│   └── messages/
└── adapters/
    └── normalize.ts         # 时间、错误对象、字段兼容转换
```

这层抽象可以让后续接口调整只影响 `api/` 和 `adapters/`。

## 3. 必做的全局能力

## 3.1 认证状态

新前端必须有一个全局 auth store，至少维护：

- `accessToken`
- `refreshToken`
- `currentUser`
- `isAuthResolved`

登录后保存：

- `token`
- `refresh_token`
- `user`

刷新页面后流程：

1. 读取本地 `token`
2. 请求 `/api/auth/me`
3. 成功则恢复登录态
4. 失败则尝试 refresh 或直接清 session

## 3.2 自动刷新 token

必须在请求层统一实现：

1. 请求 401
2. 用 `refresh_token` 调 `/api/auth/refresh`
3. 成功则更新 token 并重放原请求
4. 失败则清空登录态并跳回登录页

这是当前项目的核心鉴权模型，不能靠页面层手工处理。

## 3.3 权限控制

至少按角色控制页面可见性：

- `employer`
- `candidate`
- `admin`

同时记住：前端路由守卫只是体验层，真正权限以服务端校验为准。

## 3.4 统一错误适配

后端错误有两种主格式：

```json
{ "success": false, "message": "..." }
```

```json
{ "message": "..." }
```

建议统一做一个方法：

```ts
function getApiErrorMessage(error: unknown): string
```

优先级建议：

1. `error.response.data.message`
2. `error.message`
3. 默认兜底文案

## 3.5 时间字段适配

后端时间既有带 `Z` 的，也有不带 `Z` 的。不要直接字符串切片作为唯一方案。

建议在 adapter 层统一：

- `parseApiDate(value)`
- `formatDate(value)`
- `formatRelativeTime(value)`

## 4. 页面替换顺序

如果公司前端要逐步接管，而不是一次性重写，建议顺序如下。

### 第一阶段：认证与雇主核心流

1. 登录/注册
2. 企业发布岗位
3. 企业岗位列表
4. 候选人池
5. 发邀约

原因：

- 这条链路最接近业务核心
- 接口边界清晰
- 不依赖实时消息

### 第二阶段：候选人核心流

1. 简历上传
2. 编辑候选人档案
3. 我的邀约
4. 个人档案展示

### 第三阶段：消息与实时

1. 会话列表
2. 消息分页
3. Socket 实时消息
4. typing 和已读

### 第四阶段：管理后台

1. 概览卡片
2. 趋势图
3. 实时动态

## 5. 页面与接口映射

| 页面能力 | 接口 | 是否实时 | 备注 |
| --- | --- | --- | --- |
| 登录 | `POST /api/auth/login` | 否 | 返回 access + refresh |
| 注册 | `POST /api/auth/register` | 否 | 仅 employer/candidate |
| 恢复登录 | `GET /api/auth/me` | 否 | 刷新页面时调用 |
| 岗位广场 | `GET /api/jobs/public` | 否 | 当前实现需登录 |
| 发布岗位 | `POST /api/jobs` | 否 | employer/admin |
| 企业岗位列表 | `GET /api/jobs/my` | 否 | employer/admin |
| 候选人池 | `GET /api/candidates` | 否 | employer/admin |
| 候选人公开档案 | `GET /api/candidates/:id` | 否 | 仅数字 ID |
| 上传简历 | `POST /api/candidates/upload-resume` | 否 | multipart |
| 保存候选人档案 | `PUT /api/candidates/me` | 否 | 也是创建接口 |
| 候选人查看自己档案 | `GET /api/candidates/me` | 否 | candidate/admin |
| 匹配结果 | `GET /api/jobs/:id/match` | 否 | 每次都会重新计算 |
| 发邀约 | `POST /api/invitations` | 否 | pending/accepted 幂等 |
| 我的邀约 | `GET /api/invitations/my` | 否 | candidate/admin |
| 企业邀约统计 | `GET /api/invitations/company-summary` | 否 | dashboard 使用 |
| 回复邀约 | `PATCH /api/invitations/:id/status` | 否 | 只能从 pending 改 |
| 会话列表 | `GET /api/conversations` | 半实时 | 有 Socket 更新 + 轮询兜底 |
| 消息列表 | `GET /api/conversations/:id/messages` | 半实时 | 分页 |
| 发消息 | `POST /api/conversations/:id/messages` | 是 | Socket 广播 |
| 管理概览 | `GET /api/admin/overview` | 否 | admin only |

## 6. 两条关键业务流

## 6.1 企业端主链路

```text
登录
  -> 创建岗位
  -> 查看岗位列表
  -> 查看候选人池
  -> 选择岗位 + 发邀约
  -> 候选人回复
  -> 进入消息
```

公司前端最先接这一条，最容易产生业务价值。

## 6.2 候选人端主链路

```text
登录
  -> 上传简历
  -> 完善档案
  -> 发布 open/passive 状态
  -> 查看收到的邀约
  -> 接受/拒绝
  -> 进入消息
```

这里最容易漏掉的一步是：

- 上传简历不等于档案已发布
- 还要再调一次 `PUT /api/candidates/me`

## 7. 表单对接重点

## 7.1 企业发岗位

建议公司前端内部表单字段：

```ts
type JobForm = {
  title: string
  city: string
  salaryLabel?: string
  description: string
  requirements?: string
  businessType?: string
  jobType?: string
  routeTags: string[]
  skillTags: string[]
  urgencyLevel?: 1 | 2 | 3
}
```

提交时映射为后端字段：

- `salaryLabel -> salary_label`
- `businessType -> business_type`
- `jobType -> job_type`
- `routeTags -> route_tags`
- `skillTags -> skill_tags`
- `urgencyLevel -> urgency_level`

## 7.2 候选人档案

建议公司前端内部表单字段：

```ts
type CandidateProfileForm = {
  fullName: string
  currentTitle: string
  currentCompany?: string
  currentCity: string
  expectedCity?: string
  expectedSalaryLabel?: string
  experienceYears?: number
  education?: string
  englishLevel?: string
  summary?: string
  businessType?: string
  jobType?: string
  routeTags: string[]
  skillTags: string[]
  availabilityStatus: 'open' | 'passive' | 'closed'
}
```

提交时统一转为 snake_case。

## 7.3 邀约

邀约表单最低字段：

```ts
type InvitationForm = {
  jobId: number
  candidateId: number
  message?: string
}
```

注意幂等行为：

- 若同一岗位同一候选人已有 `pending/accepted` 邀约
- 后端会直接返回已有记录和 `thread_id`
- 前端不应把它当失败

## 8. 消息模块接入

## 8.1 HTTP 与 Socket 要并存

不要只做 WebSocket，不要只做轮询，建议保持双通路：

- HTTP 负责初始拉取和断线恢复
- Socket 负责实时增量更新
- 轮询作为兜底

原因：

- 当前后端和现有前端就是这么设计的
- 这样最抗弱网和断连

## 8.2 连接方式

前端连接参数：

```ts
io('/', {
  path: '/socket.io',
  query: { token: accessToken },
  transports: ['websocket', 'polling']
})
```

## 8.3 必接事件

### client -> server

- `join_thread`
- `leave_thread`
- `typing`
- `mark_read`

### server -> client

- `new_message`
- `conversation_updated`
- `typing`
- `messages_read`

## 8.4 推荐消息页实现顺序

1. 先做会话列表 HTTP
2. 再做消息分页 HTTP
3. 再接 `new_message`
4. 再接 `conversation_updated`
5. 最后补 `typing` 和 `messages_read`

这样最稳。

## 9. 公司前端最容易踩的坑

### 9.1 `/jobs/public` 不是匿名接口

名字叫 `public`，但当前实现仍有 `@jwt_required()`。

### 9.2 候选人公开档案只认数字 ID

不要继续沿用早期演示时期的 `c001` 这类字符串 ID。

### 9.3 上传简历后档案并不会自动“上线”

`upload-resume` 只是上传文件，若候选人尚未补齐资料，档案会保持 `closed`。

### 9.4 候选人池默认只返回 open

不传 `availability_status` 时默认过滤掉 passive 和 closed。

### 9.5 `availability_status=all` 也不返回 closed

当前服务端实现里，`all` 实际等于 `open + passive`。

### 9.6 邀约成功不一定是 201

已有 pending/accepted 邀约时会返回 200 + `already_existed=true`。

### 9.7 错误结构不统一

新前端一定要做 adapter 层，不要在每个页面里手写 `err.response?.data?.message`。

### 9.8 时间字段格式不完全统一

同一个系统里同时存在带 `Z` 和不带 `Z` 的时间串。

### 9.9 生产环境必须保证 `/socket.io` 被代理

这次整理里已经修正了仓库内 `nginx.conf`，但如果公司前端自己挂 Nginx 或网关，也必须保留 WebSocket 代理。

## 10. 推荐的交接 checklist

在公司前端真正切换流量前，至少逐项确认：

1. 登录、刷新 token、登出都已跑通
2. 401 自动刷新和失败回登录已跑通
3. employer 只能看自己的岗位
4. candidate 只能改自己的档案和自己的邀约
5. 简历上传支持 `multipart/form-data`
6. 候选人池筛选参数和服务端字段名一致
7. 邀约接口已正确处理 `already_existed`
8. 会话列表支持未读数
9. 消息列表支持分页 `before`
10. Socket `typing` / `messages_read` 已验证
11. 生产网关已代理 `/api` 和 `/socket.io`
12. 管理员账号通过 CLI 创建而不是公开注册

## 11. 最小交接方案

如果时间非常紧，公司前端至少先接入以下页面：

1. 登录页
2. 企业发岗位页
3. 企业岗位列表页
4. 候选人池页
5. 邀约页/弹窗
6. 候选人“我的邀约”页

这样即使暂时不上实时消息，也能先把撮合闭环跑起来。

## 12. 建议结论

对接公司前端时，不建议“直接复刻当前 React 页面”，建议“保留后端契约，重建前端壳层”。

最稳的做法是：

1. 先把 `auth + api client + permission + normalize` 四层搭好
2. 再按“企业主链路 -> 候选人主链路 -> 消息 -> 管理台”的顺序逐步接入
3. 只要后端契约不变，UI、状态库、框架都可以替换
