/**
 * MetricCard
 * Phase 1 · Freightos Terminal style KPI card — no business logic.
 *
 * Props
 * ─────
 * label     string            Metric label (e.g. "Active Jobs")
 * value     string | number   Primary display value
 * helper    string            Optional sub-text beneath value
 * trend     { value: string | number, direction: 'up' | 'down' | 'neutral' }
 *           Optional trend indicator shown bottom-left
 * icon      ReactNode         Optional icon rendered top-right
 * className string            Extra utility classes
 */

const TREND_STYLES = {
  up:      { color: 'var(--t-trend-up)',      arrow: '↑' },
  down:    { color: 'var(--t-trend-down)',     arrow: '↓' },
  neutral: { color: 'var(--t-trend-neutral)',  arrow: '→' },
}

export default function MetricCard({
  label,
  value,
  helper,
  trend,
  icon,
  className = '',
}) {
  const trendStyle = trend ? TREND_STYLES[trend.direction ?? 'neutral'] : null

  return (
    <div
      className={`relative flex flex-col justify-between gap-3 rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] px-5 py-4 shadow-[var(--t-shadow-panel)] transition-colors duration-[var(--t-transition)] hover:bg-[var(--t-bg-hover)] ${className}`}
    >
      {/* ── Top row: label + icon ── */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[length:var(--t-text-xs)] font-medium uppercase tracking-widest text-[color:var(--t-text-muted)]">
          {label}
        </span>
        {icon && (
          <span className="shrink-0 text-[color:var(--t-text-muted)]">
            {icon}
          </span>
        )}
      </div>

      {/* ── Primary value ── */}
      <div>
        <span className="block font-[var(--t-font-mono)] text-[length:var(--t-text-xl)] font-bold leading-none text-[color:var(--t-text)]">
          {value ?? '—'}
        </span>
        {helper && (
          <span className="mt-1 block text-[length:var(--t-text-xs)] text-[color:var(--t-text-secondary)]">
            {helper}
          </span>
        )}
      </div>

      {/* ── Trend indicator ── */}
      {trendStyle && trend && (
        <div
          className="flex items-center gap-1 text-[length:var(--t-text-xs)] font-medium"
          style={{ color: trendStyle.color }}
        >
          <span aria-hidden="true">{trendStyle.arrow}</span>
          <span>{trend.value}</span>
        </div>
      )}
    </div>
  )
}
