/* eslint-disable react-refresh/only-export-components */
// Shared read-only display primitives for job marketplace pages.
// Used by TerminalCandidateJobs and the terminal branch of JobMarketplace.

export const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly',        label: '月度' },
  { value: 'quarterly',      label: '季度' },
  { value: 'semi_annual',    label: '半年度' },
]

export function splitTokens(str) {
  if (!str) return []
  if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean)
  const parts = String(str).split(/[,，、\n\r;；]+/).map(s => s.trim()).filter(Boolean)
  const seen = new Set(); const out = []
  for (const p of parts) { if (!seen.has(p)) { seen.add(p); out.push(p) } }
  return out
}

export function formatThousand(val) {
  if (!val) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

const LABEL_STYLE = {
  color: 'var(--t-text-secondary)', fontSize: 11, fontWeight: 500,
  display: 'block', marginBottom: 3,
}
const BOX_STYLE = {
  background: 'var(--t-bg-input)',
  border: '1px solid var(--t-border)',
  color: 'var(--t-text)',
  borderRadius: 'var(--t-radius)',
  padding: '6px 10px',
  fontSize: 13,
  lineHeight: 1.45,
  minHeight: 30,
}

export function ReadField({ label, value, empty = '—' }) {
  const display = (value === null || value === undefined || value === '') ? empty : value
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{ ...BOX_STYLE, color: display === empty ? 'var(--t-text-muted)' : 'var(--t-text)' }}>
        {display}
      </div>
    </div>
  )
}

export function ReadChips({ label, value, empty = '—' }) {
  const tokens = Array.isArray(value)
    ? value.map(s => String(s).trim()).filter(Boolean)
    : splitTokens(value)
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      {tokens.length === 0 ? (
        <div style={{ ...BOX_STYLE, color: 'var(--t-text-muted)' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 2 }}>
          {tokens.map((t, i) => (
            <span
              key={i}
              style={{
                padding: '3px 9px', fontSize: 11, borderRadius: 'var(--t-radius-sm)',
                background: 'var(--t-bg-elevated)',
                border: '1px solid var(--t-border)',
                color: 'var(--t-text-secondary)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReadTextarea({ label, value, minHeight = 120 }) {
  const display = (value === null || value === undefined || value === '') ? '—' : value
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{
        ...BOX_STYLE,
        whiteSpace: 'pre-line',
        minHeight,
        color: display === '—' ? 'var(--t-text-muted)' : 'var(--t-text)',
      }}>
        {display}
      </div>
    </div>
  )
}
