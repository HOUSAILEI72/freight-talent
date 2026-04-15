import client from './client'

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
   * @param {{ city?, business_type?, job_type?, availability_status?, q? }} filters
   */
  getCandidates(filters = {}) {
    const params = {}
    if (filters.city)                params.city = filters.city
    if (filters.business_type)       params.business_type = filters.business_type
    if (filters.job_type)            params.job_type = filters.job_type
    if (filters.availability_status) params.availability_status = filters.availability_status
    if (filters.q)                   params.q = filters.q
    return client.get('/candidates', { params })
  },
}