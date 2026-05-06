import client from './client'
import { serializeTagGroups } from '../lib/tagGroups'

export const candidatesApi = {
  /** 获取当前候选人的档案（需 candidate token） */
  getMyCandidateProfile() {
    return client.get('/candidates/me')
  },

  /**
   * 创建或更新当前候选人的档案
   * @param {object} data - 候选人资料
   */
  updateMyCandidateProfile(data) {
    return client.put('/candidates/me', data)
  },

  /**
   * 确认当前候选人档案是最新简历，刷新简历鲜度时间。
   */
  confirmLatestResume() {
    return client.post('/candidates/me/confirm-latest')
  },

  /**
   * 上传简历文件（multipart/form-data）
   * @param {File} file
   * @param {function} onProgress - 上传进度回调 (percent: number)
   */
  uploadResumeFile(file, onProgress) {
    const form = new FormData()
    form.append('file', file)
    return client.post('/candidates/upload-resume', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => { if (e.total) onProgress(Math.round((e.loaded / e.total) * 100)) }
        : undefined,
    })
  },

  /**
   * 获取候选人公开档案（供 employer / admin 查看）
   * @param {number} candidateId
   */
  getCandidatePublicProfile(candidateId) {
    return client.get(`/candidates/${candidateId}`)
  },

  /**
   * 获取候选人列表（employer / admin）
   * @param {{ city?, business_type?, job_type?, function_code?, business_area_code?, location_code?, availability_status?, q?, tagGroups? }} filters
   *   tagGroups: Record<string, number[]>  同组 OR、跨组 AND
   *   business_area_code: see src/utils/businessArea.js BUSINESS_AREAS
   *   location_code:      具体到省/市/区/国家；后端按粒度做前缀匹配
   *   function_code:      映射到候选人 business_type 字段
   */
  getCandidates(filters = {}) {
    const params = {}
    if (filters.city)                params.city = filters.city
    if (filters.business_type)       params.business_type = filters.business_type
    if (filters.job_type)            params.job_type = filters.job_type
    if (filters.function_code)       params.function_code = filters.function_code
    if (filters.business_area_code)  params.business_area_code = filters.business_area_code
    if (filters.location_code)       params.location_code = filters.location_code
    if (filters.availability_status) params.availability_status = filters.availability_status
    if (filters.q)                   params.q = filters.q
    if (filters.tagGroups) {
      const s = serializeTagGroups(filters.tagGroups)
      if (s) params.tag_groups = s
    }
    return client.get('/candidates', { params })
  },

  /** GET /api/candidates/area-filters — counts of open/passive candidates by business_area_code */
  getAreaFilters() {
    return client.get('/candidates/area-filters')
  },
}
