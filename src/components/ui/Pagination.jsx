import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Pagination bar — supports both light and terminal (deep-dark) modes.
 * Shows at most 5 page buttons with ellipsis when needed.
 */
export default function Pagination({ page, totalPages, onPageChange, terminal = false }) {
  if (totalPages <= 1) return null

  const btnBase = terminal
    ? 'w-7 h-7 flex items-center justify-center rounded font-sans text-xs transition-colors'
    : 'w-7 h-7 flex items-center justify-center rounded text-xs transition-colors'

  function btnStyle(active, disabled) {
    if (terminal) {
      if (disabled) return { color: 'var(--t-text-muted)', cursor: 'default', opacity: 0.4 }
      if (active)   return { background: 'var(--t-primary)', color: 'var(--t-bg)', fontWeight: 600 }
      return { color: 'var(--t-text-secondary)', background: 'transparent' }
    }
    if (disabled) return { opacity: 0.35, cursor: 'default' }
    if (active)   return { background: '#3b82f6', color: '#fff', fontWeight: 600 }
    return { color: '#64748b' }
  }

  // Build page number list with ellipsis
  function pageNumbers() {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = []
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) {
      pages.push(p)
    }
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
    return pages
  }

  const wrapStyle = terminal
    ? { borderTop: '1px solid var(--t-border-subtle)' }
    : { borderTop: '1px solid #e2e8f0' }

  return (
    <div
      className="flex items-center justify-center gap-1 py-2 px-3"
      style={wrapStyle}
    >
      <button
        type="button"
        className={btnBase}
        style={btnStyle(false, page <= 1)}
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="上一页"
      >
        <ChevronLeft size={13} />
      </button>

      {pageNumbers().map((p, i) =>
        p === '…' ? (
          <span
            key={`ellipsis-${i}`}
            className="w-7 h-7 flex items-center justify-center text-xs"
            style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8' }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            className={btnBase}
            style={btnStyle(p === page, false)}
            onClick={() => p !== page && onPageChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        className={btnBase}
        style={btnStyle(false, page >= totalPages)}
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="下一页"
      >
        <ChevronRight size={13} />
      </button>
    </div>
  )
}
