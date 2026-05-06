import client from './client'

export const employerDashboardApi = {
  getFilters() {
    return client.get('/employer/dashboard-filters')
  },

  getChart({ functionValue = 'ALL', regionValue = 'ALL', granularity = 'day', limit = 20 } = {}) {
    return client.get('/employer/dashboard-chart', {
      params: {
        function: functionValue,
        region: regionValue,
        granularity,
        limit,
      },
    })
  },
}
