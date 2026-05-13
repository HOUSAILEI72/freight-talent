export function ConversationListItem({ conv, isActive, onClick, onContextMenu, myRole, terminal = false, unreadCount }) {
  const label  = myRole === 'employer' ? conv.candidate_name : conv.company_name
  const subtext = conv.job_title
  const unread  = unreadCount != null ? unreadCount : (conv.unread_count ?? 0)

  if (terminal) {
    return (
      <button
        onClick={onClick}
        onContextMenu={onContextMenu}
        className="w-full text-left px-4 py-3.5 transition-colors relative"
        style={{
          background: isActive ? 'var(--t-bg-active)' : 'transparent',
          borderBottom: '1px solid var(--t-border-subtle)',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {isActive && (
          <span aria-hidden className="absolute left-0 top-2 h-[calc(100%-1rem)] w-0.5 rounded-r" style={{ background: 'var(--t-primary)' }} />
        )}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ background: 'var(--t-primary)' }}>
              {(label?.[0] ?? '?').toUpperCase()}
            </div>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none" style={{ background: 'var(--t-danger)' }}>
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className={`text-sm truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`} style={{ color: 'var(--t-text)' }}>
                {label}
              </span>
              {conv.latest_message_at && (
                <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--t-text-muted)' }}>
                  {conv.latest_message_at.slice(0, 10)}
                </span>
              )}
            </div>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{subtext}</p>
          </div>
        </div>
      </button>
    )
  }

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
