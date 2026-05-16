import axios from 'axios'
import { applyRefreshInterceptor } from './refreshInterceptor'

const v2 = axios.create({
  baseURL: '/api/v2',
  timeout: 35000,
  headers: { 'Content-Type': 'application/json' },
})

v2.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

applyRefreshInterceptor(v2)

/**
 * 调用 DeepSeek 分析岗位信息，返回 { description, job_tags, soft_skills }
 * @param {object} data - 岗位基础信息字段
 */
export const analyzeJob = (data) =>
  v2.post('/ai/analyze-job', data).then((r) => r.data)
