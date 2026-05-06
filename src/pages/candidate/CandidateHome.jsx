import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Database, Send, Tags, TrendingUp, FileText } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import FunctionRail, { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import AreaSidebar, { DEFAULT_AREAS } from '../../components/terminal/AreaSidebar'
import CandidateChartPanel from '../../components/terminal/CandidateChartPanel'
import TerminalActionBar from '../../components/terminal/TerminalActionBar'
import MetricCard from '../../components/data/MetricCard'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import { useAuth } from '../../context/AuthContext'
import { jobsApi } from '../../api/jobs'

const DEFAULT_FUNCTION = 'ALL'
const DEFAULT_AREA = 'Global'

const FUNCTION_KEYWORDS = {
  Sea: ['海运', '海', 'sea', 'ocean', 'shipping'],
  Air: ['空运', '空', 'air'],
  Road: ['陆运', '公路', '卡车', '汽运', 'road', 'truck'],
  Railway: ['铁路', 'rail', 'railway', 'train'],
  'Contract Logistics': ['合同物流', '仓储', '仓库', '物流', 'contract logistics', 'warehouse'],
  ECOMS: ['跨境电商', '电商', 'fba', 'ecom', 'e-commerce', 'ecommerce'],
}

const AREA_KEYWORDS = {
  'Great China': ['中国', 'china', '上海', '北京', '广州', '深圳', '宁波', '青岛', '厦门', '天津'],
  'East China': ['华东', '上海', '江苏', '南京', '苏州', '浙江', '杭州', '宁波', '安徽', '山东', '青岛'],
  'North China': ['华北', '北京', '天津', '河北', '山西', '内蒙古'],
  'South China': ['华南', '广东', '广州', '深圳', '福建', '厦门', '广西', '海南'],
  'West China': ['西部', '西南', '西北', '四川', '成都', '重庆', '陕西', '西安', '云南', '贵州', '新疆'],
  Taiwan: ['台湾', 'taiwan', '台北'],
  'Hong Kong': ['香港', 'hong kong', 'hk'],
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

function inferAreas(job) {
  const areas = DEFAULT_AREAS
    .filter((area) => area.key !== DEFAULT_AREA && matchesArea(job, area.key))
    .map((area) => area.key)
  return areas.length > 0 ? areas : [DEFAULT_AREA]
}

function countBy(items, keys, predicate) {
  return keys
    .map((item) => ({
      label: item.label,
      count: items.filter((job) => predicate(job, item.key)).length,
    }))
    .filter((bar) => bar.count > 0)
}

export default function CandidateHome() {
  const { user } = useAuth()
  const [selectedFunction, setSelectedFunction] = useState(DEFAULT_FUNCTION)
  const [selectedArea, setSelectedArea] = useState(DEFAULT_AREA)
  const [granularity, setGranularity] = useState('day')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('—')

  useEffect(() => {
    let alive = true
    jobsApi
      .getPublicJobs({})
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
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const filteredJobs = useMemo(
    () => jobs.filter((job) => matchesFunction(job, selectedFunction) && matchesArea(job, selectedArea)),
    [jobs, selectedFunction, selectedArea]
  )

  const chartBars = useMemo(() => {
    // Time-based aggregation: X axis is always time
    function periodKey(dateStr) {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return null
      if (granularity === 'day') {
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const dd = String(d.getDate()).padStart(2, '0')
        return { period: `${d.getFullYear()}-${mm}-${dd}`, label: `${mm}-${dd}` }
      }
      if (granularity === 'week') {
        // ISO week approximation
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

  const areaCoverage = useMemo(() => {
    const uniqueAreas = new Set()
    for (const job of jobs) {
      for (const area of inferAreas(job)) uniqueAreas.add(area)
    }
    uniqueAreas.delete(DEFAULT_AREA)
    return uniqueAreas.size
  }, [jobs])

  const subtitle = `FUNC=${selectedFunction} / AREA=${selectedArea}`
  const displayName = user?.name || 'Candidate'

  return (
    <TerminalLayout title="DASHBOARD" activeIconId="dashboard" navItems={CANDIDATE_ICON_NAV}>
      <FunctionRail
        value={selectedFunction}
        onChange={setSelectedFunction}
        functions={DEFAULT_FUNCTIONS}
      />

      <AreaSidebar
        value={selectedArea}
        onChange={setSelectedArea}
        areas={DEFAULT_AREAS}
      />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-[var(--t-font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
              ACCOUNT
            </span>
            <span className="truncate font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)]">
              {displayName}
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
          <div className="grid shrink-0 grid-cols-3 gap-4">
            <MetricCard
              label="Jobs"
              value={loading ? '—' : filteredJobs.length}
              helper={subtitle}
              icon={<Briefcase size={14} />}
            />
            <MetricCard
              label="Functions"
              value={DEFAULT_FUNCTIONS.length - 1}
              helper={selectedFunction === DEFAULT_FUNCTION ? 'ALL' : selectedFunction}
              icon={<Database size={14} />}
            />
            <MetricCard
              label="Areas"
              value={areaCoverage || DEFAULT_AREAS.length - 1}
              helper={selectedArea}
              icon={<TrendingUp size={14} />}
            />
          </div>

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
