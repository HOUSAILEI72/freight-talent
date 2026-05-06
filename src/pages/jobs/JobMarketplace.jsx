import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, Clock, Search, X,
  Loader2, FolderOpen, AlertCircle, Building2,
  GraduationCap, Users, Zap, PlusCircle, Send, CheckCircle,
} from 'lucide-react'
import { TagList } from '../../components/ui/TagList'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import RegionSelector from '../../components/RegionSelector'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

// ── 右侧详情面板 ──────────────────────────────────────────────────────────────
function JobDetailPanel({ job, terminal = false, canApply = false, applied = false, applying = false, onApply }) {
  const tagsByCat = job.tags_by_category || {}
  const fullLocation = [job.province, job.city_name, job.district].filter(Boolean).join(' · ') || job.city || '—'

  const titleColor   = terminal ? { color: 'var(--t-text)' } : undefined
  const subColor     = terminal ? { color: 'var(--t-text-secondary)' } : undefined
  const mutedColor   = terminal ? { color: 'var(--t-text-muted)' } : undefined
  const accentColor  = terminal ? { color: 'var(--t-chart-blue)' } : undefined
  const cellStyle    = terminal
    ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)' }
    : undefined
  const tagChipStyle = terminal
    ? { background: 'rgba(96, 165, 250, 0.12)', color: 'var(--t-chart-blue)', border: '1px solid var(--t-border)' }
    : undefined

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div
          className={
            terminal
              ? 'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0'
              : 'w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0'
          }
          style={terminal ? { background: 'var(--t-primary)' } : undefined}
        >
          {(job.company_name ?? job.title ?? '?')[0]}
        </div>
        <div>
          <h2 className={terminal ? 'text-lg font-bold' : 'text-lg font-bold text-slate-800'} style={titleColor}>
            {job.title}
          </h2>
          <p className={terminal ? 'text-sm mt-0.5' : 'text-sm text-slate-500 mt-0.5'} style={subColor}>
            {job.company_name ?? '—'} · {fullLocation}
          </p>
          <p className={terminal ? 'text-base font-bold mt-1' : 'text-base font-bold text-blue-600 mt-1'} style={accentColor}>
            {job.salary_label ?? '面议'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: MapPin,        label: '工作地点', value: fullLocation },
          { icon: Briefcase,     label: '薪资范围', value: job.salary_label ?? '面议' },
          { icon: Clock,         label: '经验要求', value: job.experience_required ?? '不限' },
          { icon: GraduationCap, label: '学历要求', value: job.degree_required ?? '不限' },
          { icon: Users,         label: '招聘人数', value: job.headcount ? `${job.headcount} 人` : '—' },
          { icon: Zap,           label: '紧急程度', value: job.urgency_level === 1 ? '紧急' : job.urgency_level === 3 ? '不急' : '正常' },
        ].map(item => (
          <div
            key={item.label}
            className={terminal ? 'rounded-xl px-3 py-2.5' : 'bg-slate-50 rounded-xl px-3 py-2.5'}
            style={cellStyle}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon size={12} className={terminal ? '' : 'text-slate-400'} style={mutedColor} />
              <p className={terminal ? 'text-[10px]' : 'text-[10px] text-slate-400'} style={mutedColor}>{item.label}</p>
            </div>
            <p className={terminal ? 'text-sm font-semibold' : 'text-sm font-semibold text-slate-700'} style={subColor}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {Object.keys(tagsByCat).length > 0 && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            标签
          </p>
          <div className="space-y-2">
            {Object.entries(tagsByCat).map(([cat, names]) => (
              <div key={cat}>
                <p className={terminal ? 'text-xs mb-1' : 'text-xs text-slate-400 mb-1'} style={mutedColor}>{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <span
                      key={i}
                      className={
                        terminal
                          ? 'px-2 py-0.5 text-xs rounded-full'
                          : 'px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full'
                      }
                      style={tagChipStyle}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {job.description && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            岗位职责
          </p>
          <p className={terminal ? 'text-sm leading-relaxed whitespace-pre-line' : 'text-sm text-slate-600 leading-relaxed whitespace-pre-line'} style={subColor}>
            {job.description}
          </p>
        </div>
      )}

      {job.requirements && (
        <div>
          <p className={terminal ? 'text-sm font-semibold mb-2' : 'text-sm font-semibold text-slate-800 mb-2'} style={titleColor}>
            任职要求
          </p>
          <p className={terminal ? 'text-sm leading-relaxed whitespace-pre-line' : 'text-sm text-slate-600 leading-relaxed whitespace-pre-line'} style={subColor}>
            {job.requirements}
          </p>
        </div>
      )}

      {canApply && (
        <div className="pt-1">
          {applied ? (
            <span
              className={
                terminal
                  ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border font-medium'
                  : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium'
              }
              style={
                terminal
                  ? {
                      background: 'rgba(34,197,94,0.12)',
                      color: 'var(--t-success)',
                      borderColor: 'var(--t-success)',
                    }
                  : undefined
              }
            >
              <CheckCircle size={14} />已投递
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onApply && onApply(job)}
              disabled={applying}
              className={
                terminal
                  ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-white transition-colors disabled:opacity-60'
                  : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
              }
              style={terminal ? { background: 'var(--t-primary)' } : undefined}
            >
              {applying ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {applying ? '投递中...' : '投递岗位'}
            </button>
          )}
        </div>
      )}

      <p
        className={terminal ? 'text-xs pt-2 border-t' : 'text-xs text-slate-400 pt-2 border-t border-slate-100'}
        style={terminal ? { color: 'var(--t-text-muted)', borderColor: 'var(--t-border-subtle)' } : undefined}
      >
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

  // CAND-4 — applied job ids and per-job submitting flag (only used when
  // canApply=true, i.e. the candidate Terminal entry point).
  const [appliedJobIds, setAppliedJobIds] = useState(new Set())
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [applyError,    setApplyError]    = useState('')

  function fetchJobs(filters) {
    setLoading(true)
    setError('')
    jobsApi.getPublicJobs(filters)
      .then(res => {
        const list = res.data.jobs
        setJobs(list)
        if (list.length > 0 && !selected) setSelected(list[0])
      })
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchJobs({}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // CAND-4: when this page is rendered as the candidate entry, hydrate the
  // applied-set so the button state survives page refresh.
  useEffect(() => {
    if (!canApply) return
    let cancelled = false
    applicationsApi.getMyApplications()
      .then(res => {
        if (cancelled) return
        const ids = (res.data?.applications ?? [])
          .filter(a => a && a.status !== 'withdrawn')
          .map(a => a.job_id)
        setAppliedJobIds(new Set(ids))
      })
      .catch(() => { /* silent — button defaults to "投递岗位" */ })
    return () => { cancelled = true }
  }, [canApply])

  async function handleApply(job) {
    if (!job || !canApply) return
    setApplyError('')
    setApplyingJobId(job.id)
    try {
      const res = await applicationsApi.applyToJob(job.id)
      const a = res.data?.application
      if (a && a.status !== 'withdrawn') {
        setAppliedJobIds(prev => {
          const next = new Set(prev)
          next.add(job.id)
          return next
        })
      }
    } catch (err) {
      const code   = err.response?.data?.error_code
      const status = err.response?.status
      if (status === 422 && code === 'profile_incomplete') {
        // CAND-1 gate handles the rest.
        navigate('/candidate/tags')
        return
      }
      setApplyError(err.response?.data?.message ?? '投递失败，请重试')
    } finally {
      setApplyingJobId(null)
    }
  }

  function buildFilters(nextLocation = location, nextQ = q, nextFn = functionCode) {
    return {
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextLocation?.location_code ? { location_code: nextLocation.location_code } : {}),
      ...(nextFn ? { function_code: nextFn } : {}),
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    fetchJobs(buildFilters())
  }

  function handleReset() {
    setQ(''); setLocation(null); setFunctionCode('')
    setSelected(null)
    fetchJobs({})
  }

  function handleLocationChange(loc) {
    setLocation(loc)
    setSelected(null)
    fetchJobs(buildFilters(loc, q, functionCode))
  }

  function handleFunctionChange(code) {
    setFunctionCode(code)
    setSelected(null)
    fetchJobs(buildFilters(location, q, code))
  }

  const hasFilter = q || !!location?.location_code || !!functionCode

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
              共 {jobs.length} 个岗位{hasFilter ? '（已筛选）' : ''}
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
          {!loading && !error && jobs.length === 0 && (
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
          {!loading && !error && jobs.map(job => {
            const isSelected = selected?.id === job.id
            const isUrgent = job.urgency_level === 1
            const flatTags = Object.values(job.tags_by_category || {}).flat()
            const cityShort = job.city_name || job.city || '—'

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
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
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
                          style={
                            terminal
                              ? {
                                  background: 'var(--t-danger-muted)',
                                  color: 'var(--t-danger)',
                                  borderColor: 'var(--t-danger)',
                                }
                              : undefined
                          }
                        >
                          急
                        </span>
                      )}
                    </div>
                    <div
                      className={terminal ? 'flex items-center gap-2 mt-0.5 text-xs' : 'flex items-center gap-2 mt-0.5 text-xs text-slate-400'}
                      style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                    >
                      <span className="flex items-center gap-0.5"><Building2 size={10} />{job.company_name ?? '—'}</span>
                      <span className="flex items-center gap-0.5"><MapPin size={10} />{cityShort}</span>
                    </div>
                    {flatTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {flatTags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className={
                              terminal
                                ? 'text-[10px] px-1.5 py-0.5 rounded-full'
                                : 'text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full'
                            }
                            style={
                              terminal
                                ? { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)' }
                                : undefined
                            }
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p
                    className={terminal ? 'text-xs font-bold flex-shrink-0' : 'text-xs font-bold text-blue-600 flex-shrink-0'}
                    style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
                  >
                    {job.salary_label ?? '面议'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 右栏详情 ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={terminal ? { background: 'var(--t-bg)' } : undefined}
      >
        {selected ? (
          <>
            {canApply && applyError && (
              <div
                className={
                  terminal
                    ? 'mx-6 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm'
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
              canApply={canApply}
              applied={appliedJobIds.has(selected.id)}
              applying={applyingJobId === selected.id}
              onApply={handleApply}
            />
          </>
        ) : (
          <div
            className={terminal ? 'h-full flex items-center justify-center' : 'h-full flex items-center justify-center text-slate-400'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            <div className="text-center">
              <Building2
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
