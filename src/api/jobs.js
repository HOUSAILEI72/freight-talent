import client from './client'
import { serializeTagGroups } from '../lib/tagGroups'

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
   * @param {{ city?, business_type?, job_type?, function_code?, business_area_code?, location_code?, q?, tagGroups? }} filters
   *   tagGroups: Record<string, number[]>  同组 OR、跨组 AND
   *   business_area_code: see src/utils/businessArea.js BUSINESS_AREAS
   *   location_code:      具体到省/市/区/国家；后端按粒度做前缀匹配
   *   function_code:      Sea / Air / Road / Railway / Contract Logistics / ECOMS
   */
  getPublicJobs(filters = {}) {
    const params = {}
    if (filters.city)               params.city = filters.city
    if (filters.business_type)      params.business_type = filters.business_type
    if (filters.job_type)           params.job_type = filters.job_type
    if (filters.function_code)      params.function_code = filters.function_code
    if (filters.business_area_code) params.business_area_code = filters.business_area_code
    if (filters.location_code)      params.location_code = filters.location_code
    if (filters.q)                  params.q = filters.q
    if (filters.tagGroups) {
      const s = serializeTagGroups(filters.tagGroups)
      if (s) params.tag_groups = s
    }
    return client.get('/jobs/public', { params })
  },

  /** GET /api/jobs/area-filters — counts of published jobs by business_area_code */
  getAreaFilters() {
    return client.get('/jobs/area-filters')
  },
}
