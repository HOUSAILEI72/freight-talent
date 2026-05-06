import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 应用启动时：用本地 token 还原登录态
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      return
    }
    authApi.me()
      .then((res) => setUser(res.data.user))
      .catch(() => {
        // Access token is invalid and refresh (if any) already failed via interceptor
        localStorage.removeItem('token')
        localStorage.removeItem('refresh_token')
      })
      .finally(() => setLoading(false))
  }, [])

  // When the API client receives a 401, it dispatches this event.
  // Clear user state so all polling intervals (Navbar, Messages, etc.) stop.
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('auth:session-expired', handler)
    return () => window.removeEventListener('auth:session-expired', handler)
  }, [])

  const login = useCallback(async ({ email, password, role }) => {
    const res = await authApi.login({ email, password, role })
    const { access_token: token, refresh_token, user: userData } = res.data
    localStorage.setItem('token', token)
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
    setUser(userData)
    return userData
  }, [])

  const register = useCallback(async ({ email, password, name, role, company_name }) => {
    const res = await authApi.register({ email, password, name, role, company_name })
    const { access_token: token, refresh_token, user: userData } = res.data
    localStorage.setItem('token', token)
    if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(async () => {
    // 把 refresh_token 传给后端，让服务端同时撤销，防止 refresh token 继续换 access token
    const refreshToken = localStorage.getItem('refresh_token')
    await authApi.logout(refreshToken ? { refresh_token: refreshToken } : {}).catch(() => {})
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook 与 provider 共存于同一文件是惯例
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}