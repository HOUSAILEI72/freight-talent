/**
 * LoadingState
 * Phase 1 · Freightos Terminal style loading placeholder — no business logic.
 *
 * Props
 * ─────
 * title       string   Optional heading (default: "Loading…")
 * description string   Optional supporting text
 * className   string   Extra utility classes
 */
export default function LoadingState({
  title = 'Loading…',
  description,
  className = '',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-4 py-16 text-center ${className}`}
    >
      {/* ── Spinner ── */}
      <span
        aria-hidden="true"
        className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--t-border)] border-t-[var(--t-primary)]"
      />

      {/* ── Label ── */}
      <div className="flex flex-col gap-1">
        <span className="text-[length:var(--t-text-sm)] font-medium text-[color:var(--t-text-secondary)]">
          {title}
        </span>
        {description && (
          <span className="text-[length:var(--t-text-xs)] text-[color:var(--t-text-muted)]">
            {description}
          </span>
        )}
      </div>

      {/* ── Screen-reader text ── */}
      <span className="sr-only">{title}</span>
    </div>
  )
}
