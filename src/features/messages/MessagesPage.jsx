import { useState, useEffect, useRef, useMemo, startTransition } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MessageSquare, Briefcase } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../hooks/useSocket'
import { useConversations } from './hooks/useConversations'
import { useConversationMessages } from './hooks/useConversationMessages'
import { useSendMessage } from './hooks/useSendMessage'
import { ConversationList } from './components/ConversationList'
import { ConversationHeader } from './components/ConversationHeader'
import { MessageThread, ContextMenu } from './components/MessageThread'
import { MessageComposer } from './components/MessageComposer'
import { MessageLoadingState, MessageErrorState } from './components/MessageLoadingState'
import ConnectionBanner from './components/ConnectionBanner'
import { groupConversations } from './utils/conversationHelpers'

// ── Inner panel (extracted so key=activeId causes a clean remount) ────────────
function MessagePanel({ threadId, myUserId, myRole, onRead, socket, connectionStatus, terminal, threads, onSwitchThread }) {
  const [input, setInput] = useState('')

  const msgState = useConversationMessages({ threadId, myUserId, socket, connectionStatus, onRead })

  const sender = useSendMessage({
    threadId, myUserId, myRole, socket,
    setMessages: msgState.setMessages,
    shouldScrollRef: msgState.shouldScrollRef,
  })

  // cleanup retry timers on unmount
  useEffect(() => () => sender.cleanup(), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (msgState.loading) return <MessageLoadingState terminal={terminal} />
  if (msgState.msgError) return <MessageErrorState error={msgState.msgError} terminal={terminal} />

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ConversationHeader
        thread={msgState.thread}
        threadId={threadId}
        threads={threads}
        onSwitchThread={onSwitchThread}
        terminal={terminal}
      />
      <MessageThread
        messages={msgState.messages}
        hasMore={msgState.hasMore}
        loadingMore={msgState.loadingMore}
        isTyping={msgState.isTyping}
        myUserId={myUserId}
        onRetry={sender.handleRetry}
        onLoadMore={msgState.handleLoadMore}
        shouldScrollRef={msgState.shouldScrollRef}
        loadingMoreRef={msgState.loadingMoreRef}
        terminal={terminal}
      />
      <MessageComposer
        input={input}
        onChange={v => sender.handleInputChange(v, setInput)}
        onSubmit={e => sender.handleSend(e, input, setInput)}
        terminal={terminal}
      />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MessagesPage({ terminal = false, basePath = '/messages' }) {
  const { threadId: paramThreadId } = useParams()
  const navigate = useNavigate()
  const { user }  = useAuth()

  const [activeId, setActiveId] = useState(paramThreadId ? Number(paramThreadId) : null)
  const activeIdRef = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, convId }

  const { socket, connectionStatus } = useSocket(!!user)

  const convState = useConversations({
    socket, activeIdRef,
    paramThreadId,
    basePath,
    navigate,
  })

  // Sync URL param → activeId
  useEffect(() => {
    if (paramThreadId) startTransition(() => { setActiveId(Number(paramThreadId)) })
  }, [paramThreadId])

  const grouped = useMemo(
    () => groupConversations(convState.conversations, user?.role),
    [convState.conversations, user?.role]
  )

  const activeGroup = useMemo(
    () => grouped.find(g => g.threads.some(t => t.id === activeId)) ?? null,
    [grouped, activeId]
  )

  function handleSelect(group) {
    const tid = group.peer.id
    setActiveId(tid)
    navigate(`${basePath}/${tid}`)
  }

  return (
    <div
      className={terminal
        ? 'terminal-mode flex flex-1 w-full min-w-0 flex-col h-full min-h-0 overflow-hidden px-4 py-4'
        : 'max-w-6xl mx-auto px-4 py-6'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          terminal={terminal}
          onHide={() => convState.hideConv(ctxMenu.convId, activeId, setActiveId)}
          onDelete={() => convState.deleteConv(ctxMenu.convId, activeId, setActiveId)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <ConnectionBanner status={connectionStatus} terminal={terminal} />

      <div className="mb-4 flex items-center gap-2">
        <h1
          className={terminal ? 'text-xl font-bold flex items-center gap-2' : 'text-xl font-bold text-slate-800 flex items-center gap-2'}
          style={terminal ? { color: 'var(--t-text)' } : undefined}
        >
          <MessageSquare size={20} style={terminal ? { color: 'var(--t-chart-blue)' } : undefined} className={terminal ? '' : 'text-blue-500'} />
          消息
        </h1>
      </div>

      <div
        className={terminal ? 'flex flex-1 min-h-0 border overflow-hidden' : 'flex rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm'}
        style={terminal
          ? { borderColor: 'var(--t-border)', background: 'var(--t-bg-panel)' }
          : { height: 'calc(100vh - 180px)', minHeight: 500 }
        }
      >
        <ConversationList
          loadingList={convState.loadingList}
          listError={convState.listError}
          conversations={convState.conversations}
          grouped={grouped}
          activeId={activeId}
          hiddenIds={convState.hiddenIds}
          deletedIds={convState.deletedIds}
          myRole={user?.role}
          terminal={terminal}
          onSelect={handleSelect}
          onContextMenu={(e, convId) => setCtxMenu({ x: e.clientX, y: e.clientY, convId })}
        />

        {activeId ? (
          <MessagePanel
            key={activeId}
            threadId={activeId}
            threads={activeGroup?.threads ?? []}
            onSwitchThread={(tid) => { setActiveId(tid); navigate(`${basePath}/${tid}`) }}
            myUserId={user?.id}
            myRole={user?.role}
            onRead={convState.handleThreadRead}
            socket={socket}
            connectionStatus={connectionStatus}
            terminal={terminal}
          />
        ) : (
          <div
            className={terminal ? 'flex-1 flex flex-col items-center justify-center gap-3' : 'flex-1 flex flex-col items-center justify-center text-slate-400 gap-3'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            <Briefcase size={32} style={terminal ? { color: 'var(--t-text-muted)' } : undefined} className={terminal ? '' : 'text-slate-200'} />
            <p className="text-sm">选择一个会话开始沟通</p>
          </div>
        )}
      </div>
    </div>
  )
}
