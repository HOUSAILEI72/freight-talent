import { useState, useEffect, useRef, useMemo, startTransition } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Briefcase, MessageSquare, Send, Mail } from 'lucide-react'
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
import MyApplications from '../../pages/candidate/MyApplications'
import MyInvitations from '../../pages/candidate/MyInvitations'

// ── Inner chat panel ───────────────────────────────────────────────────────
function MessagePanel({ threadId, myUserId, myRole, onRead, socket, connectionStatus, terminal, threads, onSwitchThread }) {
  const [input, setInput] = useState('')

  const msgState = useConversationMessages({ threadId, myUserId, socket, connectionStatus, onRead })
  const sender   = useSendMessage({
    threadId, myUserId, myRole, socket,
    setMessages: msgState.setMessages,
    shouldScrollRef: msgState.shouldScrollRef,
  })

  useEffect(() => () => sender.cleanup(), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (msgState.loading)   return <MessageLoadingState terminal={terminal} />
  if (msgState.msgError)  return <MessageErrorState error={msgState.msgError} terminal={terminal} />

  const thread = msgState.thread

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ConversationHeader
        thread={thread}
        threadId={threadId}
        threads={threads}
        onSwitchThread={onSwitchThread}
        terminal={terminal}
        myRole={myRole}
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
        onSubmit={(e, msgOverride) => sender.handleSend(e, msgOverride ?? input, setInput)}
        terminal={terminal}
        candidateId={thread?.candidate_id}
        jobId={thread?.job_id}
        threadId={threadId}
        myRole={myRole}
      />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MessagesPage({ terminal = false, basePath = '/messages' }) {
  const { threadId: paramThreadId } = useParams()
  const navigate = useNavigate()
  const { user }  = useAuth()

  const [activeId,   setActiveId]   = useState(paramThreadId ? Number(paramThreadId) : null)
  const activeIdRef = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const [viewMode, setViewMode] = useState('messages') // 'messages' | 'applications' | 'invitations'

  // When navigating to a specific thread (e.g. from "查看沟通"), switch back to messages mode
  useEffect(() => {
    if (paramThreadId) startTransition(() => setViewMode('messages'))
  }, [paramThreadId])

  const [ctxMenu, setCtxMenu] = useState(null)

  const { socket, connectionStatus } = useSocket(!!user)

  const convState = useConversations({ socket, activeIdRef, paramThreadId, basePath, navigate })

  useEffect(() => {
    if (paramThreadId) startTransition(() => setActiveId(Number(paramThreadId)))
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

  // ── Public light layout (character-level unchanged) ────────────────────
  if (!terminal) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6" onClick={() => ctxMenu && setCtxMenu(null)}>
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x} y={ctxMenu.y} terminal={false}
            onHide={() => convState.hideConv(ctxMenu.convId, activeId, setActiveId)}
            onDelete={() => convState.deleteConv(ctxMenu.convId, activeId, setActiveId)}
            onClose={() => setCtxMenu(null)}
          />
        )}
        <ConnectionBanner status={connectionStatus} terminal={false} />
        <div className="mb-4 flex items-center gap-2">
          <h1 className="text-xl font-bold text-slate-800">消息</h1>
        </div>
        <div
          className="flex rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm"
          style={{ height: 'calc(100vh - 180px)', minHeight: 500 }}
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
            terminal={false}
            onSelect={handleSelect}
            onContextMenu={(e, convId) => setCtxMenu({ x: e.clientX, y: e.clientY, convId })}
          />
          {activeId ? (
            <MessagePanel
              key={activeId}
              threadId={activeId}
              threads={activeGroup?.threads ?? []}
              onSwitchThread={tid => { setActiveId(tid); navigate(`${basePath}/${tid}`) }}
              myUserId={user?.id}
              myRole={user?.role}
              onRead={convState.handleThreadRead}
              socket={socket}
              connectionStatus={connectionStatus}
              terminal={false}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Briefcase size={32} className="text-slate-200" />
              <p className="text-sm">选择一个会话开始沟通</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Terminal BOSS-style layout ─────────────────────────────────────────
  const MODE_TABS = [
    { key: 'messages',     label: '消息', Icon: MessageSquare },
    { key: 'applications', label: '投递', Icon: Send },
    { key: 'invitations',  label: '邀约', Icon: Mail },
  ]

  return (
    <div
      className="terminal-mode flex flex-1 w-full min-w-0 flex-col h-full min-h-0"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)', overflow: 'hidden' }}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x} y={ctxMenu.y} terminal
          onHide={() => convState.hideConv(ctxMenu.convId, activeId, setActiveId)}
          onDelete={() => convState.deleteConv(ctxMenu.convId, activeId, setActiveId)}
          onClose={() => setCtxMenu(null)}
        />
      )}

      <ConnectionBanner status={connectionStatus} terminal />

      {/* Mode switcher — candidates only */}
      {user?.role === 'candidate' && (
        <div style={{
          display: 'flex', flexShrink: 0,
          borderBottom: '1px solid var(--t-border)',
          background: 'var(--t-bg-panel)',
          paddingLeft: 8,
        }}>
          {MODE_TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              style={{
                padding: '9px 16px', fontSize: 13,
                fontWeight: viewMode === key ? 600 : 400,
                color: viewMode === key ? 'var(--t-primary)' : 'var(--t-text-muted)',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${viewMode === key ? 'var(--t-primary)' : 'transparent'}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'color 150ms, border-color 150ms',
              }}
              onMouseEnter={e => { if (viewMode !== key) e.currentTarget.style.color = 'var(--t-text-secondary)' }}
              onMouseLeave={e => { if (viewMode !== key) e.currentTarget.style.color = 'var(--t-text-muted)' }}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Applications panel */}
      {viewMode === 'applications' && <MyApplications terminal />}

      {/* Invitations panel */}
      {viewMode === 'invitations' && <MyInvitations terminal messagesPath={basePath} />}

      {/* Messages: two-column body */}
      {viewMode === 'messages' && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          {/* Left: conversation list */}
          <ConversationList
            loadingList={convState.loadingList}
            listError={convState.listError}
            conversations={convState.conversations}
            grouped={grouped}
            activeId={activeId}
            hiddenIds={convState.hiddenIds}
            deletedIds={convState.deletedIds}
            myRole={user?.role}
            terminal
            onSelect={handleSelect}
            onContextMenu={(e, convId) => setCtxMenu({ x: e.clientX, y: e.clientY, convId })}
          />

          {/* Right: chat area */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {activeId ? (
              <MessagePanel
                key={activeId}
                threadId={activeId}
                threads={activeGroup?.threads ?? []}
                onSwitchThread={tid => { setActiveId(tid); navigate(`${basePath}/${tid}`) }}
                myUserId={user?.id}
                myRole={user?.role}
                onRead={convState.handleThreadRead}
                socket={socket}
                connectionStatus={connectionStatus}
                terminal
              />
            ) : (
              <div style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 14, color: 'var(--t-text-muted)',
              }}>
                <Briefcase size={40} style={{ opacity: 0.2 }} />
                <p style={{ fontSize: 14 }}>从左侧选择一个会话开始沟通</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
