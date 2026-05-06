import { useNavigate } from 'react-router-dom'
import { Briefcase, Users } from 'lucide-react'

/**
 * TerminalActionBar
 * Phase 1 · Two primary CTAs below the chart panel.
 *
 * Routes:
 *  - 发布岗位 → /employer/jobs/new
 *  - 候选人池 → /employer/candidates
 */

function ActionButton({ icon, label, hint, onClick, primary = false }) {
  const IconComponent = icon
  const base =
    'group inline-flex h-11 items-center gap-2.5 rounded-[var(--t-radius)] border px-4 text-left transition-colors duration-[var(--t-transition)]'
  const styles = primary
    ? 'border-[color:var(--t-primary)] bg-[color:var(--t-primary)] text-white hover:bg-[color:var(--t-primary-hover)]'
    : 'border-[var(--t-border)] bg-[var(--t-bg-elevated)] text-[color:var(--t-text)] hover:bg-[var(--t-bg-hover)]'

  return (
    <button type="button" onClick={onClick} className={`${base} ${styles}`}>
      <IconComponent size={16} className="shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold uppercase tracking-wider">
          {label}
        </span>
        {hint && (
          <span
            className={`text-[10px] tracking-wider ${
              primary ? 'text-white/70' : 'text-[color:var(--t-text-muted)]'
            }`}
          >
            {hint}
          </span>
        )}
      </span>
    </button>
  )
}

export default function TerminalActionBar({ actions }) {
  const navigate = useNavigate()
  const items = actions ?? [
    {
      icon: Briefcase,
      label: '发布岗位',
      hint: 'POST · NEW JOB',
      primary: true,
      href: '/employer/jobs/new',
    },
    {
      icon: Users,
      label: '候选人池',
      hint: 'BROWSE · CANDIDATES',
      href: '/employer/candidates',
    },
  ]

  return (
    <div
      className="flex shrink-0 items-center gap-3 border-t border-[var(--t-border-subtle)] px-1 pt-4"
    >
      {items.map((item) => (
        <ActionButton
          key={item.label}
          icon={item.icon}
          label={item.label}
          hint={item.hint}
          primary={item.primary}
          onClick={item.onClick ?? (() => navigate(item.href))}
        />
      ))}
    </div>
  )
}
