import { Globe2, MapPin } from 'lucide-react'

/**
 * AreaSidebar
 * Phase 1 · Static visual structure — no API.
 *
 * Behavior:
 *  - Always expanded (~210px)
 *  - Vertically scrollable when overflow
 *  - Active row highlighted in cyan accent
 */

export const DEFAULT_AREAS = [
  { key: 'Global',       label: 'Global' },
  { key: 'Great China',  label: 'Great China' },
  { key: 'East China',   label: 'East China' },
  { key: 'North China',  label: 'North China' },
  { key: 'South China',  label: 'South China' },
  { key: 'West China',   label: 'West China' },
  { key: 'Taiwan',       label: 'Taiwan' },
  { key: 'Hong Kong',    label: 'Hong Kong' },
]

export default function AreaSidebar({
  value = 'Global',
  onChange = () => {},
  areas = DEFAULT_AREAS,
}) {
  return (
    <aside
      className="flex h-full w-[210px] shrink-0 flex-col border-r border-[var(--t-border)]"
      style={{ background: '#0e1521' }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-3">
        <span className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text-muted)]">
          Area
        </span>
        <Globe2 size={12} className="text-[color:var(--t-text-muted)]" />
      </div>

      <nav className="flex-1 overflow-y-auto py-2 terminal-scrollbar">
        {areas.map((a) => {
          const active = a.key === value
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => onChange(a.key)}
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
              <MapPin size={13} className="shrink-0 opacity-70" />
              <span className="min-w-0 truncate font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] uppercase tracking-wider">
                {a.label}
              </span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
