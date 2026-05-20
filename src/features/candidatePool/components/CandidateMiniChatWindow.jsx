import { useState, useEffect, useRef } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useConversationMessages } from '../../messages/hooks/useConversationMessages'
import { useSendMessage } from '../../messages/hooks/useSendMessage'
import { MessageThread } from '../../messages/components/MessageThread'
import { MessageComposer } from '../../messages/components/MessageComposer'

const INV_STATUS = {
  pending:  '待回复',
  accepted: '已接受',
  declined: '已婉拒',
}
const INV_BADGE = {
  pending:  { bg: 'rgba(96,165,250,0.08)',  color: 'rgba(96,165,250,0.8)',  border: 'rgba(96,165,250,0.25)' },
  accepted: { bg: 'rgba(34,197,94,0.08)',   color: 'rgba(74,222,128,0.85)', border: 'rgba(34,197,94,0.25)' },
  declined: { bg: 'rgba(148,163,184,0.06)', color: 'rgba(148,163,184,0.6)', border: 'rgba(148,163,184,0.2)' },
}

function InvBadge({ status }) {
  if (!status || !INV_STATUS[status]) return null
  const s = INV_BADGE[status] ?? INV_BADGE.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '1px 7px', borderRadius: 999,
      fontSize: 10, fontWeight: 600, lineHeight: '18px', letterSpacing: '0.02em',
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {INV_STATUS[status]}
    </span>
  )
}

const DEFAULT_RIGHT = 52  // fallback when dock ref is unavailable

export function CandidateMiniChatWindow({ activeDockConv, dockElRef, onClose, onReadDone }) {
  const { user } = useAuth()
  const [input, setInput] = useState('')
  const didCallReadDone = useRef(false)
  const chatRef = useRef(null)
  const [rightOffset, setRightOffset] = useState(DEFAULT_RIGHT)

  // Dynamically track dock position so chat window stays attached to its left edge
  useEffect(() => {
    const dockEl = dockElRef?.current
    const chatEl = chatRef.current
    if (!dockEl || !chatEl) return

    function syncPosition() {
      const rect = dockEl.getBoundingClientRect()
      // Skip if dock is not visible (e.g. responsive drawer open, desktop dock hidden)
      if (rect.width === 0 && rect.height === 0) {
        setRightOffset(DEFAULT_RIGHT)
        return
      }
      // Chat window right edge = viewport right edge - dock left edge
      setRightOffset(window.innerWidth - rect.left)
    }

    const rafId = requestAnimationFrame(syncPosition)

    const observer = new ResizeObserver(syncPosition)
    observer.observe(dockEl)
    dockEl.addEventListener('transitionend', syncPosition)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      dockEl.removeEventListener('transitionend', syncPosition)
    }
  }, [dockElRef])

  const msgState = useConversationMessages({
    threadId:         activeDockConv.threadId,
    myUserId:         user?.id,
    socket:           null,
    connectionStatus: 'disconnected',
    onRead:           null,
  })

  const sender = useSendMessage({
    threadId:        activeDockConv.threadId,
    myUserId:        user?.id,
    myRole:          user?.role,
    socket:          null,
    setMessages:     msgState.setMessages,
    shouldScrollRef: msgState.shouldScrollRef,
  })

  useEffect(() => {
    if (!msgState.loading && !msgState.msgError && !didCallReadDone.current) {
      didCallReadDone.current = true
      onReadDone?.()
    }
  }, [msgState.loading, msgState.msgError, onReadDone])

  useEffect(() => () => sender.cleanup?.(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const invStatus = msgState.thread?.invitation_status

  return (
    <>
      <style>{`
        .t-mini-textarea:focus {
          outline: none !important;
          border-color: rgba(96,165,250,0.45) !important;
          box-shadow: 0 0 0 2px rgba(37,99,235,0.14) !important;
        }
        .t-mini-textarea::placeholder { color: var(--t-text-muted); opacity: 0.6; }
      `}</style>

      <div
        ref={chatRef}
        className="terminal-mode"
        style={{
          position:      'fixed',
          bottom:        24,
          right:         rightOffset,
          width:         380,
          maxWidth:      'calc(100vw - 80px)',
          height:        480,
          zIndex:        8200,
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--t-bg-panel)',
          border:        '1px solid var(--t-border-focus)',
          borderRadius:  10,
          overflow:      'hidden',
          boxShadow:     [
            '0 24px 80px rgba(0,0,0,0.48)',
            '0 0 0 1px rgba(96,165,250,0.08)',
          ].join(', '),
        }}
      >
        {/* Top accent line */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            zIndex: 2, pointerEvents: 'none',
            background: 'linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.5) 25%, rgba(147,197,253,0.7) 50%, rgba(96,165,250,0.5) 75%, transparent 100%)',
          }}
        />

        {/* Header ~58px */}
        <div
          style={{
            flexShrink: 0,
            minHeight: 56,
            padding: '11px 12px 10px',
            borderBottom: '1px solid var(--t-border-subtle)',
            background: 'var(--t-bg-elevated)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            position: 'relative', zIndex: 1,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              flexShrink: 0, width: 34, height: 34,
              borderRadius: 9,
              background: 'rgba(37,99,235,0.2)',
              color: 'rgba(96,165,250,0.9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 14,
              border: '1px solid rgba(96,165,250,0.35)',
              marginTop: 1,
            }}
          >
            {activeDockConv.candidateInitial}
          </div>

          {/* Name + job + badge */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 13, fontWeight: 700,
                color: 'rgba(226,232,240,0.95)',
                lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 190,
                fontFamily: 'var(--t-font-cjk)',
              }}>
                {activeDockConv.candidateName}
              </span>
              {invStatus && <InvBadge status={invStatus} />}
            </div>
            {activeDockConv.jobTitle && (
              <div style={{
                fontSize: 11, color: 'rgba(120,145,175,0.85)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                fontFamily: 'var(--t-font-cjk)',
              }}>
                {activeDockConv.jobTitle}
              </div>
            )}
          </div>

          {/* Close */}
          <CloseButton onClose={onClose} />
        </div>

        {/* Message area — uses scoped --t-bg for warmer feel */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {msgState.loading ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              background: 'var(--t-bg)',
            }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'rgba(96,165,250,0.6)' }} />
              <span style={{ fontSize: 12, color: 'var(--t-text-muted)', opacity: 0.7 }}>加载消息...</span>
            </div>
          ) : msgState.msgError ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'var(--t-bg)',
            }}>
              <AlertCircle size={20} style={{ color: 'var(--t-danger)', opacity: 0.7 }} />
              <span style={{ fontSize: 12, color: 'var(--t-danger)', opacity: 0.8 }}>{msgState.msgError}</span>
            </div>
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
              terminal={true}
            />
          )}
        </div>

        {/* Composer */}
        <div style={{ borderTop: '1px solid rgba(96,165,250,0.1)', background: 'rgba(10,16,30,0.95)' }}>
          <MessageComposer
            input={input}
            onChange={v => sender.handleInputChange?.(v, setInput) ?? setInput(v)}
            onSubmit={e => sender.handleSend(e, input, setInput)}
            terminal={true}
            textareaClassName="t-mini-textarea"
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
        flexShrink: 0, width: 26, height: 26,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 5, border: '1px solid transparent', cursor: 'pointer',
        background: 'transparent', color: 'rgba(120,145,175,0.7)',
        transition: 'background 120ms, border-color 120ms, color 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(96,165,250,0.08)'
        e.currentTarget.style.borderColor = 'rgba(96,165,250,0.2)'
        e.currentTarget.style.color = 'rgba(226,232,240,0.9)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
        e.currentTarget.style.color = 'rgba(120,145,175,0.7)'
      }}
    >
      <X size={14} />
    </button>
  )
}
