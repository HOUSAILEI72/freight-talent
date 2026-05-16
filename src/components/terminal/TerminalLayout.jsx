import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import {
  Bell,
  LogOut,
  Sun,
  Moon,
  SunMoon,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getRoleHome } from '../../router/roleHome'
import { EMPLOYER_ICON_NAV } from './navItems'
import { useTerminalTheme } from '../../context/TerminalThemeContext'

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

function PricingButton({ onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="订阅方案"
      className="terminal-pricing-btn"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 32,
        padding: '0 14px',
        borderRadius: 'var(--t-radius)',
        border: 'none',
        background: hover ? 'var(--t-pricing-bg-hover)' : 'var(--t-pricing-bg)',
        color: 'var(--t-pricing-text)',
        fontFamily: 'var(--t-font-sans)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'background 120ms',
        flexShrink: 0,
      }}
    >
      <span className="pricing-text">VIEW PRICING</span>
    </button>
  )
}

function IconRail({ activeId = 'dashboard', navItems = EMPLOYER_ICON_NAV }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { effectiveTheme } = useTerminalTheme()
  const [hoveredId, setHoveredId] = useState(null)
  const logoSrc = effectiveTheme === 'light' ? '/logo.svg' : '/logo-white.svg'

  return (
    <aside
      className="flex h-full w-[60px] shrink-0 flex-col items-center justify-between border-r border-[var(--t-border)] py-3"
      style={{ background: 'var(--t-bg-panel)' }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(user ? getRoleHome(user.role) : '/')}
          className="flex h-9 w-9 items-center justify-center"
          title="Logistics Talent"
        >
          <img src={logoSrc} alt="Logistics Talent" className="h-8 w-8" />
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
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
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
              {hoveredId === item.id && (
                <span
                  className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-[var(--t-radius-sm)] bg-[var(--t-bg-active)] px-2 py-1 text-[length:var(--t-text-xs)] text-[color:var(--t-text)] shadow-lg"
                  style={{ zIndex: 100 }}
                >
                  {item.label}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* footer placeholder */}
      <div className="h-2" />
    </aside>
  )
}

const THEME_CYCLE = ['dark', 'light', 'system']
const THEME_META = {
  dark:   { Icon: Moon,    label: '深色模式' },
  light:  { Icon: Sun,     label: '浅色模式' },
  system: { Icon: SunMoon, label: '跟随系统' },
}

function ThemeToggleButton() {
  const { themeMode, setThemeMode } = useTerminalTheme()
  const [hover, setHover] = useState(false)
  const { Icon, label } = THEME_META[themeMode] ?? THEME_META.dark

  function handleClick() {
    const idx = THEME_CYCLE.indexOf(themeMode)
    setThemeMode(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length])
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--t-radius)]"
      style={{
        background: hover ? 'var(--t-bg-hover)' : 'transparent',
        color: hover ? 'var(--t-text)' : 'var(--t-text-secondary)',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 120ms, color 120ms',
        flexShrink: 0,
      }}
    >
      <Icon size={15} />
    </button>
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
      style={{ background: 'var(--t-bg-elevated)' }}
    >
      <div className="flex items-center gap-3 min-w-0 terminal-header-brand">
        <span className="font-[var(--t-font-sans)] text-[13px] font-bold uppercase tracking-[0.06em] text-[color:var(--t-chart-cyan)]">
          ACE
        </span>
        <span className="brand-sep font-[var(--t-font-sans)] text-[12px] font-bold text-[color:var(--t-chart-cyan)]">×</span>
        <span className="brand-terminal font-[var(--t-font-sans)] text-[11px] font-medium uppercase tracking-[0.08em] text-[color:var(--t-text-secondary)]" style={{ opacity: 0.7 }}>
          LOGISTICS
        </span>
        <span className="brand-sep text-[color:var(--t-text-muted)]">·</span>
        <span className="brand-page font-[var(--t-font-sans)] text-[14px] font-bold uppercase tracking-[0.12em] text-[color:var(--t-text)] truncate">
          {title}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Pricing button — employer + candidate */}
        {(user?.role === 'employer' || user?.role === 'candidate') && (
          <PricingButton onClick={() => navigate('/employer/pricing')} />
        )}

        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-[var(--t-radius)] text-[color:var(--t-text-secondary)] hover:bg-[var(--t-bg-hover)] hover:text-[color:var(--t-text)]"
          title="通知"
        >
          <Bell size={15} />
        </button>

        <ThemeToggleButton />

        <div className="mx-1 h-5 w-px bg-[var(--t-border)]" />

        <div className="terminal-header-user flex items-center gap-2 rounded-[var(--t-radius)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] px-2.5 py-1">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--t-primary)] text-[10px] font-bold text-white">
            {(user?.name?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
          </div>
          <span className="user-name max-w-[120px] truncate text-[length:var(--t-text-xs)] font-medium text-[color:var(--t-text)]">
            {companyName}
          </span>
          {roleLabel && (
            <span className="role-badge rounded border border-[var(--t-border)] px-1 text-[10px] text-[color:var(--t-text-muted)]">
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
  shellClassName = '',
  bodyBackground,
  children,
}) {
  const { effectiveTheme } = useTerminalTheme()

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
    return () => {
      html.style.cssText = prevHtml
      body.style.cssText = prevBody
    }
  }, [])

  // Sync body background to avoid color bleed around shell edges.
  // body is outside .terminal-shell so can't inherit scoped tokens.
  useEffect(() => {
    const BG = { dark: bodyBackground ?? '#0b0e13', light: '#f6f8fb' }
    document.body.style.background = BG[effectiveTheme] ?? BG.dark
  }, [effectiveTheme, bodyBackground])

  return (
    <div
      className={`terminal-shell${shellClassName ? ` ${shellClassName}` : ''} text-[color:var(--t-text)]`}
      data-terminal-theme={effectiveTheme}
      style={{ background: 'var(--t-bg)' }}
    >
      <IconRail activeId={activeIconId} navItems={navItems} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TerminalHeader title={title} />
        <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  )
}
