import client from './client'

export const companiesApi = {
  /** 搜索公司主数据列表（用于屏蔽公司选择器）
   * @param {string} q - 搜索关键词（可选）
   */
  listCompanies(q = '') {
    return client.get('/companies', { params: q ? { q } : {} })
  },
}
