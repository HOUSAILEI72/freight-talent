import { useLayoutEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'

// Reset scroll to top on every route change, before the browser paints,
// so the new page always starts at the top without a visible jump.
function ScrollToTop() {
  const { pathname } = useLocation()
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

// Routes that use full-screen Terminal layout — no Navbar / Footer.
const TERMINAL_PREFIXES = [
  '/employer/dashboard',
  '/employer/jobs',
  '/employer/candidates',
  '/employer/applications',
  '/employer/post-job',
  '/employer/match',
  '/employer/messages',
  '/employer/tags',
  '/candidate/home',
  '/candidate/jobs',
  '/candidate/messages',
  '/candidate/tags',
  '/candidate/upload',
  '/candidate/invitations',
  '/candidate/applications',
  '/candidate/profile/me',
  '/candidate/profile/builder',
]

export default function App() {
  const location = useLocation()
  const hideFooter = location.pathname.startsWith('/admin')
  const isTerminal = TERMINAL_PREFIXES.some((p) => location.pathname.startsWith(p))

  if (isTerminal) {
    return (
      <>
        <ScrollToTop />
        <Outlet />
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Navbar />
      {/* min-height keeps the footer anchored at the bottom even on short/loading pages */}
      <main className="flex-1" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
}
