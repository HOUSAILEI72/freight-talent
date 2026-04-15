import client from './client'

export const invitationsApi = {
  /**
   * 发起邀约（employer/admin）
   * @param {number} jobId
   * @param {number} candidateId
   * @param {string} message
   */
  createInvitation(jobId, candidateId, message) {
    return client.post('/invitations', {
      job_id:       jobId,
      candidate_id: candidateId,
      message,
    })
  },

  /**
   * 企业查看已发出的邀约列表（employer/admin）
   */
  getSentInvitations() {
    return client.get('/invitations/sent')
  },

  /**
   * 候选人查看自己收到的邀约
   */
  getMyInvitations() {
    return client.get('/invitations/my')
  },

  /**
   * 企业获取邀约汇总（用于 Dashboard 统计）
   */
  getCompanySummary() {
    return client.get('/invitations/company-summary')
  },

  /**
   * 候选人回复邀约状态
   * @param {number} invitationId
   * @param {'accepted'|'declined'} status
   */
  updateInvitationStatus(invitationId, status) {
    return client.patch(`/invitations/${invitationId}/status`, { status })
  },
}
