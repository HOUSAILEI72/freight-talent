import { useEffect, useMemo, useState } from 'react'
import { Users, Database, TrendingUp } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import FunctionRail, { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import AreaSidebar, { DEFAULT_AREAS } from '../../components/terminal/AreaSidebar'
import CandidateChartPanel from '../../components/terminal/CandidateChartPanel'
import TerminalActionBar from '../../components/terminal/TerminalActionBar'
import MetricCard from '../../components/data/MetricCard'
import { useAuth } from '../../context/AuthContext'
import { employerDashboardApi } from '../../api/employerDashboard'

const DEFAULT_FUNCTION = 'ALL'
const DEFAULT_AREA = 'Global'

/**
 * Phase A/B note (ACE-Talent Terminal):
 * - Visual shell only — IconRail / FunctionRail / AreaSidebar / Chart / ActionBar
 * - Function & Area lists currently use front-end constants (DEFAULT_FUNCTIONS / DEFAULT_AREAS)
 * - Chart still calls the existing real API (employerDashboardApi.getChart) when filters
 *   match what the backend understands; otherwise renders empty state.
 *   Next phase will add a dedicated terminal aggregation endpoint.
 */

export default function Dashboard() {
  const { user } = useAuth()
  const [selectedFunction, setSelectedFunction] = useState(DEFAULT_FUNCTION)
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA)
  const [granularity, setGranularity] = useState('day')
  const [chart, setChart] = useState(null)
  const [chartLoading, setChartLoading] = useState(false)

  // Probe the existing real API; if it fails we silently fall back to empty state.
  // The Function/Area constants drive the UI for now — backend integration comes next.
  useEffect(() => {
    let alive = true
    setChartLoading(true)
    // Backend (`/api/employer/dashboard-chart`) currently treats `'ALL'` as
    // "no region filter". UI uses `Global` as the aggregate label, so map it
    // when calling the API. Other area keys pass through unchanged.
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

  const subtitle = `FUNC=${selectedFunction} / AREA=${selectedArea}`
  const updatedAt = chart?.updated_at
    ? new Date(chart.updated_at).toLocaleString('zh-CN')
    : '—'

  const companyName = user?.company_name || user?.name || 'Employer'

  return (
    <TerminalLayout title="DASHBOARD" activeIconId="dashboard">
      {/* Function rail (collapsible on hover) */}
      <FunctionRail
        value={selectedFunction}
        onChange={setSelectedFunction}
        functions={DEFAULT_FUNCTIONS}
      />

      {/* Area sidebar (always expanded) */}
      <AreaSidebar
        value={selectedArea}
        onChange={setSelectedArea}
        areas={DEFAULT_AREAS}
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

        {/* Body — metrics row + chart panel + action bar */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
          {/* Metric strip */}
          <div className="grid shrink-0 grid-cols-3 gap-4">
            <MetricCard
              label="Candidates"
              value={chartLoading ? '—' : total}
              helper={subtitle}
              icon={<Users size={14} />}
            />
            <MetricCard
              label="Functions"
              value={DEFAULT_FUNCTIONS.length - 1}
              helper={selectedFunction === DEFAULT_FUNCTION ? 'ALL' : selectedFunction}
              icon={<Database size={14} />}
            />
            <MetricCard
              label="Areas"
              value={DEFAULT_AREAS.length - 1}
              helper={selectedArea}
              icon={<TrendingUp size={14} />}
            />
          </div>

          {/* Chart panel */}
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

          {/* Bottom CTA bar */}
          <TerminalActionBar />
        </div>
      </main>
    </TerminalLayout>
  )
}
