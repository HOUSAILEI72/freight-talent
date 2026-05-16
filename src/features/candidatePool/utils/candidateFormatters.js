export function getSubtitleText(c) {
  return (
    c.current_title ||
    (c.education && c.experience_years != null
      ? `${c.education} · ${c.experience_years}年`
      : c.education || (c.experience_years != null ? `${c.experience_years}年经验` : '匿名候选人'))
  )
}

export function formatSalaryRange(min, max) {
  if (min == null && max == null) return '—'
  return `${min ?? '—'} ~ ${max ?? '—'}`
}

/**
 * Format expected salary for display in candidate pool.
 * Returns e.g. "18K-25K/月", "180K/年", falls back to label.
 */
export function formatExpectedSalary(min, max, period, label) {
  if (min == null && max == null) return label || null
  const suffix = period === 'year' ? '/年' : '/月'
  const fmt = n => `${Math.round(n / 1000)}K`
  if (min != null && max != null && min !== max) return `${fmt(min)}-${fmt(max)}${suffix}`
  const val = min ?? max
  return `${fmt(val)}${suffix}`
}

export function formatYearEndBonus(hasBonus, months) {
  if (hasBonus === true) return months != null ? `${months} 月` : '有'
  if (hasBonus === false) return '无'
  return '—'
}

export function formatWorkPeriod(w) {
  return (
    w.period ||
    (w.start_month || w.end_month
      ? `${w.start_month || '?'} – ${w.end_month || '至今'}`
      : '—')
  )
}
