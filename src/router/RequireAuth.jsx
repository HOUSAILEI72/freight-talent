import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** 需要登录才能访问的路由守卫 */
export default function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return null // 等待 token 检查完成
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}
