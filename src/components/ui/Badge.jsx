const LIGHT_COLOR_MAP = {
  blue:   'bg-blue-50 text-blue-700 border border-blue-100',
  green:  'bg-emerald-50 text-emerald-700 border border-emerald-100',
  orange: 'bg-orange-50 text-orange-700 border border-orange-100',
  purple: 'bg-purple-50 text-purple-700 border border-purple-100',
  yellow: 'bg-amber-50 text-amber-700 border border-amber-100',
  gray:   'bg-slate-100 text-slate-600 border border-slate-200',
  red:    'bg-red-50 text-red-600 border border-red-100',
}

const TERMINAL_COLOR_MAP = {
  blue:   { color: 'var(--t-chart-blue)',   bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)' },
  green:  { color: 'var(--t-success)',      bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)' },
  orange: { color: 'var(--t-chart-amber)',  bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  purple: { color: 'var(--t-chart-purple)', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  yellow: { color: 'var(--t-warning)',      bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  gray:   { color: 'var(--t-text-muted)',   bg: 'transparent',            border: 'var(--t-border)' },
  red:    { color: 'var(--t-danger)',       bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
}

export function Badge({ children, color = 'blue', className = '', terminal = false }) {
  if (terminal) {
    const t = TERMINAL_COLOR_MAP[color] ?? TERMINAL_COLOR_MAP.gray
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
        style={{ color: t.color, background: t.bg, border: `1px solid ${t.border}` }}
      >
        {children}
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${LIGHT_COLOR_MAP[color] ?? LIGHT_COLOR_MAP.gray} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status, terminal = false }) {
  const map = {
    published: { label: '招聘中', color: 'green' },
    active:    { label: '招聘中', color: 'green' },
    draft:     { label: '草稿',   color: 'gray'  },
    paused:    { label: '已暂停', color: 'orange' },
    closed:    { label: '已关闭', color: 'gray'  },
  }
  const { label, color } = map[status] || { label: status, color: 'gray' }
  return <Badge color={color} terminal={terminal}>{label}</Badge>
}
