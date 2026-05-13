import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe2, Lock } from 'lucide-react'

/**
 * AreaRail — collapsible hover rail for Area selection.
 *
 * Based on FunctionRail's interaction pattern:
 *  - Default: narrow 60px rail showing icon + short code.
 *  - Hover → grows to ~228px, swaps rows to icon + full label.
 *  - Active row gets blue accent + solid background.
 *
 * Props:
 *  - value            currently selected area key
 *  - onChange         (key) => void
 *  - areas            [{ key, label, short }]
 *  - hasSubscription  boolean
 */

const RAIL_COLLAPSED = 60
const RAIL_EXPANDED  = 228

export default function AreaRail({
  value = 'China',
  onChange = () => {},
  areas = [],
  hasSubscription = true,
}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const pricingPath = '/employer/pricing'

  return (
    <aside
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--t-border)]"
      style={{
        width: open ? RAIL_EXPANDED : RAIL_COLLAPSED,
        background: '#0c121b',
        transition: 'width 180ms cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Header */}
      <div
        className={`flex h-9 shrink-0 items-center border-b border-[var(--t-border-subtle)] ${
          open ? 'justify-start px-3' : 'justify-center'
        }`}
      >
        <span className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text-muted)] whitespace-nowrap">
          {open ? 'Area' : 'AR'}
        </span>
      </div>

      {/* Area list */}
      <nav className="flex-1 overflow-y-auto py-2 terminal-scrollbar">
        {areas.map((a) => {
          const active = a.key === value
          const locked = a.key !== value && !hasSubscription
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => {
                if (locked) { navigate(pricingPath); return }
                onChange(a.key)
              }}
              title={locked ? `${a.label} — 订阅后可用` : a.label}
              className={`relative flex h-12 w-full items-center transition-colors duration-[var(--t-transition)] ${
                open ? 'gap-3 px-3' : 'flex-col justify-center gap-0.5 px-0'
              } ${
                active
                  ? 'bg-[color:var(--t-primary)] text-white'
                  : 'text-[color:var(--t-text-secondary)] hover:bg-[var(--t-bg-elevated)] hover:text-[color:var(--t-text)]'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 h-9 w-[3px] rounded-r"
                  style={{ background: '#60a5fa' }}
                />
              )}

              <Globe2 size={open ? 16 : 15} className="shrink-0" />

              {open && (
                <span className="min-w-0 flex-1 truncate font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] font-semibold uppercase tracking-wider whitespace-nowrap">
                  {a.label}
                </span>
              )}

              {locked && (
                <Lock size={open ? 11 : 9} className="shrink-0" style={{ color: 'var(--t-text-muted)', opacity: 0.5 }} />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
