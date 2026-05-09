import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, Wrench, UserSearch, UsersRound } from 'lucide-react'

/**
 * TerminalActionBar
 * Phase 1 · Primary CTAs below the chart panel.
 *
 * Routes:
 *  - 发布岗位 → /employer/jobs/new
 *  - 候选人池 → /employer/candidates
 */

function ActionButton({ icon, label, hint, onClick, primary = false, disabled = false }) {
  const IconComponent = icon
  const base =
    'group inline-flex h-11 items-center gap-2.5 rounded-[var(--t-radius)] border px-4 text-left transition-colors duration-[var(--t-transition)]'
  const styles = disabled
    ? 'cursor-not-allowed border-[var(--t-border)] bg-[var(--t-bg-elevated)] text-[color:var(--t-text-muted)] opacity-70'
    : primary
    ? 'border-[color:var(--t-primary)] bg-[color:var(--t-primary)] text-white hover:bg-[color:var(--t-primary-hover)]'
    : 'border-[var(--t-border)] bg-[var(--t-bg-elevated)] text-[color:var(--t-text)] hover:bg-[var(--t-bg-hover)]'

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
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
    {
      icon: Wrench,
      label: '辅助工具包',
      hint: 'TOOLS',
      disabled: true,
    },
    {
      icon: UserSearch,
      label: '猎头服务',
      hint: 'HEADHUNTING',
      disabled: true,
    },
    {
      icon: UsersRound,
      label: '团队猎头服务',
      hint: 'TEAM SEARCH',
      disabled: true,
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
          disabled={item.disabled}
          onClick={item.onClick ?? (item.href ? () => navigate(item.href) : undefined)}
        />
      ))}
    </div>
  )
}
