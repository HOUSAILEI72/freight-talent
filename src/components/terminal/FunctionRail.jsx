import { useNavigate } from 'react-router-dom'
import { Layers, Anchor, Plane, Truck, Train, Package, ShoppingCart, Warehouse, Scale, Lock } from 'lucide-react'
import { useHoverRail } from './useHoverRail'

export const DEFAULT_FUNCTIONS = [
  { key: 'ALL',               label: '全板块',          short: 'ALL',  icon: Layers },
  { key: 'Sea',               label: '海运板块',        short: 'S',    icon: Anchor },
  { key: 'Air',               label: '空运板块',        short: 'A',    icon: Plane },
  { key: 'CrossBorder',       label: '跨境电商物流',    short: 'CB',   icon: ShoppingCart },
  { key: 'Railway',           label: '铁路/中欧班列',   short: 'Rail', icon: Train },
  { key: 'Road',              label: '陆路运输',        short: 'R',    icon: Truck },
  { key: 'ContractLogistics', label: '合同物流/3PL',    short: '3PL',  icon: Package },
  { key: 'Warehousing',       label: '仓储/海外仓',     short: 'WH',   icon: Warehouse },
  { key: 'Customs',           label: '关务/合规',       short: 'CC',   icon: Scale },
]

const COLLAPSED = 60
const EXPANDED  = 228

export default function FunctionRail({
  value = 'ALL',
  onChange = () => {},
  functions = DEFAULT_FUNCTIONS,
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
        style={{ justifyContent: 'flex-start', padding: '0 0 0 18px', position: 'relative', overflow: 'hidden' }}
      >
        {/* collapsed label */}
        <span
          className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--t-text-muted)] whitespace-nowrap absolute"
          style={{ opacity: open ? 0 : 1, transition: 'opacity 120ms', pointerEvents: 'none', left: '50%', transform: 'translateX(-50%)' }}
        >
          FN
        </span>
        {/* expanded label */}
        <span
          className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--t-text-muted)] whitespace-nowrap absolute"
          style={{ opacity: open ? 1 : 0, transition: `opacity 200ms ${open ? '160ms' : '0ms'}`, pointerEvents: 'none', left: 12 }}
        >
          Function
        </span>
      </div>

      {/* Single list */}
      <nav className="flex-1 overflow-y-auto py-2 terminal-scrollbar">
        {functions.map((f) => {
          const Icon   = f.icon || Layers
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

              {/* Icon — always centered in collapsed state via padding offset */}
              <span style={{ flexShrink: 0, width: 18, display: 'flex', justifyContent: 'center',
                             marginLeft: open ? 0 : `${(COLLAPSED - 18 - 24) / 2}px`,
                             transition: `margin-left var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)` }}>
                <Icon size={16} />
              </span>

              {/* Label + lock — always in DOM, fade in */}
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
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium tracking-[0.01em]">
                  {f.label}
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
