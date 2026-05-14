import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'ace_terminal_theme_mode'
const VALID_MODES = ['system', 'light', 'dark']

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function readStoredMode() {
  const v = localStorage.getItem(STORAGE_KEY)
  return VALID_MODES.includes(v) ? v : 'system'
}

const TerminalThemeContext = createContext(null)

export function TerminalThemeProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(readStoredMode)
  const [systemTheme, setSystemTheme] = useState(getSystemTheme)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setSystemTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function setThemeMode(mode) {
    if (!VALID_MODES.includes(mode)) return
    localStorage.setItem(STORAGE_KEY, mode)
    setThemeModeState(mode)
  }

  const effectiveTheme = themeMode === 'system' ? systemTheme : themeMode

  return (
    <TerminalThemeContext.Provider value={{ themeMode, effectiveTheme, setThemeMode }}>
      {children}
    </TerminalThemeContext.Provider>
  )
}

export function useTerminalTheme() {
  const ctx = useContext(TerminalThemeContext)
  if (!ctx) throw new Error('useTerminalTheme must be used inside TerminalThemeProvider')
  return ctx
}
