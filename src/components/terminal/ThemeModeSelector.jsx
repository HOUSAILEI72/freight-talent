import { Monitor, Sun, Moon } from 'lucide-react'
import { useTerminalTheme } from '../../context/TerminalThemeContext'

const OPTIONS = [
  { mode: 'system', label: '跟随系统', icon: Monitor },
  { mode: 'light',  label: '浅色',     icon: Sun },
  { mode: 'dark',   label: '深色',     icon: Moon },
]

export default function ThemeModeSelector() {
  const { themeMode, setThemeMode } = useTerminalTheme()

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {OPTIONS.map(({ mode, label, icon: Icon }) => {
        const active = themeMode === mode
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setThemeMode(mode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              borderRadius: 'var(--t-radius)',
              border: active
                ? '1px solid var(--t-primary)'
                : '1px solid var(--t-border)',
              background: active ? 'var(--t-bg-active)' : 'transparent',
              color: active ? 'var(--t-primary)' : 'var(--t-text-secondary)',
              fontFamily: 'var(--t-font-mono)',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              transition: 'background 120ms, border-color 120ms, color 120ms',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.background = 'var(--t-bg-hover)'
                e.currentTarget.style.color = 'var(--t-text)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--t-text-secondary)'
              }
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
