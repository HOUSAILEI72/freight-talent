import { useState, useEffect, useRef } from 'react'
import { Send, X, Loader2 } from 'lucide-react'
import { Button } from './Button'
import { MatchScore } from './MatchScore'
import { invitationsApi } from '../../api/invitations'

/**
 * 通用发起邀约弹窗
 *
 * Props:
 *   candidate  — 公开档案对象（full_name, current_title, current_city, experience_years, expected_salary_label, id）
 *   job        — 岗位对象（id, title）；如不传则显示"主动邀约"文案
 *   matchScore — 可选，有则显示 MatchScore 组件
 *   onConfirm  — 邀约发出成功后的回调（无参数）
 *   onCancel   — 关闭弹窗的回调
 */
export function InviteModal({ candidate, job, matchScore, onConfirm, onCancel, terminal = false }) {
  const name = candidate.full_name ?? '该候选人'
  const exp  = candidate.experience_years ?? '—'
  const jobTitle = job?.title ?? '相关岗位'

  const defaultMsg = job
    ? `您好 ${name}，\n\n我们正在寻找一位${jobTitle}，看到您的档案后非常感兴趣。您的${exp}年行业经验及相关技能与我们的岗位高度契合。\n\n期待与您进一步沟通，请问近期方便安排一次电话交流吗？\n\n感谢您的时间！`
    : `您好 ${name}，\n\n我们正在寻访货代行业优秀人才，看到您的档案后非常感兴趣。期待与您进一步沟通，请问近期方便安排一次简短交流吗？\n\n感谢您的时间！`

  const [message, setMessage]   = useState(defaultMsg)
  const [sending, setSending]   = useState(false)
  const [apiError, setApiError] = useState('')
  const overlayRef = useRef(null)

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onCancel()
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onCancel])

  function handleConfirm() {
    if (!job) { onCancel(); return }   // 无岗位上下文时不提交（保险）
    setSending(true)
    setApiError('')
    invitationsApi.createInvitation(job.id, candidate.id, message)
      .then(res => onConfirm(res.data.thread_id ?? null))
      .catch(err => {
        if (err.response?.data?.already_existed) {
          onConfirm(err.response.data.thread_id ?? null)
        } else {
          setApiError(err.response?.data?.message ?? '发送失败，请重试')
          setSending(false)
        }
      })
  }

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm px-4 ${
        terminal ? 'terminal-mode' : ''
      }`}
      style={{
        background: terminal ? 'rgba(7, 10, 16, 0.7)' : 'rgba(15, 23, 42, 0.5)',
      }}
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Send size={16} className="text-blue-500" />
            <span className="font-semibold text-slate-800">发起邀约</span>
          </div>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        {/* Candidate summary */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800">{name}</p>
              <p className="text-sm text-slate-500">{candidate.current_title} · {candidate.current_city}</p>
            </div>
            {matchScore != null && (
              <div className="text-right flex-shrink-0">
                <MatchScore score={matchScore} />
                <p className="text-[10px] text-slate-400 mt-1">匹配分</p>
              </div>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: '目标岗位', value: jobTitle },
              { label: '工作年限', value: `${exp}年` },
              { label: '期望薪资', value: candidate.expected_salary_label ?? '面议' },
            ].map(f => (
              <div key={f.label} className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-400">{f.label}</p>
                <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Message textarea */}
        <div className="px-6 py-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            邀约说明 <span className="ml-1.5 text-xs font-normal text-slate-400">（可编辑）</span>
          </label>
          <textarea
            rows={6}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-1.5">{message.length} 字</p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          {apiError && <span className="text-xs text-red-500 mr-auto">{apiError}</span>}
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={sending}>取消</Button>
          <Button size="sm" onClick={handleConfirm} disabled={sending || !job}>
            {sending
              ? <><Loader2 size={13} className="animate-spin" />发送中...</>
              : <><Send size={13} />确认发送邀约</>
            }
          </Button>
        </div>
      </div>
    </div>
  )
}