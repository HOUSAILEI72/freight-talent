/**
 * Shared 401 refresh interceptor — attach to any axios instance.
 * Ensures /api/v2 clients also get automatic token refresh instead of
 * a hard logout when the access token expires.
 */

let _refreshPromise = null

function _expireSession() {
  localStorage.removeItem('token')
  localStorage.removeItem('refresh_token')
  window.dispatchEvent(new CustomEvent('auth:session-expired'))
}

export function applyRefreshInterceptor(axiosInstance) {
  axiosInstance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const original = err.config

      const isAuthEndpoint =
        original?.url?.includes('/auth/refresh') ||
        original?.url?.includes('/auth/login') ||
        original?.url?.includes('/auth/register')

      if (err.response?.status === 401 && !original._retry && !isAuthEndpoint) {
        original._retry = true

        const refreshToken = localStorage.getItem('refresh_token')
        if (!refreshToken) {
          _expireSession()
          return Promise.reject(err)
        }

        try {
          if (!_refreshPromise) {
            const axios = await import('axios')
            _refreshPromise = axios.default.post(
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

          // 通知 socket 使用新 token
          try {
            const { getSocket } = await import('../lib/socket')
            const sock = getSocket()
            if (sock?.connected) {
              sock.emit('reauthenticate', { token: newAccess })
            }
          } catch { /* socket 模块不可用时静默忽略 */ }

          original.headers.Authorization = `Bearer ${newAccess}`
          return axiosInstance(original)
        } catch {
          _expireSession()
          return Promise.reject(err)
        }
      }

      return Promise.reject(err)
    }
  )
}
