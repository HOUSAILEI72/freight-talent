function formatPercent(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  const sign = number > 0 ? '+' : ''
  const normalized = Number.isInteger(number)
    ? String(number)
    : number.toFixed(1).replace(/\.0$/, '')
  return `${sign}${normalized}%`
}

function getGrowthPercent(growthData, legacyCard, key) {
  if (key === 'ytd') {
    return growthData?.ytd_percent
      ?? growthData?.ytdPercent
      ?? growthData?.percent
      ?? legacyCard?.percent
      ?? 0
  }
  return growthData?.week_percent
    ?? growthData?.weekPercent
    ?? 0
}

export default function TrendSummaryCard({ type, data, loading }) {
  const growthData = data?.growth?.[type]
  const legacyCard = data?.cards?.[type]
  const title = type === 'jobs' ? 'PLATFORM JOB GROWTH' : 'PLATFORM CANDIDATE GROWTH'

  const ytdPct  = getGrowthPercent(growthData, legacyCard, 'ytd')
  const weekPct = getGrowthPercent(growthData, legacyCard, 'week')
  const ytdUp   = ytdPct  > 0
  const weekUp  = weekPct > 0

  return (
    <div className="terminal-growth-card">
      <span className="terminal-growth-card-label">{title}</span>
      <div className="terminal-growth-card-rows">
        <div className="terminal-growth-row">
          <span>YTD</span>
          <strong className="terminal-growth-row-value" style={{ color: ytdUp ? 'var(--t-trend-up)' : 'var(--t-trend-neutral)' }}>
            {loading ? '—' : formatPercent(ytdPct)}
          </strong>
        </div>
        <div className="terminal-growth-row">
          <span>BY WEEK</span>
          <strong className="terminal-growth-row-value terminal-growth-row-value--sm" style={{ color: weekUp ? 'var(--t-trend-up)' : 'var(--t-trend-neutral)' }}>
            {loading ? '—' : formatPercent(weekPct)}
          </strong>
        </div>
      </div>
    </div>
  )
}
