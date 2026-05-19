import client from './client'

export const notificationsApi = {
  list({ limit = 30, before = null } = {}) {
    const params = { limit }
    if (before != null) params.before = before
    return client.get('/v2/notifications', { params })
  },
  markRead(id) {
    return client.patch(`/v2/notifications/${id}/read`)
  },
  markAllRead() {
    return client.patch('/v2/notifications/read-all')
  },
  dismiss(id) {
    return client.delete(`/v2/notifications/${id}`)
  },
}
