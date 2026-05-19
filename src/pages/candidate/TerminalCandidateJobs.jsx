import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, X, Loader2, FolderOpen,
  MapPin, Briefcase, ChevronLeft, FileText, DollarSign,
} from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import RegionSelector from '../../components/RegionSelector'
import Pagination from '../../components/ui/Pagination'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { TerminalSelect } from '../../components/terminal/TerminalSelect'
import { useToast } from '../../components/ui/Toast'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'
import {
  COMMISSION_BONUS_PERIODS, formatThousand,
  ReadField, ReadChips, ReadTextarea,
} from '../../features/jobs/jobDisplayUtils'

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

// ── JobDetailPanel ────────────────────────────────────────────────────────────
function JobDetailPanel({ job }) {
  const commissionLabel =
    COMMISSION_BONUS_PERIODS.find(p => p.value === job.commission_bonus_period)?.label
    ?? job.commission_bonus_period ?? '—'
  const allTags = Object.values(job.tags_by_category || {}).flat()

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
      <div className="flex items-start mb-4 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-semibold" style={{ color: 'var(--t-text)', lineHeight: 'var(--t-line-tight)' }}>
              {job.title}
            </h1>
            {job.status === 'closed' && (
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
            <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--t-primary)', fontVariantNumeric: 'tabular-nums' }}>
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
            <ReadField label="最低学历" value={job.degree_required} />
            <ReadField label="是否带团队" value={job.is_management_role == null ? null : job.is_management_role ? '是' : '否'} />
            {job.is_management_role && (
              <ReadField label="预计团队人数" value={job.management_headcount ? String(job.management_headcount) : null} />
            )}
            <ReadField label="应聘类型" value={job.employment_type} />
            <ReadField label="工作城市" value={
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
          <div className={secTitleClass} style={secTitleStyle}><FileText size={11} /> 岗位描述</div>
          <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto terminal-scrollbar pr-1">
            <ReadTextarea label="岗位职责" value={job.description} />
            <ReadChips label="岗位标签" value={job.knowledge_requirements} />
            <ReadChips label="软技能" value={job.soft_skill_requirements} />
          </div>
        </div>

        {/* Col 3: 薪酬福利 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><DollarSign size={11} /> 薪酬福利</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <div className="grid grid-cols-3 gap-3">
              <ReadField label="最低月薪" value={formatThousand(job.salary_min)} />
              <ReadField label="最高月薪" value={formatThousand(job.salary_max)} />
              <ReadField label="薪资月数" value={job.salary_months ? `${job.salary_months} 个月` : null} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="提成/计件" value={commissionLabel} />
              <ReadField label="预估平均额" value={
                job.commission_bonus_period === 'not_applicable' ? '—'
                  : job.commission_bonus_amount ? `${formatThousand(job.commission_bonus_amount)}` : null
              } />
            </div>
            <ReadField
              label="年终奖"
              value={job.has_year_end_bonus == null ? null : job.has_year_end_bonus ? '有' : '无'}
            />
            {job.has_year_end_bonus && (
              <ReadField label="年终奖预估" value={job.year_end_bonus_months ? `${job.year_end_bonus_months} 个月` : null} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── JobCard ───────────────────────────────────────────────────────────────────
function JobCard({ job, isSelected, isApplied, isSaved, applyingJobId, savingJobId, onSelect, onApply, onSave }) {
  const isUrgent = job.urgency_level === 1
  const cityShort = job.city_name || job.city || '—'
  const salaryDisplay =
    job.salary_label
    || (job.salary_min && job.salary_max
      ? `¥${formatThousand(job.salary_min)}–${formatThousand(job.salary_max)}/月`
      : null)
    || (job.salary_min ? `¥${formatThousand(job.salary_min)}+` : null)

  return (
    <div
      onClick={() => onSelect(job)}
      className="cursor-pointer border-l-4 t-card-pressable"
      style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--t-border-subtle)',
        borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
        background: isSelected ? 'var(--t-bg-active)' : 'transparent',
        position: 'relative',
        transition: 'background 120ms, border-color 120ms, transform var(--t-dur-fast) var(--t-ease-std)',
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
      <div className="flex items-start gap-2.5">
        {/* Company avatar */}
        <div
          className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5"
          style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)' }}
        >
          {(job.company_name ?? job.title ?? '?')[0].toUpperCase()}
        </div>

        {/* Info area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--t-text)', lineHeight: 'var(--t-line-tight)' }}>
              {job.title}
            </p>
            {isUrgent && (
              <span
                className="flex-shrink-0 border rounded font-bold"
                style={{
                  fontSize: 9, padding: '1px 4px',
                  background: 'var(--t-danger-muted)', color: 'var(--t-danger)', borderColor: 'var(--t-danger)',
                }}
              >急</span>
            )}
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
            {job.company_name ?? '—'}
          </p>
          <div
            className="flex items-center gap-1.5 mt-1"
            style={{ fontSize: 11, overflow: 'hidden', flexWrap: 'nowrap' }}
          >
            {cityShort !== '—' && (
              <span className="flex items-center gap-0.5 flex-shrink-0" style={{ color: 'var(--t-text-muted)' }}>
                <MapPin size={9} />{cityShort}
              </span>
            )}
            {(job.function_name || job.business_type) && (
              <span className="flex-shrink-0" style={{
                padding: '1px 5px', borderRadius: 'var(--t-radius-sm)', fontSize: 10,
                background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
                color: 'var(--t-text-secondary)',
              }}>{job.function_name ?? job.business_type}</span>
            )}
            {salaryDisplay && (
              <span className="font-semibold truncate" style={{ color: 'var(--t-chart-blue)' }}>{salaryDisplay}</span>
            )}
          </div>
        </div>

        {/* Action buttons */}
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
              cursor: savingJobId === job.id ? 'not-allowed' : 'pointer',
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
            {savingJobId === job.id
              ? <Loader2 size={10} className="animate-spin" style={{ display: 'inline-block' }} />
              : isSaved ? '已收藏' : '收藏'}
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); if (applyingJobId !== job.id) onApply(job) }}
            disabled={applyingJobId === job.id}
            style={{
              fontSize: 11, padding: '2px 0',
              border: isApplied ? '1px solid var(--t-primary)' : '1px solid var(--t-text-muted)',
              color: isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)',
              background: isApplied ? 'var(--t-primary-muted)' : 'transparent',
              opacity: applyingJobId === job.id ? 0.5 : 1,
              cursor: applyingJobId === job.id ? 'not-allowed' : 'pointer',
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
            {applyingJobId === job.id
              ? <Loader2 size={10} className="animate-spin" style={{ display: 'inline-block' }} />
              : isApplied ? '已投递' : '投递'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SavedJobCard ──────────────────────────────────────────────────────────────
function SavedJobCard({ job, isSelected, isSaving, onSelect, onUnsave }) {
  const [hovered, setHovered] = useState(false)
  const cityShort = job.city_name || job.city || '—'
  const salaryDisplay =
    job.salary_label
    || (job.salary_min && job.salary_max
      ? `¥${formatThousand(job.salary_min)}–${formatThousand(job.salary_max)}/月`
      : null)
    || (job.salary_min ? `¥${formatThousand(job.salary_min)}+` : null)
  const fnLabel = job.function_name ?? job.business_type
  const metaTags = [job.experience_required, job.employment_type].filter(Boolean)

  return (
    <div
      onClick={() => onSelect(job)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer border-l-4 t-card-pressable"
      style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--t-border-subtle)',
        borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
        background: isSelected ? 'var(--t-bg-active)' : hovered ? 'var(--t-bg-hover)' : 'transparent',
        transition: 'background 120ms, border-color 120ms, transform var(--t-dur-fast) var(--t-ease-std)',
        position: 'relative',
      }}
    >
      {/* Unsave button on hover */}
      {hovered && !isSaving && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onUnsave(job) }}
          style={{
            position: 'absolute', top: 7, right: 8,
            fontSize: 10, padding: '1px 5px', borderRadius: 'var(--t-radius-sm)',
            border: '1px solid var(--t-border)',
            color: 'var(--t-text-muted)', background: 'var(--t-bg-elevated)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, lineHeight: 1.4,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--t-danger)'
            e.currentTarget.style.color = 'var(--t-danger)'
            e.currentTarget.style.background = 'var(--t-danger-muted)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--t-border)'
            e.currentTarget.style.color = 'var(--t-text-muted)'
            e.currentTarget.style.background = 'var(--t-bg-elevated)'
          }}
        >
          <X size={9} />取消
        </button>
      )}
      {isSaving && (
        <Loader2
          size={10} className="animate-spin"
          style={{ position: 'absolute', top: 9, right: 10, color: 'var(--t-text-muted)' }}
        />
      )}

      {/* Title + salary on same row */}
      <div className="flex items-baseline gap-1.5 overflow-hidden" style={{ paddingRight: hovered ? '3.5rem' : 0 }}>
        <p className="font-semibold text-xs truncate flex-1 min-w-0" style={{ color: 'var(--t-text)' }}>
          {job.title}
        </p>
        {salaryDisplay && (
          <span className="flex-shrink-0 font-semibold" style={{ fontSize: 10, color: 'var(--t-chart-blue)' }}>
            {salaryDisplay}
          </span>
        )}
      </div>

      {/* Company */}
      <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
        {job.company_name ?? '—'}
      </p>

      {/* City + meta tags */}
      <div className="flex items-center gap-1.5 mt-1 overflow-hidden" style={{ color: 'var(--t-text-muted)', fontSize: 10, flexWrap: 'nowrap' }}>
        {cityShort !== '—' && (
          <span className="flex items-center gap-0.5 flex-shrink-0">
            <MapPin size={8} />{cityShort}
          </span>
        )}
        {metaTags.map((t, i) => (
          <span key={i} className="flex-shrink-0" style={{
            padding: '0px 4px', borderRadius: 'var(--t-radius-sm)',
            background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
            color: 'var(--t-text-secondary)', lineHeight: '14px',
          }}>{t}</span>
        ))}
        {fnLabel && (
          <span className="flex-shrink-0 truncate" style={{
            padding: '0px 4px', borderRadius: 'var(--t-radius-sm)',
            background: 'var(--t-primary-muted)', border: '1px solid rgba(59,130,246,0.25)',
            color: 'var(--t-primary)', lineHeight: '14px',
          }}>{fnLabel}</span>
        )}
      </div>
    </div>
  )
}

// ── DetailActionBtn — reusable inline action button ───────────────────────────
function DetailActionBtn({ label, loadingLabel, isLoading, isActive, activeStyle, inactiveStyle, activeHoverStyle, inactiveHoverStyle, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      style={{
        fontSize: 11, padding: '3px 11px', borderRadius: 'var(--t-radius-sm)',
        cursor: (disabled || isLoading) ? 'not-allowed' : 'pointer',
        opacity: (disabled || isLoading) ? 0.5 : 1,
        transition: 'none',
        ...(isActive ? activeStyle : inactiveStyle),
      }}
      onMouseEnter={e => {
        if (disabled || isLoading) return
        Object.assign(e.currentTarget.style, isActive ? activeHoverStyle : inactiveHoverStyle)
      }}
      onMouseLeave={e => {
        if (disabled || isLoading) return
        Object.assign(e.currentTarget.style, isActive ? activeStyle : inactiveStyle)
      }}
    >
      {isLoading
        ? <Loader2 size={10} className="animate-spin" style={{ display: 'inline-block' }} />
        : label}
    </button>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function TerminalCandidateJobs() {
  const navigate = useNavigate()
  const toast    = useToast()

  // ── 左两列：岗位广场 ──────────────────────────────────────────────────────
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)

  const [q, setQ]                           = useState('')
  const [location, setLocation]             = useState(null)
  const [functionCode, setFunctionCode]     = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [page, setPage]                     = useState(1)
  const [totalPages, setTotalPages]         = useState(1)
  const [total, setTotal]                   = useState(0)
  const lastFiltersRef                      = useRef({})

  // ── 右列：收藏岗位 ────────────────────────────────────────────────────────
  const [savedJobs, setSavedJobs]         = useState([])
  const [savedLoading, setSavedLoading]   = useState(false)
  const [savedSelected, setSavedSelected] = useState(null)
  const [savedPage, setSavedPage]         = useState(1)
  const SAVED_PAGE_SIZE = 8

  const [savedQ, setSavedQ]                       = useState('')
  const [savedFunctionCode, setSavedFunctionCode] = useState('')
  const [savedLocation, setSavedLocation]         = useState(null)

  // ── 应用/收藏状态 Maps ────────────────────────────────────────────────────
  const [appliedJobMap, setAppliedJobMap] = useState(new Map())
  const [savedJobMap,   setSavedJobMap]   = useState(new Map())
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [savingJobId,   setSavingJobId]   = useState(null)

  const appliedJobIds = useMemo(() => new Set(appliedJobMap.keys()), [appliedJobMap])
  const savedJobIds   = useMemo(() => new Set(savedJobMap.keys()),   [savedJobMap])

  // Stable key for saved-IDs useEffect — fixes size-only dep bug
  const savedJobIdKey = useMemo(() => [...savedJobIds].sort().join(','), [savedJobIds])

  // null = list; non-null = detail panel
  const detailJob = selected ?? savedSelected

  function selectMainJob(job) { setSavedSelected(null); setSelected(job) }
  function selectSavedJob(job) { setSelected(null); setSavedSelected(job) }

  // ── 初始化：加载已投递 / 已收藏记录 ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    applicationsApi.getMyApplications()
      .then(res => {
        if (cancelled) return
        const applied = new Map(); const saved = new Map()
        for (const a of (res.data?.applications ?? [])) {
          if (!a) continue
          if (a.is_saved) {
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

  // ── 加载收藏岗位详情 ──────────────────────────────────────────────────────
  useEffect(() => {
    if (savedJobIds.size === 0) { setSavedJobs([]); return }
    setSavedLoading(true)
    const ids = [...savedJobIds]
    Promise.all(ids.map(id => jobsApi.getJobById(id).catch(() => null)))
      .then(results => {
        setSavedJobs(results.filter(Boolean).map(r => r.data?.job ?? r.data).filter(Boolean))
      })
      .catch(() => setSavedJobs([]))
      .finally(() => setSavedLoading(false))
  }, [savedJobIdKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 左列：拉取岗位 ────────────────────────────────────────────────────────
  function fetchJobs(filters, targetPage = 1) {
    setLoading(true); setError('')
    jobsApi.getPublicJobs({ ...filters, page: targetPage, page_size: 20 })
      .then(res => {
        setJobs(res.data.jobs)
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
    const f = buildFilters(); lastFiltersRef.current = f; fetchJobs(f, 1)
  }
  function handleReset() {
    setQ(''); setLocation(null); setFunctionCode(''); setEmploymentType('')
    lastFiltersRef.current = {}; fetchJobs({}, 1)
  }
  function handleLocationChange(loc) {
    setLocation(loc)
    const f = buildFilters(loc); lastFiltersRef.current = f; fetchJobs(f, 1)
  }
  function handleFunctionChange(code) {
    setFunctionCode(code)
    const f = buildFilters(location, q, code, employmentType); lastFiltersRef.current = f; fetchJobs(f, 1)
  }
  function handleEmploymentTypeChange(et) {
    setEmploymentType(et)
    const f = buildFilters(location, q, functionCode, et); lastFiltersRef.current = f; fetchJobs(f, 1)
  }
  function handlePageChange(p) { fetchJobs(lastFiltersRef.current, p) }

  // ── 投递 ──────────────────────────────────────────────────────────────────
  const handleApply = useCallback(async (job) => {
    if (appliedJobIds.has(job.id)) {
      const appId = appliedJobMap.get(job.id)
      if (!appId || applyingJobId === job.id) return
      setApplyingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setAppliedJobMap(prev => { const m = new Map(prev); m.delete(job.id); return m })
      } catch (err) {
        toast.show(err.response?.data?.message ?? '撤回失败，请重试', 'error')
      } finally { setApplyingJobId(null) }
      return
    }
    if (applyingJobId === job.id) return
    setApplyingJobId(job.id)
    try {
      const res = await applicationsApi.applyToJob(job.id)
      const a = res.data?.application
      if (a && a.status !== 'withdrawn') {
        setAppliedJobMap(prev => { const m = new Map(prev); m.set(job.id, a.id); return m })
        setSavedJobMap(prev => { const m = new Map(prev); m.delete(job.id); return m })
      }
    } catch (err) {
      const { error_code } = err.response?.data ?? {}
      if (err.response?.status === 422 && error_code === 'profile_incomplete') {
        navigate('/candidate/tags'); return
      }
      toast.show(err.response?.data?.message ?? '投递失败，请重试', 'error')
    } finally { setApplyingJobId(null) }
  }, [appliedJobIds, appliedJobMap, applyingJobId, navigate, toast])

  // ── 收藏 ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (job) => {
    if (savedJobIds.has(job.id)) {
      const appId = savedJobMap.get(job.id)
      if (!appId || savingJobId === job.id) return
      setSavingJobId(job.id)
      try {
        await applicationsApi.unsaveJob(job.id)
        setSavedJobMap(prev => { const m = new Map(prev); m.delete(job.id); return m })
      } catch (err) {
        toast.show(err.response?.data?.message ?? '取消收藏失败，请重试', 'error')
      } finally { setSavingJobId(null) }
      return
    }
    if (savingJobId === job.id) return
    setSavingJobId(job.id)
    try {
      const res = await applicationsApi.saveJob(job.id)
      const a = res.data?.application
      if (a?.is_saved) {
        setSavedJobMap(prev => { const m = new Map(prev); m.set(job.id, a.id); return m })
      }
      if (a && !['saved', 'withdrawn'].includes(a.status)) {
        setAppliedJobMap(prev => { const m = new Map(prev); m.set(job.id, a.id); return m })
      }
    } catch (err) {
      const { error_code, missing } = err.response?.data ?? {}
      if (err.response?.status === 422 && error_code === 'profile_incomplete') {
        navigate(missing?.includes('profile') ? '/candidate/profile/builder' : '/candidate/tags')
        return
      }
      toast.show(err.response?.data?.message ?? '收藏失败，请重试', 'error')
    } finally { setSavingJobId(null) }
  }, [savedJobIds, savedJobMap, savingJobId, navigate, toast])

  // ── 右列收藏过滤 + 分页 ───────────────────────────────────────────────────
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
  const hasFilter       = q || !!location?.location_code || !!functionCode || !!employmentType

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <TerminalLayout title="JOBS" activeIconId="jobs" navItems={CANDIDATE_ICON_NAV}>
      <TerminalPageSurface split>

        {detailJob ? (
          /* ── 详情视图 ── */
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ background: 'var(--t-bg)' }}>
            {/* 顶部面包屑 + 操作 */}
            <div
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2"
              style={{ borderBottom: '1px solid var(--t-border-subtle)', background: 'var(--t-bg-panel)' }}
            >
              <button
                type="button"
                onClick={() => { setSelected(null); setSavedSelected(null) }}
                className="flex items-center gap-1 text-xs flex-shrink-0"
                style={{ color: 'var(--t-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--t-text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--t-text-muted)'}
              >
                <ChevronLeft size={13} />返回
              </button>
              <span style={{ color: 'var(--t-border)', fontSize: 14 }}>|</span>
              <span className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--t-text-secondary)' }}>
                {detailJob.title}
                {detailJob.company_name && (
                  <span style={{ color: 'var(--t-text-muted)' }}> · {detailJob.company_name}</span>
                )}
              </span>

              {/* Save + Apply */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <DetailActionBtn
                  label={savedJobIds.has(detailJob.id) ? '已收藏' : '收藏'}
                  isLoading={savingJobId === detailJob.id}
                  isActive={savedJobIds.has(detailJob.id)}
                  activeStyle={{
                    border: '1px solid var(--t-success)', color: 'var(--t-success)', background: 'var(--t-success-muted)',
                  }}
                  inactiveStyle={{
                    border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)', background: 'transparent',
                  }}
                  activeHoverStyle={{
                    border: '1px solid var(--t-danger)', color: 'var(--t-danger)', background: 'var(--t-danger-muted)',
                  }}
                  inactiveHoverStyle={{
                    border: '1px solid var(--t-success)', color: 'var(--t-success)', background: 'transparent',
                  }}
                  onClick={() => handleSave(detailJob)}
                />
                <DetailActionBtn
                  label={appliedJobIds.has(detailJob.id) ? '已投递' : '立即投递'}
                  isLoading={applyingJobId === detailJob.id}
                  disabled={detailJob.status === 'closed'}
                  isActive={appliedJobIds.has(detailJob.id)}
                  activeStyle={{
                    border: '1px solid var(--t-primary)', color: 'var(--t-primary-fg)', background: 'var(--t-primary)',
                  }}
                  inactiveStyle={{
                    border: '1px solid var(--t-primary)', color: 'var(--t-primary)', background: 'var(--t-primary-muted)',
                  }}
                  activeHoverStyle={{
                    border: '1px solid var(--t-danger)', color: 'var(--t-danger)', background: 'var(--t-danger-muted)',
                  }}
                  inactiveHoverStyle={{
                    border: '1px solid var(--t-primary)', color: 'var(--t-primary-fg)', background: 'var(--t-primary)',
                  }}
                  onClick={() => handleApply(detailJob)}
                />
              </div>
            </div>
            <JobDetailPanel job={detailJob} />
          </div>
        ) : (
          /* ── 列表视图 ── */
          <>
            {/* 筛选栏 */}
            <div
              className="flex-shrink-0 flex flex-col overflow-hidden"
              style={{ width: 'var(--t-filter-sidebar-width)', background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)' }}
            >
              <div className="flex-1 overflow-y-auto terminal-scrollbar p-4">
                <h1 className="text-base font-semibold mb-3" style={{ color: 'var(--t-text)' }}>岗位广场</h1>
                <form onSubmit={handleSearch} className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--t-text-muted)' }} />
                    <input
                      value={q}
                      onChange={e => setQ(e.target.value)}
                      placeholder="搜索职位或公司..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none"
                      style={{ background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
                    />
                  </div>
                  <RegionSelector value={location} onChange={handleLocationChange} terminal placeholder="按地区筛选" />
                  <TerminalSelect
                    value={functionCode}
                    onChange={handleFunctionChange}
                    options={[{ value: '', label: '业务方向（全部）' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
                    placeholder="业务方向（全部）"
                    hasValue={!!functionCode}
                  />
                  <TerminalSelect
                    value={employmentType}
                    onChange={handleEmploymentTypeChange}
                    options={[
                      { value: '', label: '应聘类型（全部）' },
                      { value: '全职', label: '全职' },
                      { value: '兼职', label: '兼职' },
                      { value: '实习生', label: '实习生' },
                    ]}
                    placeholder="应聘类型（全部）"
                    hasValue={!!employmentType}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 py-1.5 text-xs text-white rounded-lg"
                      style={{ background: 'var(--t-primary)' }}
                    >
                      搜索
                    </button>
                    {hasFilter && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="px-2 py-1.5 text-xs rounded-lg border"
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

            {/* 岗位列表 */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ flex: '1 1 0', minWidth: 0, background: 'var(--t-bg)', borderRight: '1px solid var(--t-border)' }}
            >
              <div className="flex-1 overflow-y-auto terminal-scrollbar">
                {loading && (
                  <div className="flex items-center justify-center gap-2 py-16" style={{ color: 'var(--t-text-muted)' }}>
                    <Loader2 size={16} className="animate-spin" /><span className="text-sm">加载中...</span>
                  </div>
                )}
                {!loading && error && (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
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
              <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} terminal />
            </div>

            {/* 收藏列 — fixed width so the job list gets more room */}
            <div
              className="flex flex-col overflow-hidden flex-shrink-0"
              style={{ width: 'clamp(240px, 22vw, 310px)', background: 'var(--t-bg)' }}
            >
              {/* 收藏筛选头 */}
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
                    terminal placeholder="按地区筛选"
                  />
                  <TerminalSelect
                    value={savedFunctionCode}
                    onChange={val => { setSavedFunctionCode(val); setSavedPage(1) }}
                    options={[{ value: '', label: '业务方向（全部）' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
                    placeholder="业务方向（全部）"
                    hasValue={!!savedFunctionCode}
                  />
                </div>
                {!savedLoading && (
                  <p className="text-[11px] mt-2" style={{ color: 'var(--t-text-muted)' }}>
                    共 {filteredSavedJobs.length} 个收藏岗位
                  </p>
                )}
              </div>

              {/* 收藏列表 */}
              <div className="flex-1 overflow-y-auto terminal-scrollbar">
                {savedLoading && (
                  <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--t-text-muted)' }}>
                    <Loader2 size={14} className="animate-spin" /><span className="text-xs">加载中...</span>
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
                    isSaving={savingJobId === job.id}
                    onSelect={selectSavedJob}
                    onUnsave={handleSave}
                  />
                ))}
              </div>
              <Pagination page={savedPage} totalPages={savedTotalPages} onPageChange={setSavedPage} terminal />
            </div>
          </>
        )}

      </TerminalPageSurface>
    </TerminalLayout>
  )
}
