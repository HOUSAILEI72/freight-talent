import apiClient from './client'

export const subscriptionsApi = {
  getMySubscription: () => apiClient.get('/subscriptions/me'),
  getPlans:          () => apiClient.get('/subscriptions/plans'),
  getQuota:          () => apiClient.get('/subscriptions/quota'),
  devActivate: (payload) => apiClient.post('/subscriptions/dev-activate', payload),
}
