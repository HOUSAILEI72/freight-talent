import client from './client'

export const headhuntingApi = {
  createRequest(payload) {
    return client.post('/headhunting/requests', payload)
  },
  getMyRequests(serviceType) {
    const params = serviceType ? { service_type: serviceType } : {}
    return client.get('/headhunting/requests', { params })
  },
}
