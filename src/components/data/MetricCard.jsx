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
  light = false,
  className = '',
}) {
  const trendStyle = trend ? TREND_STYLES[trend.direction ?? 'neutral'] : null
  const pad = compact ? 'px-4 py-3' : 'px-5 py-4'

  const cardStyle = light ? {
    background: '#ffffff',
    border: '1px solid rgba(7,59,142,0.10)',
    boxShadow: '0 2px 8px rgba(7,59,142,0.07)',
  } : {}

  const labelColor  = light ? '#7390c2' : 'var(--t-text-muted)'
  const iconColor   = light ? '#7390c2' : 'var(--t-text-muted)'
  const valueColor  = light ? '#073b8e' : 'var(--t-text)'
  const helperColor = light ? '#7390c2' : 'var(--t-text-secondary)'
  const hoverClass  = light ? 'hover:bg-[#f0f6ff]' : 'hover:bg-[var(--t-bg-hover)]'

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-[var(--t-radius-lg)] transition-colors duration-[var(--t-transition)] ${hoverClass} ${pad} ${className}`}
      style={light ? cardStyle : {
        background: 'var(--t-bg-panel)',
        border: '1px solid var(--t-border)',
        boxShadow: 'var(--t-shadow-panel)',
      }}
    >
      {/* label + icon */}
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-medium tracking-[0.04em] leading-snug"
          style={{ color: labelColor }}
        >
          {label}
        </span>
        {icon && (
          <span className="shrink-0" style={{ color: iconColor }}>
            {icon}
          </span>
        )}
      </div>

      {/* value + helper */}
      <div>
        <span
          className="block text-[length:var(--t-text-xl)] font-extrabold leading-tight terminal-tabular-num"
          style={{ color: valueColor }}
        >
          {value ?? '—'}
        </span>
        {helper && (
          <span
            className="mt-1 block text-[length:var(--t-text-xs)] leading-snug"
            style={{ color: helperColor }}
          >
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
