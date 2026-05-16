# 候选人端 Dashboard 设计文档

**日期**：2026-05-16  
**分支**：release/ace-talent-mvp  
**状态**：已确认，待实施

---

## 目标

将 `src/pages/candidate/CandidateHome.jsx` 改造为与企业端 `Dashboard.jsx` 完全镜像的布局，主要差异是：

- 中间柱状图显示「岗位数趋势」（已有，保留）
- 下方 3 个计数卡换为候选人专属：投递岗位数 / 保存岗位数 / 沟通过的岗位数
- 下方 3 卡受订阅门控（LockedInsightsPanel），点击"View Pricing"跳转 `/employer/pricing`

---

## 页面布局

```
[Sub-header: ACCOUNT <姓名>   UPDATED <时间>]
[PLATFORM CANDIDATES] [PLATFORM JOBS] [PLATFORM TEAMS] [TO BE SOON]   ← 4卡 terminal-platform-count-grid
┌─────────────────────────────────┐  ┌──────────────────────┐
│  JOB TREND 柱状图（粒度切换）    │  │ PLATFORM JOB GROWTH  │
│                                 │  ├──────────────────────┤
│                                 │  │ PLATFORM CAND GROWTH │
└─────────────────────────────────┘  └──────────────────────┘
  terminal-dashboard-main
[LockedInsightsPanel]
  [投递岗位数]  [保存岗位数]  [沟通过的岗位数]   ← 3卡 terminal-card-grid
[TerminalActionBar: 岗位广场 / 我的投递 / 个人订阅 / 个人简历]
左侧 AreaRail + FunctionSidebar 保持不变
```

---

## 数据与 API

| 数据 | 来源 | 说明 |
|---|---|---|
| Platform Candidates / Jobs / Teams | 新 `GET /api/candidate/dashboard-summary` | 同企业端 trend-summary 返回结构 |
| YTD / This Week 增长率 | 同上 | 供 TrendSummaryCard 消费 |
| 柱状图 Job Trend | 现有 `jobsApi.getPublicJobs(500)` | 前端按时间粒度聚合，无变化 |
| 投递岗位数 | 现有 `applicationsApi.getMyApplications()` | 唯一 job_id，status ∉ {saved, withdrawn} |
| 保存岗位数 | 同上 | 唯一 job_id，status = 'saved' |
| 沟通过的岗位数 | 新增 `conversationsApi.getMyConversations()` | 唯一 job_id（job_id 有值的 thread） |
| 订阅状态 | 现有 `subscriptionsApi.getMySubscription()` | 控制下方 3 卡的 LockedInsightsPanel |

---

## 后端：新 endpoint

**文件**：`backend/app/routes/candidate_dashboard.py`  
**Blueprint**：`candidate_dashboard_bp`，前缀 `/api/candidate`  
**注册**：`backend/app/__init__.py`

### `GET /api/candidate/dashboard-summary`

- 鉴权：`@jwt_required()`，role 必须是 `candidate`
- 复用 `employer_dashboard.py` 中的 `_period_key()` 辅助函数

**返回结构**：
```json
{
  "platform_totals": {
    "candidates": 1240,
    "jobs": 387,
    "teams": 0
  },
  "growth": {
    "jobs": {
      "ytd_percent": 12.5,
      "week_percent": 2.1
    },
    "candidates": {
      "ytd_percent": 8.3,
      "week_percent": 1.4
    }
  }
}
```

**查询逻辑**：
- `platform_totals.candidates`：`COUNT(Candidate.id)` where `is_active=True`
- `platform_totals.jobs`：`COUNT(Job.id)` where `is_active=True`
- `platform_totals.teams`：`COUNT(DISTINCT User.id)` where `role='employer'`，暂为 0 占位
- `growth.jobs.ytd_percent`：(今年新增 Job / 去年同期新增 Job - 1) × 100，去年为 0 时返回 0
- `growth.candidates.ytd_percent`：同上逻辑，对象换为 Candidate
- `week_percent`：本周新增 vs 上周新增

**迁移路径**：将来纳入 FastAPI Phase 4（候选人模块）`fastapi_app/api/v2/candidates.py`

---

## 前端：改动文件清单

### 1. 新建 `src/components/terminal/TrendSummaryCard.jsx`

从 `src/pages/employer/Dashboard.jsx` 剪出 `TrendSummaryCard` 组件（含 `formatPercent` / `getGrowthPercent` 辅助函数），独立为共享组件。`Dashboard.jsx` 改为 import 新路径，原逻辑不变。

### 1b. 新建 `src/components/terminal/LockedInsightsPanel.jsx`

从 `src/pages/employer/Dashboard.jsx` 剪出 `LockedInsightsPanel` 局部组件，独立为共享组件。`Dashboard.jsx` 同样改为 import 新路径，原逻辑不变。

### 2. 新建 `src/api/candidateDashboard.js`

```js
export const candidateDashboardApi = {
  getSummary() {
    return client.get('/candidate/dashboard-summary')
  },
}
```

### 3. 改写 `src/pages/candidate/CandidateHome.jsx`

**新增 state**：
- `trendSummary` / `trendLoading`（平台总数 + 增长率）
- `conversations` / `convsLoading`（沟通过的岗位）
- `hasSubscription`（订阅状态）

**新增 useMemo**：
- `savedJobCount`：applications 中 status='saved' 的唯一 job_id 数
- `messagedJobCount`：conversations 中有 job_id 的唯一 job_id 数
- `platformTotals`：trendSummary?.platform_totals

**布局变更**：
| 位置 | 现状 | 改后 |
|---|---|---|
| 容器 | `overflow-y-auto terminal-scrollbar` | `terminal-dashboard-body terminal-scrollbar` |
| 上方卡片 | `terminal-card-grid` 3卡 | `terminal-platform-count-grid` 4卡（Platform数据）|
| 图表区 | 单独 CandidateChartPanel | `terminal-dashboard-main`：图表 + TrendSummaryCard aside |
| 下方卡片 | `terminal-card-grid` 裸显示 | `LockedInsightsPanel` 包裹 + `terminal-insights-panel` + `terminal-card-grid` |
| 下方卡片内容 | Jobs/Functions/Areas + Applied/Saved Companies/Reserved | 投递岗位数 / 保存岗位数 / 沟通过的岗位数 |

**LockedInsightsPanel**：
- `locked={hasSubscription === false}`
- `onPricingClick={() => navigate('/employer/pricing')}`

---

## 不改动范围

- `src/pages/candidate/UploadResume.jsx`（禁止触碰）
- Navbar 公共样式
- 企业端 `Dashboard.jsx` 逻辑（只抽取 TrendSummaryCard，原文件改一行 import）
- Flask `employer_dashboard.py`（只 import 其辅助函数，不修改）

---

## 交付验收标准

- [ ] `npx vite build --mode production` 无报错
- [ ] `cd backend && python -m pytest tests/ -x -q` 通过
- [ ] 候选人登录后上方 4 卡显示平台总数
- [ ] 柱状图正常显示岗位趋势，粒度切换正常
- [ ] 右侧两张趋势卡显示 YTD / This Week 数据
- [ ] 未订阅候选人：下方 3 卡模糊 + 显示 View Pricing 按钮
- [ ] 已订阅候选人：下方显示 投递/保存/沟通 实际数字
