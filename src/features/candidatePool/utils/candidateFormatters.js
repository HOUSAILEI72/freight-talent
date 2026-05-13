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
