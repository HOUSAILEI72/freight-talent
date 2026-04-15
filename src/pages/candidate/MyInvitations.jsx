import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Building2, MapPin, Clock, Loader2, FolderOpen, CheckCircle, XCircle, Hourglass, MessageSquare } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { invitationsApi } from '../../api/invitations'

const STATUS_MAP = {
  pending:  { label: '待回复', color: 'blue',  Icon: Hourglass },
  accepted: { label: '已接受', color: 'green', Icon: CheckCircle },
  declined: { label: '已婉拒', color: 'gray',  Icon: XCircle },
}

function InviteStatusBadge({ status }) {
  const cfg = STATUS_MAP[status] ?? STATUS_MAP.pending
  const colorCls = {
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    gray:  'bg-slate-100 text-slate-500 border-slate-200',
  }[cfg.color]
  const { Icon } = cfg
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${colorCls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

function InvitationCard({ inv, onStatusChange }) {
  const navigate = useNavigate()
  const [replying, setReplying] = useState(null) // 'accepted' | 'declined' | null
  const [cardError, setCardError] = useState('')

  function reply(status) {
    setReplying(status)
    setCardError('')
    invitationsApi.updateInvitationStatus(inv.id, status)
      .then(res => {
        onStatusChange(inv.id, res.data.invitation.status)
      })
      .catch(err => {
        const msg = err.response?.data?.message ?? '操作失败，请重试'
        setCardError(msg)
      })
      .finally(() => setReplying(null))
  }

  const isPending = inv.status === 'pending'

  return (
    <div className={`card p-5 transition-colors duration-300 ${
      inv.status === 'accepted' ? 'border-emerald-200 bg-emerald-50/20' :
      inv.status === 'declined' ? 'border-slate-200 bg-slate-50/30' : ''
    }`}>
      {/* 顶部：企业信息 + 状态徽章 */}
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

      {/* 邀约说明 */}
      {inv.message && (
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-xs text-slate-400 mb-1 flex items-center gap-1">
            <Briefcase size={11} /> 邀约说明
          </p>
          <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{inv.message}</p>
        </div>
      )}

      {/* 回复按钮（仅 pending） */}
      {isPending && (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => reply('accepted')}
            disabled={replying !== null}
          >
            {replying === 'accepted'
              ? <><Loader2 size={13} className="animate-spin" />处理中...</>
              : <><CheckCircle size={13} />接受邀约</>
            }
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => reply('declined')}
            disabled={replying !== null}
          >
            {replying === 'declined'
              ? <><Loader2 size={13} className="animate-spin" />处理中...</>
              : <><XCircle size={13} />婉拒</>
            }
          </Button>
          {cardError && (
            <span className="text-xs text-red-500 ml-1">{cardError}</span>
          )}
        </div>
      )}

      {/* 沟通入口（有 thread 时始终显示） */}
      {inv.thread_id && (
        <div className={`${isPending ? 'mt-2' : 'mt-4'}`}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/messages/${inv.thread_id}`)}
          >
            <MessageSquare size={13} />查看沟通
          </Button>
        </div>
      )}
    </div>
  )
}

export default function MyInvitations() {
  const [invitations, setInvitations] = useState([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')

  useEffect(() => {
    invitationsApi.getMyInvitations()
      .then(res => setInvitations(res.data.invitations))
      .catch(err => setError(err.response?.data?.message ?? '加载邀约失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  // 单条状态更新，不重新拉列表
  const handleStatusChange = useCallback((id, newStatus) => {
    setInvitations(prev =>
      prev.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv)
    )
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">加载邀约...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-6 text-center text-sm text-slate-500" style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{error}</div>
    )
  }

  const pendingCount  = invitations.filter(i => i.status === 'pending').length
  const repliedCount  = invitations.filter(i => i.status !== 'pending').length

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">我的邀约</h1>
          <p className="text-slate-500 mt-1">企业发给你的面试邀约</p>
        </div>
        {invitations.length > 0 && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {pendingCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-medium">
                {pendingCount} 条待回复
              </span>
            )}
            {repliedCount > 0 && (
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-medium">
                {repliedCount} 条已回复
              </span>
            )}
          </div>
        )}
      </div>

      {invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <FolderOpen size={36} className="mb-3 text-slate-300" />
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
