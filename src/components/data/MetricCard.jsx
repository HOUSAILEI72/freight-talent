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
  compact = false,
  className = '',
}) {
  const trendStyle = trend ? TREND_STYLES[trend.direction ?? 'neutral'] : null
  const pad = compact ? 'px-4 py-3' : 'px-5 py-4'

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-[var(--t-shadow-panel)] transition-colors duration-[var(--t-transition)] hover:bg-[var(--t-bg-hover)] ${pad} ${className}`}
    >
      {/* label + icon */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[length:var(--t-text-xs)] font-medium uppercase tracking-widest text-[color:var(--t-text-muted)] leading-snug">
          {label}
        </span>
        {icon && (
          <span className="shrink-0 text-[color:var(--t-text-muted)]">
            {icon}
          </span>
        )}
      </div>

      {/* value + helper */}
      <div>
        <span className="block font-[var(--t-font-mono)] text-[length:var(--t-text-xl)] font-bold leading-tight text-[color:var(--t-text)]">
          {value ?? '—'}
        </span>
        {helper && (
          <span className="mt-1 block text-[length:var(--t-text-xs)] leading-snug text-[color:var(--t-text-secondary)]">
            {helper}
          </span>
        )}
      </div>

      {/* trend */}
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
