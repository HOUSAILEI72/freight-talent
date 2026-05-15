import { useEffect, useRef, useState } from 'react'
import { Globe2 } from 'lucide-react'
import { useHoverRail } from './useHoverRail'

const COLLAPSED = 60
const EXPANDED  = 230   // 足够放下 "MIDDLE EAST & AFRICA" + icon + padding

function ComingSoonToast({ visible }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: `translateX(-50%) translateY(${visible ? 0 : 8}px)`,
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms, transform 180ms',
        pointerEvents: 'none',
        zIndex: 9999,
        background: 'var(--t-bg-elevated)',
        border: '1px solid var(--t-border)',
        borderRadius: 'var(--t-radius)',
        padding: '7px 16px',
        fontFamily: 'var(--t-font-sans)',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--t-text-muted)',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      COMING SOON
    </div>
  )
}

export default function AreaRail({
  value = 'China',
  onChange = () => {},
  areas = [],
}) {
  const { open, handleMouseEnter, handleMouseLeave } = useHoverRail()
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef(null)

  function showComingSoon() {
    setToastVisible(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 2000)
  }

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  return (
    <>
      <ComingSoonToast visible={toastVisible} />
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
            className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--t-text-muted)] whitespace-nowrap absolute"
            style={{ opacity: open ? 0 : 1, transition: 'opacity 120ms', pointerEvents: 'none', left: '50%', transform: 'translateX(-50%)' }}
          >
            AR
          </span>
          <span
            className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--t-text-muted)] whitespace-nowrap absolute"
            style={{ opacity: open ? 1 : 0, transition: `opacity 200ms ${open ? '160ms' : '0ms'}`, pointerEvents: 'none', left: 12 }}
          >
            Area
          </span>
        </div>

        {/* Area list */}
        <nav className="flex-1 overflow-y-auto py-1 terminal-scrollbar">
          {areas.map((a, idx) => {
            // ── Continent header ──────────────────────────────────────
            if (a.type === 'continent') {
              const isFirst = idx === 0
              return (
                <div
                  key={a.key}
                  style={{
                    position: 'relative',
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    paddingLeft: 10,
                    paddingRight: 8,
                    paddingTop: isFirst ? 4 : 8,
                  }}
                >
                  {/* Collapsed: horizontal divider line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 8,
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      height: 1,
                      background: 'var(--t-border)',
                      opacity: open ? 0 : 0.8,
                      transition: `opacity 120ms`,
                    }}
                  />
                  {/* Expanded: cyan label + trailing line */}
                  <span
                    style={{
                      fontFamily: 'var(--t-font-sans)',
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      color: 'var(--t-chart-cyan)',
                      opacity: open ? 1 : 0,
                      transition: `opacity 180ms ${open ? '160ms' : '0ms'}`,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      marginRight: 6,
                    }}
                  >
                    {a.label}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      background: 'var(--t-border)',
                      opacity: open ? 0.6 : 0,
                      transition: `opacity 180ms ${open ? '160ms' : '0ms'}`,
                    }}
                  />
                </div>
              )
            }

            const active   = a.key === value
            const disabled = !!a.disabled

            return (
              <button
                key={a.key}
                type="button"
                onClick={() => {
                  if (disabled) { showComingSoon(); return }
                  onChange(a.key)
                }}
                title={disabled ? `${a.label} — Coming Soon` : a.label}
                style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                className={`relative flex h-10 w-full items-center gap-3 px-3 transition-colors duration-[var(--t-transition)] ${
                  active
                    ? 'bg-[color:var(--t-primary)] text-white'
                    : disabled
                      ? ''
                      : 'hover:bg-[var(--t-bg-hover)] hover:text-[color:var(--t-text)]'
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 h-7 w-[3px] rounded-r"
                    style={{ background: '#60a5fa' }}
                  />
                )}

                <span style={{
                  flexShrink: 0,
                  width: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  color: active ? '#fff' : disabled ? 'var(--t-text-muted)' : 'var(--t-text-secondary)',
                  opacity: disabled ? 0.4 : 1,
                  marginLeft: open ? 0 : `${(COLLAPSED - 16 - 24) / 2}px`,
                  transition: `margin-left var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)`,
                }}>
                  <Globe2 size={14} />
                </span>

                <span
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    opacity: open ? (disabled ? 0.45 : 1) : 0,
                    transform: open ? 'translateX(0)' : 'translateX(-6px)',
                    transition: open
                      ? `opacity 200ms 160ms var(--t-rail-ease), transform 200ms 160ms var(--t-rail-ease)`
                      : 'opacity 80ms, transform 80ms',
                    pointerEvents: open ? 'auto' : 'none',
                    whiteSpace: 'nowrap',
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: '0.01em',
                    color: active ? '#fff' : disabled ? 'var(--t-text-muted)' : 'var(--t-text-secondary)',
                  }}
                >
                  {a.label}
                </span>
              </button>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
