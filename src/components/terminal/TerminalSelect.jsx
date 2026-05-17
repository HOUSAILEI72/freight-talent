import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'

/**
 * Terminal-styled custom select.
 * Renders a trigger button + a fixed-position dropdown panel so it never
 * gets clipped by overflow:hidden parent containers.
 *
 * Props:
 *   value        — current value
 *   onChange     — (value) => void
 *   options      — [{ value, label }]
 *   placeholder  — shown when value is empty / unmatched
 *   hasValue     — reserved for API compatibility; no longer affects border color
 *   searchable   — if true, shows a fuzzy-filter input inside the panel
 *   className    — extra classes on the trigger
 *   style        — extra styles on the trigger
 */
export function TerminalSelect({
  value,
  onChange,
  options = [],
  placeholder = '',
  hasValue,   // kept for API compat, intentionally unused
  searchable = false,
  className = '',
  style,
  highlightStyle,
}) {
  const [open, setOpen]         = useState(false)
  const [hovered, setHovered]   = useState(false)
  const [query, setQuery]       = useState('')
  const [pos, setPos]           = useState({ top: 0, left: 0, width: 0 })
  const triggerRef              = useRef(null)
  const panelRef                = useRef(null)
  const searchRef               = useRef(null)

  const selected = options.find(o => String(o.value) === String(value))

  const filtered = searchable && query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  const SEARCH_H = searchable ? 36 : 0

  function openDropdown() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelH = Math.min(options.length * 30 + 8 + SEARCH_H, 280)
    const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 2 : rect.top - panelH - 2
    setPos({ top, left: rect.left, width: rect.width })
    setQuery('')
    setOpen(true)
  }

  const close = useCallback(() => { setOpen(false); setQuery('') }, [])

  useEffect(() => {
    if (!open) return
    if (searchable) {
      // micro-delay so the panel is mounted before focus
      const t = setTimeout(() => searchRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open, searchable])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e) {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        close()
      }
    }
    function onKeyDown(e) { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  function pick(val) {
    onChange(val)
    close()
  }

  // border: default → hover → open/focus progression; hasValue no longer affects color
  const borderColor = open
    ? 'var(--t-border-focus)'
    : hovered
      ? 'var(--t-border-focus)'
      : 'var(--t-border)'

  const triggerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    width: '100%',
    height: 30,
    padding: '0 8px',
    background: 'var(--t-bg-input)',
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--t-radius-sm)',
    color: selected ? 'var(--t-text)' : 'var(--t-text-muted)',
    fontFamily: 'var(--t-font-ui)',
    fontSize: 12,
    cursor: 'pointer',
    outline: 'none',
    userSelect: 'none',
    transition: 'border-color 120ms',
    ...style,
    ...highlightStyle,
  }

  const panelStyle = {
    position: 'fixed',
    top: pos.top,
    left: pos.left,
    width: pos.width,
    zIndex: 9999,
    background: 'var(--t-bg-input)',
    border: '1px solid var(--t-border)',
    borderRadius: 'var(--t-radius)',
    boxShadow: '0 12px 28px rgba(0,0,0,.28)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 280,
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        style={triggerStyle}
        className={className}
        onClick={open ? close : openDropdown}
        onFocus={() => {}}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <span className="truncate" style={{ flex: 1, textAlign: 'left', fontFamily: 'var(--t-font-cjk)', fontSize: 12 }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={11}
          style={{
            color: 'var(--t-text-muted)',
            flexShrink: 0,
            transition: 'transform 150ms',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {open && (
        <div ref={panelRef} style={panelStyle}>
          {searchable && (
            <div style={{
              padding: '6px 8px',
              borderBottom: '1px solid var(--t-border-subtle)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Search size={11} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索岗位..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'var(--t-font-cjk)',
                  fontSize: 12,
                  color: 'var(--t-text)',
                  caretColor: 'var(--t-primary)',
                }}
              />
            </div>
          )}
          <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-cjk)' }}>
                无匹配结果
              </div>
            )}
            {filtered.map(o => {
              const isSel = String(o.value) === String(value)
              return (
                <div
                  key={o.value}
                  onClick={() => pick(o.value)}
                  style={{
                    padding: '5px 10px',
                    paddingLeft: isSel ? 8 : 10,
                    borderLeft: isSel ? '2px solid var(--t-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontFamily: 'var(--t-font-cjk)',
                    fontSize: 12,
                    color: isSel ? 'var(--t-primary)' : 'var(--t-text)',
                    background: isSel ? 'var(--t-primary-muted)' : 'transparent',
                    transition: 'background 100ms',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  {o.label}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
