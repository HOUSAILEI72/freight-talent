import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import './styles/index.css'
import './styles/terminal.css'
import { router } from './router/index.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/ui/Toast'
import { TerminalThemeProvider } from './context/TerminalThemeContext.jsx'
import { NotificationProvider } from './context/NotificationContext.jsx'

const _SENTRY_SENSITIVE = new Set([
  'authorization', 'cookie', 'set-cookie',
  'password', 'token', 'access_token', 'refresh_token',
  'phone', 'email', 'resume', 'attachment',
])

function _stripSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) =>
      _SENTRY_SENSITIVE.has(k.toLowerCase()) ? [k, '[FILTERED]'] : [k, v]
    )
  )
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: 'production',
    tracesSampleRate: 0.05,
    beforeSend(event) {
      if (event.request?.headers) {
        event.request.headers = _stripSensitive(event.request.headers)
      }
      if (event.request?.data) {
        event.request.data = null
      }
      return event
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TerminalThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationProvider>
            <RouterProvider router={router} />
          </NotificationProvider>
        </AuthProvider>
      </ToastProvider>
    </TerminalThemeProvider>
  </StrictMode>,
)