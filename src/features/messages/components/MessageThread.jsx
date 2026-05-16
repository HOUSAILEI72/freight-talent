import { useEffect, useRef } from 'react'
import { Loader2, EyeOff, Trash2, MessageSquare } from 'lucide-react'
import { MessageBubble, DateDivider } from './MessageBubble'
import TypingIndicator from './TypingIndicator'
import { msgDateKey } from '../utils/messageFormatters'

export function ContextMenu({ x, y, terminal, onHide, onDelete, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const menuStyle = {
    position: 'fixed', top: y, left: x, zIndex: 9999, minWidth: 160,
    borderRadius: 6, overflow: 'hidden',
    ...(terminal
      ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }
      : { background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }
    ),
  }
  const itemBase = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 14px', fontSize: 13,
    cursor: 'pointer', border: 'none', background: 'transparent', textAlign: 'left',
  }

  return (
    <div ref={ref} style={menuStyle} onClick={e => e.stopPropagation()}>
      <button
        style={{ ...itemBase, color: terminal ? 'var(--t-text-secondary)' : '#475569' }}
        onMouseEnter={e => { e.currentTarget.style.background = terminal ? 'var(--t-bg-hover)' : '#f1f5f9' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        onClick={() => { onHide(); onClose() }}
      >
        <EyeOff size={14} />不显示此对话
      </button>
      <div style={{ height: 1, background: terminal ? 'var(--t-border-subtle)' : '#e2e8f0', margin: '2px 0' }} />
      <button
        style={{ ...itemBase, color: terminal ? 'var(--t-danger)' : '#ef4444' }}
        onMouseEnter={e => { e.currentTarget.style.background = terminal ? 'var(--t-danger-muted)' : '#fef2f2' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
        onClick={() => { onDelete(); onClose() }}
      >
        <Trash2 size={14} />删除对话
      </button>
    </div>
  )
}

export function MessageThread({
  messages, hasMore, loadingMore, isTyping,
  myUserId, onRetry, onLoadMore,
  shouldScrollRef, loadingMoreRef,
  terminal,
}) {
  const bottomRef    = useRef(null)
  const topAnchorRef = useRef(null)

  const scrollToBottom = (behavior = 'instant') => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }

  useEffect(() => {
    if (shouldScrollRef.current && !loadingMoreRef.current) {
      shouldScrollRef.current = false
      scrollToBottom()
    }
  }, [messages, shouldScrollRef, loadingMoreRef])

  // Scroll anchor after load-more
  const prevLoadingMore = useRef(false)
  useEffect(() => {
    if (prevLoadingMore.current && !loadingMore) {
      requestAnimationFrame(() => {
        topAnchorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
      })
    }
    prevLoadingMore.current = loadingMore
  }, [loadingMore])

  return (
    <div
      className={terminal
        ? 'flex-1 overflow-y-auto px-5 py-4 space-y-3 terminal-scrollbar'
        : 'flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/40'
      }
      style={terminal ? { background: 'var(--t-bg)' } : undefined}
    >
      {hasMore && (
        <div className="flex justify-center pb-2">
          <button
            onClick={onLoadMore}
            disabled={loadingMore}
            className={terminal
              ? 'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors disabled:opacity-50'
              : 'flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-full hover:border-slate-300 hover:text-slate-700 transition-colors disabled:opacity-50'
            }
            style={terminal ? { background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)' } : undefined}
          >
            {loadingMore ? <><Loader2 size={11} className="animate-spin" />加载中...</> : '加载更多历史消息'}
          </button>
        </div>
      )}
      <div ref={topAnchorRef} />

      {messages.length === 0 && (
        terminal ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            paddingTop: 40, paddingBottom: 24, gap: 10,
          }}>
            <MessageSquare size={28} style={{ color: 'var(--t-text-muted)', opacity: 0.45 }} />
            <span style={{ fontSize: 13, color: 'var(--t-text-muted)' }}>发一条消息开始沟通</span>
          </div>
        ) : (
          <div className="text-center text-sm text-slate-400 py-12">暂无消息，发一条开始沟通吧</div>
        )
      )}

      {messages.map((msg, idx) => {
        const key        = msg._tempId ?? msg.id
        const curKey     = msgDateKey(msg.created_at)
        const prevKey    = idx > 0 ? msgDateKey(messages[idx - 1].created_at) : null
        const showDivider = curKey && curKey !== prevKey
        return (
          <div key={key}>
            {showDivider && <DateDivider dateKey={curKey} terminal={terminal} />}
            <MessageBubble msg={msg} isMine={msg.sender_user_id === myUserId} onRetry={onRetry} terminal={terminal} />
          </div>
        )
      })}

      <TypingIndicator visible={isTyping} terminal={terminal} />
      <div ref={bottomRef} />
    </div>
  )
}
