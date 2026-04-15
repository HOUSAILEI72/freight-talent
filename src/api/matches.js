import client from './client'

export const matchesApi = {
  /**
   * 获取岗位的匹配候选人列表（同时触发后端重新计算并写库）
   * @param {number} jobId
   */
  getJobMatches(jobId) {
    return client.get(`/jobs/${jobId}/match`)
  },
}