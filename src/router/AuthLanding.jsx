import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Home from '../pages/Home'
import { getRoleHome } from './roleHome'

/**
 * Index route guard for `/`.
 *
 *  - loading            → render nothing (avoid flash of marketing page during token check)
 *  - not logged in      → render Home (public marketing landing)
 *  - logged in          → redirect to role-specific workspace
 *
 * Replaces the previous `{ index: true, element: <Home /> }` so logged-in
 * users never see the marketing page when navigating to `/`.
 */
export default function AuthLanding() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Home />
  return <Navigate to={getRoleHome(user.role)} replace />
}
