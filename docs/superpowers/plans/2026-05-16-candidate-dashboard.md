# Candidate Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将候选人 Dashboard（`CandidateHome.jsx`）改造为与企业端镜像的布局，新增平台总数卡、趋势卡、订阅门控，下方3卡改为投递/保存/沟通岗位数。

**Architecture:** 新建轻量 Flask endpoint `/api/candidate/dashboard-summary` 复用企业端统计函数；前端提取两个共享组件（TrendSummaryCard、LockedInsightsPanel）后改写 CandidateHome。

**Tech Stack:** Flask 3 / Flask-JWT-Extended / SQLAlchemy / React 19 / Tailwind CSS (via terminal CSS tokens)

---

## File Map

| 操作 | 文件 | 职责 |
|---|---|---|
| 新建 | `src/components/terminal/TrendSummaryCard.jsx` | 平台增长趋势卡（从 Dashboard.jsx 提取） |
| 新建 | `src/components/terminal/LockedInsightsPanel.jsx` | 订阅门控包裹层（从 Dashboard.jsx 提取） |
| 新建 | `src/api/candidateDashboard.js` | 候选人 dashboard API 模块 |
| 新建 | `backend/app/routes/candidate_dashboard.py` | Flask Blueprint：GET /api/candidate/dashboard-summary |
| 新建 | `backend/tests/test_candidate_dashboard.py` | 后端集成测试 |
| 改动 | `src/pages/employer/Dashboard.jsx` | 改用新共享组件路径（只动 import，逻辑不变） |
| 改动 | `src/pages/candidate/CandidateHome.jsx` | 全面改造布局和数据逻辑 |
| 改动 | `backend/app/__init__.py` | 注册 candidate_dashboard_bp |

---

## Task 1: 提取 `TrendSummaryCard` 为共享组件

**Files:**
- Create: `src/components/terminal/TrendSummaryCard.jsx`
- Modify: `src/pages/employer/Dashboard.jsx`

- [ ] **Step 1: 新建 `TrendSummaryCard.jsx`**

```jsx
// src/components/terminal/TrendSummaryCard.jsx
function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const sign = number > 0 ? '+' : ''
  const normalized = Number.isInteger(number)
    ? String(number)
    : number.toFixed(1).replace(/\.0$/, '')
  return `${sign}${normalized}%`
}

function getGrowthPercent(growthData, legacyCard, key) {
  if (key === 'ytd') {
    return growthData?.ytd_percent
      ?? growthData?.ytdPercent
      ?? growthData?.percent
      ?? legacyCard?.percent
      ?? 0
  }
  return growthData?.week_percent
    ?? growthData?.weekPercent
    ?? 0
}

export default function TrendSummaryCard({ type, data, loading }) {
  const growthData = data?.growth?.[type]
  const legacyCard = data?.cards?.[type]
  const title = type === 'jobs' ? 'PLATFORM JOB GROWTH' : 'PLATFORM CANDIDATE GROWTH'

  const ytdPct  = getGrowthPercent(growthData, legacyCard, 'ytd')
  const weekPct = getGrowthPercent(growthData, legacyCard, 'week')
  const ytdUp   = ytdPct  > 0
  const weekUp  = weekPct > 0

  return (
    <div className="terminal-growth-card">
      <span className="terminal-growth-card-label">{title}</span>
      <div className="terminal-growth-card-rows">
        <div className="terminal-growth-row">
          <span>YTD</span>
          <strong className="terminal-growth-row-value" style={{ color: ytdUp ? 'var(--t-trend-up)' : 'var(--t-trend-neutral)' }}>
            {loading ? '—' : formatPercent(ytdPct)}
          </strong>
        </div>
        <div className="terminal-growth-row">
          <span>THIS WEEK</span>
          <strong className="terminal-growth-row-value terminal-growth-row-value--sm" style={{ color: weekUp ? 'var(--t-trend-up)' : 'var(--t-trend-neutral)' }}>
            {loading ? '—' : formatPercent(weekPct)}
          </strong>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 更新 `Dashboard.jsx` 中的定义和 import**

在 `Dashboard.jsx` 中，删除文件顶部的 `formatPercent`、`getGrowthPercent`、`TrendSummaryCard` 三个函数定义，在文件顶部 import 区域增加：

```jsx
import TrendSummaryCard from '../../components/terminal/TrendSummaryCard'
```

注意：`Dashboard.jsx` 中这三个函数定义在 `import` 语句和第二批 import（第87行开始）之间，全部删除即可。

- [ ] **Step 3: 验证企业端 Dashboard 页面无 console 报错**

```bash
cd /Users/edy/Desktop/货代招聘
npx vite build --mode production 2>&1 | tail -8
```

期望：`built in` 结尾，无 error。

- [ ] **Step 4: Commit**

```bash
git add src/components/terminal/TrendSummaryCard.jsx src/pages/employer/Dashboard.jsx
git commit -m "refactor: extract TrendSummaryCard as shared terminal component"
```

---

## Task 2: 提取 `LockedInsightsPanel` 为共享组件

**Files:**
- Create: `src/components/terminal/LockedInsightsPanel.jsx`
- Modify: `src/pages/employer/Dashboard.jsx`

- [ ] **Step 1: 新建 `LockedInsightsPanel.jsx`**

```jsx
// src/components/terminal/LockedInsightsPanel.jsx
export default function LockedInsightsPanel({ locked, onPricingClick, children }) {
  return (
    <section className="relative shrink-0 overflow-visible rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-[var(--t-shadow-panel)]">
      <div className={locked ? 'pointer-events-none select-none blur-[5px] opacity-35' : ''}>
        {children}
      </div>
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)', borderRadius: 'var(--t-radius-lg)' }}>
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="text-[15px] font-semibold text-[color:var(--t-text)]">
              Unlock market insights
            </div>
            <button
              type="button"
              onClick={onPricingClick}
              className="h-8 rounded-[var(--t-radius)] border px-4 text-[12px] font-bold uppercase tracking-[0.06em] hover:opacity-90"
              style={{ borderColor: 'var(--t-primary)', color: 'var(--t-text)', background: 'transparent' }}
            >
              View Pricing
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: 更新 `Dashboard.jsx` 中的定义和 import**

删除 `Dashboard.jsx` 中 `LockedInsightsPanel` 函数定义（整个函数块，`function LockedInsightsPanel` 到其对应的闭合 `}`），在顶部 import 区增加：

```jsx
import LockedInsightsPanel from '../../components/terminal/LockedInsightsPanel'
```

- [ ] **Step 3: 构建验证**

```bash
npx vite build --mode production 2>&1 | tail -8
```

期望：无 error。

- [ ] **Step 4: Commit**

```bash
git add src/components/terminal/LockedInsightsPanel.jsx src/pages/employer/Dashboard.jsx
git commit -m "refactor: extract LockedInsightsPanel as shared terminal component"
```

---

## Task 3: 后端 — 新建 candidate dashboard summary endpoint

**Files:**
- Create: `backend/app/routes/candidate_dashboard.py`
- Create: `backend/tests/test_candidate_dashboard.py`
- Modify: `backend/app/__init__.py`

- [ ] **Step 1: 先写失败测试**

新建 `backend/tests/test_candidate_dashboard.py`：

```python
"""
候选人 Dashboard summary endpoint 集成测试。
GET /api/candidate/dashboard-summary
"""
import pytest


@pytest.fixture(scope="module")
def candidate_token(app, client):
    from app.extensions import db
    from app.models.user import User
    with app.app_context():
        u = User(
            email="cand_dash_test@example.com",
            role="candidate",
            name="Dash Test Cand",
            is_active=True,
        )
        u.set_password("TestPass123!")
        db.session.add(u)
        db.session.commit()
    resp = client.post("/api/auth/login", json={
        "email": "cand_dash_test@example.com",
        "password": "TestPass123!",
    })
    assert resp.status_code == 200
    return resp.get_json()["access_token"]


@pytest.fixture(scope="module")
def employer_token(app, client):
    from app.extensions import db
    from app.models.user import User
    with app.app_context():
        u = User(
            email="employer_dash_test@example.com",
            role="employer",
            name="Dash Test Employer",
            company_name="DashCo",
            is_active=True,
        )
        u.set_password("TestPass123!")
        db.session.add(u)
        db.session.commit()
    resp = client.post("/api/auth/login", json={
        "email": "employer_dash_test@example.com",
        "password": "TestPass123!",
    })
    assert resp.status_code == 200
    return resp.get_json()["access_token"]


class TestCandidateDashboardSummary:
    URL = "/api/candidate/dashboard-summary"

    def test_requires_auth(self, client):
        resp = client.get(self.URL)
        assert resp.status_code == 401

    def test_employer_is_forbidden(self, client, employer_token):
        resp = client.get(self.URL, headers={"Authorization": f"Bearer {employer_token}"})
        assert resp.status_code == 403

    def test_candidate_gets_200(self, client, candidate_token):
        resp = client.get(self.URL, headers={"Authorization": f"Bearer {candidate_token}"})
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True

    def test_response_has_platform_totals(self, client, candidate_token):
        resp = client.get(self.URL, headers={"Authorization": f"Bearer {candidate_token}"})
        data = resp.get_json()
        totals = data["platform_totals"]
        assert "candidates" in totals
        assert "jobs" in totals
        assert "teams" in totals
        assert isinstance(totals["candidates"], int)
        assert isinstance(totals["jobs"], int)
        assert isinstance(totals["teams"], int)

    def test_response_has_growth(self, client, candidate_token):
        resp = client.get(self.URL, headers={"Authorization": f"Bearer {candidate_token}"})
        data = resp.get_json()
        growth = data["growth"]
        assert "jobs" in growth
        assert "candidates" in growth
        assert "ytd_percent" in growth["jobs"]
        assert "week_percent" in growth["jobs"]
        assert "ytd_percent" in growth["candidates"]
        assert "week_percent" in growth["candidates"]
```

- [ ] **Step 2: 运行测试，确认失败（endpoint 不存在）**

```bash
cd /Users/edy/Desktop/货代招聘/backend
python -m pytest tests/test_candidate_dashboard.py -v 2>&1 | tail -20
```

期望：`FAILED` 或 `ERROR`，原因是 404（endpoint 未注册）。

- [ ] **Step 3: 新建 `candidate_dashboard.py`**

```python
# backend/app/routes/candidate_dashboard.py
"""
候选人 Dashboard summary API
GET /api/candidate/dashboard-summary
返回全平台总数 + 增长率，结构与企业端 dashboard-trend-summary 一致。
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models.user import User
from app.routes.employer_dashboard import (
    _count_platform_candidates_total,
    _count_platform_jobs_total,
    _count_platform_teams_total,
    _count_platform_candidates_since,
    _count_platform_jobs_since,
    _start_of_year_utc_naive,
    _start_of_week_utc_naive,
    _now_utc_naive,
    ALL_VALUE,
)

candidate_dashboard_bp = Blueprint(
    "candidate_dashboard",
    __name__,
    url_prefix="/api/candidate",
)


def _err(message, code=400):
    return jsonify({"success": False, "message": message}), code


@candidate_dashboard_bp.get("/dashboard-summary")
@jwt_required()
def candidate_dashboard_summary():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return _err("用户不存在", 404)
    if user.role != "candidate":
        return _err("仅候选人账号可访问", 403)

    now        = _now_utc_naive()
    year_start = _start_of_year_utc_naive()
    week_start = _start_of_week_utc_naive()

    jobs_total  = _count_platform_jobs_total(ALL_VALUE, ALL_VALUE)
    cands_total = _count_platform_candidates_total(ALL_VALUE, ALL_VALUE)
    teams_total = _count_platform_teams_total()

    jobs_ytd   = _count_platform_jobs_since(ALL_VALUE, ALL_VALUE, year_start, now)
    jobs_week  = _count_platform_jobs_since(ALL_VALUE, ALL_VALUE, week_start, now)
    cands_ytd  = _count_platform_candidates_since(ALL_VALUE, ALL_VALUE, year_start, now)
    cands_week = _count_platform_candidates_since(ALL_VALUE, ALL_VALUE, week_start, now)

    def _pct(delta, base):
        if base > 0:
            return round(delta / base * 100, 1)
        return 100.0 if delta > 0 else 0.0

    jobs_year_base  = jobs_total  - jobs_ytd
    jobs_week_base  = jobs_total  - jobs_week
    cands_year_base = cands_total - cands_ytd
    cands_week_base = cands_total - cands_week

    return jsonify({
        "success": True,
        "platform_totals": {
            "candidates": cands_total,
            "jobs": jobs_total,
            "teams": teams_total,
        },
        "growth": {
            "jobs": {
                "label": "PLATFORM JOB GROWTH",
                "ytd_percent":  _pct(jobs_ytd,   jobs_year_base),
                "week_percent": _pct(jobs_week,  jobs_week_base),
            },
            "candidates": {
                "label": "PLATFORM CANDIDATE GROWTH",
                "ytd_percent":  _pct(cands_ytd,  cands_year_base),
                "week_percent": _pct(cands_week, cands_week_base),
            },
        },
    })
```

- [ ] **Step 4: 注册 Blueprint — 修改 `backend/app/__init__.py`**

在 `__init__.py` 的 Blueprint 区块里，在 `from app.routes.employer_dashboard import employer_dashboard_bp` 下方添加：

```python
from app.routes.candidate_dashboard import candidate_dashboard_bp
```

在 `app.register_blueprint(employer_dashboard_bp)` 下方添加：

```python
app.register_blueprint(candidate_dashboard_bp)
```

- [ ] **Step 5: 运行测试，确认全通过**

```bash
cd /Users/edy/Desktop/货代招聘/backend
python -m pytest tests/test_candidate_dashboard.py -v 2>&1 | tail -20
```

期望：5 个 PASSED。

- [ ] **Step 6: 跑全量 smoke test 确认无回归**

```bash
python -m pytest tests/ -x -q 2>&1 | tail -8
```

期望：无 FAILED / ERROR（allowed: 已知 skip）。

- [ ] **Step 7: Commit**

```bash
git add backend/app/routes/candidate_dashboard.py \
        backend/tests/test_candidate_dashboard.py \
        backend/app/__init__.py
git commit -m "feat(backend): GET /api/candidate/dashboard-summary endpoint"
```

---

## Task 4: 前端 API 模块

**Files:**
- Create: `src/api/candidateDashboard.js`

- [ ] **Step 1: 新建 `candidateDashboard.js`**

```js
// src/api/candidateDashboard.js
import client from './client'

export const candidateDashboardApi = {
  getSummary() {
    return client.get('/candidate/dashboard-summary')
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add src/api/candidateDashboard.js
git commit -m "feat(frontend): candidateDashboardApi module"
```

---

## Task 5: 改写 `CandidateHome.jsx`

**Files:**
- Modify: `src/pages/candidate/CandidateHome.jsx`

完整替换文件内容如下（在此直接覆盖，保留柱状图时间聚合逻辑，大幅改动 state、API调用、布局）：

- [ ] **Step 1: 覆盖 `CandidateHome.jsx`**

```jsx
// src/pages/candidate/CandidateHome.jsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Database, FileText, Heart, MessageSquare, Send, Tags, TrendingUp, UsersRound, Wrench } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { DEFAULT_AREAS } from '../../components/terminal/AreaSidebar'
import AreaRail from '../../components/terminal/AreaRail'
import FunctionSidebar from '../../components/terminal/FunctionSidebar'
import CandidateChartPanel from '../../components/terminal/CandidateChartPanel'
import TrendSummaryCard from '../../components/terminal/TrendSummaryCard'
import LockedInsightsPanel from '../../components/terminal/LockedInsightsPanel'
import TerminalActionBar from '../../components/terminal/TerminalActionBar'
import MetricCard from '../../components/data/MetricCard'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import { useAuth } from '../../context/AuthContext'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'
import { conversationsApi } from '../../api/conversations'
import { candidateDashboardApi } from '../../api/candidateDashboard'
import { subscriptionsApi } from '../../api/subscriptions'

const DEFAULT_FUNCTION = 'ALL'
const DEFAULT_AREA = 'China'

const FUNCTION_KEYWORDS = {
  Sea: ['海运', '海', 'sea', 'ocean', 'shipping'],
  Air: ['空运', '空', 'air'],
  Road: ['陆运', '公路', '卡车', '汽运', 'road', 'truck'],
  Railway: ['铁路', 'rail', 'railway', 'train'],
  'Contract Logistics': ['合同物流', '仓储', '仓库', '物流', 'contract logistics', 'warehouse'],
  ECOMS: ['跨境电商', '电商', 'fba', 'ecom', 'e-commerce', 'ecommerce'],
}

function textOfJob(job) {
  const tagNames = Object.values(job.tags_by_category || {}).flat()
  return [
    job.title, job.company_name, job.business_type, job.job_type,
    job.city, job.province, job.city_name, job.district,
    ...(job.route_tags || []), ...(job.skill_tags || []), ...tagNames,
  ].filter(Boolean).join(' ').toLowerCase()
}

function hasAny(text, keywords = []) {
  return keywords.some((word) => text.includes(String(word).toLowerCase()))
}

function matchesFunction(job, functionKey) {
  if (functionKey === DEFAULT_FUNCTION) return true
  return hasAny(textOfJob(job), FUNCTION_KEYWORDS[functionKey])
}

function matchesArea(job, areaKey) {
  if (areaKey === DEFAULT_AREA) return true
  const AREA_KEYWORDS = {
    China: ['中国', 'china', '上海', '北京', '广州', '深圳', '宁波', '青岛', '厦门', '天津', '香港', '台湾', '澳门'],
  }
  return hasAny(textOfJob(job), AREA_KEYWORDS[areaKey] ?? [])
}

export default function CandidateHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedFunction, setSelectedFunction] = useState(DEFAULT_FUNCTION)
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA)
  const [granularity, setGranularity] = useState('week')

  const [jobs, setJobs] = useState([])
  const [jobsLoading, setJobsLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState('—')

  const [applications, setApplications] = useState([])
  const [appsLoading, setAppsLoading] = useState(true)

  const [conversations, setConversations] = useState([])

  const [trendSummary, setTrendSummary] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)

  const [hasSubscription, setHasSubscription] = useState(null)

  // 1. 平台 summary（平台总数 + 增长率）
  useEffect(() => {
    let alive = true
    setTrendLoading(true)
    candidateDashboardApi.getSummary()
      .then((res) => { if (alive) setTrendSummary(res.data) })
      .catch(() => { if (alive) setTrendSummary(null) })
      .finally(() => { if (alive) setTrendLoading(false) })
    return () => { alive = false }
  }, [])

  // 2. 订阅状态
  useEffect(() => {
    subscriptionsApi.getMySubscription()
      .then((res) => setHasSubscription(res.data.has_active))
      .catch(() => setHasSubscription(false))
  }, [])

  // 3. 公开岗位（图表数据源）
  useEffect(() => {
    let alive = true
    jobsApi.getPublicJobs({ page_size: 500 })
      .then((res) => {
        if (!alive) return
        setJobs(res.data.jobs ?? [])
        setUpdatedAt(new Date().toLocaleString('zh-CN'))
      })
      .catch(() => { if (alive) setJobs([]) })
      .finally(() => { if (alive) setJobsLoading(false) })
    return () => { alive = false }
  }, [])

  // 4. 投递记录
  useEffect(() => {
    let alive = true
    applicationsApi.getMyApplications()
      .then((res) => { if (alive) setApplications(res.data?.applications ?? []) })
      .catch(() => { if (alive) setApplications([]) })
      .finally(() => { if (alive) setAppsLoading(false) })
    return () => { alive = false }
  }, [])

  // 5. 会话列表（沟通过的岗位）
  useEffect(() => {
    let alive = true
    conversationsApi.getMyConversations()
      .then((res) => { if (alive) setConversations(res.data?.conversations ?? []) })
      .catch(() => { if (alive) setConversations([]) })
    return () => { alive = false }
  }, [])

  const filteredJobs = useMemo(
    () => jobs.filter((job) => matchesFunction(job, selectedFunction) && matchesArea(job, selectedArea)),
    [jobs, selectedFunction, selectedArea]
  )

  // 时间粒度聚合（柱状图）
  const chartBars = useMemo(() => {
    function periodKey(dateStr) {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      if (granularity === 'bi_monthly') {
        let snapYear = d.getFullYear()
        let snapMonth = d.getMonth() + 1
        let snapDay
        const day = d.getDate()
        if (day <= 10) {
          snapDay = 10
        } else if (day <= 20) {
          snapDay = 20
        } else {
          snapDay = 10
          snapMonth += 1
          if (snapMonth > 12) { snapMonth = 1; snapYear += 1 }
        }
        const mm = String(snapMonth).padStart(2, '0')
        return { period: `${snapYear}-${mm}-${String(snapDay).padStart(2, '0')}`, label: `${mm}/${String(snapDay).padStart(2, '0')}` }
      }
      if (granularity === 'week') {
        const oneJan = new Date(d.getFullYear(), 0, 1)
        const week = Math.ceil(((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7)
        return { period: `${d.getFullYear()}-W${String(week).padStart(2, '0')}`, label: `W${String(week).padStart(2, '0')}` }
      }
      if (granularity === 'month') {
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { period: key, label: key }
      }
      if (granularity === 'quarter') {
        const q = Math.ceil((d.getMonth() + 1) / 3)
        return { period: `${d.getFullYear()}-Q${q}`, label: `${d.getFullYear()} Q${q}` }
      }
      if (granularity === 'year') {
        return { period: String(d.getFullYear()), label: String(d.getFullYear()) }
      }
      return null
    }

    const counter = new Map()
    for (const job of filteredJobs) {
      const pk = periodKey(job.created_at)
      if (!pk) continue
      counter.set(pk.period, {
        period: pk.period,
        period_label: pk.label,
        count: (counter.get(pk.period)?.count || 0) + 1,
      })
    }
    return Array.from(counter.values()).sort((a, b) => a.period.localeCompare(b.period))
  }, [filteredJobs, granularity])

  // 下方 3 卡数据
  const appliedJobCount = useMemo(() => {
    const ids = new Set(
      applications
        .filter((item) => item && !['saved', 'withdrawn'].includes(item.status))
        .map((item) => item.job_id)
        .filter(Boolean)
    )
    return ids.size
  }, [applications])

  const savedJobCount = useMemo(() => {
    const ids = new Set(
      applications
        .filter((item) => item?.status === 'saved')
        .map((item) => item.job_id)
        .filter(Boolean)
    )
    return ids.size
  }, [applications])

  const messagedJobCount = useMemo(() => {
    const ids = new Set(
      conversations
        .filter((c) => c?.job_id)
        .map((c) => c.job_id)
    )
    return ids.size
  }, [conversations])

  const platformTotals = trendSummary?.platform_totals ?? {}
  const subtitle = `FUNC=${selectedFunction} / AREA=${selectedArea}`
  const displayName = user?.name || 'Candidate'

  return (
    <TerminalLayout title="DASHBOARD" activeIconId="dashboard" navItems={CANDIDATE_ICON_NAV}>
      <AreaRail value={selectedArea} onChange={setSelectedArea} areas={DEFAULT_AREAS} />
      <FunctionSidebar value={selectedFunction} onChange={setSelectedFunction} functions={DEFAULT_FUNCTIONS} hasSubscription={true} />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sub-header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--t-border-subtle)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-medium tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>Account</span>
            <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--t-text)' }}>{displayName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>Updated</span>
            <span className="text-[12px]" style={{ color: 'var(--t-text-secondary)' }}>{updatedAt}</span>
          </div>
        </div>

        {/* Body */}
        <div className="terminal-dashboard-body terminal-scrollbar min-w-0">
          {/* 上方 4 卡：平台总数 */}
          <div className="terminal-platform-count-grid shrink-0">
            <MetricCard compact label="PLATFORM CANDIDATES" value={trendLoading ? '—' : (platformTotals.candidates ?? 0)} icon={<Database size={14} />} />
            <MetricCard compact label="PLATFORM JOBS"       value={trendLoading ? '—' : (platformTotals.jobs ?? 0)}       icon={<Briefcase size={14} />} />
            <MetricCard compact label="PLATFORM TEAMS"      value={trendLoading ? '—' : (platformTotals.teams ?? 0)}      icon={<UsersRound size={14} />} />
            <MetricCard compact label="TO BE SOON"          value="—" helper="COMING SOON"                                icon={<Wrench size={14} />} />
          </div>

          {/* 图表 + 趋势卡 */}
          <div className="terminal-dashboard-main min-w-0">
            <CandidateChartPanel
              data={chartBars}
              title="JOB TREND"
              subtitle={subtitle}
              loading={jobsLoading}
              meta={updatedAt}
              unitLabel="jobs"
              emptyText="暂无岗位数据"
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
            <aside className="terminal-dashboard-stats-aside-wrap">
              <TrendSummaryCard type="jobs"       data={trendSummary} loading={trendLoading} />
              <TrendSummaryCard type="candidates" data={trendSummary} loading={trendLoading} />
            </aside>
          </div>

          {/* 下方 3 卡：候选人专属（订阅门控） */}
          <LockedInsightsPanel
            locked={hasSubscription === false}
            onPricingClick={() => navigate('/employer/pricing')}
          >
            <div className="terminal-insights-panel flex flex-col">
              <div className="terminal-card-grid">
                <MetricCard compact label="投递岗位数" value={appsLoading ? '—' : appliedJobCount} helper="APPLIED JOBS"   icon={<Send size={14} />} />
                <MetricCard compact label="保存岗位数" value={appsLoading ? '—' : savedJobCount}   helper="SAVED JOBS"     icon={<Heart size={14} />} />
                <MetricCard compact label="沟通过的岗位数" value={messagedJobCount}                 helper="MESSAGED JOBS"  icon={<MessageSquare size={14} />} />
              </div>
            </div>
          </LockedInsightsPanel>

          {/* Bottom CTA */}
          <TerminalActionBar actions={[
            { icon: Briefcase,   label: '岗位广场',   hint: 'BROWSE · JOBS',         primary: true, href: '/candidate/jobs' },
            { icon: Send,        label: '我的投递',   hint: 'TRACK · APPLICATIONS',  href: '/candidate/applications' },
            { icon: Tags,        label: '个人订阅',   hint: 'SUBSCRIBE · TAGS',      href: '/candidate/tags' },
            { icon: FileText,    label: '个人简历',   hint: 'EDIT · PROFILE',        href: '/candidate/profile/builder' },
          ]} />
        </div>
      </main>
    </TerminalLayout>
  )
}
```

- [ ] **Step 2: 前端构建验证**

```bash
cd /Users/edy/Desktop/货代招聘
npx vite build --mode production 2>&1 | tail -8
```

期望：`built in` 结尾，无 error / warning（unused import 除外）。

- [ ] **Step 3: 后端 smoke test**

```bash
cd /Users/edy/Desktop/货代招聘/backend
python -m pytest tests/ -x -q 2>&1 | tail -8
```

期望：无新增 FAILED。

- [ ] **Step 4: Commit**

```bash
git add src/pages/candidate/CandidateHome.jsx
git commit -m "feat(candidate-dashboard): mirror employer layout — platform cards, trend aside, locked personal stats"
```

---

## Task 6: 最终验收

- [ ] **Step 1: 全量后端测试**

```bash
cd /Users/edy/Desktop/货代招聘/backend
python -m pytest tests/ -x -q 2>&1 | tail -10
```

期望：`passed` 行出现，0 error。

- [ ] **Step 2: 前端生产构建**

```bash
cd /Users/edy/Desktop/货代招聘
npx vite build --mode production 2>&1 | tail -8
```

期望：无 error。

- [ ] **Step 3: 人工验收清单**

候选人账号登录后检查以下各项（对照设计文档验收标准）：
- [ ] 上方 4 卡显示 Platform Candidates / Platform Jobs / Platform Teams / TO BE SOON
- [ ] 柱状图标题为 JOB TREND，粒度切换（周/10&20月/月/季/年）正常
- [ ] 右侧两张趋势卡显示 PLATFORM JOB GROWTH + PLATFORM CANDIDATE GROWTH，含 YTD / THIS WEEK
- [ ] 未订阅候选人：下方 3 卡内容模糊，出现"Unlock market insights"+ "View Pricing"按钮
- [ ] 点击 View Pricing → 跳转 `/employer/pricing`
- [ ] 已订阅候选人：显示 投递岗位数 / 保存岗位数 / 沟通过的岗位数 实际数字
- [ ] 企业端 Dashboard 无视觉回归（TrendSummaryCard、LockedInsightsPanel 抽取后功能正常）
