import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, MapPin, Clock, Loader2, FolderOpen, CheckCircle, XCircle, Hourglass, MessageSquare } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { invitationsApi } from '../../api/invitations'

const STATUS_MAP = {
  pending:  { label: '待回复', Icon: Hourglass },
  accepted: { label: '已接受', Icon: CheckCircle },
  declined: { label: '已婉拒', Icon: XCircle },
}

const STATUS_LIGHT = {
  pending:  'bg-blue-50 text-blue-700 border-blue-200',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-slate-100 text-slate-500 border-slate-200',
}

const STATUS_TERMINAL = {
  pending:  { color: 'var(--t-chart-blue)',  bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)' },
  accepted: { color: 'var(--t-success)',     bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)' },
  declined: { color: 'var(--t-text-muted)',  bg: 'transparent',            border: 'var(--t-border)' },
}

function InviteStatusBadge({ status, terminal = false }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending
  const { Icon } = cfg
  if (terminal) {
    const t = STATUS_TERMINAL[status] ?? STATUS_TERMINAL.pending
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
        color: t.color, background: t.bg, border: `1px solid ${t.border}`,
      }}>
        <Icon size={11} />
        {cfg.label}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_LIGHT[status] ?? STATUS_LIGHT.pending}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

function InvitationCard({ inv, onStatusChange, terminal = false, messagesPath = '/messages' }) {
  const navigate = useNavigate()
  const [replying, setReplying] = useState(null)
  const [cardError, setCardError] = useState('')

  function reply(status) {
    setReplying(status)
    setCardError('')
    invitationsApi.updateInvitationStatus(inv.id, status)
      .then(res => { onStatusChange(inv.id, res.data.invitation.status) })
      .catch(err => { setCardError(err.response?.data?.message ?? '操作失败，请重试') })
      .finally(() => setReplying(null))
  }

  const isPending = inv.status === 'pending'

  if (terminal) {
    const tStatus = STATUS_TERMINAL[inv.status] ?? STATUS_TERMINAL.pending
    const avatarBg =
      inv.status === 'accepted' ? 'rgba(74,222,128,0.15)' :
      inv.status === 'declined' ? 'var(--t-bg-elevated)' :
      'rgba(96,165,250,0.15)'
    const avatarColor =
      inv.status === 'accepted' ? 'var(--t-success)' :
      inv.status === 'declined' ? 'var(--t-text-muted)' :
      'var(--t-chart-blue)'
    const cardBorder =
      inv.status === 'accepted' ? 'rgba(74,222,128,0.3)' :
      inv.status === 'declined' ? 'var(--t-border-subtle)' :
      'var(--t-border)'

    return (
      <div style={{
        background: 'var(--t-bg-panel)', border: `1px solid ${cardBorder}`,
        borderRadius: 'var(--t-radius)', padding: 20,
      }}>
        {/* 顶部 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16,
              background: avatarBg, color: avatarColor,
            }}>
              {(inv.company_name ?? '?')[0]}
            </div>
            <div>
              <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--t-text)' }}>{inv.job_title}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3, fontSize: 11, color: 'var(--t-text-muted)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building2 size={11} />{inv.company_name}</span>
                {inv.job_city && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={11} />{inv.job_city}</span>}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} />{inv.created_at?.slice(0, 10) ?? '—'}</span>
              </div>
            </div>
          </div>
          <InviteStatusBadge status={inv.status} terminal />
        </div>

        {/* 邀约说明 */}
        {inv.message && (
          <div style={{
            marginTop: 16, padding: 12,
            background: 'var(--t-bg-elevated)', borderRadius: 'var(--t-radius-sm)',
            border: '1px solid var(--t-border-subtle)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Briefcase size={11} /> 邀约说明
            </p>
            <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{inv.message}</p>
          </div>
        )}

        {/* 回复按钮 */}
        {isPending && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => reply('accepted')}
              disabled={replying !== null}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', fontSize: 12, fontWeight: 500,
                background: 'var(--t-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--t-radius-sm)',
                cursor: replying !== null ? 'not-allowed' : 'pointer',
                opacity: replying !== null ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!replying) e.currentTarget.style.background = 'var(--t-primary-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-primary)' }}
            >
              {replying === 'accepted' ? <><Loader2 size={12} className="animate-spin" />处理中...</> : <><CheckCircle size={12} />接受邀约</>}
            </button>
            <button
              onClick={() => reply('declined')}
              disabled={replying !== null}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', fontSize: 12, fontWeight: 500,
                background: 'transparent', color: 'var(--t-text-secondary)',
                border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                cursor: replying !== null ? 'not-allowed' : 'pointer',
                opacity: replying !== null ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (!replying) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {replying === 'declined' ? <><Loader2 size={12} className="animate-spin" />处理中...</> : <><XCircle size={12} />婉拒</>}
            </button>
            {cardError && <span style={{ fontSize: 11, color: 'var(--t-danger)', marginLeft: 4 }}>{cardError}</span>}
          </div>
        )}

        {/* 沟通入口 */}
        {inv.thread_id && (
          <div style={{ marginTop: isPending ? 8 : 16 }}>
            <button
              onClick={() => navigate(`${messagesPath}/${inv.thread_id}`)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', fontSize: 12,
                background: 'transparent', color: 'var(--t-text-secondary)',
                border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <MessageSquare size={12} />查看沟通
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── light 分支（字符级不变）────────────────────────────────────────────
  return (
    <div className={`card p-5 transition-colors duration-300 ${
      inv.status === 'accepted' ? 'border-emerald-200 bg-emerald-50/20' :
      inv.status === 'declined' ? 'border-slate-200 bg-slate-50/30' : ''
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0 ${
            inv.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
            inv.status === 'declined' ? 'bg-slate-100 text-slate-500' :
            'bg-blue-100 text-blue-700'
          }`}>
            {(inv.company_name ?? '?')[0]}
          </div>
          <div>
            <p className="font-semibold text-slate-800">{inv.job_title}</p>
            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1"><Building2 size={11} />{inv.company_name}</span>
              {inv.job_city && <span className="flex items-center gap-1"><MapPin size={11} />{inv.job_city}</span>}
              <span className="flex items-center gap-1"><Clock size={11} />{inv.created_at?.slice(0, 10) ?? '—'}</span>
            </div>
          </div>
        </div>
        <InviteStatusBadge status={inv.status} />
      </div>

      {inv.message && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Briefcase size={11} /> 邀约说明
          </p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{inv.message}</p>
        </div>
      )}

      {isPending && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => reply('accepted')} disabled={replying !== null}>
            {replying === 'accepted' ? <><Loader2 size={13} className="animate-spin" />处理中...</> : <><CheckCircle size={13} />接受邀约</>}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => reply('declined')} disabled={replying !== null}>
            {replying === 'declined' ? <><Loader2 size={13} className="animate-spin" />处理中...</> : <><XCircle size={13} />婉拒</>}
          </Button>
          {cardError && <span className="text-xs text-red-500 ml-1">{cardError}</span>}
        </div>
      )}

      {inv.thread_id && (
        <div className={`${isPending ? 'mt-2' : 'mt-4'}`}>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/messages/${inv.thread_id}`)}>
            <MessageSquare size={13} />查看沟通
          </Button>
        </div>
      )}
    </div>
  )
}

export default function MyInvitations({ terminal = false, messagesPath = '/candidate/messages' }) {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    invitationsApi.getMyInvitations()
      .then(res => setInvitations(res.data.invitations))
      .catch(err => setError(err.response?.data?.message ?? '加载邀约失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  const handleStatusChange = useCallback((id, newStatus) => {
    setInvitations(prev => prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv))
  }, [])

  if (loading) {
    return (
      <div
        className={terminal ? 'terminal-mode flex-1 w-full min-w-0 flex items-center justify-center gap-2' : 'flex items-center justify-center gap-2 text-slate-400'}
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text-muted)' } : { minHeight: 'calc(100vh - 64px)' }}
      >
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">加载邀约...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={terminal ? 'terminal-mode flex-1 w-full min-w-0 flex items-center justify-center px-6' : 'max-w-lg mx-auto px-6 text-center text-sm text-slate-500'}
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-danger)' } : { minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {error}
      </div>
    )
  }

  const pendingCount = invitations.filter(i => i.status === 'pending').length
  const repliedCount = invitations.filter(i => i.status !== 'pending').length

  return (
    <div
      className={
        terminal
          ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-8'
          : 'max-w-3xl mx-auto px-6 py-10'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
    >
      <div className={terminal ? 'mx-auto w-full max-w-3xl' : ''}>
        <div className="mb-8 flex items-end justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">我的邀约</h1>
            <p className="text-slate-500 mt-1">企业发给你的面试邀约</p>
          </div>
          {invitations.length > 0 && (
            <div className="flex items-center gap-3 text-xs text-slate-400">
              {pendingCount > 0 && (
                terminal ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
                    background: 'rgba(96,165,250,0.12)', color: 'var(--t-chart-blue)',
                    border: '1px solid rgba(96,165,250,0.3)',
                  }}>
                    {pendingCount} 条待回复
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                    {pendingCount} 条待回复
                  </span>
                )
              )}
              {repliedCount > 0 && (
                terminal ? (
                  <span style={{
                    padding: '3px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
                    background: 'var(--t-bg-elevated)', color: 'var(--t-text-muted)',
                    border: '1px solid var(--t-border)',
                  }}>
                    {repliedCount} 条已回复
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-medium">
                    {repliedCount} 条已回复
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {invitations.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20"
            style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
          >
            <FolderOpen size={36} className="mb-3" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#cbd5e1' }} />
            <p className="text-base font-medium">暂无邀约</p>
            <p className="text-sm mt-1">完善简历并开放求职状态，企业将主动联系你</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map(inv => (
              <InvitationCard
                key={inv.id}
                inv={inv}
                onStatusChange={handleStatusChange}
                terminal={terminal}
                messagesPath={messagesPath}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
