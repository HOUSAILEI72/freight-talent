import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, AlertCircle, FolderOpen, Send,
  Building2, MapPin, Briefcase, Clock,
  CheckCircle, Eye, Star, XCircle, RotateCcw, Trash2,
} from 'lucide-react'
import { applicationsApi } from '../../api/applications'

/**
 * CAND-8B — Candidate "My Applications" page.
 *
 * Lists everything the candidate has applied to via CAND-4. Read-only;
 * withdrawal is intentionally not surfaced because there is no PATCH
 * endpoint yet (CAND-4 spec deferred status mutation).
 *
 * Supports `terminal` prop for the candidate Terminal shell, with a clean
 * light fallback so this component can be embedded outside the shell
 * if needed (verification path).
 */

const STATUS_DEFS = {
  submitted:   { label: '已投递',         Icon: Send,        terminalKey: 'chartBlue' },
  viewed:      { label: '企业已查看',     Icon: Eye,         terminalKey: 'primary'   },
  shortlisted: { label: '已进入候选名单', Icon: Star,        terminalKey: 'success'   },
  rejected:    { label: '暂不匹配',       Icon: XCircle,     terminalKey: 'danger'    },
  withdrawn:   { label: '已撤回',         Icon: RotateCcw,   terminalKey: 'muted'     },
}

const TERMINAL_STATUS_COLOR = {
  chartBlue: 'var(--t-chart-blue)',
  primary:   'var(--t-primary)',
  success:   'var(--t-success)',
  danger:    'var(--t-danger)',
  muted:     'var(--t-text-muted)',
}

const LIGHT_STATUS_CLASS = {
  submitted:   'bg-blue-50    text-blue-700    border-blue-200',
  viewed:      'bg-indigo-50  text-indigo-700  border-indigo-200',
  shortlisted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:    'bg-red-50     text-red-600     border-red-200',
  withdrawn:   'bg-slate-100  text-slate-500   border-slate-200',
}

function StatusChip({ status, terminal }) {
  const def = STATUS_DEFS[status] || STATUS_DEFS.submitted
  const Icon = def.Icon
  if (terminal) {
    const c = TERMINAL_STATUS_COLOR[def.terminalKey] || 'var(--t-text-muted)'
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border"
        style={{
          background: 'var(--t-bg-elevated)',
          borderColor: c,
          color: c,
        }}
      >
        <Icon size={11} /> {def.label}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${LIGHT_STATUS_CLASS[status] ?? LIGHT_STATUS_CLASS.submitted}`}>
      <Icon size={11} /> {def.label}
    </span>
  )
}

function fmtDate(s) {
  if (!s) return '—'
  return String(s).slice(0, 10)
}

function ApplicationCard({ app, terminal, onWithdraw }) {
  const j = app.job || {}
  const cardClass = terminal
    ? 'rounded-lg border p-5 transition-colors'
    : 'rounded-lg border border-slate-200 bg-white p-5 transition-colors'
  const cardStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    : undefined
  const titleStyle = terminal ? { color: 'var(--t-text)' } : undefined
  const subStyle   = terminal ? { color: 'var(--t-text-secondary)' } : undefined
  const muteStyle  = terminal ? { color: 'var(--t-text-muted)' } : undefined
  const accentStyle = terminal ? { color: 'var(--t-chart-blue)' } : undefined

  const locationLabel =
    j.location_name || j.city_name || j.city || '—'

  // CAND-4B: show withdraw button for non-terminal states
  const canWithdraw = ['submitted', 'viewed', 'shortlisted'].includes(app.status)

  return (
    <div className={cardClass} style={cardStyle}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h3
            className={terminal ? 'text-base font-semibold truncate' : 'text-base font-semibold text-slate-800 truncate'}
            style={titleStyle}
          >
            {j.title || '岗位已下线'}
          </h3>
          <p
            className={terminal ? 'text-xs mt-0.5' : 'text-xs text-slate-500 mt-0.5'}
            style={subStyle}
          >
            <Building2 size={11} className="inline mr-1 -mt-0.5" />
            {j.company_name || '—'}
          </p>
        </div>
        <StatusChip status={app.status} terminal={terminal} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Cell icon={MapPin}    label="地区" value={locationLabel}   terminal={terminal} />
        <Cell icon={Briefcase} label="板块" value={j.function_name || j.function_code || '—'} terminal={terminal} />
        <Cell icon={Send}      label="薪资" value={j.salary_label || '面议'} terminal={terminal} accentValue />
        <Cell icon={Clock}     label="投递时间" value={fmtDate(app.created_at)} terminal={terminal} />
      </div>

      {app.message && (
        <p
          className={terminal ? 'text-xs leading-relaxed mb-3' : 'text-xs text-slate-500 leading-relaxed mb-3'}
          style={subStyle}
        >
          <span style={muteStyle} className="mr-1">附言：</span>{app.message}
        </p>
      )}

      <div
        className={terminal ? 'flex items-center justify-between pt-2 border-t' : 'flex items-center justify-between pt-2 border-t border-slate-100'}
        style={terminal ? { borderColor: 'var(--t-border-subtle)' } : undefined}
      >
        <span className={terminal ? 'text-[11px]' : 'text-[11px] text-slate-400'} style={muteStyle}>
          状态更新于 {fmtDate(app.updated_at)}
        </span>
        {canWithdraw && (
          <button
            type="button"
            onClick={() => onWithdraw(app.id)}
            className={
              terminal
                ? 'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors'
                : 'inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs text-red-600 hover:bg-red-50 transition-colors'
            }
            style={
              terminal
                ? { color: 'var(--t-danger)', background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)' }
                : undefined
            }
          >
            <Trash2 size={12} /> 撤回投递
          </button>
        )}
      </div>
    </div>
  )
}

function Cell({ icon: Icon, label, value, terminal, accentValue }) {
  return (
    <div
      className={terminal ? 'rounded-md px-2.5 py-1.5' : 'rounded-md bg-slate-50 px-2.5 py-1.5'}
      style={
        terminal
          ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)' }
          : undefined
      }
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Icon size={10} style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
        <span
          className={terminal ? 'text-[10px]' : 'text-[10px] text-slate-400'}
          style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
        >
          {label}
        </span>
      </div>
      <p
        className={terminal ? 'text-xs font-medium truncate' : 'text-xs font-medium text-slate-700 truncate'}
        style={
          terminal
            ? (accentValue ? { color: 'var(--t-chart-blue)' } : { color: 'var(--t-text-secondary)' })
            : undefined
        }
      >
        {value}
      </p>
    </div>
  )
}

export default function MyApplications({ terminal = false }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [items, setItems]     = useState([])
  const [withdrawing, setWithdrawing] = useState(null) // application_id being withdrawn

  useEffect(() => {
    let cancelled = false
    applicationsApi.getMyApplications()
      .then(res => {
        if (cancelled) return
        const list = res.data?.applications ?? []
        // Backend already orders by created_at desc; preserve.
        setItems(list)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load candidate applications:', {
          status: err.response?.status,
          data: err.response?.data,
          code: err.code,
          message: err.message,
        })
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载投递记录失败，请刷新重试'
        setError(errMsg)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const handleWithdraw = async (applicationId) => {
    if (withdrawing) return // prevent double-click
    if (!confirm('确定要撤回这条投递吗？')) return

    setWithdrawing(applicationId)
    try {
      const res = await applicationsApi.updateApplicationStatus(applicationId, 'withdrawn')
      if (res.data?.success) {
        // Update local state
        setItems(prev =>
          prev.map(app =>
            app.id === applicationId
              ? { ...app, status: 'withdrawn', updated_at: res.data.application.updated_at }
              : app
          )
        )
      }
    } catch (err) {
      console.error('Failed to withdraw application:', {
        applicationId,
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
      const msg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '撤回失败，请重试'
      alert(msg)
    } finally {
      setWithdrawing(null)
    }
  }

  const containerClass = terminal
    ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-8'
    : 'max-w-3xl mx-auto px-6 py-12'
  const containerStyle = terminal
    ? { background: 'var(--t-bg)', color: 'var(--t-text)' }
    : undefined

  if (loading) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm"
          style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
        >
          <Loader2 size={14} className="animate-spin" /> 正在加载投递记录...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={containerClass} style={containerStyle}>
        <div
          className={
            terminal
              ? 'mx-auto max-w-md rounded-lg border p-5'
              : 'mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-5'
          }
          style={
            terminal
              ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
              : undefined
          }
        >
          <div
            className="flex items-center gap-2 mb-2 text-sm font-semibold"
            style={terminal ? { color: 'var(--t-danger)' } : { color: '#dc2626' }}
          >
            <AlertCircle size={15} /> 无法加载投递记录
          </div>
          <p
            className="text-sm"
            style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#7f1d1d' }}
          >
            {error}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClass} style={containerStyle}>
      <div className={terminal ? 'mx-auto w-full max-w-3xl' : ''}>
        <div className="mb-6">
          <div
            className="flex items-center gap-2 mb-1"
            style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
          >
            <Send size={14} />
            <span className="text-[11px] tracking-[0.2em] uppercase">APPLICATIONS · ME</span>
          </div>
          <h1
            className={terminal ? 'text-2xl font-semibold' : 'text-2xl font-semibold text-slate-800'}
            style={terminal ? { color: 'var(--t-text)' } : undefined}
          >
            我的投递
          </h1>
          <p
            className={terminal ? 'text-sm mt-1' : 'text-sm text-slate-500 mt-1'}
            style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
          >
            共 {items.length} 条投递记录。状态由企业方更新。
          </p>
        </div>

        {items.length === 0 ? (
          <div
            className={
              terminal
                ? 'flex flex-col items-center justify-center text-center rounded-lg border p-10'
                : 'flex flex-col items-center justify-center text-center rounded-lg border border-slate-200 bg-white p-10'
            }
            style={
              terminal
                ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
                : undefined
            }
          >
            <FolderOpen
              size={32}
              className="mb-3"
              style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#cbd5e1' }}
            />
            <p
              className={terminal ? 'text-sm mb-4' : 'text-sm text-slate-500 mb-4'}
              style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
            >
              还没有投递记录
            </p>
            <button
              type="button"
              onClick={() => navigate('/candidate/jobs')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--t-primary)' }}
            >
              <Briefcase size={14} /> 去岗位广场
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(app => (
              <ApplicationCard
                key={app.id}
                app={app}
                terminal={terminal}
                onWithdraw={handleWithdraw}
              />
            ))}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/candidate/jobs')}
                className={
                  terminal
                    ? 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors'
                    : 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm'
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
                <Briefcase size={14} /> 查看更多岗位
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export { StatusChip }
