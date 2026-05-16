import { useState, useEffect, useCallback } from 'react'
import { candidatesApi } from '../../../api/candidates'

const ACTIONS = [
  { key: 'interview',         label: '约面试' },
  { key: 'not_fit',           label: '不合适' },
  { key: 'resume_update',     label: '简历需更新' },
  { key: 'interview_address', label: '发送面试地址' },
]

function getStatusLabel(status) {
  if (status === 'sent')    return '已发送'
  if (status === 'failed')  return '发送失败'
  if (status === 'pending') return '发送中...'
  return null
}

export function CandidateEmailActionBar({ candidateId, jobId, threadId, terminal }) {
  const [actionStates, setActionStates] = useState({})
  const [sending, setSending] = useState({})
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    if (!candidateId || !jobId) return
    try {
      const res = await candidatesApi.getCandidateEmailActions(candidateId, { job_id: jobId })
      if (res.data?.actions) setActionStates(res.data.actions)
    } catch {
      // 静默失败，不影响 UI
    }
  }, [candidateId, jobId])

  useEffect(() => { load() }, [load])

  async function handleSend(actionKey) {
    setSending(prev => ({ ...prev, [actionKey]: true }))
    try {
      const res = await candidatesApi.sendCandidateEmailAction(candidateId, {
        action: actionKey,
        job_id: jobId,
        thread_id: threadId,
      })
      setActionStates(prev => ({
        ...prev,
        [actionKey]: {
          status: 'sent',
          sent_at: res.data.sent_at,
          updated_at: res.data.sent_at,
        },
      }))
      setToast('邮件已发送')
      setTimeout(() => setToast(null), 2500)
    } catch (err) {
      setActionStates(prev => ({
        ...prev,
        [actionKey]: { status: 'failed', sent_at: null, updated_at: null },
      }))
      setToast(err.response?.data?.message || '邮件发送失败')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSending(prev => ({ ...prev, [actionKey]: false }))
    }
  }

  const btnBase = {
    height: 22,
    padding: '0 8px',
    borderRadius: 999,
    fontFamily: 'var(--t-font-sans)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background 120ms, border-color 120ms, color 120ms',
    border: '1px solid',
  }

  function getBtnStyle(actionKey) {
    const st = actionStates[actionKey]?.status ?? 'idle'
    const isSending = !!sending[actionKey]
    if (isSending || st === 'pending') return {
      ...btnBase,
      borderColor: terminal ? 'var(--t-border)' : '#cbd5e1',
      color: terminal ? 'var(--t-text-muted)' : '#94a3b8',
      background: 'transparent',
      cursor: 'not-allowed',
      opacity: 0.6,
    }
    if (st === 'sent') return {
      ...btnBase,
      borderColor: terminal ? 'var(--t-success)' : '#86efac',
      color: terminal ? 'var(--t-success)' : '#16a34a',
      background: terminal ? 'rgba(34,197,94,0.1)' : '#f0fdf4',
      cursor: 'default',
    }
    if (st === 'failed') return {
      ...btnBase,
      borderColor: terminal ? 'var(--t-danger, #ef4444)' : '#fca5a5',
      color: terminal ? 'var(--t-danger, #ef4444)' : '#dc2626',
      background: terminal ? 'rgba(239,68,68,0.1)' : '#fef2f2',
    }
    return {
      ...btnBase,
      borderColor: terminal ? 'var(--t-border)' : '#e2e8f0',
      color: terminal ? 'var(--t-text-muted)' : '#64748b',
      background: 'transparent',
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {ACTIONS.map(action => {
          const st = actionStates[action.key]?.status ?? 'idle'
          const isSending = !!sending[action.key]
          const disabled = isSending || st === 'sent'
          const label = isSending ? '发送中...' : getStatusLabel(st) ?? action.label

          return (
            <button
              key={action.key}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && handleSend(action.key)}
              style={getBtnStyle(action.key)}
              onMouseEnter={(e) => {
                if (disabled) return
                if (terminal) {
                  e.currentTarget.style.borderColor = 'var(--t-primary)'
                  e.currentTarget.style.color = 'var(--t-primary)'
                  e.currentTarget.style.background = 'var(--t-primary-muted)'
                } else {
                  e.currentTarget.style.borderColor = '#93c5fd'
                  e.currentTarget.style.color = '#2563eb'
                  e.currentTarget.style.background = '#eff6ff'
                }
              }}
              onMouseLeave={(e) => {
                if (disabled) return
                const style = getBtnStyle(action.key)
                e.currentTarget.style.borderColor = style.borderColor
                e.currentTarget.style.color = style.color
                e.currentTarget.style.background = style.background
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '8px 18px',
            borderRadius: 10,
            background: '#1e293b',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
