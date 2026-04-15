import client from './client'

export const adminApi = {
  /** 获取运营总览统计（仅 admin） */
  getOverview() {
    return client.get('/admin/overview')
  },
}
