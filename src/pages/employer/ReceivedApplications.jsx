import { useEffect, useState } from 'react'
import {
  Loader2, AlertCircle, Inbox, CheckCircle, Eye, Star, XCircle, RotateCcw,
  User, Briefcase, MapPin, Tag,
} from 'lucide-react'
import { applicationsApi } from '../../api/applications'

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'submitted', label: '待查看' },
  { value: 'viewed', label: '已查看' },
  { value: 'shortlisted', label: '候选名单' },
  { value: 'rejected', label: '暂不匹配' },
  { value: 'withdrawn', label: '已撤回' },
]

function StatusChip({ status, terminal }) {
  const configs = {
    submitted: { icon: CheckCircle, label: '待查看', color: terminal ? 'var(--t-chart-blue)' : 'text-blue-600 bg-blue-50' },
    viewed: { icon: Eye, label: '已查看', color: terminal ? 'var(--t-primary)' : 'text-indigo-600 bg-indigo-50' },
    shortlisted: { icon: Star, label: '候选名单', color: terminal ? 'var(--t-success)' : 'text-green-600 bg-green-50' },
    rejected: { icon: XCircle, label: '暂不匹配', color: terminal ? 'var(--t-danger)' : 'text-red-600 bg-red-50' },
    withdrawn: { icon: RotateCcw, label: '已撤回', color: terminal ? 'var(--t-text-muted)' : 'text-gray-500 bg-gray-100' },
  }
  const cfg = configs[status] || configs.submitted
  const Icon = cfg.icon

  if (terminal) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
        style={{ color: cfg.color, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)' }}
      >
        <Icon size={12} /> {cfg.label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      <Icon size={12} /> {cfg.label}
    </span>
  )
}

function ApplicationCard({ app, terminal, onUpdateStatus, updating }) {
  const c = app.candidate || {}
  const j = app.job || {}

  const cardClass = terminal
    ? 'rounded-lg border p-5 transition-colors'
    : 'rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300'
  const cardStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    : undefined
  const titleStyle = terminal ? { color: 'var(--t-text)' } : undefined
  const subStyle = terminal ? { color: 'var(--t-text-secondary)' } : undefined
  const muteStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  const displayName = c.full_name || c.anonymous_name || '匿名候选人'
  const allTags = [
    ...(c.knowledge_tags || []),
    ...(c.hard_skill_tags || []),
    ...(c.soft_skill_tags || []),
  ].slice(0, 5)

  const canOperate = !['rejected', 'withdrawn'].includes(app.status)
  const actions = []
  if (app.status === 'submitted') {
    actions.push({ label: '标记已查看', nextStatus: 'viewed' })
    actions.push({ label: '进入候选名单', nextStatus: 'shortlisted' })
    actions.push({ label: '暂不匹配', nextStatus: 'rejected' })
  } else if (app.status === 'viewed') {
    actions.push({ label: '进入候选名单', nextStatus: 'shortlisted' })
    actions.push({ label: '暂不匹配', nextStatus: 'rejected' })
  } else if (app.status === 'shortlisted') {
    actions.push({ label: '暂不匹配', nextStatus: 'rejected' })
  }

  const fmtDate = (d) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '—'
    }
  }

  return (
    <div className={cardClass} style={cardStyle}>
      {/* Header: candidate info + status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <User size={14} style={subStyle} className={terminal ? '' : 'text-slate-500'} />
            <h3
              className={terminal ? 'text-base font-semibold truncate' : 'text-base font-semibold text-slate-800 truncate'}
              style={titleStyle}
            >
              {displayName}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={subStyle}>
            {c.current_title && (
              <span className="flex items-center gap-1">
                <Briefcase size={11} /> {c.current_title}
              </span>
            )}
            {c.function_name && (
              <span className="flex items-center gap-1">
                <Tag size={11} /> {c.function_name}
              </span>
            )}
            {c.location_name && (
              <span className="flex items-center gap-1">
                <MapPin size={11} /> {c.location_name}
              </span>
            )}
          </div>
        </div>
        <StatusChip status={app.status} terminal={terminal} />
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {allTags.map((tag, idx) => (
            <span
              key={idx}
              className={terminal ? 'px-2 py-0.5 rounded text-[11px]' : 'px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700'}
              style={terminal ? { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', border: '1px solid var(--t-border-subtle)' } : undefined}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Job info */}
      <div
        className={terminal ? 'text-sm mb-3 pb-3 border-b' : 'text-sm text-slate-600 mb-3 pb-3 border-b border-slate-100'}
        style={terminal ? { color: 'var(--t-text-secondary)', borderColor: 'var(--t-border-subtle)' } : undefined}
      >
        <div className="font-medium mb-1">投递岗位：{j.title || '—'}</div>
        <div className="text-xs" style={muteStyle}>
          {j.location_name || j.city || '—'}
        </div>
      </div>

      {/* Message */}
      {app.message && (
        <div
          className={terminal ? 'text-xs mb-3 p-2 rounded' : 'text-xs text-slate-600 mb-3 p-2 rounded bg-slate-50'}
          style={terminal ? { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)' } : undefined}
        >
          <div className="font-medium mb-1" style={terminal ? { color: 'var(--t-text)' } : undefined}>
            候选人留言：
          </div>
          {app.message}
        </div>
      )}

      {/* Footer: timestamps + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className={terminal ? 'text-[11px]' : 'text-[11px] text-slate-400'} style={muteStyle}>
          投递于 {fmtDate(app.created_at)} · 更新于 {fmtDate(app.updated_at)}
        </div>
        {canOperate && actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.nextStatus}
                type="button"
                onClick={() => onUpdateStatus(app.id, action.nextStatus)}
                disabled={updating === app.id}
                className={
                  terminal
                    ? 'px-3 py-1 rounded text-xs transition-colors disabled:opacity-50'
                    : 'px-3 py-1 rounded text-xs bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50'
                }
                style={
                  terminal
                    ? { background: 'var(--t-primary)', color: '#fff' }
                    : undefined
                }
              >
                {updating === app.id ? '处理中...' : action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReceivedApplications({ terminal = false }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [updating, setUpdating] = useState(null)

  const loadApplications = async (status = '') => {
    setLoading(true)
    setError('')
    try {
      const filters = status ? { status } : {}
      const res = await applicationsApi.getReceivedApplications(filters)
      setItems(res.data?.applications || [])
    } catch (err) {
      console.error('Failed to load received applications:', {
        status,
        responseStatus: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载投递记录失败，请刷新重试'
      setError(errMsg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadApplications(statusFilter)
  }, [statusFilter])

  const handleUpdateStatus = async (applicationId, nextStatus) => {
    if (updating) return
    setUpdating(applicationId)
    try {
      const res = await applicationsApi.updateApplicationStatus(applicationId, nextStatus)
      if (res.data?.success) {
        setItems((prev) =>
          prev.map((app) =>
            app.id === applicationId
              ? { ...app, status: nextStatus, updated_at: res.data.application.updated_at }
              : app
          )
        )
      }
    } catch (err) {
      console.error('Failed to update application status:', {
        applicationId,
        nextStatus,
        responseStatus: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
      const msg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '操作失败，请重试'
      alert(msg)
    } finally {
      setUpdating(null)
    }
  }

  const containerClass = terminal
    ? 'flex-1 w-full min-w-0 p-6'
    : 'max-w-5xl mx-auto p-6'
  const containerStyle = terminal ? { background: 'var(--t-bg-base)' } : undefined
  const titleStyle = terminal ? { color: 'var(--t-text)' } : undefined
  const subStyle = terminal ? { color: 'var(--t-text-secondary)' } : undefined

  return (
    <div className={containerClass} style={containerStyle}>
      {/* Header */}
      {!terminal && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">收到的投递</h1>
          <p className="text-sm text-slate-600">查看和管理候选人的投递申请</p>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatusFilter(opt.value)}
              className={
                terminal
                  ? `px-3 py-1.5 rounded text-sm transition-colors ${
                      statusFilter === opt.value ? 'font-medium' : ''
                    }`
                  : `px-3 py-1.5 rounded text-sm transition-colors ${
                      statusFilter === opt.value
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`
              }
              style={
                terminal
                  ? statusFilter === opt.value
                    ? { background: 'var(--t-primary)', color: '#fff' }
                    : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', border: '1px solid var(--t-border)' }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin" size={32} style={terminal ? { color: 'var(--t-text-muted)' } : undefined} />
        </div>
      ) : error ? (
        <div
          className={terminal ? 'flex items-center gap-2 p-4 rounded' : 'flex items-center gap-2 p-4 rounded bg-red-50 text-red-700'}
          style={terminal ? { background: 'var(--t-bg-panel)', color: 'var(--t-danger)', border: '1px solid var(--t-border)' } : undefined}
        >
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Inbox size={48} className={terminal ? '' : 'text-slate-300'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined} />
          <p className={terminal ? 'mt-3 text-sm' : 'mt-3 text-sm text-slate-500'} style={subStyle}>
            暂无候选人投递
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              terminal={terminal}
              onUpdateStatus={handleUpdateStatus}
              updating={updating}
            />
          ))}
        </div>
      )}
    </div>
  )
}
