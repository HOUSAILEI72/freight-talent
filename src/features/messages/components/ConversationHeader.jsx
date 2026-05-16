import { useState, useEffect, useRef, useMemo } from 'react'
import { Briefcase } from 'lucide-react'
import { INV_STATUS, INV_STATUS_TERMINAL_STYLE } from '../constants'
import { CandidateEmailActionBar } from './CandidateEmailActionBar'

function InvBadge({ status, terminal = false }) {
  const cfg = INV_STATUS[status] ?? INV_STATUS.pending
  const { Icon } = cfg
  if (terminal) {
    const style = INV_STATUS_TERMINAL_STYLE[status] ?? INV_STATUS_TERMINAL_STYLE.pending
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border" style={style}>
        <Icon size={10} />{cfg.label}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <Icon size={10} />{cfg.label}
    </span>
  )
}

function JobSelector({ threads, activeId, onSelect, terminal }) {
  const [open,        setOpen]        = useState(false)
  const [q,           setQ]           = useState('')
  const [fnFilter,    setFnFilter]    = useState('')
  const [areaFilter,  setAreaFilter]  = useState('')
  const [pos,         setPos]         = useState({ top: 0, left: 0 })
  const ref        = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (!open) { setQ(''); setFnFilter(''); setAreaFilter('') } }, [open])

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(v => !v)
  }

  const activeThread = threads.find(t => t.id === activeId)

  const functions = useMemo(() => {
    const set = new Map()
    for (const t of threads) {
      const code = t.function_code; const name = t.function_name || code
      if (code && !set.has(code)) set.set(code, name)
    }
    return [...set.entries()].map(([code, name]) => ({ code, name }))
  }, [threads])

  const areas = useMemo(() => {
    const set = new Map()
    for (const t of threads) {
      const key = t.province || t.city_name; const label = t.city_name || t.province
      if (key && !set.has(key)) set.set(key, label)
    }
    return [...set.entries()].map(([code, name]) => ({ code, name }))
  }, [threads])

  const filtered = useMemo(() => {
    let list = threads
    if (q.trim()) list = list.filter(t => (t.job_title || '').toLowerCase().includes(q.trim().toLowerCase()))
    if (fnFilter)   list = list.filter(t => t.function_code === fnFilter)
    if (areaFilter) list = list.filter(t => t.province === areaFilter || t.city_name === areaFilter)
    return list
  }, [threads, q, fnFilter, areaFilter])

  const chipBase  = 'px-2 py-0.5 text-[10px] rounded-full border whitespace-nowrap cursor-pointer transition-colors'
  const chipActive = terminal
    ? { borderColor: 'var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)' }
    : { borderColor: '#3b82f6', background: '#eff6ff', color: '#3b82f6' }
  const chipIdle = terminal
    ? { borderColor: 'var(--t-border)', color: 'var(--t-text-muted)' }
    : { borderColor: '#e2e8f0', color: '#94a3b8' }

  return (
    <div className="inline-flex" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        className="text-xs flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors"
        style={terminal ? {
          color: open ? 'var(--t-text)' : 'var(--t-text-secondary)',
          borderColor: open ? 'var(--t-primary)' : 'var(--t-border)',
          background: open ? 'var(--t-primary-muted)' : 'transparent',
          cursor: 'pointer',
        } : {
          color: open ? '#1e40af' : '#475569',
          borderColor: open ? '#3b82f6' : '#cbd5e1',
          background: open ? '#eff6ff' : '#fff',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          if (open) return
          if (terminal) { e.currentTarget.style.borderColor = 'var(--t-text-muted)'; e.currentTarget.style.color = 'var(--t-text)'; e.currentTarget.style.background = 'var(--t-bg-hover)' }
          else { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f8fafc' }
        }}
        onMouseLeave={(e) => {
          if (open) return
          if (terminal) { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)'; e.currentTarget.style.background = 'transparent' }
          else { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#fff' }
        }}
      >
        <Briefcase size={11} className="flex-shrink-0 opacity-60" />
        <span className="truncate max-w-[160px]">{activeThread?.job_title || '—'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="flex-shrink-0 opacity-50" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
          <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          className={terminal ? 'fixed z-[9999] rounded-lg overflow-hidden min-w-[260px]' : 'fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden min-w-[260px]'}
          style={{
            top: pos.top, left: pos.left,
            ...(terminal ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' } : {}),
          }}
        >
          <div className="p-2">
            <input
              value={q} onChange={e => setQ(e.target.value)} placeholder="搜索岗位..."
              className={terminal ? 'w-full px-2.5 py-1.5 text-xs rounded-lg focus:outline-none' : 'w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'}
              style={terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' } : undefined}
            />
          </div>

          {(functions.length > 1 || areas.length > 1) && (
            <div className="px-2 pb-1 space-y-1.5">
              {functions.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>职能</span>
                  <button type="button" onClick={() => setFnFilter('')} className={chipBase} style={!fnFilter ? chipActive : chipIdle}>全部</button>
                  {functions.map(f => (
                    <button key={f.code} type="button" onClick={() => setFnFilter(v => v === f.code ? '' : f.code)} className={chipBase} style={fnFilter === f.code ? chipActive : chipIdle}>{f.name}</button>
                  ))}
                </div>
              )}
              {areas.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>地区</span>
                  <button type="button" onClick={() => setAreaFilter('')} className={chipBase} style={!areaFilter ? chipActive : chipIdle}>全部</button>
                  {areas.map(a => (
                    <button key={a.code} type="button" onClick={() => setAreaFilter(v => v === a.code ? '' : a.code)} className={chipBase} style={areaFilter === a.code ? chipActive : chipIdle}>{a.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ height: 1, background: terminal ? 'var(--t-border-subtle)' : '#e2e8f0' }} />

          <div className="max-h-[220px] overflow-y-auto py-1 terminal-scrollbar">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-center text-slate-400" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>无匹配岗位</p>
            ) : filtered.map(t => (
              <button
                key={t.id} type="button"
                onClick={() => { onSelect(t.id); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors"
                style={terminal ? { color: t.id === activeId ? 'var(--t-text)' : 'var(--t-text-secondary)', background: t.id === activeId ? 'var(--t-bg-active)' : 'transparent' } : { color: t.id === activeId ? '#1e293b' : '#475569', background: t.id === activeId ? '#eff6ff' : 'transparent' }}
                onMouseEnter={(e) => { if (t.id !== activeId) e.currentTarget.style.background = terminal ? 'var(--t-bg-hover)' : '#f8fafc' }}
                onMouseLeave={(e) => { if (t.id !== activeId) e.currentTarget.style.background = 'transparent' }}
              >
                {t.id === activeId ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" style={{ color: terminal ? 'var(--t-primary)' : '#3b82f6' }}>
                    <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : <span className="w-3 flex-shrink-0" />}
                <span className="truncate flex-1">{t.job_title}</span>
                {t.invitation_status && (
                  <span className="flex-shrink-0 text-[10px] opacity-60" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
                    {t.invitation_status === 'accepted' ? '已接受' : t.invitation_status === 'declined' ? '已婉拒' : '待回复'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ConversationHeader({ thread, threadId, threads, onSwitchThread, terminal, myRole }) {
  const otherName = thread?.candidate_name ?? thread?.company_name
  const showEmailBar = (myRole === 'employer' || myRole === 'admin')
    && !!thread?.candidate_id
    && !!thread?.job_id

  return (
    <div
      className={terminal ? 'px-5 py-3.5 flex items-start gap-3 flex-shrink-0' : 'px-5 py-3.5 border-b border-slate-100 flex items-start gap-3 flex-shrink-0'}
      style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
    >
      <div
        className={terminal ? 'w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0' : 'w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0'}
        style={terminal ? { background: 'var(--t-primary)' } : undefined}
      >
        {(otherName?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={terminal ? 'font-semibold text-sm' : 'font-semibold text-slate-800 text-sm'} style={terminal ? { color: 'var(--t-text)' } : undefined}>
            {otherName}
          </p>
          {thread?.invitation_status && <InvBadge status={thread.invitation_status} terminal={terminal} />}
        </div>
        {threads.length > 0 ? (
          <JobSelector threads={threads} activeId={threadId} onSelect={id => onSwitchThread?.(id)} terminal={terminal} />
        ) : (
          <p className={terminal ? 'text-xs' : 'text-xs text-slate-400'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
            {thread?.job_title}
          </p>
        )}
        {showEmailBar && (
          <div style={{ marginTop: 6 }}>
            <CandidateEmailActionBar
              candidateId={thread.candidate_id}
              jobId={thread.job_id}
              threadId={threadId}
              terminal={terminal}
            />
          </div>
        )}
      </div>
    </div>
  )
}
