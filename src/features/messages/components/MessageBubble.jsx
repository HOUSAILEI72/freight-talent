import { dateLabel } from '../utils/messageFormatters'

export function DateDivider({ dateKey, terminal = false }) {
  if (terminal) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px" style={{ background: 'var(--t-border-subtle)' }} />
        <span className="text-[11px] font-medium select-none whitespace-nowrap" style={{ color: 'var(--t-text-muted)' }}>
          {dateLabel(dateKey)}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--t-border-subtle)' }} />
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-[11px] text-slate-400 font-medium select-none whitespace-nowrap">
        {dateLabel(dateKey)}
      </span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  )
}

export function MessageBubble({ msg, isMine, onRetry, terminal = false }) {
  const senderLabel = msg.sender_name ?? (msg.sender_role === 'employer' ? '企业' : '候选人')
  const isSending   = msg.status === 'sending'
  const isRetrying  = msg.status === 'retrying'
  const isFailed    = msg.status === 'failed'
  const isRead      = msg.is_read

  if (terminal) {
    // My bubble: primary-muted bg with primary border, dark text — clearly "mine" but not BOSS blue
    // Their bubble: bg-elevated with subtle border
    let bubbleStyle
    if (isMine) {
      bubbleStyle = isFailed
        ? { background: 'var(--t-danger-muted)', color: 'var(--t-danger)', border: '1px solid var(--t-danger)' }
        : {
            background: 'var(--t-primary-muted)',
            color: 'var(--t-text)',
            border: '1px solid var(--t-primary)',
          }
    } else {
      bubbleStyle = {
        background: 'var(--t-bg-elevated)',
        color: 'var(--t-text)',
        border: '1px solid var(--t-border)',
      }
    }

    const avatarBg    = isMine
      ? (isFailed ? 'var(--t-danger-muted)' : 'var(--t-primary-muted)')
      : 'var(--t-bg-active)'
    const avatarColor = isMine && isFailed ? 'var(--t-danger)' : isMine ? 'var(--t-primary)' : 'var(--t-text-secondary)'
    const metaColor   = isFailed ? 'var(--t-danger)' : 'var(--t-text-muted)'

    return (
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row' }}>
        {/* Avatar */}
        <div
          title={senderLabel}
          style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: avatarBg, color: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}
        >
          {senderLabel[0].toUpperCase()}
        </div>

        {/* Bubble column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 'clamp(200px, 60%, 600px)', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
          {!isMine && (
            <span style={{ fontSize: 11, color: 'var(--t-text-muted)', marginLeft: 4 }}>{senderLabel}</span>
          )}
          <div
            style={{
              padding: '9px 14px',
              borderRadius: isMine ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
              fontSize: 14, lineHeight: 1.6,
              opacity: (isSending || isRetrying) ? 0.6 : 1,
              transition: 'opacity 200ms',
              wordBreak: 'break-word',
              ...bubbleStyle,
            }}
          >
            {msg.content}
            <div style={{ fontSize: 11, marginTop: 4, color: metaColor, display: 'flex', alignItems: 'center', gap: 4, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <span>
                {isSending ? '发送中…' : isRetrying ? `重试中${msg._retryLabel ?? ''}…` : msg.created_at?.slice(11, 16)}
              </span>
              {isMine && !isSending && !isRetrying && !isFailed && (
                <span style={{ color: 'var(--t-primary)', fontWeight: 600 }}>{isRead ? '✓✓' : '✓'}</span>
              )}
            </div>
          </div>
          {isFailed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
              <span style={{ fontSize: 11, color: 'var(--t-danger)' }}>{msg._errorMsg ?? '发送失败'}</span>
              <button
                onClick={() => onRetry?.(msg._tempId, msg.content)}
                className="t-retry-btn"
                style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-chart-blue)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── public light branch (unchanged) ──────────────────────────────────────
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <div title={senderLabel} className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isMine ? (isFailed ? 'bg-red-400' : 'bg-blue-500') : 'bg-slate-400'}`}>
        {senderLabel[0].toUpperCase()}
      </div>
      <div className="flex flex-col gap-0.5" style={{ maxWidth: '65%' }}>
        {!isMine && <span className="text-[10px] text-slate-400 ml-1">{senderLabel}</span>}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed transition-opacity ${
          isMine
            ? `rounded-br-sm ${isFailed ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-600 text-white'} ${(isSending || isRetrying) ? 'opacity-60' : ''}`
            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
        }`}>
          {msg.content}
          <p className={`text-[10px] mt-1 ${isFailed ? 'text-red-400' : isMine ? 'text-blue-200' : 'text-slate-400'}`}>
            {isSending ? '发送中…' : isRetrying ? `重试中${msg._retryLabel ?? ''}…` : msg.created_at?.slice(11, 16)}
            {isMine && !isSending && !isRetrying && !isFailed && (
              <span className="ml-1 select-none">{isRead ? '✓✓' : '✓'}</span>
            )}
          </p>
        </div>
        {isFailed && (
          <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'justify-end' : ''}`}>
            <span className="text-[10px] text-red-500">{msg._errorMsg ?? '发送失败'}</span>
            <button onClick={() => onRetry?.(msg._tempId, msg.content)} className="text-[10px] text-blue-500 hover:text-blue-700 font-medium underline underline-offset-2">重试</button>
          </div>
        )}
      </div>
    </div>
  )
}
