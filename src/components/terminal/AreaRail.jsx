import { useNavigate } from 'react-router-dom'
import { Globe2, Lock } from 'lucide-react'
import { useHoverRail } from './useHoverRail'

const COLLAPSED = 60
const EXPANDED  = 228

export default function AreaRail({
  value = 'China',
  onChange = () => {},
  areas = [],
  hasSubscription = true,
}) {
  const navigate = useNavigate()
  const { open, handleMouseEnter, handleMouseLeave } = useHoverRail()
  const pricingPath = '/employer/pricing'

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--t-border)]"
      style={{
        width: open ? EXPANDED : COLLAPSED,
        background: 'var(--t-bg-elevated)',
        transition: `width var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)`,
        willChange: 'width',
      }}
    >
      {/* Header */}
      <div
        className="flex h-9 shrink-0 items-center border-b border-[var(--t-border-subtle)]"
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        <span
          className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text-muted)] whitespace-nowrap absolute"
          style={{ opacity: open ? 0 : 1, transition: 'opacity 120ms', pointerEvents: 'none', left: '50%', transform: 'translateX(-50%)' }}
        >
          AR
        </span>
        <span
          className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text-muted)] whitespace-nowrap absolute"
          style={{ opacity: open ? 1 : 0, transition: `opacity 200ms ${open ? '160ms' : '0ms'}`, pointerEvents: 'none', left: 12 }}
        >
          Area
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
              className={`relative flex h-12 w-full items-center gap-3 px-3 transition-colors duration-[var(--t-transition)] ${
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

              <span style={{ flexShrink: 0, width: 18, display: 'flex', justifyContent: 'center',
                             marginLeft: open ? 0 : `${(COLLAPSED - 18 - 24) / 2}px`,
                             transition: `margin-left var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)` }}>
                <Globe2 size={16} />
              </span>

              <span
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  overflow: 'hidden',
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateX(0)' : 'translateX(-6px)',
                  transition: open
                    ? `opacity 200ms 160ms var(--t-rail-ease), transform 200ms 160ms var(--t-rail-ease)`
                    : 'opacity 80ms, transform 80ms',
                  pointerEvents: open ? 'auto' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span className="min-w-0 flex-1 truncate font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] font-semibold uppercase tracking-wider">
                  {a.label}
                </span>
                {locked && (
                  <Lock size={11} className="shrink-0" style={{ color: 'var(--t-text-muted)', opacity: 0.5 }} />
                )}
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
