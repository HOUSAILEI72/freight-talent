import { useNavigate } from 'react-router-dom'
import { Briefcase, Users, Wrench, UserSearch, UsersRound } from 'lucide-react'

function ActionButton({ icon, label, hint, onClick, primary = false, disabled = false }) {
  const IconComponent = icon
  const base = 'terminal-action-bar-btn border font-[var(--t-font-sans)] text-left transition-colors duration-[var(--t-transition)] cursor-pointer'
  const styles = disabled
    ? 'cursor-not-allowed border-[var(--t-border)] bg-[var(--t-bg-elevated)] text-[color:var(--t-text-muted)] opacity-70'
    : primary
    ? 'border-[color:var(--t-primary)] bg-[color:var(--t-primary)] text-[color:var(--t-primary-fg)] hover:bg-[color:var(--t-primary-hover)]'
    : 'border-[var(--t-border)] bg-[var(--t-bg-elevated)] text-[color:var(--t-text)] hover:bg-[var(--t-bg-hover)]'

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${styles}`}>
      <IconComponent size={15} className="shrink-0" />
      <span className="flex flex-col leading-tight min-w-0">
        <span className="text-[length:var(--t-text-sm)] font-semibold truncate">
          {label}
        </span>
        {hint && (
          <span
            className="action-hint text-[10px] tracking-[0.04em] truncate"
            style={{
              color: primary ? 'var(--t-primary-fg)' : 'var(--t-text-muted)',
              opacity: primary ? 0.65 : 1,
            }}
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
    { icon: Briefcase,  label: '发布岗位',   hint: 'POST · NEW JOB',        primary: true, href: '/employer/jobs/new' },
    { icon: Users,      label: '候选人池',   hint: 'BROWSE · CANDIDATES',   href: '/employer/candidates' },
    { icon: Wrench,     label: '辅助工具包', hint: 'TOOLS',                  disabled: true },
    { icon: UserSearch, label: '个人猎头服务', hint: 'HEADHUNTING',          href: '/employer/headhunting/personal' },
    { icon: UsersRound, label: '团队猎头服务', hint: 'TEAM SEARCH',          href: '/employer/headhunting/team' },
  ]

  return (
    <div className="terminal-action-bar">
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
