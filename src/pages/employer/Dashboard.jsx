import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Briefcase, Heart, UsersRound, Wrench, UserSearch } from 'lucide-react'
import TrendSummaryCard from '../../components/terminal/TrendSummaryCard'
import LockedInsightsPanel from '../../components/terminal/LockedInsightsPanel'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import AreaRail from '../../components/terminal/AreaRail'
import { DEFAULT_AREAS } from '../../components/terminal/AreaSidebar'
import FunctionSidebar from '../../components/terminal/FunctionSidebar'
import CandidateChartPanel from '../../components/terminal/CandidateChartPanel'
import TerminalActionBar from '../../components/terminal/TerminalActionBar'
import MetricCard from '../../components/data/MetricCard'
import { useAuth } from '../../context/AuthContext'
import { employerDashboardApi } from '../../api/employerDashboard'
import { subscriptionsApi } from '../../api/subscriptions'

const DEFAULT_FUNCTION = 'ALL'
const DEFAULT_AREA = 'China'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedFunction, setSelectedFunction] = useState(DEFAULT_FUNCTION)
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA)
  const [granularity, setGranularity] = useState('week')
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
      .getChart({ functionValue: selectedFunction, regionValue: regionForApi, granularity })
      .then((res) => { if (alive) setChart(res.data) })
      .catch(() => { if (alive) setChart(null) })
      .finally(() => { if (alive) setChartLoading(false) })
    return () => { alive = false }
  }, [selectedFunction, selectedArea, granularity])

  useEffect(() => {
    let alive = true
    setTrendLoading(true)
    employerDashboardApi
      .getTrendSummary({ functionValue: 'ALL', regionValue: 'ALL' })
      .then((res) => { if (alive) setTrendSummary(res.data) })
      .catch(() => { if (alive) setTrendSummary(null) })
      .finally(() => { if (alive) setTrendLoading(false) })
    return () => { alive = false }
  }, [])

  const chartBars = useMemo(() => {
    const bars = chart?.bars ?? []
    const staleShape = bars.some((item) => item?.period == null && item?.period_label == null)
    if (staleShape) {
      console.warn('Employer dashboard chart ignored non-time-series payload:', { mode: chart?.mode, bars })
      return []
    }
    return bars
  }, [chart])

  const subtitle = `FUNC=${selectedFunction} / AREA=${selectedArea}`
  const updatedAt = chart?.updated_at
    ? new Date(chart.updated_at).toLocaleString('zh-CN')
    : '—'

  const stats = chart?.stats ?? {}
  const jobsCount = stats.jobs ?? 0
  const applicationsCount = stats.applicant_candidates ?? stats.applications_received ?? 0
  const favoritesCount = stats.favorited_candidates ?? 0
  const filterHelper =
    selectedFunction === DEFAULT_FUNCTION && selectedArea === DEFAULT_AREA
      ? '全板块 / CHINA'
      : `FUNC=${selectedFunction} / AREA=${selectedArea}`

  const legacyTrendCards = trendSummary?.cards ?? {}
  const platformTotals = {
    candidates: trendSummary?.platform_totals?.candidates ?? legacyTrendCards.candidates?.current,
    jobs: trendSummary?.platform_totals?.jobs ?? legacyTrendCards.jobs?.current,
    teams: trendSummary?.platform_totals?.teams,
  }
  const companyName = user?.company_name || user?.name || 'Employer'

  return (
    <TerminalLayout
      title="DASHBOARD"
      activeIconId="dashboard"
    >
      {/* Area rail */}
      <AreaRail
        value={selectedArea}
        onChange={handleAreaChange}
        areas={DEFAULT_AREAS}
      />

      {/* Function sidebar */}
      <FunctionSidebar
        value={selectedFunction}
        onChange={handleFunctionChange}
        functions={DEFAULT_FUNCTIONS}
        hasSubscription={hasSubscription}
      />

      {/* Main workspace */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sub-header strip */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid var(--t-border-subtle)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] font-medium tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>
              Account
            </span>
            <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--t-text)' }}>
              {companyName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>
              Updated
            </span>
            <span className="text-[12px]" style={{ color: 'var(--t-text-secondary)' }}>
              {updatedAt}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="terminal-dashboard-body terminal-scrollbar min-w-0">
          {/* Platform count strip */}
          <div className="terminal-platform-count-grid shrink-0">
            <MetricCard
              compact
              label="PLATFORM CANDIDATES"
              value={trendLoading ? '—' : (platformTotals.candidates ?? 0)}
              icon={<Users size={14} />}
            />
            <MetricCard
              compact
              label="PLATFORM JOBS"
              value={trendLoading ? '—' : (platformTotals.jobs ?? 0)}
              icon={<Briefcase size={14} />}
            />
            <MetricCard
              compact
              label="PLATFORM TEAMS"
              value={trendLoading ? '—' : (platformTotals.teams ?? 0)}
              icon={<UsersRound size={14} />}
            />
            <MetricCard
              compact
              label="TO BE SOON"
              value="—"
              helper="COMING SOON"
              icon={<Wrench size={14} />}
            />
          </div>

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
              <TrendSummaryCard type="jobs"       data={trendSummary} loading={trendLoading} />
              <TrendSummaryCard type="candidates" data={trendSummary} loading={trendLoading} />
            </aside>
          </div>

          {/* Employer metrics panel */}
          <LockedInsightsPanel
            locked={hasSubscription === false}
            onPricingClick={() => navigate('/employer/pricing')}
          >
            <div className="terminal-insights-panel flex flex-col">
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
                  label="APPLICANT CANDIDATES"
                  value={chartLoading ? '—' : applicationsCount}
                  helper={filterHelper}
                  icon={<Users size={14} />}
                />
                <MetricCard
                  compact
                  label="FAVORITED CANDIDATES"
                  value={chartLoading ? '—' : favoritesCount}
                  helper={filterHelper}
                  icon={<Heart size={14} />}
                />
              </div>
            </div>
          </LockedInsightsPanel>

          {/* Bottom CTA bar */}
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
