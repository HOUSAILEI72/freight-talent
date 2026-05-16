import { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useConversationMessages } from '../../messages/hooks/useConversationMessages'
import { useSendMessage } from '../../messages/hooks/useSendMessage'
import { MessageThread } from '../../messages/components/MessageThread'
import { MessageComposer } from '../../messages/components/MessageComposer'
import { CandidateEmailActionBar } from '../../messages/components/CandidateEmailActionBar'

const INV_STATUS = {
  pending:  { label: '待回复' },
  accepted: { label: '已接受' },
  declined: { label: '已婉拒' },
}

const INV_BADGE_STYLE = {
  pending:  { background: 'rgba(96,165,250,0.1)',  color: 'var(--t-chart-blue)', borderColor: 'rgba(96,165,250,0.35)' },
  accepted: { background: 'rgba(34,197,94,0.1)',   color: 'var(--t-success)',    borderColor: 'rgba(34,197,94,0.35)' },
  declined: { background: 'var(--t-bg-elevated)',  color: 'var(--t-text-muted)', borderColor: 'var(--t-border)' },
}

function InvBadge({ status }) {
  if (!status || !INV_STATUS[status]) return null
  const s = INV_BADGE_STYLE[status] ?? INV_BADGE_STYLE.pending
  return (
    <span style={{
      ...s,
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 600, lineHeight: '18px',
      border: '1px solid',
    }}>
      {INV_STATUS[status].label}
    </span>
  )
}

export function CandidateChatModal({ threadId, candidate, job, terminal = true, onClose }) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const overlayRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  const msgState = useConversationMessages({
    threadId,
    myUserId: user?.id,
    socket: null,
    connectionStatus: 'disconnected',
    onRead: null,
  })

  const sender = useSendMessage({
    threadId,
    myUserId: user?.id,
    myRole: user?.role,
    socket: null,
    setMessages: msgState.setMessages,
    shouldScrollRef: msgState.shouldScrollRef,
  })

  useEffect(() => () => sender.cleanup?.(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const name = candidate?.full_name ?? '候选人'
  const invStatus = msgState.thread?.invitation_status

  if (!terminal) {
    // ── Light / public mode (unchanged) ─────────────────────────────────
    return (
      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        style={{
          position: 'fixed', inset: 0, zIndex: 9900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(15,23,42,0.5)',
          backdropFilter: 'blur(2px)',
          padding: '16px',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 580,
            height: '72vh', maxHeight: 680,
            display: 'flex', flexDirection: 'column',
            borderRadius: 12, overflow: 'hidden',
            background: '#fff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ flexShrink: 0, borderBottom: '1px solid #e2e8f0', padding: '12px 16px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 8, background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                {name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{name}</span>
                  {job?.title && <span style={{ fontSize: 11, color: '#94a3b8' }}>· {job.title}</span>}
                </div>
                <CandidateEmailActionBar candidateId={candidate?.id} jobId={job?.id} threadId={threadId} terminal={false} />
              </div>
              <button type="button" onClick={onClose} style={{ flexShrink: 0, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'transparent', color: '#94a3b8' }}>
                <X size={15} />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            {msgState.loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>加载中...</div>
            ) : msgState.msgError ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 13 }}>{msgState.msgError}</div>
            ) : (
              <MessageThread messages={msgState.messages} hasMore={msgState.hasMore} loadingMore={msgState.loadingMore} isTyping={msgState.isTyping} myUserId={user?.id} onRetry={sender.handleRetry} onLoadMore={msgState.handleLoadMore} shouldScrollRef={msgState.shouldScrollRef} loadingMoreRef={msgState.loadingMoreRef} terminal={false} />
            )}
          </div>
          <MessageComposer input={input} onChange={v => sender.handleInputChange?.(v, setInput) ?? setInput(v)} onSubmit={e => sender.handleSend(e, input, setInput)} terminal={false} />
        </div>
      </div>
    )
  }

  // ── Terminal mode ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        .t-modal-textarea:focus {
          outline: none !important;
          border-color: var(--t-border-focus) !important;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.18) !important;
        }
        .t-modal-textarea::placeholder { color: var(--t-text-muted); }
        @media (max-width: 640px) {
          .t-modal-panel {
            width: calc(100vw - 24px) !important;
            max-width: none !important;
            height: calc(100vh - 32px) !important;
            max-height: none !important;
            border-radius: 8px !important;
          }
        }
      `}</style>

      <div
        ref={overlayRef}
        onClick={handleOverlayClick}
        style={{
          position: 'fixed', inset: 0, zIndex: 9900,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(6,9,15,0.82)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          padding: '16px',
        }}
      >
        {/* Panel */}
        <div
          className="t-modal-panel terminal-mode"
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 720,
            height: '75vh',
            maxHeight: 660,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 10,
            overflow: 'hidden',
            position: 'relative',
            background: 'var(--t-bg-panel)',
            border: '1px solid var(--t-border)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.72), 0 0 0 1px rgba(37,99,235,0.14)',
          }}
        >
          {/* Top accent highlight */}
          <div
            aria-hidden
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 1, pointerEvents: 'none',
              background: 'linear-gradient(90deg, transparent 0%, rgba(37,99,235,0.45) 20%, rgba(96,165,250,0.6) 50%, rgba(37,99,235,0.45) 80%, transparent 100%)',
            }}
          />

          {/* Header */}
          <div
            style={{
              flexShrink: 0,
              padding: '15px 20px 13px',
              borderBottom: '1px solid var(--t-border-subtle)',
              background: 'var(--t-bg-elevated)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* Avatar */}
              <div
                style={{
                  flexShrink: 0,
                  width: 40, height: 40,
                  borderRadius: 10,
                  background: 'var(--t-primary)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 16,
                  border: '1px solid rgba(37,99,235,0.6)',
                  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.1), 0 2px 8px rgba(37,99,235,0.28)',
                }}
              >
                {name[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Name + badge row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text)', lineHeight: 1.2 }}>
                    {name}
                  </span>
                  {invStatus && <InvBadge status={invStatus} />}
                </div>
                {/* Sub-info */}
                {(job?.title || candidate?.current_company) && (
                  <p style={{ fontSize: 11.5, color: 'var(--t-text-muted)', marginBottom: 7, lineHeight: 1.4 }}>
                    {job?.title}
                    {job?.title && candidate?.current_company && ' · '}
                    {candidate?.current_company}
                  </p>
                )}
                {/* Email actions */}
                <CandidateEmailActionBar
                  candidateId={candidate?.id}
                  jobId={job?.id}
                  threadId={threadId}
                  terminal
                />
              </div>

              {/* Close */}
              <CloseButton onClose={onClose} />
            </div>
          </div>

          {/* Message area */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {msgState.loading ? (
              <LoadingState />
            ) : msgState.msgError ? (
              <ErrorState error={msgState.msgError} />
            ) : (
              <MessageThread
                messages={msgState.messages}
                hasMore={msgState.hasMore}
                loadingMore={msgState.loadingMore}
                isTyping={msgState.isTyping}
                myUserId={user?.id}
                onRetry={sender.handleRetry}
                onLoadMore={msgState.handleLoadMore}
                shouldScrollRef={msgState.shouldScrollRef}
                loadingMoreRef={msgState.loadingMoreRef}
                terminal
              />
            )}
          </div>

          {/* Composer */}
          <MessageComposer
            input={input}
            onChange={v => sender.handleInputChange?.(v, setInput) ?? setInput(v)}
            onSubmit={e => sender.handleSend(e, input, setInput)}
            terminal
            textareaClassName="t-modal-textarea"
          />
        </div>
      </div>
    </>
  )
}

function CloseButton({ onClose }) {
  return (
    <button
      type="button"
      onClick={onClose}
      style={{
        flexShrink: 0, width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: '1px solid transparent', cursor: 'pointer',
        background: 'transparent', color: 'var(--t-text-muted)',
        transition: 'background 120ms, border-color 120ms, color 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--t-bg-hover)'
        e.currentTarget.style.borderColor = 'var(--t-border)'
        e.currentTarget.style.color = 'var(--t-text)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.color = 'var(--t-text-muted)'
      }}
    >
      <X size={15} />
    </button>
  )
}

function LoadingState() {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 10,
    }}>
      <Loader2 size={20} className="animate-spin" style={{ color: 'var(--t-chart-blue)' }} />
      <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>加载消息...</span>
    </div>
  )
}

function ErrorState({ error }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      <AlertCircle size={22} style={{ color: 'var(--t-danger)' }} />
      <span style={{ fontSize: 13, color: 'var(--t-danger)' }}>{error}</span>
    </div>
  )
}
