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
 * Phase 1 · Purple Recharts bar chart with dark tooltip.
 *
 * Props:
 *  - data: [{ label, count }, ...] or [{ period, period_label, count }, ...]
 *  - title: panel title
 *  - subtitle: panel subtitle (filter summary)
 *  - loading: boolean
 *  - meta: optional right-side meta string
 *  - unitLabel: unit label for tooltip (default: 'candidates')
 *  - emptyText: empty state text
 *  - granularity: current time granularity (day/week/month/quarter/year)
 *  - onGranularityChange: callback when granularity changes
 *  - granularityOptions: optional custom granularity options
 */

const DEFAULT_GRANULARITY_OPTIONS = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' },
  { value: 'year', label: '年' },
]

function DarkTooltip({ active, payload, label, unitLabel = 'candidates' }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-[var(--t-radius)] border px-3 py-2"
      style={{
        background: 'rgba(11, 14, 19, 0.96)',
        borderColor: 'var(--t-border)',
        boxShadow: 'var(--t-shadow-elevated)',
      }}
    >
      <p className="max-w-56 truncate text-[length:var(--t-text-xs)] text-[color:var(--t-text-secondary)]">
        {label}
      </p>
      <p
        className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold"
        style={{ color: 'var(--t-chart-purple)' }}
      >
        {payload[0].value} {unitLabel}
      </p>
    </div>
  )
}

function GranularityControl({ value, onChange, options = DEFAULT_GRANULARITY_OPTIONS }) {
  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-[var(--t-radius)] border p-0.5"
      style={{
        background: 'var(--t-bg-elevated)',
        borderColor: 'var(--t-border)',
      }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-2 py-1 rounded-[calc(var(--t-radius)-2px)] font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider transition-all"
          style={{
            background: value === opt.value ? 'var(--t-primary)' : 'transparent',
            color: value === opt.value ? 'var(--t-text)' : 'var(--t-text-muted)',
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
}) {
  // Normalize data: support both old { label, count } and new { period, period_label, count }
  const normalizedData = data.map((item) => ({
    x_label: item.period_label || item.period || item.label,
    count: item.count,
  }))

  return (
    <section
      className="flex h-full flex-1 flex-col rounded-[var(--t-radius-lg)] border border-[var(--t-border)] shadow-[var(--t-shadow-panel)]"
      style={{ background: 'var(--t-bg-panel)' }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5 py-3">
        <div className="min-w-0">
          <h3 className="font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] font-bold uppercase tracking-[0.18em] text-[color:var(--t-text)]">
            {title}
          </h3>
          <p className="mt-0.5 truncate font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onGranularityChange && (
            <GranularityControl
              value={granularity}
              onChange={onGranularityChange}
              options={granularityOptions}
            />
          )}
          {meta && (
            <span className="font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
              {meta}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[length:var(--t-text-sm)] text-[color:var(--t-text-secondary)]">
            加载图表…
          </div>
        ) : normalizedData.length === 0 ? (
          <EmptyChart emptyText={emptyText} />
        ) : (
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={normalizedData} margin={{ top: 12, right: 12, bottom: 24, left: 0 }}>
                <CartesianGrid
                  vertical={false}
                  stroke="rgba(255,255,255,0.08)"
                />
                <XAxis
                  dataKey="x_label"
                  interval={0}
                  height={50}
                  tick={{ fill: 'var(--t-text-secondary)', fontSize: 11 }}
                  tickFormatter={(v) =>
                    String(v).length > 10 ? `${String(v).slice(0, 10)}…` : v
                  }
                  tickLine={false}
                  axisLine={{ stroke: 'var(--t-border)' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'var(--t-text-secondary)', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--t-border)' }}
                />
                <Tooltip
                  content={<DarkTooltip unitLabel={unitLabel} />}
                  cursor={{ fill: 'rgba(167,139,250,0.08)' }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--t-chart-purple)"
                  radius={[3, 3, 0, 0]}
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

function EmptyChart({ emptyText = '暂无候选人数据' }) {
  // Placeholder visual: faint grid + zero-state message,
  // so the chart area never collapses to whitespace.
  const ghostBars = [12, 18, 9, 22, 14, 28, 11]
  return (
    <div className="relative flex flex-1 items-end justify-around gap-3 px-4 pb-8 pt-4">
      {ghostBars.map((h, i) => (
        <div
          key={i}
          className="w-8 rounded-t-sm opacity-30"
          style={{
            height: `${h * 6}px`,
            background:
              'linear-gradient(180deg, var(--t-chart-purple) 0%, rgba(167,139,250,0.1) 100%)',
          }}
        />
      ))}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-bg-panel)]/80 px-4 py-2 backdrop-blur">
          <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] uppercase tracking-wider text-[color:var(--t-text-secondary)]">
            {emptyText}
          </span>
        </div>
      </div>
    </div>
  )
}
