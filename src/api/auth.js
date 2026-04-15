import client from './client'

export const authApi = {
  /**
   * 登录
   * @param {{ email: string, password: string }} data
   */
  login(data) {
    return client.post('/auth/login', data)
  },

  /**
   * 注册
   * @param {{ email: string, password: string, name: string, role: string, company_name?: string }} data
   */
  register(data) {
    return client.post('/auth/register', data)
  },

  /** 获取当前登录用户信息（需 token） */
  me() {
    return client.get('/auth/me')
  },

  /**
   * 登出：把 access token 和 refresh token 都传给后端撤销
   * @param {{ refresh_token?: string }} [data]
   */
  logout(data = {}) {
    return client.post('/auth/logout', data)
  },
}

