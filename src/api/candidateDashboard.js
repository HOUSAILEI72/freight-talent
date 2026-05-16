import client from './client'

export const candidateDashboardApi = {
  getSummary() {
    return client.get('/candidate/dashboard-summary')
  },
}
