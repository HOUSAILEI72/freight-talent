import { Badge } from '../../../components/ui/Badge'

export function FreshBadge({ days, terminal }) {
  if (days == null) return null
  if (!terminal) {
    if (days <= 3) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
        {days <= 1 ? '今日更新' : `${days}天内更新`}
      </span>
    )
    if (days <= 7) return <Badge color="blue">{days}天内更新</Badge>
    return null
  }
  if (days > 7) return null
  const isFresh = days <= 3
  const bg     = isFresh ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.12)'
  const border = isFresh ? 'rgba(34,197,94,0.3)'  : 'rgba(96,165,250,0.3)'
  const color  = isFresh ? 'var(--t-success)'      : 'var(--t-chart-blue)'
  const label  = days <= 1 ? '今日更新' : `${days} 天前更新`
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 10px', borderRadius: 9999,
      fontSize: 11, fontWeight: 600,
      background: bg, border: `1px solid ${border}`, color,
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: color,
        animation: isFresh ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : undefined,
      }} />
      {label}
    </span>
  )
}

export function AvailBadge({ status, terminal }) {
  if (!terminal) {
    if (status === 'open')    return <Badge color="green">开放机会</Badge>
    if (status === 'passive') return <Badge color="blue">被动寻找</Badge>
    return <Badge color="gray">暂不考虑</Badge>
  }
  const label = status === 'open' ? 'OPEN' : status === 'passive' ? 'PASSIVE' : 'CLOSED'
  const color = status === 'open' ? 'var(--t-success)' : status === 'passive' ? 'var(--t-chart-blue)' : 'var(--t-text-muted)'
  return (
    <span className="font-sans text-[10px] uppercase tracking-wider" style={{ color }}>
      {label}
    </span>
  )
}
