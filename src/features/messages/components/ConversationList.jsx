import { Loader2 } from 'lucide-react'
import { ConversationListItem } from './ConversationListItem'
import { EmptyConversationState } from './EmptyConversationState'

export function ConversationList({
  loadingList, listError, conversations, grouped,
  activeId, hiddenIds, deletedIds,
  myRole, terminal,
  onSelect, onContextMenu,
}) {
  return (
    <div
      className={terminal ? 'w-64 flex flex-col flex-shrink-0' : 'w-64 border-r border-slate-100 flex flex-col flex-shrink-0'}
      style={terminal ? { borderRight: '1px solid var(--t-border)' } : undefined}
    >
      <div
        className={terminal ? 'px-4 py-3' : 'px-4 py-3 border-b border-slate-100'}
        style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
      >
        <p
          className={terminal ? 'text-xs font-semibold uppercase tracking-wide' : 'text-xs font-semibold text-slate-500 uppercase tracking-wide'}
          style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
        >
          会话
        </p>
      </div>

      <div className={terminal ? 'flex-1 overflow-y-auto terminal-scrollbar' : 'flex-1 overflow-y-auto'}>
        {loadingList && (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin" style={terminal ? { color: 'var(--t-text-muted)' } : undefined} />
          </div>
        )}
        {!loadingList && listError && (
          <div
            className={terminal ? 'px-4 py-6 text-center text-xs' : 'px-4 py-6 text-center text-xs text-red-400'}
            style={terminal ? { color: 'var(--t-danger)' } : undefined}
          >
            {listError}
          </div>
        )}
        {!loadingList && !listError && conversations.length === 0 && (
          <EmptyConversationState userRole={myRole} terminal={terminal} />
        )}
        {grouped
          .filter(g => !g.threads.every(t => hiddenIds.has(t.id) || deletedIds.has(t.id)))
          .map(g => (
            <ConversationListItem
              key={g.key}
              conv={g.peer}
              isActive={g.threads.some(t => t.id === activeId)}
              onClick={() => onSelect(g)}
              unreadCount={g.totalUnread}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onContextMenu(e, g.peer.id)
              }}
              myRole={myRole}
              terminal={terminal}
            />
          ))
        }
      </div>
    </div>
  )
}
