import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, Clock, Search, X,
  Loader2, FolderOpen, AlertCircle,
  GraduationCap, Users, Zap, PlusCircle,
} from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import RegionSelector from '../../components/RegionSelector'
import Pagination from '../../components/ui/Pagination'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')


// ── helpers ──────────────────────────────────────────────────────────────────
const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly',        label: '月度' },
  { value: 'quarterly',      label: '季度' },
  { value: 'semi_annual',    label: '半年度' },
]
function splitTokens(str) {
  if (!str) return []
  // Handle arrays directly (e.g. knowledge_requirements from backend)
  if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean)
  const parts = String(str).split(/[,，、\n\r;；]+/).map(s => s.trim()).filter(Boolean)
  const seen = new Set(); const out = []
  for (const p of parts) { if (!seen.has(p)) { seen.add(p); out.push(p) } }
  return out
}
function formatThousand(val) {
  if (!val) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

// ── read-only field sub-components ───────────────────────────────────────────
function ReadField({ label, value, empty = '—' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-[var(--t-font-mono)] text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--t-text-muted)' }}>
        {label}
      </span>
      <div
        className="min-h-[28px] rounded-[var(--t-radius)] px-2 py-1.5 font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] leading-snug"
        style={{ background: 'var(--t-bg-input,var(--t-bg-elevated))', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)' }}
      >
        {value || empty}
      </div>
    </div>
  )
}
function ReadChips({ label, value, empty = '—' }) {
  const tokens = splitTokens(value)
  return (
    <div className="flex flex-col gap-1">
      <span className="font-[var(--t-font-mono)] text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--t-text-muted)' }}>
        {label}
      </span>
      {tokens.length === 0 ? (
        <div
          className="min-h-[28px] rounded-[var(--t-radius)] px-2 py-1.5 font-[var(--t-font-mono)] text-[length:var(--t-text-sm)]"
          style={{ background: 'var(--t-bg-input,var(--t-bg-elevated))', border: '1px solid var(--t-border)', color: 'var(--t-text-muted)' }}
        >
          {empty}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {tokens.map((t, i) => (
            <span
              key={i}
              className="font-[var(--t-font-mono)] text-[10px] px-2 py-0.5 rounded-[var(--t-radius-sm)]"
              style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
function ReadTextarea({ label, value, empty = '—' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-[var(--t-font-mono)] text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--t-text-muted)' }}>
        {label}
      </span>
      <div
        className="rounded-[var(--t-radius)] px-2 py-1.5 font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] leading-relaxed whitespace-pre-line"
        style={{ background: 'var(--t-bg-input,var(--t-bg-elevated))', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)', minHeight: '80px' }}
      >
        {value || empty}
      </div>
    </div>
  )
}

// ── 右侧详情面板 ──────────────────────────────────────────────────────────────
function JobDetailPanel({ job, terminal = false }) {
  const tagsByCat = job.tags_by_category || {}
  const baseLocation =
    job.location_path ||
    [job.province, job.city_name, job.district].filter(Boolean).join(' · ') ||
    job.location_name ||
    job.city ||
    '—'
  const fullLocation = job.address ? `${baseLocation} · ${job.address}` : baseLocation

  if (terminal) {
    const commissionLabel = COMMISSION_BONUS_PERIODS.find(p => p.value === job.commission_bonus_period)?.label ?? job.commission_bonus_period ?? '—'
    const salaryText = (job.salary_min || job.salary_max)
      ? `${formatThousand(job.salary_min) || '?'} – ${formatThousand(job.salary_max) || '?'}`
      : (job.salary_label || '面议')

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b" style={{ borderColor: 'var(--t-border-subtle)' }}>
          <div className="font-[var(--t-font-mono)] text-[length:var(--t-text-base)] font-bold" style={{ color: 'var(--t-text)' }}>
            {job.title}
          </div>
          <div className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            {job.company_name ?? '—'} · {fullLocation}
          </div>
          <div className="font-[var(--t-font-mono)] text-[11px] mt-1 uppercase tracking-wide font-semibold" style={{ color: 'var(--t-primary,var(--t-chart-blue))' }}>
            {salaryText}
          </div>
        </div>

        {/* Three-column body */}
        <div className="flex-1 min-h-0 grid grid-cols-3 gap-px" style={{ background: 'var(--t-border-subtle)' }}>
          {/* Col 1 — Basic info */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto terminal-scrollbar" style={{ background: 'var(--t-bg-panel)' }}>
            <div className="font-[var(--t-font-mono)] text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--t-text-muted)' }}>
              BASIC INFO
            </div>
            <ReadField label="FUNCTION" value={job.function_name ?? job.business_type} />
            <ReadField label="LOCATION" value={fullLocation} />
            <ReadField label="EXP REQUIRED" value={job.experience_required} />
            <ReadField label="MIN EDUCATION" value={job.degree_required} />
            <ReadField label="EMPLOYMENT TYPE" value={job.employment_type} />
            <ReadField
              label="MANAGEMENT ROLE"
              value={job.is_management_role
                ? `管理岗${job.management_headcount ? ` · ${job.management_headcount} 人` : ''}`
                : '非管理岗'}
            />
            <ReadField label="TAGS" value={Object.values(tagsByCat).flat().join('、') || null} />
            <div className="mt-auto pt-3 border-t font-[var(--t-font-mono)] text-[9px]" style={{ borderColor: 'var(--t-border-subtle)', color: 'var(--t-text-muted)' }}>
              发布于 {job.created_at?.slice(0, 10) ?? '—'}
            </div>
          </div>

          {/* Col 2 — Description */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto terminal-scrollbar" style={{ background: 'var(--t-bg-panel)' }}>
            <div className="font-[var(--t-font-mono)] text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--t-text-muted)' }}>
              JOB DESCRIPTION
            </div>
            <ReadTextarea label="DESCRIPTION" value={job.description} />
            <ReadChips label="KNOWLEDGE REQ" value={job.knowledge_requirements} />
            <ReadChips label="HARD SKILLS" value={job.hard_skill_requirements} />
            <ReadChips label="SOFT SKILLS" value={job.soft_skill_requirements} />
          </div>

          {/* Col 3 — Compensation */}
          <div className="flex flex-col gap-3 p-4 overflow-y-auto terminal-scrollbar" style={{ background: 'var(--t-bg-panel)' }}>
            <div className="font-[var(--t-font-mono)] text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: 'var(--t-text-muted)' }}>
              COMPENSATION
            </div>
            <ReadField label="SALARY MIN (¥/mo)" value={formatThousand(job.salary_min)} />
            <ReadField label="SALARY MAX (¥/mo)" value={formatThousand(job.salary_max)} />
            <ReadField label="SALARY MONTHS" value={job.salary_months ? `${job.salary_months} 个月` : null} />
            <ReadField label="COMMISSION PERIOD" value={commissionLabel} />
            <ReadField label="COMMISSION AMOUNT" value={job.commission_bonus_amount ? `${job.commission_bonus_amount}` : null} />
            <ReadField
              label="YEAR-END BONUS"
              value={job.has_year_end_bonus
                ? `有${job.year_end_bonus_months ? ` · ${job.year_end_bonus_months} 个月` : ''}`
                : job.has_year_end_bonus === false ? '无' : null}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── non-terminal (light) branch ───────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {(job.company_name ?? job.title ?? '?')[0]}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{job.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{job.company_name ?? '—'} · {fullLocation}</p>
          <p className="text-base font-bold text-blue-600 mt-1">{job.salary_label ?? '面议'}</p>
        </div>
      </div>

      {/* 基本信息格 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: MapPin,        label: '工作地点', value: fullLocation },
          { icon: Briefcase,     label: '薪资范围', value: job.salary_label ?? '面议' },
          { icon: Clock,         label: '经验要求', value: job.experience_required ?? '不限' },
          { icon: GraduationCap, label: '最低学历', value: job.degree_required ?? '不限' },
          { icon: Users, label: '管理属性', value: job.is_management_role ? `管理岗${job.management_headcount ? ` · ${job.management_headcount} 人` : ''}` : '非管理岗' },
          { icon: Users, label: '招聘人数', value: job.headcount ? `${job.headcount} 人` : '—' },
          { icon: Zap,   label: '紧急程度', value: job.urgency_level === 1 ? '紧急' : job.urgency_level === 3 ? '不急' : '正常' },
          { icon: Briefcase, label: '应聘类型', value: job.employment_type ?? '—' },
        ].map(item => (
          <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400">{item.label}</p>
            </div>
            <p className="text-sm font-semibold text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>

      {/* 标签 */}
      {Object.keys(tagsByCat).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">标签</p>
          <div className="space-y-2">
            {Object.entries(tagsByCat).map(([cat, names]) => (
              <div key={cat}>
                <p className="text-xs text-slate-400 mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full">{n}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 岗位职责 */}
      {job.description && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">岗位职责</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.description}</p>
        </div>
      )}

      {/* 任职要求 */}
      {job.requirements && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">任职要求</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.requirements}</p>
        </div>
      )}

      <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        发布于 {job.created_at?.slice(0, 10) ?? '—'}
      </p>
    </div>
  )
}


// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function JobMarketplace({ terminal = false, showNewJobButton = false, canApply = false }) {
  const navigate = useNavigate()
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)

  const [q, setQ]                 = useState('')
  const [location, setLocation]   = useState(null)  // RegionSelector value
  const [functionCode, setFunctionCode] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [savedFilter, setSavedFilter] = useState('all')
  const [appliedFilter, setAppliedFilter] = useState('all')

  // CAND-4 — Maps of jobId → applicationId (only used when canApply=true).
  // Using Map instead of Set so we can call the withdraw endpoint by app id.
  const [appliedJobMap, setAppliedJobMap] = useState(new Map()) // jobId → appId
  const [savedJobMap,   setSavedJobMap]   = useState(new Map()) // jobId → appId
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [savingJobId,   setSavingJobId]   = useState(null)
  const [applyError,    setApplyError]    = useState('')
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [total, setTotal]                 = useState(0)
  const lastFiltersRef                    = useRef({})

  // Derived sets for quick membership checks (used in render)
  const appliedJobIds = useMemo(() => new Set(appliedJobMap.keys()), [appliedJobMap])
  const savedJobIds   = useMemo(() => new Set(savedJobMap.keys()),   [savedJobMap])

  function fetchJobs(filters, targetPage = 1) {
    setLoading(true)
    setError('')
    jobsApi.getPublicJobs({ ...filters, page: targetPage, page_size: 20 })
      .then(res => {
        const list = res.data.jobs
        setJobs(list)
        setPage(res.data.page ?? targetPage)
        setTotalPages(res.data.total_pages ?? 1)
        setTotal(res.data.total ?? 0)
        if (list.length > 0 && !selected) setSelected(list[0])
      })
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchJobs({}, 1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // CAND-4: hydrate jobId→appId maps on mount so button state survives refresh.
  useEffect(() => {
    if (!canApply) return
    let cancelled = false
    applicationsApi.getMyApplications()
      .then(res => {
        if (cancelled) return
        const applied = new Map()
        const saved   = new Map()
        for (const a of (res.data?.applications ?? [])) {
          if (!a) continue
          if (a.status === 'saved') {
            saved.set(a.job_id, a.id)
          } else if (!['withdrawn'].includes(a.status)) {
            applied.set(a.job_id, a.id)
          }
        }
        setAppliedJobMap(applied)
        setSavedJobMap(saved)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [canApply])

  const visibleJobs = useMemo(() => {
    if (!canApply) return jobs
    return jobs.filter(job => {
      const isSaved = savedJobIds.has(job.id)
      const isApplied = appliedJobIds.has(job.id)
      if (savedFilter === 'saved' && !isSaved) return false
      if (savedFilter === 'unsaved' && isSaved) return false
      if (appliedFilter === 'applied' && !isApplied) return false
      if (appliedFilter === 'unapplied' && isApplied) return false
      return true
    })
  }, [appliedFilter, appliedJobIds, canApply, jobs, savedFilter, savedJobIds])

  useEffect(() => {
    if (loading || error) return
    if (visibleJobs.length === 0) {
      if (selected) setSelected(null)
      return
    }
    if (!selected || !visibleJobs.some(job => job.id === selected.id)) {
      setSelected(visibleJobs[0])
    }
  }, [error, loading, selected, visibleJobs])

  async function handleApply(job) {
    if (!job || !canApply) return
    setApplyError('')

    // Toggle: already applied → withdraw
    if (appliedJobIds.has(job.id)) {
      const appId = appliedJobMap.get(job.id)
      if (!appId || applyingJobId === job.id) return
      setApplyingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setAppliedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      } catch (err) {
        setApplyError(err.response?.data?.message ?? '撤回失败，请重试')
      } finally {
        setApplyingJobId(null)
      }
      return
    }

    if (applyingJobId === job.id) return
    setApplyingJobId(job.id)
    try {
      const res = await applicationsApi.applyToJob(job.id)
      const a = res.data?.application
      if (a && a.status !== 'withdrawn') {
        setAppliedJobMap(prev => { const next = new Map(prev); next.set(job.id, a.id); return next })
        setSavedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      }
    } catch (err) {
      const code   = err.response?.data?.error_code
      const status = err.response?.status
      if (status === 422 && code === 'profile_incomplete') {
        navigate('/candidate/tags')
        return
      }
      setApplyError(err.response?.data?.message ?? '投递失败，请重试')
    } finally {
      setApplyingJobId(null)
    }
  }

  async function handleSave(job) {
    if (!job || !canApply) return
    setApplyError('')

    // Toggle: already saved → withdraw (cancel save)
    if (savedJobIds.has(job.id)) {
      const appId = savedJobMap.get(job.id)
      if (!appId || savingJobId === job.id) return
      setSavingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setSavedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      } catch (err) {
        setApplyError(err.response?.data?.message ?? '取消收藏失败，请重试')
      } finally {
        setSavingJobId(null)
      }
      return
    }

    if (savingJobId === job.id) return
    setSavingJobId(job.id)
    try {
      const res = await applicationsApi.saveJob(job.id)
      const a = res.data?.application
      if (a?.status === 'saved') {
        setSavedJobMap(prev => { const next = new Map(prev); next.set(job.id, a.id); return next })
      } else if (a && a.status !== 'withdrawn') {
        setAppliedJobMap(prev => { const next = new Map(prev); next.set(job.id, a.id); return next })
      }
    } catch (err) {
      const code    = err.response?.data?.error_code
      const status  = err.response?.status
      const missing = err.response?.data?.missing ?? []
      if (status === 422 && code === 'profile_incomplete') {
        navigate(missing.includes('profile') ? '/candidate/profile/builder' : '/candidate/tags')
        return
      }
      setApplyError(err.response?.data?.message ?? '收藏失败，请重试')
    } finally {
      setSavingJobId(null)
    }
  }

  function buildFilters(nextLocation = location, nextQ = q, nextFn = functionCode, nextEt = employmentType) {
    return {
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextLocation?.location_code ? { location_code: nextLocation.location_code } : {}),
      ...(nextFn ? { function_code: nextFn } : {}),
      ...(nextEt ? { employment_type: nextEt } : {}),
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    const f = buildFilters()
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handleReset() {
    setQ(''); setLocation(null); setFunctionCode(''); setEmploymentType(''); setSavedFilter('all'); setAppliedFilter('all')
    setSelected(null)
    lastFiltersRef.current = {}
    fetchJobs({}, 1)
  }

  function handleLocationChange(loc) {
    setLocation(loc)
    setSelected(null)
    const f = buildFilters(loc, q, functionCode)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handleFunctionChange(code) {
    setFunctionCode(code)
    setSelected(null)
    const f = buildFilters(location, q, code, employmentType)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handleEmploymentTypeChange(et) {
    setEmploymentType(et)
    setSelected(null)
    const f = buildFilters(location, q, functionCode, et)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handlePageChange(p) {
    setSelected(null)
    fetchJobs(lastFiltersRef.current, p)
  }

  const hasStatusFilter = canApply && (savedFilter !== 'all' || appliedFilter !== 'all')
  const hasFilter = q || !!location?.location_code || !!functionCode || !!employmentType || hasStatusFilter

  const inner = (
    <>
      {/* ── 左栏 ── */}
      <div
        className={
          terminal
            ? 'w-80 flex-shrink-0 flex flex-col overflow-hidden'
            : 'w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden'
        }
        style={terminal ? { background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)' } : undefined}
      >
        <div
          className={terminal ? 'p-4' : 'p-4 border-b border-slate-100'}
          style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
        >
          <div className="flex items-center justify-between mb-3">
            <h1
              className={terminal ? 'text-base font-semibold' : 'text-base font-semibold text-slate-800'}
              style={terminal ? { color: 'var(--t-text)' } : undefined}
            >
              岗位广场
            </h1>
            {terminal && showNewJobButton && (
              <button
                type="button"
                onClick={() => navigate('/employer/jobs/new')}
                title="发布岗位"
                className="inline-flex items-center gap-1 rounded-[var(--t-radius)] border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: 'var(--t-primary)',
                  borderColor: 'var(--t-primary)',
                  color: '#fff',
                }}
              >
                <PlusCircle size={12} />
                <span className="font-[var(--t-font-mono)]">New Job</span>
              </button>
            )}
          </div>
          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative">
              <Search
                size={13}
                className={terminal ? 'absolute left-3 top-1/2 -translate-y-1/2' : 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="搜索职位或城市..."
                className={
                  terminal
                    ? 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none'
                    : 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
                }
                style={
                  terminal
                    ? {
                        background: 'var(--t-bg-input)',
                        border: '1px solid var(--t-border)',
                        color: 'var(--t-text)',
                      }
                    : undefined
                }
              />
            </div>
            <RegionSelector
              value={location}
              onChange={handleLocationChange}
              terminal={terminal}
              placeholder="按地区筛选（省 / 市 / 区 / 海外国家）"
            />
            <select
              value={functionCode}
              onChange={(e) => handleFunctionChange(e.target.value)}
              className={
                terminal
                  ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                  : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
              }
              style={
                terminal
                  ? {
                      background: 'var(--t-bg-input)',
                      borderColor: 'var(--t-border)',
                      color: functionCode ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }
                  : undefined
              }
            >
              <option value="">按业务方向筛选（全部）</option>
              {FUNCTION_OPTIONS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <select
              value={employmentType}
              onChange={(e) => handleEmploymentTypeChange(e.target.value)}
              className={
                terminal
                  ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                  : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
              }
              style={
                terminal
                  ? {
                      background: 'var(--t-bg-input)',
                      borderColor: 'var(--t-border)',
                      color: employmentType ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }
                  : undefined
              }
            >
              <option value="">应聘类型（全部）</option>
              <option value="全职">全职</option>
              <option value="兼职">兼职</option>
              <option value="实习生">实习生</option>
            </select>
            {canApply && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={savedFilter}
                  onChange={(e) => setSavedFilter(e.target.value)}
                  className={
                    terminal
                      ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                      : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          borderColor: 'var(--t-border)',
                          color: savedFilter === 'all' ? 'var(--t-text-muted)' : 'var(--t-text)',
                        }
                      : undefined
                  }
                  title="按收藏状态筛选"
                >
                  <option value="all">收藏：全部</option>
                  <option value="saved">已收藏</option>
                  <option value="unsaved">未收藏</option>
                </select>
                <select
                  value={appliedFilter}
                  onChange={(e) => setAppliedFilter(e.target.value)}
                  className={
                    terminal
                      ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                      : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          borderColor: 'var(--t-border)',
                          color: appliedFilter === 'all' ? 'var(--t-text-muted)' : 'var(--t-text)',
                        }
                      : undefined
                  }
                  title="按投递状态筛选"
                >
                  <option value="all">投递：全部</option>
                  <option value="applied">已投递</option>
                  <option value="unapplied">未投递</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className={
                  terminal
                    ? 'flex-1 py-1.5 text-xs text-white rounded-lg transition-colors'
                    : 'flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                }
                style={terminal ? { background: 'var(--t-primary)' } : undefined}
              >
                搜索
              </button>
              {hasFilter && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={
                    terminal
                      ? 'px-2 py-1.5 text-xs rounded-lg border transition-colors'
                      : 'px-2 py-1.5 text-xs text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-elevated)',
                          borderColor: 'var(--t-border)',
                          color: 'var(--t-text-secondary)',
                        }
                      : undefined
                  }
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </form>
          {!loading && !error && (
            <p
              className={terminal ? 'text-xs mt-2' : 'text-xs text-slate-400 mt-2'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              共 {total} 个岗位{hasFilter ? '（已筛选）' : ''}
            </p>
          )}
        </div>

        <div className={terminal ? 'flex-1 overflow-y-auto terminal-scrollbar' : 'flex-1 overflow-y-auto'}>
          {loading && (
            <div
              className={terminal ? 'flex items-center justify-center gap-2 py-16' : 'flex items-center justify-center gap-2 py-16 text-slate-400'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <AlertCircle
                size={24}
                className={terminal ? 'mb-2' : 'text-red-300 mb-2'}
                style={terminal ? { color: 'var(--t-danger)' } : undefined}
              />
              <p
                className={terminal ? 'text-xs text-center' : 'text-xs text-red-500 text-center'}
                style={terminal ? { color: 'var(--t-danger)' } : undefined}
              >
                {error}
              </p>
            </div>
          )}
          {!loading && !error && visibleJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FolderOpen
                size={28}
                className={terminal ? 'mb-2' : 'text-slate-300 mb-2'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              />
              <p
                className={terminal ? 'text-xs text-center' : 'text-xs text-slate-400 text-center'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                暂无匹配岗位
              </p>
            </div>
          )}
          {!loading && !error && visibleJobs.map(job => {
            const isSelected = selected?.id === job.id
            const isUrgent = job.urgency_level === 1
            const cityShort = job.city_name || job.city || '—'
            const isApplied = appliedJobIds.has(job.id)
            const isSaved = savedJobIds.has(job.id)

            // Selected / hover styles per mode
            const rowClass = terminal
              ? `p-4 cursor-pointer transition-all border-l-4 ${isSelected ? '' : 'border-l-transparent'}`
              : `p-4 cursor-pointer border-b border-slate-100 transition-all ${
                  isSelected
                    ? 'border-l-4 border-l-blue-500 bg-blue-50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-50'
                }`
            const rowStyle = terminal
              ? {
                  borderBottom: '1px solid var(--t-border-subtle)',
                  background: isSelected ? 'var(--t-bg-active)' : 'transparent',
                  borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
                }
              : undefined

            return (
              <div
                key={job.id}
                onClick={() => setSelected(job)}
                className={rowClass}
                style={rowStyle}
                onMouseEnter={(e) => {
                  if (terminal && !isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (terminal && !isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                <div className="flex items-center gap-3">
                  {/* 公司头像 */}
                  <div
                    className={
                      terminal
                        ? 'w-9 h-9 rounded flex items-center justify-center font-bold text-sm flex-shrink-0'
                        : 'w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-500'
                    }
                    style={terminal ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: 'var(--t-text)' } : undefined}
                  >
                    {(job.company_name ?? job.title ?? '?')[0]}
                  </div>
                  {/* 信息区 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={terminal ? 'font-medium text-sm truncate' : 'font-medium text-sm text-slate-800 truncate'}
                        style={terminal ? { color: 'var(--t-text)' } : undefined}
                      >
                        {job.title}
                      </p>
                      {isUrgent && (
                        <span
                          className={
                            terminal
                              ? 'flex-shrink-0 text-[10px] px-1 py-0.5 border rounded font-medium'
                              : 'flex-shrink-0 text-[10px] px-1 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded font-medium'
                          }
                          style={terminal ? { background: 'var(--t-danger-muted)', color: 'var(--t-danger)', borderColor: 'var(--t-danger)' } : undefined}
                        >
                          急
                        </span>
                      )}
                    </div>
                    <p
                      className={terminal ? 'text-xs truncate mt-0.5' : 'text-xs text-slate-500 truncate mt-0.5'}
                      style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
                    >
                      {job.company_name ?? '—'}
                    </p>
                    <div
                      className={terminal ? 'flex items-center gap-2 text-xs mt-0.5 flex-wrap' : 'flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap'}
                      style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                    >
                      {cityShort !== '—' && (
                        <span className="flex items-center gap-0.5"><MapPin size={9} />{cityShort}</span>
                      )}
                      {job.salary_label && (
                        <span
                          className={terminal ? 'font-semibold' : 'font-semibold text-blue-600'}
                          style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
                        >
                          {job.salary_label}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 右侧操作按钮 */}
                  {canApply && (
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0" style={{ width: '3.5rem' }}>
                      {/* 收藏 / 取消收藏 toggle */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (savingJobId !== job.id) handleSave(job) }}
                        disabled={savingJobId === job.id}
                        className={terminal
                          ? 'text-xs py-0.5 rounded w-full text-center'
                          : `text-xs py-0.5 rounded border w-full text-center transition-colors ${
                              isSaved
                                ? 'border-emerald-300 text-emerald-600 bg-emerald-50 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                                : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:text-slate-700'
                            }`
                        }
                        style={terminal ? {
                          border: isSaved ? '1px solid var(--t-success)' : '1px solid var(--t-text-muted)',
                          color: isSaved ? 'var(--t-success)' : 'var(--t-text-secondary)',
                          background: isSaved ? 'var(--t-success-muted)' : 'transparent',
                          borderRadius: 'var(--t-radius-sm)',
                          opacity: savingJobId === job.id ? 0.5 : 1,
                          cursor: savingJobId === job.id ? 'default' : 'pointer',
                          width: '100%',
                          textAlign: 'center',
                        } : undefined}
                        onMouseEnter={(e) => {
                          if (!terminal || savingJobId === job.id) return
                          if (isSaved) {
                            e.currentTarget.style.borderColor = 'var(--t-danger)'
                            e.currentTarget.style.color = 'var(--t-danger)'
                            e.currentTarget.style.background = 'var(--t-danger-muted)'
                          } else {
                            e.currentTarget.style.borderColor = 'var(--t-text)'
                            e.currentTarget.style.color = 'var(--t-text)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!terminal || savingJobId === job.id) return
                          e.currentTarget.style.borderColor = isSaved ? 'var(--t-success)' : 'var(--t-text-muted)'
                          e.currentTarget.style.color = isSaved ? 'var(--t-success)' : 'var(--t-text-secondary)'
                          e.currentTarget.style.background = isSaved ? 'var(--t-success-muted)' : 'transparent'
                        }}
                      >
                        {savingJobId === job.id ? '…' : isSaved ? '已收藏' : '收藏'}
                      </button>
                      {/* 投递 / 撤回投递 toggle */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (applyingJobId !== job.id) handleApply(job) }}
                        disabled={applyingJobId === job.id}
                        className={terminal
                          ? 'text-xs py-0.5 rounded w-full text-center'
                          : `text-xs py-0.5 rounded border w-full text-center transition-colors ${
                              isApplied
                                ? 'border-blue-300 text-blue-600 bg-blue-50 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                                : 'border-slate-200 text-slate-500 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                            }`
                        }
                        style={terminal ? {
                          border: isApplied ? '1px solid var(--t-primary)' : '1px solid var(--t-text-muted)',
                          color: isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)',
                          background: isApplied ? 'var(--t-primary-muted)' : 'transparent',
                          opacity: applyingJobId === job.id ? 0.5 : 1,
                          cursor: applyingJobId === job.id ? 'default' : 'pointer',
                          borderRadius: 'var(--t-radius-sm)',
                          width: '100%',
                          textAlign: 'center',
                        } : undefined}
                        onMouseEnter={(e) => {
                          if (!terminal || applyingJobId === job.id) return
                          if (isApplied) {
                            e.currentTarget.style.borderColor = 'var(--t-danger)'
                            e.currentTarget.style.color = 'var(--t-danger)'
                            e.currentTarget.style.background = 'var(--t-danger-muted)'
                          } else {
                            e.currentTarget.style.borderColor = 'var(--t-primary)'
                            e.currentTarget.style.color = 'var(--t-primary)'
                            e.currentTarget.style.background = 'var(--t-primary-muted)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!terminal || applyingJobId === job.id) return
                          e.currentTarget.style.borderColor = isApplied ? 'var(--t-primary)' : 'var(--t-text-muted)'
                          e.currentTarget.style.color = isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)'
                          e.currentTarget.style.background = isApplied ? 'var(--t-primary-muted)' : 'transparent'
                        }}
                      >
                        {applyingJobId === job.id ? '…' : isApplied ? '已投递' : '投递'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          terminal={terminal}
        />
      </div>

      {/* ── 右栏详情 ── */}
      <div
        className={terminal ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto'}
        style={terminal ? { background: 'var(--t-bg)' } : undefined}
      >
        {selected ? (
          <div className={terminal ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'contents'}>
            {canApply && applyError && (
              <div
                className={
                  terminal
                    ? 'shrink-0 mx-6 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm'
                    : 'mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm'
                }
                style={
                  terminal
                    ? { background: 'var(--t-danger-muted)', borderColor: 'var(--t-danger)', color: 'var(--t-danger)' }
                    : undefined
                }
              >
                <AlertCircle size={14} /><span>{applyError}</span>
              </div>
            )}
            <JobDetailPanel
              job={selected}
              terminal={terminal}
            />
          </div>
        ) : (
          <div
            className={terminal ? 'h-full flex items-center justify-center' : 'h-full flex items-center justify-center text-slate-400'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            <div className="text-center">
              <FolderOpen
                size={40}
                className={terminal ? 'mx-auto mb-3' : 'mx-auto mb-3 text-slate-300'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              />
              <p className="text-sm">点击左侧岗位查看详情</p>
            </div>
          </div>
        )}
      </div>
    </>
  )

  if (terminal) {
    return (
      <TerminalPageSurface split>
        {inner}
      </TerminalPageSurface>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      {inner}
    </div>
  )
}
