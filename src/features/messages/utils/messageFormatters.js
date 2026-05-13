export function msgDateKey(isoString) {
  if (!isoString) return ''
  const d   = new Date(isoString)
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateLabel(dateKey) {
  const today     = msgDateKey(new Date().toISOString())
  const yesterday = msgDateKey(new Date(Date.now() - 86400000).toISOString())
  if (dateKey === today)     return '今天'
  if (dateKey === yesterday) return '昨天'
  return dateKey
}
