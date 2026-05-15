import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import './styles/index.css'
import './styles/terminal.css'
import { router } from './router/index.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ToastProvider } from './components/ui/Toast'
import { TerminalThemeProvider } from './context/TerminalThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TerminalThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </TerminalThemeProvider>
  </StrictMode>,
)