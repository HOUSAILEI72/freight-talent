import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getRoleHome } from './roleHome'

/** 需要登录才能访问的路由守卫 */
export default function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return null // 等待 token 检查完成

  if (!user) {
    // 未登录：跳转到登录页，并携带 next 参数
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (roles && !roles.includes(user.role)) {
    // Role mismatch → bounce to the user's own workspace, NOT the public
    // marketing landing `/`. This prevents logged-in users from ever seeing
    // the Home page as a fallback when they hit a route they can't access.
    return <Navigate to={getRoleHome(user.role)} replace />
  }
  return children
}
