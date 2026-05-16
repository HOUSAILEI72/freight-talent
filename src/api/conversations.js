import client from './client'

export const conversationsApi = {
  /** 获取当前用户的所有会话列表 */
  getMyConversations() {
    return client.get('/conversations')
  },

  getConversationMessages(threadId, { before = null, limit = 20 } = {}) {
    const params = { limit }
    if (before != null) params.before = before
    return client.get(`/conversations/${threadId}/messages`, { params })
  },

  sendConversationMessage(threadId, content) {
    return client.post(`/conversations/${threadId}/messages`, { content })
  },

  /** POST /api/conversations/open — 打开或创建会话，返回 thread_id */
  openConversation({ jobId, candidateId }) {
    return client.post('/conversations/open', { job_id: jobId, candidate_id: candidateId })
  },
}
