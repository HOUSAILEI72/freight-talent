import { useEffect, useRef, useState } from 'react'
import { Globe2, MapPin } from 'lucide-react'

export const DEFAULT_AREAS = [
  { type: 'continent', key: 'continent-asia',     label: 'ASIA' },
  { key: 'China',       label: 'China' },
  { key: 'Japan',       label: 'Japan',       disabled: true },
  { key: 'Singapore',   label: 'Singapore',   disabled: true },
  { key: 'South Korea', label: 'South Korea', disabled: true },

  { type: 'continent', key: 'continent-europe',   label: 'EUROPE' },
  { key: 'Netherlands', label: 'Netherlands', disabled: true },
  { key: 'Germany',     label: 'Germany',     disabled: true },
  { key: 'UK',          label: 'UK',          disabled: true },

  { type: 'continent', key: 'continent-americas', label: 'AMERICAS' },
  { key: 'USA',         label: 'USA',         disabled: true },
  { key: 'Canada',      label: 'Canada',      disabled: true },

  { type: 'continent', key: 'continent-mea',      label: 'MIDDLE EAST & AFRICA' },
  { key: 'UAE',         label: 'UAE',         disabled: true },
]

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

export default function AreaSidebar({
  value = 'China',
  onChange = () => {},
  areas = DEFAULT_AREAS,
}) {
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
        className="flex h-full shrink-0 flex-col border-r border-[var(--t-border)]"
        style={{ background: 'var(--t-bg-elevated)', width: 'max-content', minWidth: 176 }}
      >
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-3 gap-4">
          <span className="text-[11px] font-semibold tracking-[0.04em] text-[color:var(--t-text-muted)] whitespace-nowrap">
            Area
          </span>
          <Globe2 size={12} className="text-[color:var(--t-text-muted)] shrink-0" />
        </div>

        <nav className="flex-1 overflow-y-auto py-1 terminal-scrollbar">
          {areas.map((a, idx) => {
            // ── Continent header ──────────────────────────────────────
            if (a.type === 'continent') {
              const isFirst = idx === 0
              return (
                <div
                  key={a.key}
                  style={{
                    padding: `${isFirst ? 4 : 12}px 12px 4px`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--t-font-sans)',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      color: 'var(--t-chart-cyan)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {a.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--t-border)', minWidth: 8 }} />
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
                className={`relative flex h-8 w-full items-center gap-2 px-3 text-left transition-colors duration-[var(--t-transition)] ${
                  active
                    ? 'bg-[var(--t-bg-active)]'
                    : disabled
                      ? ''
                      : 'hover:bg-[var(--t-bg-hover)]'
                }`}
              >
                {active && (
                  <span
                    className="absolute left-0 top-1.5 h-5 w-0.5 rounded-r"
                    style={{ background: 'var(--t-chart-cyan)' }}
                  />
                )}
                <MapPin
                  size={11}
                  className="shrink-0"
                  style={{
                    color: active ? 'var(--t-chart-cyan)' : disabled ? 'var(--t-text-muted)' : 'var(--t-text-secondary)',
                    opacity: disabled ? 0.45 : 1,
                  }}
                />
                <span
                  className="whitespace-nowrap text-[13px] font-medium tracking-[0.01em]"
                  style={{
                    color: active
                      ? 'var(--t-text)'
                      : disabled
                        ? 'var(--t-text-muted)'
                        : 'var(--t-text-secondary)',
                    opacity: disabled ? 0.55 : 1,
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
