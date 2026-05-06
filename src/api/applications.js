import client from './client'

/**
 * CAND-4 — candidate-initiated job applications.
 *
 * Three endpoints:
 *   POST /api/jobs/<id>/applications   (candidate)
 *   GET  /api/applications/my           (candidate)
 *   GET  /api/applications/received     (employer / admin)
 *
 * The privacy unlock that comes from a successful application lives on the
 * back-end (CAND-5). The front-end here only owns the relation lifecycle.
 */
export const applicationsApi = {
  /**
   * 候选人向某岗位投递。
   * @param {number} jobId
   * @param {{ message?: string }} [data]
   *
   * The back-end is idempotent: re-applying to the same job returns the
   * existing record with `duplicate: true` (status 200) instead of 409.
   */
  applyToJob(jobId, data = {}) {
    return client.post(`/jobs/${jobId}/applications`, data || {})
  },

  /** 候选人查看自己已投递的岗位列表。 */
  getMyApplications() {
    return client.get('/applications/my')
  },

  /** 企业 / 管理员查看收到的投递（仅含本企业）。CAND-4 候选人字段保持匿名，
   *  完整解锁逻辑在 CAND-5。
   *  @param {Object} [filters] - 可选过滤条件，如 { status: 'submitted' }
   */
  getReceivedApplications(filters = {}) {
    const params = new URLSearchParams()
    if (filters.status) params.append('status', filters.status)
    const query = params.toString()
    return client.get(`/applications/received${query ? `?${query}` : ''}`)
  },

  /**
   * CAND-4B: 更新投递状态。
   * @param {number} applicationId
   * @param {string} status - 'submitted' | 'viewed' | 'shortlisted' | 'rejected' | 'withdrawn'
   */
  updateApplicationStatus(applicationId, status) {
    return client.patch(`/applications/${applicationId}/status`, { status })
  },
}
