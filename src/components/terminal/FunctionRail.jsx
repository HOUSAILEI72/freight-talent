import { useState } from 'react'
import { Layers, Anchor, Plane, Truck, Train, Package, ShoppingCart } from 'lucide-react'

/**
 * FunctionRail
 * Single-instance expanding sidebar (no flyout overlay).
 *
 * Behavior
 * ────────
 *  · Default: narrow 60px rail showing icon + short code.
 *  · Hover anywhere on the rail → the SAME container smoothly grows to ~228px and
 *    swaps each row from "icon + short code" to "icon + full label".
 *  · Mouse leave → smoothly collapses back.
 *  · Only one list is ever rendered. No position:absolute flyout.
 *  · Active row: solid blue (var(--t-primary)) + left blue accent + white text.
 *  · Hover row: elevated dark background.
 *
 * Props
 * ─────
 *  - value      currently selected function key
 *  - onChange   (key) => void
 *  - functions  optional override of DEFAULT_FUNCTIONS
 */

export const DEFAULT_FUNCTIONS = [
  { key: 'ALL',                label: 'ALL',                short: 'ALL',  icon: Layers },
  { key: 'Sea',                label: 'Sea',                short: 'S',    icon: Anchor },
  { key: 'Air',                label: 'Air',                short: 'A',    icon: Plane },
  { key: 'Road',               label: 'Road',               short: 'R',    icon: Truck },
  { key: 'Railway',            label: 'Railway',            short: 'Rail', icon: Train },
  { key: 'Contract Logistics', label: 'Contract Logistics', short: 'CL',   icon: Package },
  { key: 'ECOMS',              label: 'ECOMS',              short: 'E',    icon: ShoppingCart },
]

const RAIL_COLLAPSED = 60
const RAIL_EXPANDED  = 228

export default function FunctionRail({
  value = 'ALL',
  onChange = () => {},
  functions = DEFAULT_FUNCTIONS,
}) {
  const [open, setOpen] = useState(false)

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
          {open ? 'Function' : 'FN'}
        </span>
      </div>

      {/* Single list */}
      <nav className="flex-1 overflow-y-auto py-2 terminal-scrollbar">
        {functions.map((f) => {
          const Icon = f.icon || Layers
          const active = f.key === value
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onChange(f.key)}
              title={f.label}
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

              <Icon size={open ? 16 : 15} className="shrink-0" />

              {open && (
                <span className="min-w-0 flex-1 truncate font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] font-semibold uppercase tracking-wider whitespace-nowrap">
                  {f.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
