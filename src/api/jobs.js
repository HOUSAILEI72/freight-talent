import client from './client'

export const jobsApi = {
  /**
   * 发布岗位
   * @param {object} data - 岗位表单数据
   */
  createJob(data) {
    return client.post('/jobs', data)
  },

  /** 获取当前登录企业自己的岗位列表 */
  getMyJobs() {
    return client.get('/jobs/my')
  },

  /**
   * 获取单个岗位详情
   * @param {number} jobId
   */
  getJobById(jobId) {
    return client.get(`/jobs/${jobId}`)
  },

  /**
   * 获取公开岗位列表（所有已发布岗位，candidate / employer / admin 均可访问）
   * @param {{ city?, business_type?, job_type?, q? }} filters
   */
  getPublicJobs(filters = {}) {
    const params = {}
    if (filters.city)          params.city = filters.city
    if (filters.business_type) params.business_type = filters.business_type
    if (filters.job_type)      params.job_type = filters.job_type
    if (filters.q)             params.q = filters.q
    return client.get('/jobs/public', { params })
  },
}