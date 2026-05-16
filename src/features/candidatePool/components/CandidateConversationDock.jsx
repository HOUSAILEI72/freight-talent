import { useState, useEffect, useRef } from 'react'
import { ChevronRight, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { conversationsApi } from '../../../api/conversations'

const EASE = 'cubic-bezier(0.22,1,0.36,1)'

function buildActiveDockConv(conv) {
  return {
    threadId:         conv.id,
    candidateId:      conv.candidate_id,
    candidateName:    conv.candidate_name,
    candidateInitial: (conv.candidate_name?.[0] ?? '?').toUpperCase(),
    jobId:            conv.job_id ?? null,
    jobTitle:         conv.job_title ?? null,
  }
}

export function CandidateConversationDock({
  activeThreadId,
  onSelect,
  onCollapsedChange,
  refreshKey = 0,
}) {
  const [collapsed,     setCollapsed]     = useState(true)
  const [conversations, setConversations] = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const timerRef   = useRef(null)
  const mountedRef = useRef(true)

  async function fetchList(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await conversationsApi.getMyConversations()
      if (!mountedRef.current) return
      setConversations(res.data?.conversations ?? res.data ?? [])
      setError('')
    } catch {
      if (mountedRef.current) setError('加载失败')
    } finally {
      if (mountedRef.current && !silent) setLoading(false)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    fetchList()
    timerRef.current = setInterval(() => fetchList(true), 60_000)
    return () => {
      mountedRef.current = false
      clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (refreshKey > 0) fetchList(true)
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeThreadId == null) return
    setConversations(prev =>
      prev.map(c => c.id === activeThreadId ? { ...c, unread_count: 0 } : c)
    )
  }, [activeThreadId])

  function handleToggle() {
    const next = !collapsed
    setCollapsed(next)
    onCollapsedChange?.(next)
  }

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0)

  return (
    <aside
      className="terminal-mode"
      style={{
        flexShrink: 0,
        width:      collapsed ? 36 : 'var(--t-dock-width, clamp(200px, 16vw, 240px))',
        display:    'flex',
        flexDirection: 'column',
        overflow:   'hidden',
        background: 'var(--t-bg-panel)',
        borderLeft: '1px solid rgba(96,165,250,0.16)',
        transition: `width 280ms ${EASE}`,
        position:   'relative',
      }}
    >
      {/* Top accent highlight — terminal panel signature */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          zIndex: 1, pointerEvents: 'none',
          background: 'linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.3) 40%, rgba(96,165,250,0.5) 60%, transparent 100%)',
        }}
      />

      {/* Header — 44px */}
      <div
        style={{
          flexShrink: 0,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? 0 : '0 8px 0 12px',
          borderBottom: '1px solid rgba(96,165,250,0.1)',
          background: 'var(--t-bg-elevated)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          position: 'relative',
          zIndex: 0,
        }}
      >
        {collapsed ? (
          <button
            type="button"
            title="展开沟通栏"
            onClick={handleToggle}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'transparent', color: 'var(--t-text-muted)',
              position: 'relative',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' }}
          >
            <MessageSquare size={14} />
            {totalUnread > 0 && (
              <span style={{
                position: 'absolute', top: 1, right: 1,
                minWidth: 14, height: 14, borderRadius: 999,
                background: 'var(--t-danger)', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
              }}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <MessageSquare size={12} style={{ color: 'var(--t-text-muted)', flexShrink: 0, opacity: 0.7 }} />
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em',
                color: 'var(--t-text-muted)', textTransform: 'uppercase',
                fontFamily: 'var(--t-font-ui)',
              }}>
                沟通列表
              </span>
              {totalUnread > 0 && (
                <span style={{
                  minWidth: 16, height: 16, borderRadius: 999,
                  background: 'var(--t-danger)', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 3px', flexShrink: 0,
                }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
            <button
              type="button"
              title="收起沟通栏"
              onClick={handleToggle}
              style={{
                width: 24, height: 24, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 4, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--t-text-muted)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' }}
            >
              <ChevronRight size={12} />
            </button>
          </>
        )}
      </div>

      {/* 列表区 */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto' }} className="terminal-scrollbar">
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 7 }}>
              <Loader2 size={13} className="animate-spin" style={{ color: 'var(--t-chart-blue)', opacity: 0.7 }} />
              <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>加载中...</span>
            </div>
          )}
          {!loading && error && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 7 }}>
              <AlertCircle size={13} style={{ color: 'var(--t-danger)' }} />
              <span style={{ fontSize: 11, color: 'var(--t-danger)' }}>{error}</span>
            </div>
          )}
          {!loading && !error && conversations.length === 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '36px 20px 28px', gap: 8,
            }}>
              <MessageSquare size={20} style={{ color: 'var(--t-text-muted)', opacity: 0.3 }} />
              <span style={{ fontSize: 11, color: 'var(--t-text-muted)', opacity: 0.6, textAlign: 'center', lineHeight: 1.5 }}>
                暂无沟通记录
              </span>
            </div>
          )}
          {!loading && !error && conversations.map(conv => (
            <DockConvItem
              key={conv.id}
              conv={conv}
              isActive={conv.id === activeThreadId}
              onClick={() => onSelect(buildActiveDockConv(conv))}
            />
          ))}
        </div>
      )}
    </aside>
  )
}

// ── 精简版列表项 ~76px ─────────────────────────────────────
function DockConvItem({ conv, isActive, onClick }) {
  const name    = conv.candidate_name ?? '候选人'
  const initial = (name[0] ?? '?').toUpperCase()
  const unread  = conv.unread_count ?? 0

  const todayStr = new Date().toISOString().slice(0, 10)
  const timeStr  = conv.latest_message_at
    ? conv.latest_message_at.slice(0, 10) === todayStr
      ? conv.latest_message_at.slice(11, 16)
      : conv.latest_message_at.slice(5, 10).replace('-', '/')
    : ''

  const [hovered, setHovered] = useState(false)

  const bg = isActive
    ? 'rgba(37,99,235,0.13)'
    : hovered ? 'rgba(255,255,255,0.035)' : 'transparent'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 9,
        padding: '10px 10px',
        cursor: 'pointer',
        background: bg,
        borderLeft: isActive ? '2px solid var(--t-primary)' : '2px solid transparent',
        borderBottom: '1px solid rgba(96,165,250,0.06)',
        boxShadow: isActive ? 'inset 0 0 16px rgba(37,99,235,0.04)' : 'none',
        transition: 'background 120ms',
        minHeight: 76,
      }}
    >
      {/* Avatar */}
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 7,
        marginTop: 2,
        background: isActive ? 'rgba(37,99,235,0.22)' : 'var(--t-bg-elevated)',
        border: `1px solid ${isActive ? 'rgba(96,165,250,0.55)' : 'rgba(96,165,250,0.22)'}`,
        color: isActive ? 'var(--t-chart-blue)' : 'var(--t-text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--t-font-ui)',
        fontWeight: 700, fontSize: 12.5,
        transition: 'background 120ms, border-color 120ms, color 120ms',
      }}>
        {initial}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name + time */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4, marginBottom: 3 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--t-font-cjk)',
            lineHeight: 'var(--t-line-tight, 1.25)',
            letterSpacing: 'var(--t-letter-ui, 0.01em)',
            color: isActive ? 'var(--t-text)' : 'var(--t-text-secondary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {name}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {timeStr && (
              <span style={{
                fontFamily: 'var(--t-font-mono)',
                fontSize: 10,
                color: 'rgba(148,163,184,0.5)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {timeStr}
              </span>
            )}
            {unread > 0 && (
              <span style={{
                minWidth: 15, height: 15, borderRadius: 999,
                background: 'var(--t-danger)', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>

        {/* Job title */}
        {conv.job_title && (
          <div style={{
            fontFamily: 'var(--t-font-cjk)',
            fontSize: 11,
            color: 'rgba(148,163,184,0.78)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginBottom: 2.5,
            lineHeight: 1.35,
          }}>
            {conv.job_title}
          </div>
        )}

        {/* Latest message */}
        {conv.latest_message && (
          <div style={{
            fontFamily: 'var(--t-font-cjk)',
            fontSize: 11,
            color: 'rgba(148,163,184,0.55)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.35,
          }}>
            {conv.latest_message}
          </div>
        )}
      </div>
    </div>
  )
}
