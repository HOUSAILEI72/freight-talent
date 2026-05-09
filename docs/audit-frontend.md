# ACE-Talent 前端全量审计

**路径：** `/Users/edy/Desktop/货代招聘/src/`
**技术栈：** React 19, Vite 8, Tailwind CSS v4, React Router v7, Axios, Socket.IO Client, Recharts, Lucide React
**审计日期：** 2026-05-09

---

## 1. API 层 — 12 个模块

### 1.1 `api/client.js` — Axios 基础实例

- `baseURL: '/api'`, 10 秒超时，JSON Content-Type
- 请求拦截器：自动附加 `Authorization: Bearer <token>`
- 响应拦截器：401 → 调用 `/api/auth/refresh` 刷新令牌旋转（单例去重并发 401），失败则清除令牌 + 触发 `auth:session-expired` 事件 + Socket reauthenticate

### 1.2 `api/auth.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `login(data)` | POST | /auth/login |
| `register(data)` | POST | /auth/register |
| `sendCode(data)` | POST | /auth/send-code |
| `me()` | GET | /auth/me |
| `logout(data)` | POST | /auth/logout |

### 1.3 `api/jobs.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `createJob(data)` | POST | /jobs |
| `getMyJobs()` | GET | /jobs/my |
| `getJobById(id)` | GET | /jobs/:id |
| `getPublicJobs(filters)` | GET | /jobs/public |
| `getAreaFilters()` | GET | /jobs/area-filters |

### 1.4 `api/candidates.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `getMyCandidateProfile()` | GET | /candidates/me |
| `updateMyCandidateProfile(data)` | PUT | /candidates/me |
| `confirmLatestResume()` | POST | /candidates/me/confirm-latest |
| `uploadResumeFile(file, onProgress)` | POST | /candidates/upload-resume |
| `getCandidatePublicProfile(id)` | GET | /candidates/:id |
| `getCandidates(filters)` | GET | /candidates |
| `getAreaFilters()` | GET | /candidates/area-filters |

### 1.5 `api/applications.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `saveJob(jobId)` | POST | /jobs/:id/saved |
| `applyToJob(jobId, data)` | POST | /jobs/:id/applications |
| `getMyApplications()` | GET | /applications/my |
| `getReceivedApplications(filters)` | GET | /applications/received |
| `updateApplicationStatus(id, status)` | PATCH | /applications/:id/status |

### 1.6 `api/matches.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `getJobMatches(jobId)` | GET | /jobs/:id/match |

### 1.7 `api/invitations.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `createInvitation(jobId, candidateId, message)` | POST | /invitations |
| `getSentInvitations()` | GET | /invitations/sent |
| `getMyInvitations()` | GET | /invitations/my |
| `getCompanySummary()` | GET | /invitations/company-summary |
| `updateInvitationStatus(id, status)` | PATCH | /invitations/:id/status |

### 1.8 `api/conversations.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `getMyConversations()` | GET | /conversations |
| `getConversationMessages(threadId, options)` | GET | /conversations/:id/messages |
| `sendConversationMessage(threadId, content)` | POST | /conversations/:id/messages |

### 1.9 `api/admin.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `getOverview()` | GET | /admin/overview |
| `previewImport(formData)` | POST | /admin/import/preview |
| `listBatches(params)` | GET | /admin/import/batches |
| `getBatch(id, params)` | GET | /admin/import/batches/:id |
| `dryRunImport(id, params)` | POST | /admin/import/batches/:id/confirm |
| `confirmImport(id, params)` | POST | /admin/import/batches/:id/confirm |
| `downloadAnnotated(id)` | GET | /admin/import/batches/:id/download |

### 1.10 `api/employerDashboard.js`

| 函数 | 方法 | 路径 |
|---|---|---|
| `getFilters()` | GET | /employer/dashboard-filters |
| `getChart(params)` | GET | /employer/dashboard-chart |

### 1.11 `api/chartApi.js` — 独立 axios 实例 (`baseURL: '/api/v2'`, 15s 超时)

| 函数 | 方法 | 路径 |
|---|---|---|
| `getCandidateChart(params)` | GET | /v2/candidates/chart |
| `getJobChart(params)` | GET | /v2/jobs/chart |

### 1.12 `api/tagsV2.js` — 独立 axios 实例 (`baseURL: '/api/v2'`, 15s 超时)

15 个函数：`getCategories()`, `getTags(params)`, `submitTag(data)`, `importTagsExcel(file)`, `getPendingTags()`, `getMyTags()`, `reviewTag(id, action, reason)`, `reviewTagsBulk(ids, action, reason)`, `getPendingNotes()`, `reviewNote(id, action, reason)`, `getTagNotes(tagId)`, `getMyTagNote(tagId)`, `submitTagNote(tagId, note)`, `getTagApprovalSetting()`, `setTagApprovalSetting(enabled)`

---

## 2. 页面组件 — 40+ 文件

### 2.1 公共/认证（2）

| 文件 | 路由 | 角色 | 说明 |
|---|---|---|---|
| `pages/Home.jsx` | `/` | 未登录 | 着陆页（hero/角色分类/特性/CTA） |
| `pages/auth/Login.jsx` | `/login` | 未登录 | 登录/注册/验证码，三角色 tab |

### 2.2 候选人端（14）

| 文件 | 路由 | 说明 |
|---|---|---|
| `CandidateHome.jsx` | `/candidate/home` | Terminal 仪表盘（FunctionRail+AreaSidebar+Chart） |
| `TerminalCandidateJobs.jsx` | `/candidate/jobs` | Terminal 包装 → JobMarketplace |
| `TerminalCandidateMessages.jsx` | `/candidate/messages` | Terminal 包装 → Messages |
| `TerminalCandidateTags.jsx` | `/candidate/tags` | Terminal 包装 → MyTags |
| `TerminalCandidateUpload.jsx` | `/candidate/upload` | Terminal 包装 → UploadResume |
| `TerminalCandidateInvitations.jsx` | `/candidate/invitations` | Terminal 包装 → MyInvitations |
| `TerminalCandidateApplications.jsx` | `/candidate/applications` | Terminal 包装 → MyApplications |
| `TerminalCandidateProfile.jsx` | `/candidate/profile/me` | Terminal 包装 → CandidateProfile (self) |
| `TerminalCandidateProfileBuilder.jsx` | `/candidate/profile/builder` | Terminal 包装 → CandidateProfileBuilder |
| `CandidateProfile.jsx` | `/candidate/profile/:id` | 双模式：self（terminal）+ 他人（浅色），隐私门控 |
| `CandidateProfileBuilder.jsx` | —（被包装） | 5 段式表单 |
| `MyInvitations.jsx` | —（被包装） | 邀约列表 + 接受/婉拒 |
| `MyApplications.jsx` | —（被包装） | 投递列表 + 撤回 + status chip |
| `UploadResume.jsx` | —（被包装） | 3 步简历上传（拖拽→确认→成功） |

### 2.3 企业端（13）

| 文件 | 路由 | 说明 |
|---|---|---|
| `Dashboard.jsx` | `/employer/dashboard` | Terminal 仪表盘（nav+FunctionRail+AreaSidebar+Chart+指标卡+ActionBar） |
| `EmployerHome.jsx` | `/employer/home` | 候选人趋势图（浅色） |
| `CandidatePool.jsx` | `/candidates`, `/employer/candidates` | 双栏候选人池 + 归档 + 面议邀约 + InviteModal |
| `TerminalJobs.jsx` | `/employer/jobs` | Terminal 包装 → JobMarketplace |
| `TerminalCandidates.jsx` | `/employer/candidates` | Terminal 包装 → CandidatePool |
| `TerminalMessages.jsx` | `/employer/messages` | Terminal 包装 → Messages |
| `TerminalTags.jsx` | `/employer/tags` | Terminal 包装 → MyTags |
| `TerminalPostJob.jsx` | `/employer/jobs/new` | Terminal 包装 → PostJob |
| `TerminalMatchResult.jsx` | `/employer/jobs/:id/match`, `/employer/match/:id` | Terminal 包装 → MatchResult |
| `TerminalReceivedApplications.jsx` | `/employer/applications/received` | Terminal 包装 → ReceivedApplications |
| `PostJob.jsx` | —（被包装） | 岗位发布表单 |
| `MatchResult.jsx` | —（被包装） | 匹配结果展示 |
| `ReceivedApplications.jsx` | —（被包装） | 收到的投递管理 |

### 2.4 共享（3）

| 文件 | 路由 | 说明 |
|---|---|---|
| `jobs/JobMarketplace.jsx` | `/jobs` | 双栏岗位市场（候选人：投递/收藏；企业：新建按钮） |
| `messages/Messages.jsx` | `/messages`, `/messages/:id` | 实时聊天（Socket.IO + 分页历史 + 已读 + 输入提示 + 自动重试 ×3） |
| `tags/MyTags.jsx` | `/tags` | 标签浏览器 + 提交表单 |

### 2.5 管理端（7）

| 文件 | 路由 | 说明 |
|---|---|---|
| `admin/Overview.jsx` | `/admin/overview` | 运营仪表盘（StatCard+柱状图+动态） |
| `admin/ImportManager.jsx` | `/admin/import` | Excel 导入管理 |
| `admin/AdminCharts.jsx` | `/admin/charts` | 数据图表 |
| `admin/AdminCandidates.jsx` | `/admin/candidates` | 候选人管理 |
| `admin/AdminJobs.jsx` | `/admin/jobs` | 岗位管理 |
| `admin/Approvals.jsx` | `/admin/approvals` | 审批中心 |
| `admin/TagManager.jsx` | `/admin/tags`(→/admin/import) | 3 tab：标签库/待审批标签/待审批描述 + 审批开关 |

---

## 3. 共享 UI 组件 — 9 个

| 组件 | 文件 | Props |
|---|---|---|
| `Badge` | `ui/Badge.jsx` | `children`, `color` (blue/green/orange/purple/gray/red) |
| `StatusBadge` | `ui/Badge.jsx` | `status` (published/active/draft/paused/closed) |
| `Button` | `ui/Button.jsx` | `variant` (primary/secondary/ghost/danger/success), `size` (sm/md/lg/xl) |
| `InviteModal` | `ui/InviteModal.jsx` | `candidate`, `job`, `matchScore`, `onConfirm`, `onCancel`, `terminal` |
| `MatchScore` | `ui/MatchScore.jsx` | `score` (0-100), `size` (md/lg) |
| `StatCard` | `ui/StatCard.jsx` | `label`, `value`, `sub`, `icon`, `trend`, `color` |
| `TagList` | `ui/TagList.jsx` | `tags` (string[]), `max`, `colorFn` |
| `TagNoteModal` | `ui/TagNoteModal.jsx` | `tag` ({id, name, category}) |
| `TagSelector` | `ui/TagSelector.jsx` | `value` (string[]), `onChange`, `placeholder`, `disabled` |

---

## 4. Terminal 组件 — 8 个

| 组件 | 文件 | 说明 |
|---|---|---|
| `TerminalLayout` | `terminal/TerminalLayout.jsx` | 100vw×100vh 深色壳层（IconRail 左 + TerminalHeader 顶 + children 主区域） |
| `FunctionRail` | `terminal/FunctionRail.jsx` | 职能侧栏，hover 60px→228px，7 项（全部/海运/空运/公路/铁路/合同物流/电商） |
| `AreaSidebar` | `terminal/AreaSidebar.jsx` | 区域侧栏，210px，8 项（Global/大中华/华东/华北/华南/华西/台湾/香港） |
| `TerminalPanel` | `terminal/TerminalPanel.jsx` | 视觉容器（title/subtitle/actions/children） |
| `TerminalActionBar` | `terminal/TerminalActionBar.jsx` | CTA 按钮行 |
| `TerminalPageSurface` | `terminal/TerminalPageSurface.jsx` | 页面外壳（split 双栏/非 split 垂直滚动），注入 `terminal-mode` class |
| `CandidateChartPanel` | `terminal/CandidateChartPanel.jsx` | Recharts 深色柱状图 + 粒度控制（day/week/month/quarter/year）+ 空态 |
| `navItems.js` | `terminal/navItems.js` | `EMPLOYER_ICON_NAV` (7 图标) + `CANDIDATE_ICON_NAV` (8 图标) |

---

## 5. 布局组件 — 2 个

| 组件 | 文件 | 说明 |
|---|---|---|
| `Navbar` | `layout/Navbar.jsx` | 粘性顶栏（logo/角色导航/用户菜单/通知铃铛+未读角标 30s 轮询/移动端汉堡菜单） |
| `Footer` | `layout/Footer.jsx` | 深色页脚（3 列链接网格/版权/ICP 号） |

---

## 6. 路由 — `router/index.jsx`

**~40 条路由**，使用 `createBrowserRouter`。

### 路由守卫

| 守卫 | 说明 |
|---|---|
| `RequireAuth({ roles })` | 未登录→/login?next=；角色不匹配→重定向到角色首页 |
| `AuthLanding` | `/` 已登录→角色首页，未登录→Home |
| `RedirectIfAuth` | `/login` 已登录→角色首页 |

### 角色首页映射

- employer → `/employer/dashboard`
- candidate → `/candidate/home`
- admin → `/admin/overview`

### 完整路由表

| 路径 | 组件 | 角色 | 终端模式 |
|---|---|---|---|
| `/` | AuthLanding | 全部 | — |
| `/login` | Login | 未登录 | — |
| `/jobs` | JobMarketplace | candidate/employer/admin | — |
| `/messages` | Messages | employer/candidate/admin | — |
| `/messages/:threadId` | Messages | employer/candidate/admin | — |
| `/tags` | MyTags | candidate/employer | — |
| `/candidates` | CandidatePool | employer/admin | — |
| `/candidate/upload` | TerminalCandidateUpload | candidate | Terminal |
| `/candidate/profile/me` | TerminalCandidateProfile | candidate | Terminal |
| `/candidate/profile/builder` | TerminalCandidateProfileBuilder | candidate | Terminal |
| `/candidate/profile/:id` | CandidateProfile | candidate/employer/admin | — |
| `/candidate/home` | CandidateHome | candidate | Terminal |
| `/candidate/jobs` | TerminalCandidateJobs | candidate | Terminal |
| `/candidate/messages` | TerminalCandidateMessages | candidate | Terminal |
| `/candidate/messages/:threadId` | TerminalCandidateMessages | candidate | Terminal |
| `/candidate/tags` | TerminalCandidateTags | candidate | Terminal |
| `/candidate/invitations` | TerminalCandidateInvitations | candidate | Terminal |
| `/candidate/applications` | TerminalCandidateApplications | candidate | Terminal |
| `/employer/candidates` | TerminalCandidates | employer/admin | Terminal |
| `/employer/jobs` | TerminalJobs | employer/admin | Terminal |
| `/employer/messages` | TerminalMessages | employer | Terminal |
| `/employer/messages/:threadId` | TerminalMessages | employer | Terminal |
| `/employer/tags` | TerminalTags | employer | Terminal |
| `/employer/jobs/new` | TerminalPostJob | employer | Terminal |
| `/employer/jobs/:jobId/match` | TerminalMatchResult | employer | Terminal |
| `/employer/applications/received` | TerminalReceivedApplications | employer/admin | Terminal |
| `/employer/post-job` | →/employer/jobs/new | — | 兼容重定向 |
| `/employer/match/:jobId` | TerminalMatchResult | employer | 兼容旧路由 |
| `/employer/dashboard` | Dashboard | employer | Terminal |
| `/employer/home` | EmployerHome | employer | Terminal |
| `/admin/overview` | Overview | admin | — |
| `/admin/import` | ImportManager | admin | — |
| `/admin/approvals` | Approvals | admin | — |
| `/admin/charts` | AdminCharts | admin | — |
| `/admin/candidates` | AdminCandidates | admin | — |
| `/admin/jobs` | AdminJobs | admin | — |
| `/admin/tags` | →/admin/import | — | 兼容重定向 |

---

## 7. 认证 (`context/AuthContext.jsx`)

**State：** `{ user, loading, login, register, logout }`

**生命周期：** 挂载时从 localStorage 恢复 token → `authApi.me()` 验证 → 失败则清除。监听 `auth:session-expired` 事件。

**login/register：** 存储 access_token + refresh_token → localStorage → setUser

**logout：** 发送 refresh_token 到服务端撤销 → 清除 localStorage → setUser(null)

---

## 8. 根组件 (`App.jsx`)

- Terminal 路径前缀匹配 → 不渲染 Navbar/Footer
- 非 Terminal 路径 → Navbar + `<main><Outlet /></main>` + Footer（/admin 路由隐藏 Footer）
- ScrollToTop：路径变化时 `scrollTo(0,0)` with `behavior: 'instant'`

---

## 9. 样式系统

### 9.1 `styles/terminal.css` — 深色 Terminal 设计 token

**背景：** `--t-bg` (#0b0e13), `--t-bg-panel` (#111720), `--t-bg-elevated` (#16202e), `--t-bg-hover` (#1a2535), `--t-bg-active` (#1f2d42), `--t-bg-input` (#0f1823)

**边框：** `--t-border` (#1e2d40), `--t-border-subtle` (#162030), `--t-border-focus` (#2563eb)

**文字：** `--t-text` (#e2e8f0), `--t-text-secondary` (#94a3b8), `--t-text-muted` (#4b5a6e), `--t-text-inverse` (#0b0e13)

**主色：** `--t-primary` (#2563eb), `--t-primary-hover` (#1d4ed8), `--t-primary-muted` (#1e3a6e)

**语义色：** `--t-success` (#22c55e), `--t-success-muted` (#14532d), `--t-danger` (#ef4444), `--t-danger-muted` (#7f1d1d), `--t-warning` (#f59e0b), `--t-warning-muted` (#78350f)

**图表色：** `--t-chart-purple` (#a78bfa), `--t-chart-blue` (#60a5fa), `--t-chart-cyan` (#22d3ee), `--t-chart-green` (#4ade80), `--t-chart-amber` (#fbbf24)

**其他：** 3 趋势色, 5 圆角 (sm/lg/xl), 2 阴影, 2 字体, 8 字号 (xs~xl), 1 缓动

**Scoped 重映射：** `.terminal-mode` 将 Tailwind utilities (bg-white/border-slate-200/text-slate-800 等) 映射到 Terminal token

### 9.2 `styles/index.css` — 浅色 Tailwind @theme

- 品牌色：`--color-brand-50~900` (蓝色阶)
- 强调色：`--color-accent-400~600` (翡翠)
- 中性色：`--color-neutral-50~900` (板岩)
- Card 工具类 + fadeUp 动画

---

## 10. Socket.IO (`lib/socket.js`)

- 单例模式：`io('/', { path: '/socket.io', transports: ['websocket', 'polling'], auth: token })`
- 重连：10 次，1s→30s 指数退避，0.5 随机因子
- `connectSocket()` / `getSocket()` / `disconnectSocket()`（400ms 防抖，兼容 StrictMode）

### `hooks/useSocket.js`

`useSocket(enabled=true) → { socket, connectionStatus }` — 自动连接/事件监听/清理

---

## 11. 工具函数

| 文件 | 说明 |
|---|---|
| `lib/tagGroups.js` | `serializeTagGroups()` — 标签组分面筛选传参 |
| `utils/businessArea.js` | 10 区域分类法 + 31 省→区域映射 |
| `utils/candidateProfile.js` | 14 字段档案完整度门控 |
| `utils/overseasCountries.js` | 29 海外国家白名单 |
| `utils/regionTree.js` | 全国省市县树 (~3700 条目，拼音/中文/编码搜索) |

---

## 12. Mock 文件 — 全部死代码

| 文件 | 内容 |
|---|---|
| `mock/candidates.js` | 6 条占位数据 (c001-c006)，全部字段 'xxx' 或 0 |
| `mock/jobs.js` | 5 条占位数据 (j001-j005)，全部字段 'xxx' 或 0 |
| `mock/stats.js` | 全部 0 值统计 + 7 条占位趋势数据 |

**无任何文件导入这三个 mock 模块。**
