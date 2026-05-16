import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

/**
 * CandidateChartPanel
 *
 * Props:
 *  - data: [{ label, count }, ...] or [{ period, period_label, count }, ...]
 *  - title / subtitle / loading / meta / unitLabel / emptyText
 *  - granularity / onGranularityChange / granularityOptions
 *  - light: boolean — white card with dark-blue text (Freightos dashboard style)
 */

const DEFAULT_GRANULARITY_OPTIONS = [
  { value: 'week',       label: '周' },
  { value: 'bi_monthly', label: '10&20/月' },
  { value: 'month',      label: '月' },
  { value: 'quarter',    label: '季度' },
  { value: 'year',       label: '年' },
]

/* Colour palettes for dark vs light mode */
const DARK = {
  panelBg:    'var(--t-bg-panel)',
  headerBorder:'var(--t-border-subtle)',
  title:      'var(--t-text)',
  subtitle:   'var(--t-text-muted)',
  meta:       'var(--t-text-muted)',
  grid:       'rgba(255,255,255,0.08)',
  axisFill:   'var(--t-text-secondary)',
  axisStroke: 'var(--t-border)',
  bar:        'var(--t-chart-purple)',
  cursor:     'rgba(167,139,250,0.08)',
  ctrlBg:     'var(--t-bg-elevated)',
  ctrlBorder: 'var(--t-border)',
  ctrlActive: 'var(--t-primary)',
  ctrlActiveText:'var(--t-text)',
  ctrlText:   'var(--t-text-muted)',
  emptyBg:    null, // uses css var inline
}

const LIGHT = {
  panelBg:    '#ffffff',
  headerBorder:'rgba(7,59,142,0.09)',
  title:      '#073b8e',
  subtitle:   '#7390c2',
  meta:       '#7390c2',
  grid:       'rgba(7,59,142,0.07)',
  axisFill:   '#7390c2',
  axisStroke: 'rgba(7,59,142,0.14)',
  bar:        '#2563eb',
  cursor:     'rgba(37,99,235,0.07)',
  ctrlBg:     'rgba(7,59,142,0.06)',
  ctrlBorder: 'rgba(7,59,142,0.14)',
  ctrlActive: '#2563eb',
  ctrlActiveText:'#ffffff',
  ctrlText:   '#7390c2',
  emptyBg:    'rgba(255,255,255,0.92)',
}

function DarkTooltip({ active, payload, label, unitLabel = 'candidates' }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-[var(--t-radius)] border px-3 py-2"
      style={{
        background: 'rgba(11, 14, 19, 0.96)',
        borderColor: 'rgba(30,45,64,0.9)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      }}
    >
      <p className="max-w-56 truncate text-[11px] text-[color:var(--t-text-secondary)]">
        {label}
      </p>
      <p className="text-[14px] font-semibold" style={{ color: '#60a5fa' }}>
        {payload[0].value} {unitLabel}
      </p>
    </div>
  )
}

function GranularityControl({ value, onChange, options = DEFAULT_GRANULARITY_OPTIONS, c }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-[var(--t-radius)] border p-0.5"
      style={{ background: c.ctrlBg, borderColor: c.ctrlBorder }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2 py-1 rounded-[calc(var(--t-radius)-2px)] text-[12px] font-medium transition-all"
          style={{
            background: value === opt.value ? c.ctrlActive : 'transparent',
            color: value === opt.value ? c.ctrlActiveText : c.ctrlText,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function CandidateChartPanel({
  data = [],
  title = 'CANDIDATE DISTRIBUTION',
  subtitle = 'FUNC=ALL / AREA=ALL',
  loading = false,
  meta = '',
  unitLabel = 'candidates',
  emptyText = '暂无候选人数据',
  granularity,
  onGranularityChange,
  granularityOptions,
  light = false,
}) {
  const c = light ? LIGHT : DARK

  const normalizedData = data.map((item) => ({
    x_label: item.period_label || item.period || item.label,
    count: item.count,
  }))

  const borderStyle = light
    ? { border: '1px solid rgba(7,59,142,0.10)', boxShadow: '0 2px 12px rgba(7,59,142,0.08)' }
    : {}

  return (
    <section
      className="terminal-candidate-chart-panel flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--t-radius-lg)]"
      style={{ background: c.panelBg, ...borderStyle }}
    >
      {/* Header */}
      <div
        className="terminal-chart-header px-5 py-3"
        style={{ borderBottom: `1px solid ${c.headerBorder}` }}
      >
        <div className="terminal-chart-header-left">
          <h3
            className="text-[13px] font-semibold tracking-[0.04em]"
            style={{ color: c.title }}
          >
            {title}
          </h3>
          <p
            className="mt-0.5 truncate text-[11px] tracking-[0.02em]"
            style={{ color: c.subtitle }}
          >
            {subtitle}
          </p>
        </div>
        <div className="terminal-chart-header-right">
          {onGranularityChange && (
            <GranularityControl
              value={granularity}
              onChange={onGranularityChange}
              options={granularityOptions}
              c={c}
            />
          )}
          {meta && (
            <span
              className="text-[11px] tracking-[0.02em]"
              style={{ color: c.meta }}
            >
              {meta}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-4">
        {loading ? (
          <div
            className="flex flex-1 items-center justify-center text-[length:var(--t-text-sm)]"
            style={{ color: light ? '#7390c2' : 'var(--t-text-secondary)' }}
          >
            加载图表…
          </div>
        ) : normalizedData.length === 0 ? (
          <EmptyChart emptyText={emptyText} c={c} />
        ) : (
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={normalizedData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={c.grid} />
                <XAxis
                  dataKey="x_label"
                  interval={0}
                  height={32}
                  tick={{ fill: c.axisFill, fontSize: 11 }}
                  tickFormatter={(v) =>
                    String(v).length > 10 ? `${String(v).slice(0, 10)}…` : v
                  }
                  tickLine={false}
                  axisLine={{ stroke: c.axisStroke }}
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tick={{ fill: c.axisFill, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={<DarkTooltip unitLabel={unitLabel} />}
                  cursor={{ fill: c.cursor }}
                />
                <Bar
                  dataKey="count"
                  fill={c.bar}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={56}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyChart({ emptyText = '暂无候选人数据', c }) {
  const ghostBars = [12, 18, 9, 22, 14, 28, 11]
  return (
    <div className="relative flex flex-1 items-end justify-around gap-3 px-4 pb-8 pt-4">
      {ghostBars.map((h, i) => (
        <div
          key={i}
          className="w-8 rounded-t-sm opacity-20"
          style={{
            height: `${h * 6}px`,
            background: `linear-gradient(180deg, ${c.bar} 0%, transparent 100%)`,
          }}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="rounded-[var(--t-radius)] border px-4 py-2 backdrop-blur"
          style={{
            background: c.emptyBg ?? 'var(--t-bg-panel)',
            borderColor: c.axisStroke,
          }}
        >
          <span
            className="text-[13px] tracking-[0.02em]"
            style={{ color: c.subtitle }}
          >
            {emptyText}
          </span>
        </div>
      </div>
    </div>
  )
}
