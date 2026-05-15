import { BriefcaseBusiness, UserSearch, UsersRound } from 'lucide-react'
import { useHoverRail } from '../../components/terminal/useHoverRail'

const COLLAPSED = 52
const EXPANDED  = 240

export const JOBS_TABS = [
  { key: 'all',               label: '全部岗位',    short: 'ALL', icon: BriefcaseBusiness },
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
      <div
        style={{
          height: 40,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--t-border-subtle)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* collapsed label */}
        <span style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--t-font-sans)', fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--t-text-muted)', whiteSpace: 'nowrap',
          opacity: open ? 0 : 1, transition: 'opacity 120ms',
          pointerEvents: 'none',
        }}>
          JM
        </span>
        {/* expanded label */}
        <span style={{
          position: 'absolute', left: 14,
          fontFamily: 'var(--t-font-sans)', fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--t-text-muted)', whiteSpace: 'nowrap',
          opacity: open ? 1 : 0,
          transition: open ? 'opacity 200ms 160ms' : 'opacity 80ms',
          pointerEvents: 'none',
        }}>
          JOB MARKETPLACE
        </span>
      </div>

      {/* Tab list */}
      <nav style={{ flex: 1, overflowY: 'auto' }} className="terminal-scrollbar">
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
                height: 44,
                gap: 9,
                padding: '0 14px',
                background: active ? 'var(--t-bg-active)' : 'transparent',
                color: active ? 'var(--t-text)' : 'var(--t-text-secondary)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 120ms',
                outline: 'none',
                borderBottom: '1px solid var(--t-border-subtle)',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Active bar */}
              {active && (
                <span aria-hidden style={{
                  position: 'absolute', left: 0,
                  top: '50%', transform: 'translateY(-50%)',
                  height: 28, width: 3,
                  borderRadius: '0 2px 2px 0',
                  background: 'var(--t-primary)',
                }} />
              )}

              {/* Icon — centered when collapsed */}
              <span style={{
                flexShrink: 0, width: 18,
                display: 'flex', justifyContent: 'center',
                marginLeft: open ? 0 : `${(COLLAPSED - 18 - 28) / 2}px`,
                transition: `margin-left var(--t-rail-${open ? 'expand' : 'collapse'}-duration) var(--t-rail-ease)`,
              }}>
                <Icon size={14} style={{ color: active ? 'var(--t-primary)' : 'var(--t-text-muted)' }} />
              </span>

              {/* Label — always in DOM, fade + slide in */}
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
                  fontWeight: active ? 700 : 500,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  color: active ? 'var(--t-text)' : 'var(--t-text-secondary)',
                }}>
                  {tab.label}
                </span>
                {count != null && (
                  <span style={{
                    fontFamily: 'var(--t-font-sans)', fontSize: 10,
                    padding: '1px 5px', borderRadius: 8,
                    background: active ? 'var(--t-primary)' : 'var(--t-bg-elevated)',
                    color: active ? '#fff' : 'var(--t-text-muted)',
                    border: active ? 'none' : '1px solid var(--t-border)',
                    flexShrink: 0, minWidth: 20, textAlign: 'center',
                  }}>
                    {count}
                  </span>
                )}
              </span>

              {/* Dot indicator when collapsed + has count */}
              {!open && count != null && count > 0 && (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 6, height: 6, borderRadius: '50%',
                  background: active ? 'var(--t-primary)' : 'var(--t-text-muted)',
                  opacity: open ? 0 : 1,
                  transition: 'opacity 80ms',
                }} />
              )}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
