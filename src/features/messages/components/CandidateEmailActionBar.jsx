import { useState, useEffect, useCallback } from 'react'
import { candidatesApi } from '../../../api/candidates'

const ACTIONS = [
  { key: 'interview',         label: '约面试',     tone: 'positive' },
  { key: 'not_fit',           label: '不合适',     tone: 'negative' },
  { key: 'resume_update',     label: '简历需更新', tone: 'neutral' },
  { key: 'interview_address', label: '发送面试地址', tone: 'neutral' },
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
    height: 27,
    padding: '0 11px',
    borderRadius: 999,
    fontFamily: 'var(--t-font-sans)',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'background 120ms, border-color 120ms, color 120ms, transform 80ms, opacity 80ms',
    border: '1px solid',
    lineHeight: 1,
  }

  function getIdleStyle(tone) {
    if (!terminal) return { ...btnBase, borderColor: '#e2e8f0', color: '#475569', background: 'transparent' }
    if (tone === 'positive') return {
      ...btnBase,
      borderColor: 'var(--t-primary)',
      color: 'var(--t-primary)',
      background: 'var(--t-primary-muted)',
    }
    if (tone === 'negative') return {
      ...btnBase,
      borderColor: 'var(--t-border)',
      color: 'var(--t-text-muted)',
      background: 'transparent',
    }
    return { ...btnBase, borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)', background: 'transparent' }
  }

  function getBtnStyle(actionKey, tone) {
    const st = actionStates[actionKey]?.status ?? 'idle'
    const isSending = !!sending[actionKey]
    if (isSending || st === 'pending') return {
      ...btnBase,
      borderColor: terminal ? 'var(--t-border)' : '#cbd5e1',
      color: terminal ? 'var(--t-text-muted)' : '#94a3b8',
      background: 'transparent',
      cursor: 'not-allowed',
      opacity: 0.55,
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
      borderColor: terminal ? 'var(--t-danger)' : '#fca5a5',
      color: terminal ? 'var(--t-danger)' : '#dc2626',
      background: terminal ? 'rgba(239,68,68,0.08)' : '#fef2f2',
    }
    return getIdleStyle(tone)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
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
              style={getBtnStyle(action.key, action.tone)}
              onMouseEnter={(e) => {
                if (disabled) return
                if (terminal) {
                  e.currentTarget.style.borderColor = action.tone === 'negative' ? 'var(--t-danger)' : 'var(--t-primary)'
                  e.currentTarget.style.color = action.tone === 'negative' ? 'var(--t-danger)' : 'var(--t-primary)'
                  e.currentTarget.style.background = action.tone === 'negative' ? 'rgba(239,68,68,0.08)' : 'var(--t-primary-muted)'
                } else {
                  e.currentTarget.style.borderColor = '#93c5fd'
                  e.currentTarget.style.color = '#2563eb'
                  e.currentTarget.style.background = '#eff6ff'
                }
              }}
              onMouseLeave={(e) => {
                if (disabled) return
                const style = getBtnStyle(action.key, action.tone)
                e.currentTarget.style.borderColor = style.borderColor
                e.currentTarget.style.color = style.color
                e.currentTarget.style.background = style.background
              }}
              onMouseDown={e => { if (!disabled && terminal) { e.currentTarget.style.transform = 'scale(0.95)'; e.currentTarget.style.opacity = '0.82' } }}
              onMouseUp={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.opacity = '' }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {toast && (
        <div
          className={terminal ? 't-toast-enter terminal-mode' : undefined}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            padding: '8px 18px',
            borderRadius: 10,
            background: terminal ? 'var(--t-bg-elevated)' : '#1e293b',
            border: terminal ? '1px solid var(--t-border)' : 'none',
            color: terminal ? 'var(--t-text)' : '#fff',
            fontSize: 13,
            fontWeight: 500,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: terminal ? 'var(--t-shadow-elevated)' : '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
