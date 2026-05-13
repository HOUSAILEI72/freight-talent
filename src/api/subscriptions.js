import apiClient from './client'

export const subscriptionsApi = {
  getMySubscription: () => apiClient.get('/subscriptions/me'),
  getPlans:          () => apiClient.get('/subscriptions/plans'),
  devActivate: (payload) => apiClient.post('/subscriptions/dev-activate', payload),
}
