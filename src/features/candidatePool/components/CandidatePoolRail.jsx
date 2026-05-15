import { useHoverRail } from '../../../components/terminal/useHoverRail'
import { CANDIDATE_POOL_TABS } from '../constants'

const COLLAPSED = 52
const EXPANDED  = 224

export function CandidatePoolRail({ value = 'all', onChange = () => {}, counts = {} }) {
  const { open, handleMouseEnter, handleMouseLeave } = useHoverRail()

  return (
    <aside
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: open ? EXPANDED : COLLAPSED,
        background: 'var(--t-bg-panel)',
        borderRight: '1px solid var(--t-border)',
        transition: `width var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)`,
        willChange: 'width',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        height: '100%',
      }}
    >
      {/* Header */}
      <div style={{
        height: 36, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--t-border-subtle)',
        position: 'relative', overflow: 'hidden',
      }}>
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--t-text-muted)', whiteSpace: 'nowrap',
          opacity: open ? 0 : 1, transition: 'opacity 120ms',
          pointerEvents: 'none',
        }}>
          PL
        </span>
        <span style={{
          position: 'absolute', left: 12,
          fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--t-text-muted)', whiteSpace: 'nowrap',
          opacity: open ? 1 : 0,
          transition: open ? 'opacity 200ms 160ms' : 'opacity 80ms',
          pointerEvents: 'none',
        }}>
          POOL
        </span>
      </div>

      {/* Tab list */}
      <nav style={{ flex: 1, overflowY: 'auto' }} className="terminal-scrollbar">
        {CANDIDATE_POOL_TABS.map(tab => {
          const Icon   = tab.icon
          const active = tab.key === value
          const count  = counts[tab.key]

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              title={!open ? tab.label : undefined}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                height: 48,
                gap: 10,
                padding: '0 12px',
                background: active ? 'var(--t-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--t-text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 120ms',
                outline: 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--t-bg-elevated)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Active accent bar */}
              {active && (
                <span aria-hidden style={{
                  position: 'absolute', left: 0,
                  top: '50%', transform: 'translateY(-50%)',
                  height: 36, width: 3,
                  borderRadius: '0 2px 2px 0',
                  background: '#60a5fa',
                }} />
              )}

              {/* Icon */}
              <span style={{
                flexShrink: 0, width: 18,
                display: 'flex', justifyContent: 'center',
                marginLeft: open ? 0 : `${(COLLAPSED - 18 - 24) / 2}px`,
                transition: `margin-left var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)`,
              }}>
                <Icon size={14} />
              </span>

              {/* Label + count — always in DOM */}
              <span style={{
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
              }}>
                <span style={{
                  flex: 1,
                  fontFamily: 'var(--t-font-sans)', fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  textAlign: 'left',
                }}>
                  {tab.label}
                </span>
                {count != null && (
                  <span style={{
                    fontFamily: 'var(--t-font-sans)', fontSize: 10,
                    padding: '1px 6px', borderRadius: 10,
                    background: active ? 'rgba(255,255,255,0.2)' : 'var(--t-bg-elevated)',
                    color: active ? '#fff' : 'var(--t-text-muted)',
                    border: active ? 'none' : '1px solid var(--t-border)',
                    flexShrink: 0,
                  }}>
                    {count}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
