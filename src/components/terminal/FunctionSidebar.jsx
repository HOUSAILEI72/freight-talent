import { useNavigate } from 'react-router-dom'
import { Layers, Lock } from 'lucide-react'

/**
 * FunctionSidebar — always-expanded sidebar for Function selection.
 *
 * Based on AreaSidebar's layout:
 *  - Always expanded (~210px)
 *  - Scrollable when overflow
 *  - Active row highlighted with blue accent
 *
 * Props:
 *  - value            currently selected function key
 *  - onChange         (key) => void
 *  - functions        [{ key, label, icon }]
 *  - hasSubscription  boolean
 */

export default function FunctionSidebar({
  value = 'ALL',
  onChange = () => {},
  functions = [],
  hasSubscription = true,
}) {
  const navigate = useNavigate()
  const pricingPath = '/employer/pricing'

  return (
    <aside
      className="flex h-full shrink-0 flex-col border-r border-[var(--t-border)]"
      style={{ background: '#0e1521' }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-3">
        <span className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text-muted)]">
          Function
        </span>
        <Layers size={12} className="text-[color:var(--t-text-muted)]" />
      </div>

      <nav className="flex-1 overflow-y-auto py-2 terminal-scrollbar">
        {functions.map((f) => {
          const Icon = f.icon || Layers
          const active = f.key === value
          const locked = f.key !== 'ALL' && !hasSubscription
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                if (locked) { navigate(pricingPath); return }
                onChange(f.key)
              }}
              title={locked ? `${f.label} — 订阅后可用` : f.label}
              className={`relative flex h-9 w-full items-center gap-2.5 px-3 text-left transition-colors duration-[var(--t-transition)] ${
                active
                  ? 'bg-[var(--t-bg-active)] text-[color:var(--t-text)]'
                  : 'text-[color:var(--t-text-secondary)] hover:bg-[var(--t-bg-hover)] hover:text-[color:var(--t-text)]'
              }`}
            >
              {active && (
                <span
                  className="absolute left-0 top-2 h-5 w-0.5 rounded-r"
                  style={{ background: 'var(--t-chart-cyan)' }}
                />
              )}
              <Icon size={13} className="shrink-0 opacity-70" />
              <span className="whitespace-nowrap font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] uppercase tracking-wider">
                {f.label}
              </span>
              {locked && (
                <Lock size={10} className="shrink-0 ml-auto" style={{ color: 'var(--t-text-muted)', opacity: 0.5 }} />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
