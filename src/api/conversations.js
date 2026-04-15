import client from './client'

export const conversationsApi = {
  /** 获取当前用户的所有会话列表 */
  getMyConversations() {
    return client.get('/conversations')
  },

  /**
   * 获取某条会话的消息列表
   * @param {number} threadId
   * @param {{ before?: number, limit?: number }} options
   */
  getConversationMessages(threadId, { before = null, limit = 20 } = {}) {
    const params = { limit }
    if (before != null) params.before = before
    return client.get(`/conversations/${threadId}/messages`, { params })
  },

  /**
   * 在某条会话中发送消息
   * @param {number} threadId
   * @param {string} content
   */
  sendConversationMessage(threadId, content) {
    return client.post(`/conversations/${threadId}/messages`, { content })
  },
}
