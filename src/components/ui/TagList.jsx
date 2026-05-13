const COLOR_CLASSES = [
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-emerald-50 text-emerald-700',
  'bg-orange-50 text-orange-700',
]

const TERMINAL_COLORS = [
  { color: 'var(--t-chart-blue)',   bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)' },
  { color: 'var(--t-chart-purple)', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  { color: 'var(--t-success)',      bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)' },
  { color: 'var(--t-chart-amber)',  bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
]

export function TagList({ tags = [], max = 5, colorFn, terminal = false }) {
  const shown = tags.slice(0, max)
  const rest = tags.length - max

  if (terminal) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {shown.map((tag, i) => {
          const c = TERMINAL_COLORS[i % TERMINAL_COLORS.length]
          return (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
                color: c.color, background: c.bg, border: `1px solid ${c.border}`,
              }}
            >
              {tag}
            </span>
          )
        })}
        {rest > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
            color: 'var(--t-text-muted)', background: 'transparent', border: '1px solid var(--t-border)',
          }}>
            +{rest}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-row flex-wrap gap-1.5">
      {shown.map((tag, i) => (
        <span
          key={tag}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorFn ? colorFn(tag, i) : COLOR_CLASSES[i % COLOR_CLASSES.length]}`}
        >
          {tag}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
          +{rest}
        </span>
      )}
    </div>
  )
}