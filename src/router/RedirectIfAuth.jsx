import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRoleHome } from './roleHome'

/**
 * Inverse of `RequireAuth`: blocks logged-in users from rendering routes
 * that are only meaningful pre-login (currently `/login`).
 *
 *  - loading        → render nothing (avoid flashing the login form during
 *                     the initial token check)
 *  - logged in      → redirect to the user's role home via `getRoleHome`
 *  - not logged in  → render children (the login page)
 *
 * Reuses the same `getRoleHome` source of truth as `AuthLanding` /
 * `RequireAuth` / `Login.jsx`. Don't introduce a second REDIRECT map.
 */
export default function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to={getRoleHome(user.role)} replace />
  return children
}
