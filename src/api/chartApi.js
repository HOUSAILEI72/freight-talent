import axios from 'axios'
import { serializeTagGroups } from '../lib/tagGroups'

const v2 = axios.create({
  baseURL: '/api/v2',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

v2.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** @param {{ tagGroups?: Record<string,number[]>, granularity?: string, periods?: number, refresh?: boolean }} params */
export const getCandidateChart = ({ tagGroups = {}, granularity = 'month', periods = 12, refresh = false }) =>
  v2.get('/candidates/chart', {
    params: { tag_groups: serializeTagGroups(tagGroups), granularity, periods, refresh },
  }).then(r => r.data)

/** @param {{ tagGroups?: Record<string,number[]>, granularity?: string, periods?: number, refresh?: boolean }} params */
export const getJobChart = ({ tagGroups = {}, granularity = 'month', periods = 12, refresh = false }) =>
  v2.get('/jobs/chart', {
    params: { tag_groups: serializeTagGroups(tagGroups), granularity, periods, refresh },
  }).then(r => r.data)
