import { BriefcaseBusiness, UserSearch, UsersRound } from 'lucide-react'
import { useHoverRail } from '../../components/terminal/useHoverRail'

const COLLAPSED = 52
const EXPANDED  = 176

export const JOBS_TABS = [
  { key: 'all',               label: '发布岗位',    short: 'ALL', icon: BriefcaseBusiness },
  { key: 'personal_headhunt', label: '个人猎头服务', short: 'PH',  icon: UserSearch },
  { key: 'team_headhunt',     label: '团队猎头服务', short: 'TH',  icon: UsersRound },
]

export function JobsRail({ value = 'all', onChange = () => {}, counts = {} }) {
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
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--t-text-muted)', whiteSpace: 'nowrap',
          opacity: open ? 0 : 1, transition: 'opacity 120ms',
          pointerEvents: 'none',
        }}>
          JM
        </span>
        <span style={{
          position: 'absolute', left: 12,
          fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          color: 'var(--t-text-muted)', whiteSpace: 'nowrap',
          opacity: open ? 1 : 0,
          transition: open ? 'opacity 200ms 160ms' : 'opacity 80ms',
          pointerEvents: 'none',
        }}>
          JOB MARKETPLACE
        </span>
      </div>

      {/* Tab list */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="terminal-scrollbar">
        {JOBS_TABS.map(tab => {
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
                height: 40,
                gap: 8,
                padding: '0 10px',
                background: active ? 'var(--t-bg-active)' : 'transparent',
                color: active ? 'var(--t-text)' : 'var(--t-text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 120ms',
                outline: 'none',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Active accent bar */}
              {active && (
                <span aria-hidden style={{
                  position: 'absolute', left: 0,
                  top: '50%', transform: 'translateY(-50%)',
                  height: 24, width: 3,
                  borderRadius: '0 2px 2px 0',
                  background: 'var(--t-primary)',
                }} />
              )}

              {/* Icon */}
              <span style={{
                flexShrink: 0, width: 16,
                display: 'flex', justifyContent: 'center',
                marginLeft: open ? 0 : `${(COLLAPSED - 16 - 20) / 2}px`,
                transition: `margin-left var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)`,
              }}>
                <Icon size={13} style={{ color: active ? 'var(--t-primary)' : 'var(--t-text-muted)' }} />
              </span>

              {/* Label + count */}
              <span style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
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
                  fontFamily: 'var(--t-font-sans)',
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: active ? 'var(--t-text)' : 'var(--t-text-secondary)',
                }}>
                  {tab.label}
                </span>
                {count != null && (
                  <span style={{
                    fontFamily: 'var(--t-font-mono)',
                    fontSize: 10,
                    lineHeight: 1,
                    padding: '2px 5px',
                    borderRadius: 8,
                    background: active ? 'var(--t-primary)' : 'var(--t-bg-elevated)',
                    color: active ? '#fff' : 'var(--t-text-muted)',
                    border: active ? 'none' : '1px solid var(--t-border)',
                    flexShrink: 0,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {count}
                  </span>
                )}
              </span>

              {/* Dot — collapsed + has count */}
              {!open && count != null && count > 0 && (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 5, height: 5, borderRadius: '50%',
                  background: active ? 'var(--t-primary)' : 'var(--t-text-muted)',
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
