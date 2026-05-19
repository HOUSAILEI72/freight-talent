import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Send, Tags, FileText, Users, UsersRound, Wrench, MessageSquare } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { DEFAULT_AREAS } from '../../components/terminal/AreaSidebar'
import AreaRail from '../../components/terminal/AreaRail'
import FunctionSidebar from '../../components/terminal/FunctionSidebar'
import CandidateChartPanel from '../../components/terminal/CandidateChartPanel'
import TerminalActionBar from '../../components/terminal/TerminalActionBar'
import TrendSummaryCard from '../../components/terminal/TrendSummaryCard'
import LockedInsightsPanel from '../../components/terminal/LockedInsightsPanel'
import MetricCard from '../../components/data/MetricCard'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import { useAuth } from '../../context/AuthContext'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'
import { conversationsApi } from '../../api/conversations'
import { subscriptionsApi } from '../../api/subscriptions'
import { candidateDashboardApi } from '../../api/candidateDashboard'

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

const AREA_KEYWORDS = {
  China: ['中国', 'china', '上海', '北京', '广州', '深圳', '宁波', '青岛', '厦门', '天津', '香港', '台湾', '澳门'],
}

function textOfJob(job) {
  const tagNames = Object.values(job.tags_by_category || {}).flat()
  return [
    job.title,
    job.company_name,
    job.business_type,
    job.job_type,
    job.city,
    job.province,
    job.city_name,
    job.district,
    ...(job.route_tags || []),
    ...(job.skill_tags || []),
    ...tagNames,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
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
  return hasAny(textOfJob(job), AREA_KEYWORDS[areaKey])
}

export default function CandidateHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [selectedFunction, setSelectedFunction] = useState(DEFAULT_FUNCTION)
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA)
  const [granularity, setGranularity] = useState('bi_monthly')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('—')
  const [applications, setApplications] = useState([])
  const [applicationsLoading, setApplicationsLoading] = useState(true)
  const [conversations, setConversations] = useState([])
  const [convsLoading, setConvsLoading] = useState(true)
  const [trendSummary, setTrendSummary] = useState(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [hasSubscription, setHasSubscription] = useState(null)

  useEffect(() => {
    let alive = true
    jobsApi
      .getPublicJobs({ page_size: 500 })
      .then((res) => {
        if (!alive) return
        setJobs(res.data.jobs ?? [])
        setUpdatedAt(new Date().toLocaleString('zh-CN'))
      })
      .catch((err) => {
        if (!alive) return
        setJobs([])
        setError(err.response?.data?.message ?? '岗位数据加载失败')
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    applicationsApi
      .getMyApplications()
      .then((res) => { if (alive) setApplications(res.data?.applications ?? []) })
      .catch(() => { if (alive) setApplications([]) })
      .finally(() => { if (alive) setApplicationsLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    conversationsApi
      .getMyConversations()
      .then((res) => { if (alive) setConversations(res.data?.threads ?? res.data ?? []) })
      .catch(() => { if (alive) setConversations([]) })
      .finally(() => { if (alive) setConvsLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    candidateDashboardApi
      .getSummary()
      .then((res) => { if (alive) setTrendSummary(res.data) })
      .catch(() => { if (alive) setTrendSummary(null) })
      .finally(() => { if (alive) setTrendLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    subscriptionsApi.getMySubscription()
      .then((res) => setHasSubscription(res.data.has_active))
      .catch(() => setHasSubscription(false))
  }, [])

  const filteredJobs = useMemo(
    () => jobs.filter((job) => matchesFunction(job, selectedFunction) && matchesArea(job, selectedArea)),
    [jobs, selectedFunction, selectedArea]
  )

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
        const period = `${snapYear}-${mm}-${String(snapDay).padStart(2, '0')}`
        return { period, label: `${mm}/${String(snapDay).padStart(2, '0')}` }
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

  const platformTotals = useMemo(() => trendSummary?.platform_totals ?? {}, [trendSummary])

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
        .filter((item) => item?.is_saved)
        .map((item) => item.job_id)
        .filter(Boolean)
    )
    return ids.size
  }, [applications])

  const messagedJobCount = useMemo(() => {
    const ids = new Set(
      (Array.isArray(conversations) ? conversations : [])
        .filter((t) => t?.job_id)
        .map((t) => t.job_id)
    )
    return ids.size
  }, [conversations])

  const subtitle = `FUNC=${selectedFunction} / AREA=${selectedArea}`
  const displayName = user?.name || 'Candidate'

  return (
    <TerminalLayout title="DASHBOARD" activeIconId="dashboard" navItems={CANDIDATE_ICON_NAV}>
      <AreaRail
        value={selectedArea}
        onChange={setSelectedArea}
        areas={DEFAULT_AREAS}
      />

      <FunctionSidebar
        value={selectedFunction}
        onChange={setSelectedFunction}
        functions={DEFAULT_FUNCTIONS}
        hasSubscription={true}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
              ACCOUNT
            </span>
            <span className="truncate font-[var(--t-font-sans)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)]">
              {displayName}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
              UPDATED
            </span>
            <span className="font-[var(--t-font-sans)] text-[10px] text-[color:var(--t-text-secondary)]">
              {updatedAt}
            </span>
          </div>
        </div>

        <div className="terminal-dashboard-body terminal-scrollbar min-w-0">
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

          <div className="terminal-dashboard-main min-w-0">
            <CandidateChartPanel
              data={chartBars}
              title="JOB TREND"
              subtitle={subtitle}
              loading={loading}
              meta={updatedAt}
              unitLabel="jobs"
              emptyText={error || '暂无岗位数据'}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
            <aside className="terminal-dashboard-stats-aside-wrap">
              <TrendSummaryCard type="jobs"       data={trendSummary} loading={trendLoading} />
              <TrendSummaryCard type="candidates" data={trendSummary} loading={trendLoading} />
            </aside>
          </div>

          <LockedInsightsPanel
            locked={hasSubscription === false}
            onPricingClick={() => navigate('/employer/pricing')}
          >
            <div className="terminal-insights-panel flex flex-col">
              <div className="terminal-card-grid">
                <MetricCard
                  compact
                  label="APPLIED JOBS"
                  value={applicationsLoading ? '—' : appliedJobCount}
                  helper="SUBMITTED POSITIONS"
                  icon={<Send size={14} />}
                />
                <MetricCard
                  compact
                  label="SAVED JOBS"
                  value={applicationsLoading ? '—' : savedJobCount}
                  helper="BOOKMARKED POSITIONS"
                  icon={<Tags size={14} />}
                />
                <MetricCard
                  compact
                  label="MESSAGED JOBS"
                  value={convsLoading ? '—' : messagedJobCount}
                  helper="ACTIVE CONVERSATIONS"
                  icon={<MessageSquare size={14} />}
                />
              </div>
            </div>
          </LockedInsightsPanel>

          <TerminalActionBar
            actions={[
              {
                icon: Briefcase,
                label: '岗位广场',
                hint: 'BROWSE · JOBS',
                primary: true,
                href: '/candidate/jobs',
              },
              {
                icon: Send,
                label: '我的投递',
                hint: 'TRACK · APPLICATIONS',
                href: '/candidate/applications',
              },
              {
                icon: Tags,
                label: '个人订阅',
                hint: 'SUBSCRIBE · TAGS',
                href: '/candidate/tags',
              },
              {
                icon: FileText,
                label: '个人简历',
                hint: 'EDIT · PROFILE',
                href: '/candidate/profile/builder',
              },
            ]}
          />
        </div>
      </main>
    </TerminalLayout>
  )
}
