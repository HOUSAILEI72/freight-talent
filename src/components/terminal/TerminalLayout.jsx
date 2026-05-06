import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import {
  Bell,
  LogOut,
  Ship,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getRoleHome } from '../../router/roleHome'
import { EMPLOYER_ICON_NAV } from './navItems'

/**
 * TerminalLayout
 * Phase 1 · Freightos Terminal full-screen shell.
 *
 * Provides:
 *  - 100vw / 100vh dark workspace
 *  - Left IconRail (deep dark)
 *  - Top TerminalHeader
 *  - Children render in main workspace area
 *
 * No business logic / no API calls.
 */

const ROLE_LABEL = { employer: '企业', candidate: '候选人', admin: '管理员' }

function IconRail({ activeId = 'dashboard', navItems = EMPLOYER_ICON_NAV }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  return (
    <aside
      className="flex h-full w-[60px] shrink-0 flex-col items-center justify-between border-r border-[var(--t-border)] py-3"
      style={{ background: '#070a10' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(user ? getRoleHome(user.role) : '/')}
          className="flex h-9 w-9 items-center justify-center rounded-[var(--t-radius)] bg-[color:var(--t-primary)] text-white shadow-[var(--t-shadow-panel)]"
          title="ACE-Talent"
        >
          <Ship size={16} />
        </button>

        <div className="my-2 h-px w-6 bg-[var(--t-border)]" />

        {navItems.map((item) => {
          const Icon = item.icon
          const active = item.id === activeId
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.href)}
              title={item.label}
              className={`group relative flex h-9 w-9 items-center justify-center rounded-[var(--t-radius)] transition-colors duration-[var(--t-transition)] ${
                active
                  ? 'bg-[var(--t-bg-active)] text-[color:var(--t-text)]'
                  : 'text-[color:var(--t-text-muted)] hover:bg-[var(--t-bg-hover)] hover:text-[color:var(--t-text)]'
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1.5 h-6 w-0.5 rounded-r bg-[color:var(--t-primary)]" />
              )}
              <Icon size={16} />
            </button>
          )
        })}
      </div>

      {/* footer placeholder */}
      <div className="h-2" />
    </aside>
  )
}

function TerminalHeader({ title = 'DASHBOARD' }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const companyName = user?.company_name || user?.name || 'Employer'
  const roleLabel = user ? ROLE_LABEL[user.role] ?? user.role : ''

  return (
    <header
      className="flex h-[60px] shrink-0 items-center justify-between border-b border-[var(--t-border)] px-5"
      style={{ background: '#0a0f17' }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] font-bold uppercase tracking-[0.18em] text-[color:var(--t-chart-cyan)]">
          ACE-TALENT
        </span>
        <span className="text-[color:var(--t-text-muted)]">·</span>
        <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-xs)] uppercase tracking-[0.16em] text-[color:var(--t-text-secondary)]">
          TERMINAL
        </span>
        <span className="text-[color:var(--t-text-muted)]">·</span>
        <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold uppercase tracking-wider text-[color:var(--t-text)]">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--t-radius)] text-[color:var(--t-text-secondary)] hover:bg-[var(--t-bg-hover)] hover:text-[color:var(--t-text)]"
          title="通知"
        >
          <Bell size={15} />
        </button>

        <div className="mx-1 h-5 w-px bg-[var(--t-border)]" />

        <div className="flex items-center gap-2 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] px-2.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--t-primary)] text-[10px] font-bold text-white">
            {(user?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <span className="max-w-[120px] truncate text-[length:var(--t-text-xs)] font-medium text-[color:var(--t-text)]">
            {companyName}
          </span>
          {roleLabel && (
            <span className="rounded border border-[var(--t-border)] px-1 text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
              {roleLabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--t-radius)] text-[color:var(--t-text-muted)] hover:bg-[var(--t-bg-hover)] hover:text-[color:var(--t-danger)]"
          title="退出登录"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}

export default function TerminalLayout({
  title = 'DASHBOARD',
  activeIconId = 'dashboard',
  navItems = EMPLOYER_ICON_NAV,
  children,
}) {
  // Lock html/body overflow so the terminal truly fills 100vh without
  // the global `html { overflow-y: scroll }` reserving a scrollbar gutter.
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.cssText
    const prevBody = body.style.cssText
    html.style.overflow = 'hidden'
    html.style.scrollbarGutter = 'auto'
    body.style.overflow = 'hidden'
    body.style.background = 'var(--t-bg)'
    return () => {
      html.style.cssText = prevHtml
      body.style.cssText = prevBody
    }
  }, [])

  return (
    <div
      className="flex overflow-hidden text-[color:var(--t-text)]"
      style={{ width: '100vw', height: '100vh', background: 'var(--t-bg)' }}
    >
      <IconRail activeId={activeIconId} navItems={navItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TerminalHeader title={title} />
        <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
