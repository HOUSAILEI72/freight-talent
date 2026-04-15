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

export default function App() {
  const location = useLocation()
  const hideFooter = location.pathname.startsWith('/admin')

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