import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// 每次请求自动带上 access token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 防止并发 401 触发多次刷新
let _refreshPromise = null

// 401 → 尝试用 refresh token 换新 access token，成功则重试原请求
// 只有刷新本身失败（或根本没有 refresh token）才清除会话
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // 只处理 401，且避免对 /auth/refresh 和 /auth/login 本身重试
    const isAuthEndpoint =
      original?.url?.includes('/auth/refresh') ||
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/register')

    if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
      original._retry = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        // 没有 refresh token，直接退出
        _expireSession()
        return Promise.reject(err)
      }

      try {
        // 多个并发 401 只发一次刷新请求
        if (!_refreshPromise) {
          _refreshPromise = axios.post(
            '/api/auth/refresh',
            {},
            { headers: { Authorization: `Bearer ${refreshToken}` } }
          ).finally(() => { _refreshPromise = null })
        }

        const { data } = await _refreshPromise
        const newAccess = data.access_token
        const newRefresh = data.refresh_token

        localStorage.setItem('token', newAccess)
        if (newRefresh) localStorage.setItem('refresh_token', newRefresh)

        // 通知 socket 使用新 token（无需断线重连）
        try {
          const { getSocket } = await import('../lib/socket')
          const sock = getSocket()
          if (sock?.connected) {
            sock.emit('reauthenticate', { token: newAccess })
          }
        } catch { /* socket 模块不可用时静默忽略 */ }

        // 用新 access token 重试原请求
        original.headers.Authorization = `Bearer ${newAccess}`
        return client(original)
      } catch {
        // 刷新失败（refresh token 过期或被吊销）→ 强制退出
        _expireSession()
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  }
)

function _expireSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  window.dispatchEvent(new CustomEvent('auth:session-expired'))
}

export default client
