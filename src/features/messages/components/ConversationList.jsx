import { useState, useMemo } from 'react'
import { Loader2, Search, ChevronDown } from 'lucide-react'
import { ConversationListItem } from './ConversationListItem'
import { EmptyConversationState } from './EmptyConversationState'

const TABS = [
  { key: 'all',       label: '全部' },
  { key: 'unread',    label: '未读' },
  { key: 'chatting',  label: '沟通中' },
  { key: 'interview', label: '已约面' },
  { key: 'resumed',   label: '已获简历' },
  { key: 'starred',   label: '收藏' },
]

function filterByTab(groups, tab) {
  if (tab === 'all')       return groups
  if (tab === 'unread')    return groups.filter(g => g.totalUnread > 0)
  if (tab === 'chatting')  return groups.filter(g => !!g.peer.latest_message_at)
  if (tab === 'interview') return groups.filter(g => g.peer.invitation_status === 'accepted')
  return []
}

export function ConversationList({
  loadingList, listError, conversations, grouped,
  activeId, hiddenIds, deletedIds,
  myRole, terminal,
  onSelect, onContextMenu,
}) {
  const [tab,       setTab]       = useState('all')
  const [search,    setSearch]    = useState('')
  const [jobFilter, setJobFilter] = useState('')
  const [jobOpen,   setJobOpen]   = useState(false)

  const jobOptions = useMemo(() => {
    const seen = new Map()
    for (const c of conversations) {
      if (c.job_id && c.job_title && !seen.has(c.job_id))
        seen.set(c.job_id, c.job_title)
    }
    return [...seen.entries()].map(([id, title]) => ({ id, title }))
  }, [conversations])

  const visibleGroups = useMemo(() => {
    let list = grouped.filter(g => !g.threads.every(t => hiddenIds.has(t.id) || deletedIds.has(t.id)))
    list = filterByTab(list, tab)
    if (jobFilter) list = list.filter(g => g.threads.some(t => String(t.job_id) === jobFilter))
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(g => {
        const name = (myRole === 'employer' ? g.peer.candidate_name : g.peer.company_name) ?? ''
        const job  = g.peer.job_title ?? ''
        const msg  = g.peer.latest_message ?? ''
        return name.toLowerCase().includes(q) || job.toLowerCase().includes(q) || msg.toLowerCase().includes(q)
      })
    }
    return list
  }, [grouped, hiddenIds, deletedIds, tab, jobFilter, search, myRole])

  // ── public light branch ────────────────────────────────────────────────
  if (!terminal) {
    return (
      <div className="w-64 border-r border-slate-100 flex flex-col flex-shrink-0">
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">会话</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList && <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-slate-300" /></div>}
          {!loadingList && listError && <div className="px-4 py-6 text-center text-xs text-red-400">{listError}</div>}
          {!loadingList && !listError && conversations.length === 0 && <EmptyConversationState userRole={myRole} terminal={false} />}
          {grouped
            .filter(g => !g.threads.every(t => hiddenIds.has(t.id) || deletedIds.has(t.id)))
            .map(g => (
              <ConversationListItem
                key={g.key} conv={g.peer} isActive={g.threads.some(t => t.id === activeId)}
                onClick={() => onSelect(g)} unreadCount={g.totalUnread}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, g.peer.id) }}
                myRole={myRole} terminal={false}
              />
            ))
          }
        </div>
      </div>
    )
  }

  // ── terminal branch ────────────────────────────────────────────────────
  return (
    <div
      className="msg-conv-list flex flex-col"
      style={{
        borderRight: '1px solid var(--t-border)',
        background: 'var(--t-bg-panel)',
        minHeight: 0,
      }}
    >
      {/* Search */}
      <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{
            position: 'absolute', left: 9, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--t-text-muted)', pointerEvents: 'none',
          }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索姓名、岗位、消息内容"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px 7px 30px',
              fontSize: 13, borderRadius: 8,
              background: 'var(--t-bg-input)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
              outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-border-focus)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-border)' }}
          />
        </div>

        {/* Job filter */}
        {jobOptions.length > 0 && (
          <div style={{ position: 'relative', marginTop: 6, marginBottom: 2 }}>
            <button
              type="button"
              onClick={() => setJobOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '5px 10px',
                fontSize: 12, borderRadius: 8,
                background: jobFilter ? 'var(--t-primary-muted)' : 'var(--t-bg-input)',
                border: `1px solid ${jobFilter ? 'var(--t-primary)' : 'var(--t-border)'}`,
                color: jobFilter ? 'var(--t-primary)' : 'var(--t-text-muted)',
                cursor: 'pointer',
                transition: 'background 120ms, border-color 120ms',
              }}
              onMouseEnter={e => { if (!jobFilter) e.currentTarget.style.borderColor = 'var(--t-border-focus)' }}
              onMouseLeave={e => { if (!jobFilter) e.currentTarget.style.borderColor = 'var(--t-border)' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                {jobFilter ? (jobOptions.find(j => String(j.id) === jobFilter)?.title ?? '全部职位') : '全部职位'}
              </span>
              <ChevronDown size={12} style={{ flexShrink: 0, transform: jobOpen ? 'rotate(180deg)' : undefined, transition: '200ms', marginLeft: 4 }} />
            </button>
            {jobOpen && (
              <div className="t-dropdown-enter" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: 2,
                borderRadius: 8, background: 'var(--t-bg-elevated)',
                border: '1px solid var(--t-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                overflow: 'hidden',
              }}>
                {[{ id: '', title: '全部职位' }, ...jobOptions].map(j => (
                  <button
                    key={String(j.id)} type="button"
                    onClick={() => { setJobFilter(String(j.id)); setJobOpen(false) }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12,
                      color: String(j.id) === jobFilter ? 'var(--t-primary)' : 'var(--t-text-secondary)',
                      background: String(j.id) === jobFilter ? 'var(--t-bg-active)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (String(j.id) !== jobFilter) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
                    onMouseLeave={e => { if (String(j.id) !== jobFilter) e.currentTarget.style.background = 'transparent' }}
                  >
                    {j.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', overflowX: 'auto', flexShrink: 0,
        borderBottom: '1px solid var(--t-border)',
        scrollbarWidth: 'none',
        paddingLeft: 4,
      }}>
        {TABS.map(t => (
          <button
            key={t.key} type="button"
            onClick={() => setTab(t.key)}
            style={{
              flexShrink: 0, padding: '8px 12px',
              fontSize: 12, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--t-primary)' : 'var(--t-text-muted)',
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tab === t.key ? 'var(--t-primary)' : 'transparent'}`,
              cursor: 'pointer', transition: 'color 150ms, border-color 150ms, background 120ms', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { if (tab !== t.key) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
            onMouseLeave={e => { if (tab !== t.key) e.currentTarget.style.background = 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto terminal-scrollbar">
        {loadingList && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--t-text-muted)' }} />
          </div>
        )}
        {!loadingList && listError && (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--t-danger)' }}>
            {listError}
          </div>
        )}
        {!loadingList && !listError && visibleGroups.length === 0 && (
          <EmptyConversationState userRole={myRole} terminal={terminal} />
        )}
        {visibleGroups.map(g => (
          <ConversationListItem
            key={g.key}
            conv={g.peer}
            isActive={g.threads.some(t => t.id === activeId)}
            onClick={() => onSelect(g)}
            unreadCount={g.totalUnread}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, g.peer.id) }}
            myRole={myRole}
            terminal={terminal}
          />
        ))}
      </div>
    </div>
  )
}
