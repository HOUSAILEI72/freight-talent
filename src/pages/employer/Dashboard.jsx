import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Database, TrendingUp, Inbox, Briefcase, Heart, UsersRound, Wrench, UserSearch } from 'lucide-react'

// ── LockedInsightsPanel ───────────────────────────────────────────────────
function LockedInsightsPanel({ locked, onPricingClick, children }) {
  return (
    <section className="relative shrink-0 overflow-hidden rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-[var(--t-shadow-panel)]">
      <div className={locked ? 'pointer-events-none select-none blur-[5px] opacity-35' : ''}>
        {children}
      </div>

      {locked && (
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(7,10,16,0.45)] backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)]">
              Unlock market insights
            </div>
            <button
              type="button"
              onClick={onPricingClick}
              className="h-8 rounded-[var(--t-radius)] border border-[color:var(--t-primary)] px-4 font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text)] hover:bg-[color:var(--t-primary)]"
            >
              VIEW PRICING
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
// ── TrendSummaryCard ──────────────────────────────────────────────────────
function TrendSummaryCard({ type, data, loading }) {
  const title = type === 'candidates' ? 'PLATFORM CANDIDATES' : 'PLATFORM JOBS'
  const card = data?.cards?.[type]

  const cardClass =
    'terminal-trend-card rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-[var(--t-shadow-panel)]'

  const labelEl = (
    <span className="terminal-trend-card-label font-[var(--t-font-mono)] text-[10px] uppercase text-[color:var(--t-text-muted)]">
      {title}
    </span>
  )

  if (loading) {
    return (
      <div className={cardClass}>
        {labelEl}
        <div className="terminal-trend-card-main">
          <span className="terminal-trend-card-value font-[var(--t-font-mono)] font-bold text-[color:var(--t-text-secondary)]">
            —
          </span>
        </div>
        <div className="terminal-trend-card-footer">
          <span className="terminal-trend-card-meta font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
            &nbsp;
          </span>
        </div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className={cardClass}>
        {labelEl}
        <div className="terminal-trend-card-main">
          <span className="font-[var(--t-font-mono)] text-[26px] font-bold uppercase tracking-wide text-[color:var(--t-text-secondary)]">
            NO DATA
          </span>
        </div>
        <div className="terminal-trend-card-footer">
          <span className="terminal-trend-card-meta font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
            &nbsp;
          </span>
        </div>
      </div>
    )
  }

  const deltaSign = card.delta > 0 ? '+' : ''
  const percentSign = card.percent > 0 ? '+' : ''
  const deltaColor =
    card.direction === 'up'
      ? 'var(--t-trend-up)'
      : card.direction === 'down'
        ? 'var(--t-trend-down)'
        : 'var(--t-text-muted)'

  return (
    <div className={cardClass}>
      {labelEl}
      <div className="terminal-trend-card-main">
        <span className="terminal-trend-card-value font-[var(--t-font-mono)] font-bold text-[color:var(--t-text)]">
          {card.current}
        </span>
      </div>
      <div className="terminal-trend-card-footer">
        <span className="terminal-trend-card-meta font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-secondary)]">
          AS OF {data.current_checkpoint}
        </span>
        <span
          className="terminal-trend-card-change font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-bold"
          style={{ color: deltaColor }}
        >
          {deltaSign}{card.delta} / {percentSign}{card.percent}%
        </span>
        <span className="terminal-trend-card-compare font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
          VS {data.previous_checkpoint}
        </span>
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import AreaRail from '../../components/terminal/AreaRail'
import FunctionSidebar from '../../components/terminal/FunctionSidebar'
import CandidateChartPanel from '../../components/terminal/CandidateChartPanel'
import TerminalActionBar from '../../components/terminal/TerminalActionBar'
import MetricCard from '../../components/data/MetricCard'
import { useAuth } from '../../context/AuthContext'
import { employerDashboardApi } from '../../api/employerDashboard'
import { subscriptionsApi } from '../../api/subscriptions'

const DEFAULT_FUNCTION = 'ALL'
const DEFAULT_AREA = 'China'
const SHOW_SECONDARY_METRICS = false

const DASHBOARD_AREA_OPTIONS = [
  { key: 'China', label: 'CHINA', short: 'CN', code: 'GREAT_CHINA' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedFunction, setSelectedFunction] = useState(DEFAULT_FUNCTION)
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA)
  const [granularity, setGranularity] = useState('day')
  const [chart, setChart] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)
  const [trendSummary, setTrendSummary] = useState(null)
  const [trendLoading, setTrendLoading] = useState(false)
  const [hasSubscription, setHasSubscription] = useState(null)

  useEffect(() => {
    subscriptionsApi.getMySubscription()
      .then(res => setHasSubscription(res.data.has_active))
      .catch(() => setHasSubscription(false))
  }, [])

  function handleFunctionChange(val) {
    if (val !== 'ALL' && !hasSubscription) {
      navigate('/employer/pricing')
      return
    }
    setSelectedFunction(val)
  }

  function handleAreaChange(val) {
    if (val !== DEFAULT_AREA && !hasSubscription) {
      navigate('/employer/pricing')
      return
    }
    setSelectedArea(val)
  }

  useEffect(() => {
    let alive = true
    setChartLoading(true)
    const regionForApi = selectedArea === 'Global' ? 'ALL' : selectedArea
    employerDashboardApi
      .getChart({
        functionValue: selectedFunction,
        regionValue: regionForApi,
        granularity,
      })
      .then((res) => {
        if (alive) setChart(res.data)
      })
      .catch(() => {
        if (alive) setChart(null)
      })
      .finally(() => {
        if (alive) setChartLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedFunction, selectedArea, granularity])

  useEffect(() => {
    let alive = true
    setTrendLoading(true)
    const regionForApi = selectedArea === 'Global' ? 'ALL' : selectedArea
    employerDashboardApi
      .getTrendSummary({
        functionValue: selectedFunction,
        regionValue: regionForApi,
      })
      .then((res) => {
        if (alive) setTrendSummary(res.data)
      })
      .catch(() => {
        if (alive) setTrendSummary(null)
      })
      .finally(() => {
        if (alive) setTrendLoading(false)
      })
    return () => {
      alive = false
    }
  }, [selectedFunction, selectedArea])

  const chartBars = useMemo(() => {
    const bars = chart?.bars ?? []
    const staleShape = bars.some((item) => item?.period == null && item?.period_label == null)
    if (staleShape) {
      console.warn('Employer dashboard chart ignored non-time-series payload:', {
        mode: chart?.mode,
        bars,
      })
      return []
    }
    return bars
  }, [chart])
  const total = chart?.total ?? 0
  const stats = chart?.stats ?? {}
  const applicationsCount = stats.applications_received ?? 0
  const jobsCount = stats.jobs ?? 0
  const favoritesCount = useMemo(() => {
    try {
      const raw = localStorage.getItem(`archived_${user?.id}`)
      return raw ? JSON.parse(raw).length : 0
    } catch {
      return 0
    }
  }, [user?.id])

  const subtitle = `FUNC=${selectedFunction} / AREA=${selectedArea}`
  const filterHelper = selectedFunction === DEFAULT_FUNCTION && selectedArea === DEFAULT_AREA
    ? 'ALL FUNCTIONS / CHINA'
    : subtitle
  const updatedAt = chart?.updated_at
    ? new Date(chart.updated_at).toLocaleString('zh-CN')
    : '—'

  const companyName = user?.company_name || user?.name || 'Employer'
  const insightsLocked = hasSubscription === false

  return (
    <TerminalLayout title="DASHBOARD" activeIconId="dashboard">
      {/* Area rail (collapsible on hover — narrow first column) */}
      <AreaRail
        value={selectedArea}
        onChange={handleAreaChange}
        areas={DASHBOARD_AREA_OPTIONS}
        hasSubscription={hasSubscription}
      />

      {/* Function sidebar (always expanded — second column) */}
      <FunctionSidebar
        value={selectedFunction}
        onChange={handleFunctionChange}
        functions={DEFAULT_FUNCTIONS}
        hasSubscription={hasSubscription}
      />

      {/* Main workspace */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sub-header strip */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-[var(--t-font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
              ACCOUNT
            </span>
            <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)] truncate">
              {companyName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-[var(--t-font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
              UPDATED
            </span>
            <span className="font-[var(--t-font-mono)] text-[10px] text-[color:var(--t-text-secondary)]">
              {updatedAt}
            </span>
          </div>
        </div>

        {/* Body — chart panel + locked insights + action bar */}
        <div className="terminal-dashboard-body terminal-scrollbar min-w-0">
          {/* Chart + trend sidebar */}
          <div className="terminal-dashboard-main min-w-0">
            <CandidateChartPanel
              data={chartBars}
              title="CANDIDATE TREND"
              subtitle={subtitle}
              loading={chartLoading}
              meta={updatedAt}
              unitLabel="candidates"
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
            <aside className="terminal-dashboard-stats-aside-wrap">
              <TrendSummaryCard type="candidates" data={trendSummary} loading={trendLoading} />
              <TrendSummaryCard type="jobs"       data={trendSummary} loading={trendLoading} />
            </aside>
          </div>

          {/* Freightos-style locked insight panel */}
          <LockedInsightsPanel
            locked={insightsLocked}
            onPricingClick={() => navigate('/employer/pricing')}
          >
            <div className="flex flex-col gap-4 p-4">
              <div className="terminal-card-grid">
                <MetricCard
                  compact
                  label="JOBS"
                  value={chartLoading ? '—' : jobsCount}
                  helper={filterHelper}
                  icon={<Briefcase size={14} />}
                />
                <MetricCard
                  compact
                  label="APPLICATIONS"
                  value={chartLoading ? '—' : applicationsCount}
                  helper={filterHelper}
                  icon={<Inbox size={14} />}
                />
                <MetricCard
                  compact
                  label="INTERESTED"
                  value={chartLoading ? '—' : favoritesCount}
                  helper={filterHelper}
                  icon={<Heart size={14} />}
                />
              </div>
              <div className="terminal-card-grid">
                <MetricCard
                  compact
                  label="2.0 后续迭代"
                  value="—"
                  helper="COMING SOON"
                  icon={<Wrench size={14} />}
                />
                <MetricCard
                  compact
                  label="2.0 后续迭代"
                  value="—"
                  helper="COMING SOON"
                  icon={<UserSearch size={14} />}
                />
                <MetricCard
                  compact
                  label="2.0 后续迭代"
                  value="—"
                  helper="COMING SOON"
                  icon={<UsersRound size={14} />}
                />
              </div>
            </div>
          </LockedInsightsPanel>

          {/* Metric strip — Row 2 (hidden, code preserved) */}
          {SHOW_SECONDARY_METRICS && (
          <div className="terminal-card-grid shrink-0">
            <MetricCard
              compact
              label="CANDIDATES"
              value={chartLoading ? '—' : total}
              helper={filterHelper}
              icon={<Users size={14} />}
            />
            <MetricCard
              compact
              label="FUNCTIONS"
              value={DEFAULT_FUNCTIONS.length - 1}
              helper={selectedFunction === DEFAULT_FUNCTION ? 'ALL' : selectedFunction}
              icon={<Database size={14} />}
            />
            <MetricCard
              compact
              label="AREAS"
              value={DASHBOARD_AREA_OPTIONS.length}
              helper={selectedArea}
              icon={<TrendingUp size={14} />}
            />
          </div>
          )}

          {/* Bottom CTA bar — always visible, never blurred */}
          <TerminalActionBar actions={[
            {
              icon: Briefcase,
              label: '发布岗位',
              hint: 'POST · NEW JOB',
              primary: true,
              onClick: () => hasSubscription ? navigate('/employer/jobs/new') : navigate('/employer/pricing'),
            },
            {
              icon: Users,
              label: '候选人池',
              hint: 'BROWSE · CANDIDATES',
              onClick: () => hasSubscription ? navigate('/employer/candidates') : navigate('/employer/pricing'),
            },
            { icon: Wrench,     label: '辅助工具包', hint: 'TOOLS',       disabled: true },
            { icon: UserSearch, label: '个人猎头服务', hint: 'HEADHUNTING', onClick: () => navigate('/employer/headhunting/personal') },
            { icon: UsersRound, label: '团队猎头服务', hint: 'TEAM SEARCH', onClick: () => navigate('/employer/headhunting/team') },
          ]} />
        </div>
      </main>
    </TerminalLayout>
  )
}
