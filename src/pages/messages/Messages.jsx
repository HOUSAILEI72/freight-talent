import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MessageSquare, Send, Loader2, FolderOpen, AlertCircle,
  Briefcase, CheckCircle, XCircle, Hourglass,
  EyeOff, Trash2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { conversationsApi } from '../../api/conversations'
import { Button } from '../../components/ui/Button'
import { useSocket } from '../../hooks/useSocket'
import { useAutoResize } from '../../hooks/useAutoResize'
import ConnectionBanner from '../../components/messages/ConnectionBanner'
import TypingIndicator from '../../components/messages/TypingIndicator'

// ── 邀约状态徽章 ───────────────────────────────────────────────────────────────
const INV_STATUS = {
  pending:  { label: '待回复', Icon: Hourglass,   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  accepted: { label: '已接受', Icon: CheckCircle, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  declined: { label: '已婉拒', Icon: XCircle,     cls: 'bg-slate-100 text-slate-500 border-slate-200' },
}

// Terminal-mode color tokens for invitation status (matches Phase 7 token map).
// Public mode is unaffected — it still reads from INV_STATUS[status].cls.
const INV_STATUS_TERMINAL_STYLE = {
  pending:  { background: 'rgba(96, 165, 250, 0.12)', color: 'var(--t-chart-blue)', borderColor: 'var(--t-chart-blue)' },
  accepted: { background: 'rgba(34, 197, 94, 0.12)',  color: 'var(--t-success)',    borderColor: 'var(--t-success)' },
  declined: { background: 'var(--t-bg-elevated)',     color: 'var(--t-text-muted)', borderColor: 'var(--t-border)' },
}

function InvBadge({ status, terminal = false }) {
  const cfg = INV_STATUS[status] ?? INV_STATUS.pending
  const { Icon } = cfg

  if (terminal) {
    const style = INV_STATUS_TERMINAL_STYLE[status] ?? INV_STATUS_TERMINAL_STYLE.pending
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border"
        style={style}
      >
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

// ── 右键菜单 ──────────────────────────────────────────────────────────────────
function ContextMenu({ x, y, terminal, onHide, onDelete, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    // 只监听 mousedown 关闭，不监听 contextmenu——
    // 否则触发菜单的右键事件会冒泡到 document 立刻把菜单关掉。
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  const menuStyle = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 9999,
    minWidth: 160,
    borderRadius: 6,
    overflow: 'hidden',
    ...(terminal
      ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }
      : { background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }
    ),
  }

  const itemBase = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 14px',
    fontSize: 13, cursor: 'pointer', border: 'none', background: 'transparent',
    textAlign: 'left',
  }

  return (
    <div ref={ref} style={menuStyle} onClick={(e) => e.stopPropagation()}>
      <button
        style={{ ...itemBase, color: terminal ? 'var(--t-text-secondary)' : '#475569' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = terminal ? 'var(--t-bg-hover)' : '#f1f5f9' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        onClick={() => { onHide(); onClose() }}
      >
        <EyeOff size={14} />不显示此对话
      </button>
      <div style={{ height: 1, background: terminal ? 'var(--t-border-subtle)' : '#e2e8f0', margin: '2px 0' }} />
      <button
        style={{ ...itemBase, color: terminal ? 'var(--t-danger)' : '#ef4444' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = terminal ? 'var(--t-danger-muted)' : '#fef2f2' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        onClick={() => { onDelete(); onClose() }}
      >
        <Trash2 size={14} />删除对话
      </button>
    </div>
  )
}

// ── 会话列表项（含未读角标）────────────────────────────────────────────────────
function ConvItem({ conv, isActive, onClick, onContextMenu, myRole, terminal = false, unreadCount }) {
  const label   = myRole === 'employer' ? conv.candidate_name : conv.company_name
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
          <span
            aria-hidden
            className="absolute left-0 top-2 h-[calc(100%-1rem)] w-0.5 rounded-r"
            style={{ background: 'var(--t-primary)' }}
          />
        )}
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'var(--t-primary)' }}
            >
              {(label?.[0] ?? '?').toUpperCase()}
            </div>
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none"
                style={{ background: 'var(--t-danger)' }}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span
                className={`text-sm truncate ${unread > 0 ? 'font-semibold' : 'font-medium'}`}
                style={{ color: 'var(--t-text)' }}
              >
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

// ── 日期工具 ──────────────────────────────────────────────────────────────────
function msgDateKey(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateLabel(dateKey) {
  const today     = msgDateKey(new Date().toISOString())
  const yesterday = msgDateKey(new Date(Date.now() - 86400000).toISOString())
  if (dateKey === today)     return '今天'
  if (dateKey === yesterday) return '昨天'
  return dateKey
}

// ── 日期分割线 ────────────────────────────────────────────────────────────────
function DateDivider({ dateKey, terminal = false }) {
  if (terminal) {
    return (
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px" style={{ background: 'var(--t-border-subtle)' }} />
        <span
          className="text-[11px] font-medium select-none whitespace-nowrap"
          style={{ color: 'var(--t-text-muted)' }}
        >
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

// ── 单条消息气泡 ───────────────────────────────────────────────────────────────
function Bubble({ msg, isMine, onRetry, terminal = false }) {
  const senderLabel = msg.sender_name
    ?? (msg.sender_role === 'employer' ? '企业' : '候选人')

  const isSending  = msg.status === 'sending'
  const isRetrying = msg.status === 'retrying'
  const isFailed   = msg.status === 'failed'
  const isRead     = msg.is_read

  if (terminal) {
    // ── Terminal mode bubble (token-driven) ─────────────────────────────
    const avatarBg = isMine
      ? (isFailed ? 'var(--t-danger-muted)' : 'var(--t-primary)')
      : 'var(--t-bg-active)'
    const avatarColor = isMine && isFailed ? 'var(--t-danger)' : '#fff'

    let bubbleStyle
    if (isMine) {
      if (isFailed) {
        bubbleStyle = {
          background: 'var(--t-danger-muted)',
          color: 'var(--t-danger)',
          border: '1px solid var(--t-danger)',
        }
      } else {
        bubbleStyle = {
          background: 'var(--t-primary)',
          color: '#fff',
          border: '1px solid rgba(37,99,235,0.7)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        }
      }
    } else {
      bubbleStyle = {
        background: 'var(--t-bg-elevated)',
        color: 'var(--t-text)',
        border: '1px solid var(--t-border)',
      }
    }

    const metaColor = isFailed
      ? 'var(--t-danger)'
      : isMine
        ? 'rgba(255,255,255,0.7)'
        : 'var(--t-text-muted)'

    return (
      <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
        <div
          title={senderLabel}
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: avatarBg, color: avatarColor }}
        >
          {senderLabel[0].toUpperCase()}
        </div>
        <div className="flex flex-col gap-0.5" style={{ maxWidth: '65%' }}>
          {!isMine && (
            <span className="text-[10px] ml-1" style={{ color: 'var(--t-text-muted)' }}>{senderLabel}</span>
          )}
          <div
            className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed transition-opacity ${
              isMine ? 'rounded-br-sm' : 'rounded-bl-sm'
            } ${(isSending || isRetrying) ? 'opacity-60' : ''}`}
            style={bubbleStyle}
          >
            {msg.content}
            <p className="text-[10px] mt-1" style={{ color: metaColor }}>
              {isSending
                ? '发送中…'
                : isRetrying
                  ? `重试中${msg._retryLabel ?? ''}…`
                  : msg.created_at?.slice(11, 16)
              }
              {isMine && !isSending && !isRetrying && !isFailed && (
                <span className="ml-1 select-none">
                  {isRead ? '✓✓' : '✓'}
                </span>
              )}
            </p>
          </div>
          {isFailed && (
            <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'justify-end' : ''}`}>
              <span className="text-[10px]" style={{ color: 'var(--t-danger)' }}>
                {msg._errorMsg ?? '发送失败'}
              </span>
              <button
                onClick={() => onRetry?.(msg._tempId, msg.content)}
                className="text-[10px] font-medium underline underline-offset-2"
                style={{ color: 'var(--t-chart-blue)' }}
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Public (light) mode bubble — original markup unchanged ──────────────
  return (
    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
      <div
        title={senderLabel}
        className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${
          isMine ? (isFailed ? 'bg-red-400' : 'bg-blue-500') : 'bg-slate-400'
        }`}
      >
        {senderLabel[0].toUpperCase()}
      </div>
      <div className="flex flex-col gap-0.5" style={{ maxWidth: '65%' }}>
        {!isMine && (
          <span className="text-[10px] text-slate-400 ml-1">{senderLabel}</span>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed transition-opacity ${
          isMine
            ? `rounded-br-sm ${isFailed ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-blue-600 text-white'} ${(isSending || isRetrying) ? 'opacity-60' : ''}`
            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
        }`}>
          {msg.content}
          <p className={`text-[10px] mt-1 ${
            isFailed ? 'text-red-400' : isMine ? 'text-blue-200' : 'text-slate-400'
          }`}>
            {isSending
              ? '发送中…'
              : isRetrying
                ? `重试中${msg._retryLabel ?? ''}…`
                : msg.created_at?.slice(11, 16)
            }
            {/* 已读回执 */}
            {isMine && !isSending && !isRetrying && !isFailed && (
              <span className="ml-1 select-none">
                {isRead ? '✓✓' : '✓'}
              </span>
            )}
          </p>
        </div>
        {isFailed && (
          <div className={`flex items-center gap-1.5 mt-0.5 ${isMine ? 'justify-end' : ''}`}>
            <span className="text-[10px] text-red-500">
              {msg._errorMsg ?? '发送失败'}
            </span>
            <button
              onClick={() => onRetry?.(msg._tempId, msg.content)}
              className="text-[10px] text-blue-500 hover:text-blue-700 font-medium underline underline-offset-2"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 岗位选择下拉（消息面板 header 内用）───────────────────────────────────────
function JobSelector({ threads, activeId, onSelect, terminal }) {
  const [open, setOpen]       = useState(false)
  const [q, setQ]             = useState('')
  const [fnFilter, setFnFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [pos, setPos]          = useState({ top: 0, left: 0 })
  const ref = useRef(null)
  const triggerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle() {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(v => !v)
  }

  // 关闭时清空搜索词和筛选
  useEffect(() => { if (!open) { setQ(''); setFnFilter(''); setAreaFilter('') } }, [open])

  const activeThread = threads.find(t => t.id === activeId)

  // 提取所有 function / area 选项
  const functions = useMemo(() => {
    const set = new Map()
    for (const t of threads) {
      const code = t.function_code
      const name = t.function_name || code
      if (code && !set.has(code)) set.set(code, name)
    }
    return [...set.entries()].map(([code, name]) => ({ code, name }))
  }, [threads])

  const areas = useMemo(() => {
    const set = new Map()
    for (const t of threads) {
      const key = t.province || t.city_name
      const label = t.city_name || t.province
      if (key && !set.has(key)) set.set(key, label)
    }
    return [...set.entries()].map(([code, name]) => ({ code, name }))
  }, [threads])

  // 过滤
  const filtered = useMemo(() => {
    let list = threads
    if (q.trim()) {
      const kw = q.trim().toLowerCase()
      list = list.filter(t => (t.job_title || '').toLowerCase().includes(kw))
    }
    if (fnFilter) list = list.filter(t => t.function_code === fnFilter)
    if (areaFilter) list = list.filter(t => t.province === areaFilter || t.city_name === areaFilter)
    return list
  }, [threads, q, fnFilter, areaFilter])

  const inputBg    = terminal ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' } : undefined
  const chipBase   = terminal
    ? 'px-2 py-0.5 text-[10px] rounded-full border whitespace-nowrap cursor-pointer transition-colors'
    : 'px-2 py-0.5 text-[10px] rounded-full border whitespace-nowrap cursor-pointer transition-colors'
  const itemBase   = terminal
    ? 'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors'
    : 'w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors'

  return (
    <div className="inline-flex" ref={ref}>
      {/* 触发器 —— 显眼的可点击下拉按钮 */}
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        className={terminal
          ? 'text-xs flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors'
          : 'text-xs flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors'}
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
          if (terminal) {
            e.currentTarget.style.borderColor = 'var(--t-text-muted)'
            e.currentTarget.style.color = 'var(--t-text)'
            e.currentTarget.style.background = 'var(--t-bg-hover)'
          } else {
            e.currentTarget.style.borderColor = '#94a3b8'
            e.currentTarget.style.background = '#f8fafc'
          }
        }}
        onMouseLeave={(e) => {
          if (open) return
          if (terminal) {
            e.currentTarget.style.borderColor = 'var(--t-border)'
            e.currentTarget.style.color = 'var(--t-text-secondary)'
            e.currentTarget.style.background = 'transparent'
          } else {
            e.currentTarget.style.borderColor = '#cbd5e1'
            e.currentTarget.style.color = '#475569'
            e.currentTarget.style.background = '#fff'
          }
        }}
      >
        <Briefcase size={11} className="flex-shrink-0 opacity-60" />
        <span className="truncate max-w-[160px]">{activeThread?.job_title || '—'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="flex-shrink-0 opacity-50" style={{ transform: open ? 'rotate(180deg)' : undefined }}>
          <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* 下拉面板（fixed 定位，不受父容器 overflow:hidden 影响） */}
      {open && (
        <div
          className={terminal
            ? 'fixed z-[9999] rounded-lg overflow-hidden min-w-[260px]'
            : 'fixed z-[9999] rounded-lg border border-slate-200 bg-white shadow-xl overflow-hidden min-w-[260px]'}
          style={{
            top: pos.top,
            left: pos.left,
            ...(terminal ? {
              background: 'var(--t-bg-elevated)',
              border: '1px solid var(--t-border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            } : {}),
          }}
        >
          {/* 搜索框 */}
          <div className="p-2">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="搜索岗位..."
              className={terminal
                ? 'w-full px-2.5 py-1.5 text-xs rounded-lg focus:outline-none'
                : 'w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'}
              style={inputBg}
            />
          </div>

          {/* 筛选 chip 行 */}
          {(functions.length > 1 || areas.length > 1) && (
            <div className="px-2 pb-1 space-y-1.5">
              {functions.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>职能</span>
                  <button
                    type="button"
                    onClick={() => setFnFilter('')}
                    className={chipBase}
                    style={!fnFilter ? (terminal ? { borderColor: 'var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)' } : { borderColor: '#3b82f6', background: '#eff6ff', color: '#3b82f6' }) : (terminal ? { borderColor: 'var(--t-border)', color: 'var(--t-text-muted)' } : { borderColor: '#e2e8f0', color: '#94a3b8' })}
                  >全部</button>
                  {functions.map(f => (
                    <button
                      key={f.code}
                      type="button"
                      onClick={() => setFnFilter(v => v === f.code ? '' : f.code)}
                      className={chipBase}
                      style={fnFilter === f.code ? (terminal ? { borderColor: 'var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)' } : { borderColor: '#3b82f6', background: '#eff6ff', color: '#3b82f6' }) : (terminal ? { borderColor: 'var(--t-border)', color: 'var(--t-text-muted)' } : { borderColor: '#e2e8f0', color: '#94a3b8' })}
                    >{f.name}</button>
                  ))}
                </div>
              )}
              {areas.length > 1 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-400 flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>地区</span>
                  <button
                    type="button"
                    onClick={() => setAreaFilter('')}
                    className={chipBase}
                    style={!areaFilter ? (terminal ? { borderColor: 'var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)' } : { borderColor: '#3b82f6', background: '#eff6ff', color: '#3b82f6' }) : (terminal ? { borderColor: 'var(--t-border)', color: 'var(--t-text-muted)' } : { borderColor: '#e2e8f0', color: '#94a3b8' })}
                  >全部</button>
                  {areas.map(a => (
                    <button
                      key={a.code}
                      type="button"
                      onClick={() => setAreaFilter(v => v === a.code ? '' : a.code)}
                      className={chipBase}
                      style={areaFilter === a.code ? (terminal ? { borderColor: 'var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)' } : { borderColor: '#3b82f6', background: '#eff6ff', color: '#3b82f6' }) : (terminal ? { borderColor: 'var(--t-border)', color: 'var(--t-text-muted)' } : { borderColor: '#e2e8f0', color: '#94a3b8' })}
                    >{a.name}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 分隔线 */}
          <div style={{ height: 1, background: terminal ? 'var(--t-border-subtle)' : '#e2e8f0' }} />

          {/* 岗位列表 */}
          <div className="max-h-[220px] overflow-y-auto py-1 terminal-scrollbar">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-center text-slate-400" style={terminal ? { color: 'var(--t-text-muted)' } : undefined}>
                无匹配岗位
              </p>
            ) : filtered.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => { onSelect(t.id); setOpen(false) }}
                className={itemBase}
                style={terminal ? {
                  color: t.id === activeId ? 'var(--t-text)' : 'var(--t-text-secondary)',
                  background: t.id === activeId ? 'var(--t-bg-active)' : 'transparent',
                } : {
                  color: t.id === activeId ? '#1e293b' : '#475569',
                  background: t.id === activeId ? '#eff6ff' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (t.id === activeId) return
                  e.currentTarget.style.background = terminal ? 'var(--t-bg-hover)' : '#f8fafc'
                }}
                onMouseLeave={(e) => {
                  if (t.id === activeId) return
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {t.id === activeId ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="flex-shrink-0" style={{ color: terminal ? 'var(--t-primary)' : '#3b82f6' }}>
                    <path d="M2 6 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="w-3 flex-shrink-0" />
                )}
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

// ── 消息面板 ──────────────────────────────────────────────────────────────────
function MessagePanel({ threadId, myUserId, myRole, onRead, socket, connectionStatus, onConversationUpdated, terminal = false, threads = [], onSwitchThread }) {
  const [thread,      setThread]      = useState(null)
  const [messages,    setMessages]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [msgError,    setMsgError]    = useState('')
  const [hasMore,     setHasMore]     = useState(false)
  const [nextBefore,  setNextBefore]  = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [input,       setInput]       = useState('')
  const inputRef = useAutoResize(input, { maxRows: 6, lineHeight: 22 })
  const [isTyping,    setIsTyping]    = useState(false)

  const bottomRef      = useRef(null)
  const topAnchorRef   = useRef(null)
  const onReadRef      = useRef(onRead)
  const tempIdRef      = useRef(0)
  const loadingMoreRef = useRef(false)
  const shouldScrollRef = useRef(false)
  const typingTimerRef  = useRef(null)  // 停止输入后清除 typing 状态的 timer
  const typingClearRef  = useRef(null)  // 收到对方 typing 事件后的 3s 保底清除 timer
  const retryTimersRef  = useRef({})    // tempId → setTimeout handle

  useEffect(() => { onReadRef.current = onRead }, [onRead])

  // 统一的滚底函数
  const scrollToBottom = useCallback((behavior = 'instant') => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
    })
  }, [])

  // ── API helpers ────────────────────────────────────────────────────────────
  const initialFetch = useCallback(() => {
    conversationsApi.getConversationMessages(threadId)
      .then(res => {
        setThread(res.data.thread)
        setMessages(res.data.messages)
        setHasMore(res.data.has_more)
        setNextBefore(res.data.next_before)
        setMsgError('')
        onReadRef.current?.(threadId)
        shouldScrollRef.current = true
      })
      .catch(err => {
        console.error('Failed to load messages:', {
          threadId,
          status: err.response?.status,
          data: err.response?.data,
          code: err.code,
          message: err.message,
        })
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载消息失败'
        setMsgError(errMsg)
      })
      .finally(() => setLoading(false))
  }, [threadId])

  const pollFetch = useCallback(() => {
    conversationsApi.getConversationMessages(threadId)
      .then(res => {
        setThread(res.data.thread)
        setMessages(prev => {
          const existingIds = new Set(prev.filter(m => m.id != null).map(m => m.id))
          const incoming    = res.data.messages ?? []
          const newOnes     = incoming.filter(m => !existingIds.has(m.id))
          if (newOnes.length === 0) return prev
          onReadRef.current?.(threadId)
          shouldScrollRef.current = true
          return [...prev, ...newOnes]
        })
      })
      .catch(() => {})
  }, [threadId])

  // 初始加载 + 降频轮询（30s fallback）
  useEffect(() => {
    setLoading(true)
    setMessages([])
    setThread(null)
    setHasMore(false)
    setNextBefore(null)
    shouldScrollRef.current = false
    loadingMoreRef.current  = false
    initialFetch()
    const timer = setInterval(pollFetch, 30000)
    return () => clearInterval(timer)
  }, [initialFetch, pollFetch])

  // 重连后立即 re-fetch
  useEffect(() => {
    if (connectionStatus === 'connected' && threadId && !loading) {
      pollFetch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionStatus])

  // 统一滚动 effect
  useEffect(() => {
    if (shouldScrollRef.current && !loadingMoreRef.current) {
      shouldScrollRef.current = false
      scrollToBottom()
    }
  }, [messages, scrollToBottom])

  // ── Socket 事件 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket || !threadId) return

    socket.emit('join_thread', { thread_id: threadId })
    // 进入 thread 时立即发送 mark_read
    socket.emit('mark_read', { thread_id: threadId })

    const onNewMessage = (msg) => {
      setMessages(prev => {
        // 去重：若已存在（tempId 匹配或 id 匹配）则用服务端数据替换 temp
        const hasTempForThis = prev.some(m => m._tempId && m.sender_user_id === myUserId && m.content === msg.content && !m.id)
        if (prev.some(m => m.id === msg.id)) return prev  // 已存在，忽略
        if (hasTempForThis) {
          // 找到对应的 temp 消息（最新的那个同内容 temp）替换
          let replaced = false
          return prev.map(m => {
            if (!replaced && m._tempId && m.sender_user_id === myUserId && m.content === msg.content && !m.id) {
              replaced = true
              return msg
            }
            return m
          })
        }
        // 纯推送（对方消息）
        shouldScrollRef.current = true
        return [...prev, msg]
      })
      // 通知已读
      socket.emit('mark_read', { thread_id: threadId })
      onReadRef.current?.(threadId)
      shouldScrollRef.current = true
    }

    const onMessagesRead = ({ thread_id, reader_user_id }) => {
      if (thread_id !== threadId) return
      if (reader_user_id === myUserId) return  // 自己读的，不需要更新
      setMessages(prev =>
        prev.map(m =>
          m.sender_user_id === myUserId && !m.is_read
            ? { ...m, is_read: true }
            : m
        )
      )
    }

    const onTyping = ({ thread_id, user_id, is_typing }) => {
      if (thread_id !== threadId) return
      if (user_id === myUserId) return  // 跳过自己
      setIsTyping(is_typing)
      if (is_typing) {
        // 3s 保底清除（防止对方断线没有发 false）
        clearTimeout(typingClearRef.current)
        typingClearRef.current = setTimeout(() => setIsTyping(false), 3000)
        // typing 时滚底，让 indicator 可见
        shouldScrollRef.current = true
      } else {
        clearTimeout(typingClearRef.current)
      }
    }

    socket.on('new_message',    onNewMessage)
    socket.on('messages_read',  onMessagesRead)
    socket.on('typing',         onTyping)

    return () => {
      socket.emit('leave_thread', { thread_id: threadId })
      socket.off('new_message',   onNewMessage)
      socket.off('messages_read', onMessagesRead)
      socket.off('typing',        onTyping)
      clearTimeout(typingClearRef.current)
    }
  }, [socket, threadId, myUserId])

  // ── Load more ──────────────────────────────────────────────────────────────
  function handleLoadMore() {
    if (!nextBefore || loadingMoreRef.current) return
    setLoadingMore(true)
    loadingMoreRef.current = true
    conversationsApi.getConversationMessages(threadId, { before: nextBefore })
      .then(res => {
        const older = res.data.messages ?? []
        setMessages(prev => {
          const existingIds = new Set(prev.filter(m => m.id != null).map(m => m.id))
          return [...older.filter(m => !existingIds.has(m.id)), ...prev]
        })
        setHasMore(res.data.has_more)
        setNextBefore(res.data.next_before)
        requestAnimationFrame(() => {
          topAnchorRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
        })
      })
      .catch(() => {})
      .finally(() => {
        setLoadingMore(false)
        loadingMoreRef.current = false
      })
  }

  // ── Send with auto-retry ───────────────────────────────────────────────────
  function sendWithRetry(content, tempId, attempt = 0) {
    conversationsApi.sendConversationMessage(threadId, content)
      .then(res => {
        const serverMsg = res.data.message
        // 清除该 tempId 的重试 timer
        clearTimeout(retryTimersRef.current[tempId])
        delete retryTimersRef.current[tempId]

        setMessages(prev => {
          if (prev.some(m => m.id === serverMsg.id)) {
            // socket 推送已先到，去掉 temp 占位
            return prev.filter(m => m._tempId !== tempId)
          }
          shouldScrollRef.current = true
          return prev.map(m => m._tempId === tempId ? serverMsg : m)
        })
      })
      .catch(err => {
        const maxAttempts = 3
        if (attempt < maxAttempts - 1) {
          // 标记"重试中"
          const retryLabel = ` (第${attempt + 2}次)`
          setMessages(prev =>
            prev.map(m => m._tempId === tempId
              ? { ...m, status: 'retrying', _retryLabel: retryLabel }
              : m
            )
          )
          retryTimersRef.current[tempId] = setTimeout(() => {
            sendWithRetry(content, tempId, attempt + 1)
          }, 2000)
        } else {
          // 最终失败
          clearTimeout(retryTimersRef.current[tempId])
          delete retryTimersRef.current[tempId]
          const errMsg = err.response?.data?.message ?? '发送失败，请重试'
          setMessages(prev =>
            prev.map(m => m._tempId === tempId
              ? { ...m, status: 'failed', _errorMsg: errMsg, _retryLabel: undefined }
              : m
            )
          )
        }
      })
  }

  function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    const tempId   = `_tmp_${++tempIdRef.current}`
    const localMsg = {
      _tempId:        tempId,
      id:             undefined,
      sender_user_id: myUserId,
      sender_role:    myRole,
      sender_name:    null,
      content:        text,
      created_at:     new Date().toISOString(),
      status:         'sending',
      is_read:        false,
    }
    shouldScrollRef.current = true
    setMessages(prev => [...prev, localMsg])
    setInput('')
    // 发送时停止 typing 状态
    clearTimeout(typingTimerRef.current)
    if (socket) socket.emit('typing', { thread_id: threadId, is_typing: false })
    sendWithRetry(text, tempId, 0)
  }

  function handleRetry(tempId, content) {
    shouldScrollRef.current = true
    setMessages(prev =>
      prev.map(m => m._tempId === tempId
        ? { ...m, status: 'sending', _errorMsg: undefined, _retryLabel: undefined }
        : m
      )
    )
    sendWithRetry(content, tempId, 0)
  }

  // ── Typing 防抖 ────────────────────────────────────────────────────────────
  function handleInputChange(e) {
    setInput(e.target.value)
    if (!socket) return
    // 发送 is_typing: true
    socket.emit('typing', { thread_id: threadId, is_typing: true })
    // 1s 无输入后发 is_typing: false
    clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing', { thread_id: threadId, is_typing: false })
    }, 1000)
  }

  // 清理重试 timer（组件卸载时）
  useEffect(() => {
    return () => {
      Object.values(retryTimersRef.current).forEach(clearTimeout)
      clearTimeout(typingTimerRef.current)
    }
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="flex-1 flex items-center justify-center gap-2"
        style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
      >
        <Loader2 size={20} className={terminal ? 'animate-spin' : 'animate-spin text-slate-400'} />
        <span className={terminal ? 'text-sm' : 'text-sm text-slate-400'}>加载消息...</span>
      </div>
    )
  }
  if (msgError) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center gap-2"
        style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
      >
        <AlertCircle size={28} style={terminal ? { color: 'var(--t-danger)' } : undefined} className={terminal ? '' : 'text-red-300'} />
        <p className="text-sm" style={terminal ? { color: 'var(--t-danger)' } : undefined}>
          {!terminal && <span className="text-red-500">{msgError}</span>}
          {terminal && msgError}
        </p>
      </div>
    )
  }

  const otherName = myRole === 'employer' ? thread?.candidate_name : thread?.company_name

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Panel header */}
      <div
        className={
          terminal
            ? 'px-5 py-3.5 flex items-center gap-3 flex-shrink-0'
            : 'px-5 py-3.5 border-b border-slate-100 flex items-center gap-3 flex-shrink-0'
        }
        style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
      >
        <div
          className={
            terminal
              ? 'w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm'
              : 'w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm'
          }
          style={terminal ? { background: 'var(--t-primary)' } : undefined}
        >
          {(otherName?.[0] ?? '?').toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p
              className={terminal ? 'font-semibold text-sm' : 'font-semibold text-slate-800 text-sm'}
              style={terminal ? { color: 'var(--t-text)' } : undefined}
            >
              {otherName}
            </p>
            {thread?.invitation_status && <InvBadge status={thread.invitation_status} terminal={terminal} />}
          </div>
          {/* 岗位选择下拉 */}
          {threads.length > 0 ? (
            <JobSelector
              threads={threads}
              activeId={threadId}
              onSelect={(id) => onSwitchThread?.(id)}
              terminal={terminal}
            />
          ) : (
            <p
              className={terminal ? 'text-xs' : 'text-xs text-slate-400'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              {thread?.job_title}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className={
          terminal
            ? 'flex-1 overflow-y-auto px-5 py-4 space-y-3 terminal-scrollbar'
            : 'flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50/40'
        }
        style={terminal ? { background: 'var(--t-bg)' } : undefined}
      >
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className={
                terminal
                  ? 'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors disabled:opacity-50'
                  : 'flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-full hover:border-slate-300 hover:text-slate-700 transition-colors disabled:opacity-50'
              }
              style={
                terminal
                  ? {
                      background: 'var(--t-bg-panel)',
                      border: '1px solid var(--t-border)',
                      color: 'var(--t-text-secondary)',
                    }
                  : undefined
              }
            >
              {loadingMore
                ? <><Loader2 size={11} className="animate-spin" />加载中...</>
                : '加载更多历史消息'
              }
            </button>
          </div>
        )}
        <div ref={topAnchorRef} />

        {messages.length === 0 && (
          <div
            className={terminal ? 'text-center text-sm py-12' : 'text-center text-sm text-slate-400 py-12'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            暂无消息，发一条开始沟通吧
          </div>
        )}
        {messages.map((msg, idx) => {
          const key     = msg._tempId ?? msg.id
          const curKey  = msgDateKey(msg.created_at)
          const prevKey = idx > 0 ? msgDateKey(messages[idx - 1].created_at) : null
          const showDivider = curKey && curKey !== prevKey
          return (
            <div key={key}>
              {showDivider && <DateDivider dateKey={curKey} terminal={terminal} />}
              <Bubble
                msg={msg}
                isMine={msg.sender_user_id === myUserId}
                onRetry={handleRetry}
                terminal={terminal}
              />
            </div>
          )
        })}
        <TypingIndicator visible={isTyping} terminal={terminal} />
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className={
          terminal
            ? 'px-4 py-3 flex-shrink-0'
            : 'px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0'
        }
        style={
          terminal
            ? { borderTop: '1px solid var(--t-border-subtle)', background: 'var(--t-bg-panel)' }
            : undefined
        }
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
            }}
            className={
              terminal
                ? 'flex-1 px-3 py-2 text-sm rounded-xl focus:outline-none resize-none'
                : 'flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none'
            }
            style={
              terminal
                ? {
                    background: 'var(--t-bg-input)',
                    border: '1px solid var(--t-border)',
                    color: 'var(--t-text)',
                  }
                : undefined
            }
          />
          <Button type="submit" size="sm" disabled={!input.trim()} className="flex-shrink-0">
            <Send size={13} />发送
          </Button>
        </div>
      </form>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function Messages({ terminal = false, basePath = '/messages' }) {
  const { threadId: paramThreadId } = useParams()
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [conversations, setConversations] = useState([])
  const [loadingList,   setLoadingList]   = useState(true)
  const [listError,     setListError]     = useState('')
  const [activeId,      setActiveId]      = useState(paramThreadId ? Number(paramThreadId) : null)

  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, convId }

  // hidden: 不显示（新消息到达自动重现）；deleted: 删除（永久隐藏直到手动清除）
  const storageKey = user?.id ? `msg_hidden_${user.id}` : null
  const deletedKey = user?.id ? `msg_deleted_${user.id}` : null

  const [hiddenIds,  setHiddenIds]  = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`msg_hidden_${user?.id}`) ?? '[]')) }
    catch { return new Set() }
  })
  const [deletedIds, setDeletedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`msg_deleted_${user?.id}`) ?? '[]')) }
    catch { return new Set() }
  })

  // Socket
  const { socket, connectionStatus } = useSocket(!!user)

  // 持久化 hiddenIds / deletedIds 到 localStorage
  useEffect(() => {
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify([...hiddenIds]))
  }, [hiddenIds, storageKey])
  useEffect(() => {
    if (deletedKey) localStorage.setItem(deletedKey, JSON.stringify([...deletedIds]))
  }, [deletedIds, deletedKey])

  function hideConv(convId) {
    setHiddenIds(prev => new Set([...prev, convId]))
    if (activeId === convId) setActiveId(null)
  }

  function deleteConv(convId) {
    if (!window.confirm('确定删除此对话？删除后将不再显示，已有消息不会被清除。')) return
    setDeletedIds(prev => new Set([...prev, convId]))
    setHiddenIds(prev => { const next = new Set(prev); next.delete(convId); return next })
    if (activeId === convId) setActiveId(null)
  }

  const activeIdRef = useRef(activeId)
  useEffect(() => { activeIdRef.current = activeId }, [activeId])

  const readThreadsRef = useRef(new Set())

  const mergeConversations = useCallback((incoming) => {
    setConversations(prev => {
      const localUnread = {}
      for (const c of prev) {
        if (readThreadsRef.current.has(c.id)) {
          localUnread[c.id] = c.unread_count
        }
      }

      const merged = incoming.map(c => ({
        ...c,
        unread_count: (c.id === activeIdRef.current && localUnread[c.id] === 0)
          ? 0
          : c.unread_count,
      }))

      merged.sort((a, b) => {
        const ta = a.latest_message_at ?? a.updated_at ?? ''
        const tb = b.latest_message_at ?? b.updated_at ?? ''
        return tb.localeCompare(ta)
      })

      return merged
    })
  }, [])

  const fetchConversations = useCallback((isInitial = false) => {
    if (isInitial) setLoadingList(true)
    conversationsApi.getMyConversations()
      .then(res => {
        const convs = res.data.conversations ?? []
        if (isInitial) {
          setConversations(convs)
          setListError('')
          if (!paramThreadId && convs.length > 0) {
            setActiveId(convs[0].id)
            navigate(`${basePath}/${convs[0].id}`, { replace: true })
          }
        } else {
          mergeConversations(convs)
        }
      })
      .catch(err => {
        // Dev visibility: surface backend status + payload + URL so the next
        // 500 won't be silently swallowed as "加载会话失败".
        // eslint-disable-next-line no-console
        console.error('Failed to load conversations:', {
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url,
          method: err.config?.method,
        })
        const data = err.response?.data
        const message =
          data?.message ||
          data?.error ||
          data?.detail ||
          data?.msg ||
          '加载会话失败'
        if (isInitial) setListError(message)
      })
      .finally(() => { if (isInitial) setLoadingList(false) })
  }, [mergeConversations, navigate, paramThreadId])

  // Initial load
  useEffect(() => {
    startTransition(() => { fetchConversations(true) })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 降频轮询（60s fallback）
  useEffect(() => {
    const timer = setInterval(() => startTransition(() => { fetchConversations(false) }), 60000)
    return () => clearInterval(timer)
  }, [fetchConversations])

  // Sync URL param → activeId
  useEffect(() => {
    if (paramThreadId) startTransition(() => { setActiveId(Number(paramThreadId)) })
  }, [paramThreadId])

  // Socket: conversation_updated 实时更新会话列表
  useEffect(() => {
    if (!socket) return
    const onConversationUpdated = (data) => {
      // 新消息到达时，将该对话从"不显示"列表移除（deleted 的不受影响）
      if (data.sender_user_id !== user?.id) {
        setHiddenIds(prev => {
          if (!prev.has(data.thread_id)) return prev
          const next = new Set(prev); next.delete(data.thread_id); return next
        })
      }
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id !== data.thread_id) return c
          return {
            ...c,
            latest_message:    data.latest_message,
            latest_message_at: data.latest_message_at ?? data.updated_at,
            updated_at:        data.updated_at,
            // 若是对方发的，且不是当前激活的 thread，则增加未读
            unread_count: (data.sender_user_id !== user?.id && c.id !== activeIdRef.current)
              ? (c.unread_count ?? 0) + 1
              : c.unread_count,
          }
        })
        // 重新排序
        updated.sort((a, b) => {
          const ta = a.latest_message_at ?? a.updated_at ?? ''
          const tb = b.latest_message_at ?? b.updated_at ?? ''
          return tb.localeCompare(ta)
        })
        return updated
      })
    }

    socket.on('conversation_updated', onConversationUpdated)
    return () => socket.off('conversation_updated', onConversationUpdated)
  }, [socket, user?.id])

  // Called by MessagePanel after fetching (backend has marked as read)
  const handleThreadRead = useCallback((threadId) => {
    readThreadsRef.current.add(threadId)
    setConversations(prev =>
      prev.map(c => c.id === threadId ? { ...c, unread_count: 0 } : c)
    )
  }, [])

  // ── 按对方 user 分组合并 ──────────────────────────────────────────────────
  const grouped = useMemo(() => {
    if (!user || user.role === 'admin') {
      return conversations.map(c => ({
        key: String(c.id),
        peer: c,
        threads: [c],
        totalUnread: c.unread_count ?? 0,
      }))
    }
    const map = new Map()
    for (const c of conversations) {
      const gk = user.role === 'employer' ? `c_${c.candidate_id}` : `e_${c.employer_id}`
      if (!map.has(gk)) map.set(gk, [])
      map.get(gk).push(c)
    }
    return [...map.entries()].map(([key, threads]) => {
      const sorted = threads.sort((a, b) =>
        (b.latest_message_at ?? '') > (a.latest_message_at ?? '') ? 1 : -1)
      // 同一 job_id 只保留最新一条 thread
      const seen = new Set()
      const deduped = sorted.filter(t => {
        if (seen.has(t.job_id)) return false
        seen.add(t.job_id)
        return true
      })
      return {
        key,
        peer: deduped[0],
        threads: deduped,
        totalUnread: deduped.reduce((s, t) => s + (t.unread_count ?? 0), 0),
      }
    }).sort((a, b) =>
      (b.peer.latest_message_at ?? '') > (a.peer.latest_message_at ?? '') ? 1 : -1)
  }, [conversations, user])

  const activeGroup = useMemo(
    () => grouped.find(g => g.threads.some(t => t.id === activeId)) ?? null,
    [grouped, activeId],
  )

  function handleSelect(group) {
    const tid = group.peer.id
    setActiveId(tid)
    navigate(`${basePath}/${tid}`)
  }

  return (
    <div
      className={
        terminal
          ? 'terminal-mode flex flex-1 w-full min-w-0 flex-col h-full min-h-0 overflow-hidden px-4 py-4'
          : 'max-w-6xl mx-auto px-4 py-6'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
      onClick={() => ctxMenu && setCtxMenu(null)}
    >
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          terminal={terminal}
          onHide={() => hideConv(ctxMenu.convId)}
          onDelete={() => deleteConv(ctxMenu.convId)}
          onClose={() => setCtxMenu(null)}
        />
      )}
      <ConnectionBanner status={connectionStatus} terminal={terminal} />

      <div className="mb-4 flex items-center gap-2">
        <h1
          className={
            terminal
              ? 'text-xl font-bold flex items-center gap-2'
              : 'text-xl font-bold text-slate-800 flex items-center gap-2'
          }
          style={terminal ? { color: 'var(--t-text)' } : undefined}
        >
          <MessageSquare size={20} style={terminal ? { color: 'var(--t-chart-blue)' } : undefined} className={terminal ? '' : 'text-blue-500'} />消息
        </h1>
      </div>

      <div
        className={
          terminal
            ? 'flex flex-1 min-h-0 border overflow-hidden'
            : 'flex rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm'
        }
        style={
          terminal
            ? { borderColor: 'var(--t-border)', background: 'var(--t-bg-panel)' }
            : { height: 'calc(100vh - 180px)', minHeight: 500 }
        }
      >
        {/* Left: conversation list */}
        <div
          className={
            terminal
              ? 'terminal-split-sidebar flex flex-col flex-shrink-0'
              : 'w-64 border-r border-slate-100 flex flex-col flex-shrink-0'
          }
          style={terminal ? { borderRight: '1px solid var(--t-border)' } : undefined}
        >
          <div
            className={
              terminal
                ? 'px-4 py-3'
                : 'px-4 py-3 border-b border-slate-100'
            }
            style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
          >
            <p
              className={
                terminal
                  ? 'text-xs font-semibold uppercase tracking-wide'
                  : 'text-xs font-semibold text-slate-500 uppercase tracking-wide'
              }
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              会话
            </p>
          </div>
          <div className={terminal ? 'flex-1 overflow-y-auto terminal-scrollbar' : 'flex-1 overflow-y-auto'}>
            {loadingList && (
              <div className="flex justify-center py-8">
                <Loader2
                  size={18}
                  className="animate-spin"
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                />
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
              <div
                className={
                  terminal
                    ? 'flex flex-col items-center justify-center py-12 px-4 text-center'
                    : 'flex flex-col items-center justify-center py-12 text-slate-400 px-4 text-center'
                }
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                <FolderOpen size={28} className={terminal ? 'mb-2' : 'mb-2 text-slate-300'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined} />
                <p className="text-xs">
                  {user?.role === 'employer'
                    ? '向候选人发出邀约后，沟通入口将出现在这里'
                    : '收到企业邀约后，沟通入口将出现在这里'}
                </p>
              </div>
            )}
            {grouped
              .filter(g => !g.threads.every(t => hiddenIds.has(t.id) || deletedIds.has(t.id)))
              .map(g => (
                <ConvItem
                  key={g.key}
                  conv={g.peer}
                  isActive={g.threads.some(t => t.id === activeId)}
                  onClick={() => handleSelect(g)}
                  unreadCount={g.totalUnread}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setCtxMenu({ x: e.clientX, y: e.clientY, convId: g.peer.id })
                  }}
                  myRole={user?.role}
                  terminal={terminal}
                />
              ))
            }
          </div>
        </div>

        {/* Right: message panel */}
        {activeId ? (
          <MessagePanel
            key={activeId}
            threadId={activeId}
            threads={activeGroup?.threads ?? []}
            onSwitchThread={(tid) => { setActiveId(tid); navigate(`${basePath}/${tid}`) }}
            myUserId={user?.id}
            myRole={user?.role}
            onRead={handleThreadRead}
            socket={socket}
            connectionStatus={connectionStatus}
            terminal={terminal}
          />
        ) : (
          <div
            className={
              terminal
                ? 'flex-1 flex flex-col items-center justify-center gap-3'
                : 'flex-1 flex flex-col items-center justify-center text-slate-400 gap-3'
            }
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
