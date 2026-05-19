function relativeTime(dateStr) {
  if (!dateStr) return null
  try {
    const d    = new Date(dateStr)
    const diff = Date.now() - d.getTime()
    if (diff < 60_000)        return '刚刚'
    if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}分钟前`
    if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}小时前`
    const days = Math.floor(diff / 86_400_000)
    if (days < 7)             return `${days}天前`
    return dateStr.slice(0, 10)
  } catch {
    return dateStr.slice(0, 10)
  }
}

// Deterministic avatar background from name (gives each person a stable color)
const AVATAR_COLORS = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']
function avatarColor(name) {
  if (!name) return '#3b82f6'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function ConversationListItem({ conv, isActive, onClick, onContextMenu, myRole, terminal = false, unreadCount }) {
  const label   = myRole === 'employer' ? conv.candidate_name : conv.company_name
  const subtext = conv.job_title
  const unread  = unreadCount != null ? unreadCount : (conv.unread_count ?? 0)
  const preview = conv.latest_message ?? null
  const timeStr = relativeTime(conv.latest_message_at)

  if (terminal) {
    const bgColor = avatarColor(label)
    return (
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        type="button"
        className="w-full text-left t-card-pressable"
        style={{
          display: 'block',
          padding: '11px 14px',
          background: isActive ? 'var(--t-bg-active)' : 'transparent',
          borderBottom: '1px solid var(--t-border-subtle)',
          borderLeft: `3px solid ${isActive ? 'var(--t-primary)' : 'transparent'}`,
          transition: 'background 120ms, transform var(--t-dur-fast) var(--t-ease-std)',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 16,
            }}>
              {(label?.[0] ?? '?').toUpperCase()}
            </div>
            {unread > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -5,
                minWidth: 17, height: 17, padding: '0 4px',
                background: 'var(--t-danger)', color: '#fff',
                fontSize: 10, fontWeight: 700, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, boxShadow: '0 0 0 2px var(--t-bg-panel)',
              }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>

          {/* Left: name + job title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{
              fontSize: 14,
              fontWeight: unread > 0 ? 700 : 500,
              color: 'var(--t-text)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'block',
            }}>
              {label ?? '—'}
            </span>
            {subtext && (
              <div style={{
                fontSize: 12, color: 'var(--t-text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                marginTop: 2, fontWeight: 400,
              }}>
                {subtext}
              </div>
            )}
          </div>

          {/* Right: time (top) + preview (below time) */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, maxWidth: 96 }}>
            {timeStr && (
              <span style={{ fontSize: 11, color: 'var(--t-text-muted)', whiteSpace: 'nowrap' }}>
                {timeStr}
              </span>
            )}
            <div style={{
              fontSize: 12,
              color: unread > 0 ? 'var(--t-primary)' : 'var(--t-text-muted)',
              fontWeight: unread > 0 ? 600 : 400,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              width: '100%', textAlign: 'right',
            }}>
              {preview ?? <span style={{ opacity: 0.5 }}>等待开始沟通</span>}
            </div>
          </div>
        </div>
      </button>
    )
  }

  // ── public light branch (unchanged) ──────────────────────────────────
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 transition-colors ${
        isActive ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {(label?.[0] ?? '?').toUpperCase()}
          </div>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className={`text-sm truncate ${unread > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
              {label}
            </span>
            {conv.latest_message_at && (
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {conv.latest_message_at.slice(0, 10)}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate mt-0.5">{subtext}</p>
        </div>
      </div>
    </button>
  )
}
