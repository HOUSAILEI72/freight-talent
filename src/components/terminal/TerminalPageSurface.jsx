/**
 * TerminalPageSurface
 * Standard outer container for every employer Terminal-mode page.
 *
 * Responsibilities
 *  - Always fill the TerminalLayout main workspace via `flex-1 w-full min-w-0`
 *    so children center / size correctly inside the dark shell.
 *  - Apply `terminal-mode` so styles/terminal.css scoped overrides remap
 *    Tailwind colors to Terminal tokens.
 *  - Provide `var(--t-bg)` background and `var(--t-text)` color.
 *
 * Variants
 *  - `split=false` (default): vertical scroll surface (`overflow-y-auto`)
 *    with `terminal-scrollbar`.
 *  - `split=true`: row flex container with no scroll, used by two-column
 *    pages (JobMarketplace / CandidatePool) that manage their own panes.
 *
 * Principle
 *  - Outer container fills the workspace; INNER content is responsible
 *    for any `mx-auto` / `max-w-*` content width limit. Don't put
 *    `mx-auto` on the outermost terminal container.
 */
export default function TerminalPageSurface({
  children,
  split = false,
  className = '',
  style,
}) {
  const base = 'terminal-mode flex-1 w-full min-w-0'
  const layout = split
    ? 'flex h-full min-h-0 overflow-hidden'
    : 'h-full min-h-0 overflow-y-auto terminal-scrollbar'

  return (
    <div
      className={`${base} ${layout} ${className}`}
      style={{
        background: 'var(--t-bg)',
        color: 'var(--t-text)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
