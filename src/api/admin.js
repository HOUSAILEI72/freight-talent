import client from './client'

export const adminApi = {
  /** 获取运营总览统计（仅 admin） */
  getOverview() {
    return client.get('/admin/overview')
  },

  // ── 批量导入 ──────────────────────────────────────────────────────────────

  /** 上传 Excel 执行预检，返回 batch_id + 预检摘要 */
  previewImport(formData) {
    return client.post('/admin/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  /** 列出历史导入批次（分页） */
  listBatches({ page = 1, perPage = 20, importType = '' } = {}) {
    const params = { page, per_page: perPage }
    if (importType) params.import_type = importType
    return client.get('/admin/import/batches', { params })
  },

  /** 获取单个批次详情（可含行级结果） */
  getBatch(batchId, { includeRows = false } = {}) {
    return client.get(`/admin/import/batches/${batchId}`, {
      params: { include_rows: includeRows },
    })
  },

  /** 执行 dry run（不写 DB，返回可写行数预估） */
  dryRunImport(batchId, { skipErrors = false } = {}) {
    return client.post(`/admin/import/batches/${batchId}/confirm`, null, {
      params: { dry_run: 'true', skip_errors: skipErrors ? 'true' : 'false' },
    })
  },

  /** 确认并执行真实写入 */
  confirmImport(batchId, { skipErrors = false } = {}) {
    return client.post(`/admin/import/batches/${batchId}/confirm`, null, {
      params: { skip_errors: skipErrors ? 'true' : 'false' },
    })
  },

  /** 以 Blob 形式下载标注 Excel（走 axios 带 Authorization 头，避免裸链接 401） */
  downloadAnnotated(batchId) {
    return client.get(`/admin/import/batches/${batchId}/download`, {
      responseType: 'blob',
    })
  },
}
