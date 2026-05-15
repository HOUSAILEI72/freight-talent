import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Loader2, FolderOpen, AlertCircle,
  MapPin, Briefcase, ChevronLeft,
} from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import RegionSelector from '../../components/RegionSelector'
import Pagination from '../../components/ui/Pagination'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'

// ── shared helpers (copied from JobMarketplace to avoid prop-drilling) ────────
const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly',        label: '月度' },
  { value: 'quarterly',      label: '季度' },
  { value: 'semi_annual',    label: '半年度' },
]
const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

function splitTokens(str) {
  if (!str) return []
  if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean)
  return String(str).split(/[,，、\n\r;；]+/).map(s => s.trim()).filter(Boolean)
}
function formatThousand(val) {
  if (!val) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

// ── read-only display sub-components (terminal-only) ──────────────────────────
const LABEL_STYLE = { color: 'var(--t-text-secondary)', fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 3 }
const BOX_STYLE = {
  background: 'var(--t-bg-input)',
  border: '1px solid var(--t-border)',
  color: 'var(--t-text)',
  borderRadius: 'var(--t-radius)',
  padding: '6px 10px',
  fontSize: 13,
  lineHeight: 1.45,
  minHeight: 30,
}

function ReadField({ label, value, empty = '—' }) {
  const display = (value === null || value === undefined || value === '') ? empty : value
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{ ...BOX_STYLE, color: display === empty ? 'var(--t-text-muted)' : 'var(--t-text)' }}>
        {display}
      </div>
    </div>
  )
}

function ReadChips({ label, value }) {
  const tokens = Array.isArray(value)
    ? value.map(s => String(s).trim()).filter(Boolean)
    : splitTokens(value)
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      {tokens.length === 0 ? (
        <div style={{ ...BOX_STYLE, color: 'var(--t-text-muted)' }}>—</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 2 }}>
          {tokens.map((t, i) => (
            <span
              key={i}
              style={{
                padding: '3px 9px', fontSize: 11, borderRadius: 'var(--t-radius-sm)',
                background: 'var(--t-bg-elevated)',
                border: '1px solid var(--t-border)',
                color: 'var(--t-text-secondary)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ReadTextarea({ label, value }) {
  const display = (value === null || value === undefined || value === '') ? '—' : value
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{ ...BOX_STYLE, whiteSpace: 'pre-line', minHeight: 120, color: display === '—' ? 'var(--t-text-muted)' : 'var(--t-text)' }}>
        {display}
      </div>
    </div>
  )
}

// ── JobDetailPanel (terminal-only, 3-column) ──────────────────────────────────
function JobDetailPanel({ job }) {
  const commissionLabel = COMMISSION_BONUS_PERIODS.find(p => p.value === job.commission_bonus_period)?.label ?? job.commission_bonus_period ?? '—'
  const allTags = Object.values(job.tags_by_category || {}).flat()
  const isClosed = job.status === 'closed'

  const cardClass = 'p-4 space-y-3 rounded-[var(--t-radius-lg)] border flex flex-col min-h-0'
  const cardStyle = { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
  const secTitleClass = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] mb-1 flex-shrink-0'
  const secTitleStyle = { color: 'var(--t-text-muted)' }

  return (
    <div
      className="terminal-mode flex-1 min-h-0 overflow-y-auto terminal-scrollbar flex flex-col px-6 py-5"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold truncate" style={{ color: 'var(--t-text)' }}>{job.title}</h1>
            {isClosed && (
              <span style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                padding: '2px 7px', borderRadius: 'var(--t-radius-sm)',
                background: 'var(--t-danger-muted)', color: 'var(--t-danger)',
                border: '1px solid var(--t-danger)', textTransform: 'uppercase',
              }}>CLOSED</span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            {job.company_name ?? '—'}
            {job.created_at ? ` · 发布于 ${job.created_at.slice(0, 10)}` : ''}
          </p>
          {(job.salary_min || job.salary_max) && (
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--t-primary)' }}>
              ¥ {formatThousand(job.salary_min) || '?'} – {formatThousand(job.salary_max) || '?'} / 月
              {job.salary_months ? `  ·  ${job.salary_months} 个月` : ''}
            </p>
          )}
        </div>
      </div>

      {/* 3-column grid */}
      <div className="terminal-form-grid-3 flex-1 min-h-0">
        {/* Col 1: 基本信息 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 基本信息</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <ReadField label="岗位名称" value={job.title} />
            <ReadField label="岗位板块" value={job.function_name ?? job.business_type} />
            <ReadField label="经验要求" value={job.experience_required} />
            <ReadField label="最低学历要求" value={job.degree_required} />
            <ReadField label="是否带团队" value={job.is_management_role == null ? null : job.is_management_role ? '是' : '否'} />
            {job.is_management_role && (
              <ReadField label="预计团队人数" value={job.management_headcount ? String(job.management_headcount) : null} />
            )}
            <ReadField label="应聘类型" value={job.employment_type} />
            <ReadField label="岗位工作城市" value={
              job.location_path ||
              [job.province, job.city_name, job.district].filter(Boolean).join(' · ') ||
              job.location_name || job.city
            } />
            <ReadField label="详细地址" value={job.address} />
            {allTags.length > 0 && <ReadChips label="标签" value={allTags} />}
          </div>
        </div>

        {/* Col 2: 岗位描述 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 岗位描述</div>
          <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto terminal-scrollbar pr-1">
            <ReadTextarea label="岗位职责" value={job.description} />
            <ReadChips label="知识" value={job.knowledge_requirements} />
            <ReadChips label="硬技能" value={job.hard_skill_requirements} />
            <ReadChips label="软技能" value={job.soft_skill_requirements} />
          </div>
        </div>

        {/* Col 3: 薪酬福利 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 薪酬福利</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <div className="grid grid-cols-3 gap-3">
              <ReadField label="最低月薪" value={formatThousand(job.salary_min)} />
              <ReadField label="最高月薪" value={formatThousand(job.salary_max)} />
              <ReadField label="薪资月数" value={job.salary_months ? `${job.salary_months} 个月` : null} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="提成/计件奖金" value={commissionLabel} />
              <ReadField label="预估平均额" value={
                job.commission_bonus_period === 'not_applicable' ? '—'
                : job.commission_bonus_amount ? `${formatThousand(job.commission_bonus_amount)}` : null
              } />
            </div>
            <ReadField label="是否有年终奖" value={job.has_year_end_bonus == null ? null : job.has_year_end_bonus ? '是' : '否'} />
            {job.has_year_end_bonus && (
              <ReadField label="年终奖预估平均额" value={job.year_end_bonus_months ? `${job.year_end_bonus_months} 个月` : null} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── JobCard (left two columns list item) ─────────────────────────────────────
function JobCard({ job, isSelected, isApplied, isSaved, applyingJobId, savingJobId, onSelect, onApply, onSave }) {
  const isUrgent = job.urgency_level === 1
  const cityShort = job.city_name || job.city || '—'

  return (
    <div
      onClick={() => onSelect(job)}
      className="cursor-pointer transition-all border-l-4"
      style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--t-border-subtle)',
        borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
        background: isSelected ? 'var(--t-bg-active)' : 'transparent',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      {job.status === 'closed' && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
          padding: '2px 5px', borderRadius: 'var(--t-radius-sm)',
          background: 'var(--t-danger-muted)', color: 'var(--t-danger)',
          border: '1px solid var(--t-danger)', textTransform: 'uppercase',
          pointerEvents: 'none', lineHeight: 1.4,
        }}>CLOSED</span>
      )}
      <div className="flex items-center gap-3">
        {/* 公司头像 */}
        <div
          className="w-9 h-9 rounded flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
        >
          {(job.company_name ?? job.title ?? '?')[0]}
        </div>

        {/* 信息区 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm truncate" style={{ color: 'var(--t-text)' }}>{job.title}</p>
            {isUrgent && (
              <span
                className="flex-shrink-0 text-[10px] px-1 py-0.5 border rounded font-medium"
                style={{ background: 'var(--t-danger-muted)', color: 'var(--t-danger)', borderColor: 'var(--t-danger)' }}
              >急</span>
            )}
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
            {job.company_name ?? '—'}
          </p>
          <div className="flex items-center gap-2 text-xs mt-0.5 flex-wrap" style={{ color: 'var(--t-text-muted)' }}>
            {cityShort !== '—' && (
              <span className="flex items-center gap-0.5"><MapPin size={9} />{cityShort}</span>
            )}
            {job.salary_label && (
              <span className="font-semibold" style={{ color: 'var(--t-chart-blue)' }}>{job.salary_label}</span>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0" style={{ width: '3.5rem' }}>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (savingJobId !== job.id) onSave(job) }}
            disabled={savingJobId === job.id}
            style={{
              fontSize: 11, padding: '2px 0', borderRadius: 'var(--t-radius-sm)',
              border: isSaved ? '1px solid var(--t-success)' : '1px solid var(--t-text-muted)',
              color: isSaved ? 'var(--t-success)' : 'var(--t-text-secondary)',
              background: isSaved ? 'var(--t-success-muted)' : 'transparent',
              opacity: savingJobId === job.id ? 0.5 : 1,
              cursor: savingJobId === job.id ? 'default' : 'pointer',
              width: '100%', textAlign: 'center',
            }}
            onMouseEnter={e => {
              if (savingJobId === job.id) return
              if (isSaved) {
                e.currentTarget.style.borderColor = 'var(--t-danger)'
                e.currentTarget.style.color = 'var(--t-danger)'
                e.currentTarget.style.background = 'var(--t-danger-muted)'
              } else {
                e.currentTarget.style.borderColor = 'var(--t-text)'
                e.currentTarget.style.color = 'var(--t-text)'
              }
            }}
            onMouseLeave={e => {
              if (savingJobId === job.id) return
              e.currentTarget.style.borderColor = isSaved ? 'var(--t-success)' : 'var(--t-text-muted)'
              e.currentTarget.style.color = isSaved ? 'var(--t-success)' : 'var(--t-text-secondary)'
              e.currentTarget.style.background = isSaved ? 'var(--t-success-muted)' : 'transparent'
            }}
          >
            {savingJobId === job.id ? '…' : isSaved ? '已收藏' : '收藏'}
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (applyingJobId !== job.id) onApply(job) }}
            disabled={applyingJobId === job.id}
            style={{
              fontSize: 11, padding: '2px 0', borderRadius: 'var(--t-radius-sm)',
              border: isApplied ? '1px solid var(--t-primary)' : '1px solid var(--t-text-muted)',
              color: isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)',
              background: isApplied ? 'var(--t-primary-muted)' : 'transparent',
              opacity: applyingJobId === job.id ? 0.5 : 1,
              cursor: applyingJobId === job.id ? 'default' : 'pointer',
              borderRadius: 'var(--t-radius-sm)',
              width: '100%', textAlign: 'center',
            }}
            onMouseEnter={e => {
              if (applyingJobId === job.id) return
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
            onMouseLeave={e => {
              if (applyingJobId === job.id) return
              e.currentTarget.style.borderColor = isApplied ? 'var(--t-primary)' : 'var(--t-text-muted)'
              e.currentTarget.style.color = isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)'
              e.currentTarget.style.background = isApplied ? 'var(--t-primary-muted)' : 'transparent'
            }}
          >
            {applyingJobId === job.id ? '…' : isApplied ? '已投递' : '投递'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SavedJobCard (right column list item) ────────────────────────────────────
function SavedJobCard({ job, isSelected, onSelect }) {
  const cityShort = job.city_name || job.city || '—'
  return (
    <div
      onClick={() => onSelect(job)}
      className="cursor-pointer transition-all border-l-4"
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--t-border-subtle)',
        borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
        background: isSelected ? 'var(--t-bg-active)' : 'transparent',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <p className="font-medium text-xs truncate" style={{ color: 'var(--t-text)' }}>{job.title}</p>
      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>{job.company_name ?? '—'}</p>
      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap" style={{ color: 'var(--t-text-muted)', fontSize: 11 }}>
        {cityShort !== '—' && <span className="flex items-center gap-0.5"><MapPin size={8} />{cityShort}</span>}
        {job.salary_label && <span style={{ color: 'var(--t-chart-blue)' }}>{job.salary_label}</span>}
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function TerminalCandidateJobs() {
  const navigate = useNavigate()

  // ── 左两列：岗位广场 ──────────────────────────────────────────────────────
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)  // 选中后展开详情

  const [q, setQ]                       = useState('')
  const [location, setLocation]         = useState(null)
  const [functionCode, setFunctionCode] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [page, setPage]                 = useState(1)
  const [totalPages, setTotalPages]     = useState(1)
  const [total, setTotal]               = useState(0)
  const lastFiltersRef                  = useRef({})

  // ── 右列：收藏岗位 ────────────────────────────────────────────────────────
  const [savedJobs, setSavedJobs]           = useState([])   // 收藏的完整岗位对象列表
  const [savedLoading, setSavedLoading]     = useState(false)
  const [savedSelected, setSavedSelected]   = useState(null) // 收藏区选中的岗位（进详情）
  const [savedPage, setSavedPage]           = useState(1)
  const SAVED_PAGE_SIZE = 8

  // 右列筛选
  const [savedQ, setSavedQ]                     = useState('')
  const [savedFunctionCode, setSavedFunctionCode] = useState('')
  const [savedLocation, setSavedLocation]       = useState(null)

  // ── 应用/收藏状态 Maps ───────────────────────────────────────────────────
  const [appliedJobMap, setAppliedJobMap] = useState(new Map())
  const [savedJobMap,   setSavedJobMap]   = useState(new Map())
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [savingJobId,   setSavingJobId]   = useState(null)
  const [applyError,    setApplyError]    = useState('')

  const appliedJobIds = useMemo(() => new Set(appliedJobMap.keys()), [appliedJobMap])
  const savedJobIds   = useMemo(() => new Set(savedJobMap.keys()),   [savedJobMap])

  // ── 右列：详情视图状态 ───────────────────────────────────────────────────
  // null = 显示列表；非 null = 显示 JobDetailPanel
  const detailJob = selected ?? savedSelected

  // 当 selected（左列选中）激活时，清空右列选中，反之亦然
  function selectMainJob(job) {
    setSavedSelected(null)
    setSelected(job)
  }
  function selectSavedJob(job) {
    setSelected(null)
    setSavedSelected(job)
  }

  // ── 初始化：加载应用记录 ─────────────────────────────────────────────────
  useEffect(() => {
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
          } else if (a.status !== 'withdrawn') {
            applied.set(a.job_id, a.id)
          }
        }
        setAppliedJobMap(applied)
        setSavedJobMap(saved)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── 加载收藏的岗位详情（每当 savedJobIds 变化时重新拉取） ────────────────
  useEffect(() => {
    if (savedJobIds.size === 0) {
      setSavedJobs([])
      return
    }
    setSavedLoading(true)
    const ids = [...savedJobIds]
    Promise.all(ids.map(id => jobsApi.getJobById(id).catch(() => null)))
      .then(results => {
        setSavedJobs(results.filter(Boolean).map(r => r.data?.job ?? r.data).filter(Boolean))
      })
      .catch(() => setSavedJobs([]))
      .finally(() => setSavedLoading(false))
  }, [savedJobIds.size]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 左列：拉取岗位 ───────────────────────────────────────────────────────
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
      })
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchJobs({}, 1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildFilters(loc = location, qStr = q, fn = functionCode, et = employmentType) {
    return {
      ...(qStr ? { q: qStr } : {}),
      ...(loc?.location_code ? { location_code: loc.location_code } : {}),
      ...(fn ? { function_code: fn } : {}),
      ...(et ? { employment_type: et } : {}),
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    const f = buildFilters()
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }
  function handleReset() {
    setQ(''); setLocation(null); setFunctionCode(''); setEmploymentType('')
    lastFiltersRef.current = {}
    fetchJobs({}, 1)
  }
  function handleLocationChange(loc) {
    setLocation(loc)
    const f = buildFilters(loc)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }
  function handleFunctionChange(code) {
    setFunctionCode(code)
    const f = buildFilters(location, q, code, employmentType)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }
  function handleEmploymentTypeChange(et) {
    setEmploymentType(et)
    const f = buildFilters(location, q, functionCode, et)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }
  function handlePageChange(p) {
    fetchJobs(lastFiltersRef.current, p)
  }

  // ── 收藏/投递操作 ────────────────────────────────────────────────────────
  const handleApply = useCallback(async (job) => {
    setApplyError('')
    if (appliedJobIds.has(job.id)) {
      const appId = appliedJobMap.get(job.id)
      if (!appId || applyingJobId === job.id) return
      setApplyingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setAppliedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      } catch (err) {
        setApplyError(err.response?.data?.message ?? '撤回失败，请重试')
      } finally { setApplyingJobId(null) }
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
      const code = err.response?.data?.error_code
      const status = err.response?.status
      if (status === 422 && code === 'profile_incomplete') {
        navigate('/candidate/tags'); return
      }
      setApplyError(err.response?.data?.message ?? '投递失败，请重试')
    } finally { setApplyingJobId(null) }
  }, [appliedJobIds, appliedJobMap, applyingJobId, navigate])

  const handleSave = useCallback(async (job) => {
    setApplyError('')
    if (savedJobIds.has(job.id)) {
      const appId = savedJobMap.get(job.id)
      if (!appId || savingJobId === job.id) return
      setSavingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setSavedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      } catch (err) {
        setApplyError(err.response?.data?.message ?? '取消收藏失败，请重试')
      } finally { setSavingJobId(null) }
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
      const code = err.response?.data?.error_code
      const status = err.response?.status
      if (status === 422 && code === 'profile_incomplete') {
        navigate(err.response?.data?.missing?.includes('profile') ? '/candidate/profile/builder' : '/candidate/tags')
        return
      }
      setApplyError(err.response?.data?.message ?? '收藏失败，请重试')
    } finally { setSavingJobId(null) }
  }, [savedJobIds, savedJobMap, savingJobId, navigate])

  // ── 右列：收藏岗位过滤 + 分页 ───────────────────────────────────────────
  const filteredSavedJobs = useMemo(() => {
    return savedJobs.filter(job => {
      if (savedQ) {
        const q2 = savedQ.toLowerCase()
        if (!job.title?.toLowerCase().includes(q2) && !job.company_name?.toLowerCase().includes(q2)) return false
      }
      if (savedFunctionCode && job.function_code !== savedFunctionCode) return false
      if (savedLocation?.location_code) {
        const lc = savedLocation.location_code
        if (!job.location_path?.includes(lc) && job.location_code !== lc) return false
      }
      return true
    })
  }, [savedJobs, savedQ, savedFunctionCode, savedLocation])

  const savedTotalPages = Math.ceil(filteredSavedJobs.length / SAVED_PAGE_SIZE) || 1
  const pagedSavedJobs  = filteredSavedJobs.slice((savedPage - 1) * SAVED_PAGE_SIZE, savedPage * SAVED_PAGE_SIZE)

  const hasFilter = q || !!location?.location_code || !!functionCode || !!employmentType

  // ── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs" navItems={CANDIDATE_ICON_NAV}>
      <TerminalPageSurface split>

        {/* 当有详情选中时，整个3列区域展示 JobDetailPanel */}
        {detailJob ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: 'var(--t-bg)' }}>
            {/* 顶部面包屑返回 */}
            <div
              className="flex-shrink-0 flex items-center gap-2 px-6 py-2"
              style={{ borderBottom: '1px solid var(--t-border-subtle)', background: 'var(--t-bg-panel)' }}
            >
              <button
                type="button"
                onClick={() => { setSelected(null); setSavedSelected(null) }}
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--t-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--t-text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--t-text-muted)'}
              >
                <ChevronLeft size={13} />
                返回岗位列表
              </button>
              <span style={{ color: 'var(--t-border)', fontSize: 12 }}>|</span>
              <span className="text-xs truncate" style={{ color: 'var(--t-text-secondary)' }}>
                {detailJob.title}
              </span>
              {applyError && (
                <span className="ml-auto text-xs flex items-center gap-1" style={{ color: 'var(--t-danger)' }}>
                  <AlertCircle size={12} />{applyError}
                </span>
              )}
            </div>
            <JobDetailPanel job={detailJob} />
          </div>
        ) : (
          /* 未选中详情时：筛选栏 + 岗位列表栏 + 收藏栏 */
          <>
            {/* ── 筛选栏（固定宽度，独立一列） ── */}
            <div
              className="flex-shrink-0 flex flex-col overflow-hidden"
              style={{
                width: 220,
                background: 'var(--t-bg-panel)',
                borderRight: '1px solid var(--t-border)',
              }}
            >
              <div className="flex-1 overflow-y-auto terminal-scrollbar p-4">
                <h1 className="text-base font-semibold mb-3" style={{ color: 'var(--t-text)' }}>岗位广场</h1>
                <form onSubmit={handleSearch} className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-muted)' }} />
                    <input
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="搜索职位或城市..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none"
                      style={{ background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
                    />
                  </div>
                  <RegionSelector
                    value={location}
                    onChange={handleLocationChange}
                    terminal
                    placeholder="按地区筛选"
                  />
                  <select
                    value={functionCode}
                    onChange={e => handleFunctionChange(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border"
                    style={{
                      background: 'var(--t-bg-input)', borderColor: 'var(--t-border)',
                      color: functionCode ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }}
                  >
                    <option value="">业务方向（全部）</option>
                    {FUNCTION_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select
                    value={employmentType}
                    onChange={e => handleEmploymentTypeChange(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border"
                    style={{
                      background: 'var(--t-bg-input)', borderColor: 'var(--t-border)',
                      color: employmentType ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }}
                  >
                    <option value="">应聘类型（全部）</option>
                    <option value="全职">全职</option>
                    <option value="兼职">兼职</option>
                    <option value="实习生">实习生</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 text-xs text-white rounded-lg transition-colors"
                      style={{ background: 'var(--t-primary)' }}
                    >
                      搜索
                    </button>
                    {hasFilter && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-2 py-1.5 text-xs rounded-lg border transition-colors"
                        style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </form>
                {!loading && !error && (
                  <p className="text-xs mt-3" style={{ color: 'var(--t-text-muted)' }}>
                    共 {total} 个岗位{hasFilter ? '（已筛选）' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* ── 岗位列表栏（flex:1，可滚动，底部分页） ── */}
            <div
              className="flex flex-col overflow-hidden"
              style={{
                flex: '1 1 0',
                minWidth: 0,
                background: 'var(--t-bg)',
                borderRight: '1px solid var(--t-border)',
              }}
            >
              <div className="flex-1 overflow-y-auto terminal-scrollbar">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--t-text-muted)' }}>
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">加载中...</span>
                  </div>
                )}
                {!loading && error && (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <AlertCircle size={24} className="mb-2" style={{ color: 'var(--t-danger)' }} />
                    <p className="text-xs text-center" style={{ color: 'var(--t-danger)' }}>{error}</p>
                  </div>
                )}
                {!loading && !error && jobs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <FolderOpen size={28} className="mb-2" style={{ color: 'var(--t-text-muted)' }} />
                    <p className="text-xs text-center" style={{ color: 'var(--t-text-muted)' }}>暂无匹配岗位</p>
                  </div>
                )}
                {!loading && !error && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)' }}>
                  {jobs.map(job => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSelected={selected?.id === job.id}
                      isApplied={appliedJobIds.has(job.id)}
                      isSaved={savedJobIds.has(job.id)}
                      applyingJobId={applyingJobId}
                      savingJobId={savingJobId}
                      onSelect={selectMainJob}
                      onApply={handleApply}
                      onSave={handleSave}
                    />
                  ))}
                </div>
              )}
              </div>

              {/* 岗位列表分页 */}
              <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} terminal />
            </div>

            {/* ── 右一列：筛选 + 收藏岗位列表 ── */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ flex: '1 1 0', minWidth: 0, background: 'var(--t-bg)' }}
            >
              {/* 上半：筛选条件 */}
              <div
                className="flex-shrink-0 p-4"
                style={{ borderBottom: '1px solid var(--t-border-subtle)', background: 'var(--t-bg-panel)' }}
              >
                <h2 className="text-xs font-semibold uppercase tracking-[0.04em] mb-3" style={{ color: 'var(--t-text-muted)' }}>
                  我的收藏
                </h2>
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-muted)' }} />
                    <input
                      value={savedQ}
                      onChange={e => { setSavedQ(e.target.value); setSavedPage(1) }}
                      placeholder="搜索收藏岗位..."
                      className="w-full pl-7 pr-2 py-1.5 text-xs rounded-lg focus:outline-none"
                      style={{ background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
                    />
                  </div>
                  <RegionSelector
                    value={savedLocation}
                    onChange={loc => { setSavedLocation(loc); setSavedPage(1) }}
                    terminal
                    placeholder="按地区筛选"
                  />
                  <select
                    value={savedFunctionCode}
                    onChange={e => { setSavedFunctionCode(e.target.value); setSavedPage(1) }}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border"
                    style={{
                      background: 'var(--t-bg-input)', borderColor: 'var(--t-border)',
                      color: savedFunctionCode ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }}
                  >
                    <option value="">业务方向（全部）</option>
                    {FUNCTION_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                </div>
                {!savedLoading && (
                  <p className="text-[11px] mt-2" style={{ color: 'var(--t-text-muted)' }}>
                    共 {filteredSavedJobs.length} 个收藏岗位
                  </p>
                )}
              </div>

              {/* 下半：收藏岗位列表 */}
              <div className="flex-1 overflow-y-auto terminal-scrollbar">
                {savedLoading && (
                  <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--t-text-muted)' }}>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">加载中...</span>
                  </div>
                )}
                {!savedLoading && filteredSavedJobs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <FolderOpen size={24} className="mb-2" style={{ color: 'var(--t-text-muted)' }} />
                    <p className="text-xs text-center" style={{ color: 'var(--t-text-muted)' }}>
                      {savedJobIds.size === 0 ? '暂无收藏岗位' : '无匹配收藏'}
                    </p>
                  </div>
                )}
                {!savedLoading && pagedSavedJobs.map(job => (
                  <SavedJobCard
                    key={job.id}
                    job={job}
                    isSelected={savedSelected?.id === job.id}
                    onSelect={selectSavedJob}
                  />
                ))}
              </div>

              {/* 右列独立分页 */}
              <Pagination page={savedPage} totalPages={savedTotalPages} onPageChange={setSavedPage} terminal />
            </div>
          </>
        )}

      </TerminalPageSurface>
    </TerminalLayout>
  )
}
