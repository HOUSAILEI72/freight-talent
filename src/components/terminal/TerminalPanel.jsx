/**
 * TerminalPanel
 * Phase 1 · Pure visual container — no business logic.
 *
 * Props
 * ─────
 * title     string            Optional header title
 * subtitle  string            Optional subheading beneath title
 * actions   ReactNode         Optional right-side header slot (buttons, badges …)
 * children  ReactNode         Panel body
 * className string            Extra Tailwind / utility classes
 */
export default function TerminalPanel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}) {
  const hasHeader = title || subtitle || actions

  return (
    <div
      className={`rounded-[var(--t-radius-lg)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-[var(--t-shadow-panel)] ${className}`}
    >
      {hasHeader && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--t-border-subtle)] px-5 py-4">
          {(title || subtitle) && (
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-[length:var(--t-text-sm)] font-semibold tracking-wide text-[color:var(--t-text)]">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="mt-0.5 truncate text-[length:var(--t-text-xs)] text-[color:var(--t-text-muted)]">
                  {subtitle}
                </p>
              )}
            </div>
          )}
          {actions && (
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          )}
        </div>
      )}

      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
