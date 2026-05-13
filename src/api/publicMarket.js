import client from './client'

export const publicMarketApi = {
  getSnapshot: () => client.get('/public/market-snapshot').then(r => r.data),
}
