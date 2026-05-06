/**
 * /api/v2 (FastAPI) 标签体系接口
 */
import axios from 'axios'

// v2 client — baseURL 指向 FastAPI，复用 localStorage token
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

// ── 标签分类 ──────────────────────────────────────────────────────────────────

/** 返回所有有 active 词条的 category 列表 */
export const getCategories = () =>
  v2.get('/tags/categories').then((r) => r.data)

/** 返回标签。include_pending=true 时把 pending 也带上（admin 标签库视图用） */
export const getTags = (params = {}) =>
  v2.get('/tags', { params }).then((r) => r.data)

/** 申请或创建新标签 */
export const submitTag = (data) =>
  v2.post('/tags', data).then((r) => r.data)

/** 上传 Excel 批量导入标签（admin） */
export const importTagsExcel = (file) => {
  const form = new FormData()
  form.append('file', file)
  return v2
    .post('/tags/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((r) => r.data)
}

// ── 审批（admin） ─────────────────────────────────────────────────────────────

/** 待审批标签列表 */
export const getPendingTags = () =>
  v2.get('/tags/pending').then((r) => r.data)

/** 当前用户提交过的全部标签（含 pending/active/rejected） */
export const getMyTags = () =>
  v2.get('/tags/mine').then((r) => r.data)

/** 审批标签：action = 'approve' | 'reject' */
export const reviewTag = (id, action, rejectReason = '') =>
  v2.patch(`/tags/${id}/review`, { action, reject_reason: rejectReason }).then((r) => r.data)

/** 批量审批 pending 标签 */
export const reviewTagsBulk = (tagIds, action, rejectReason = '') =>
  v2.patch('/tags/review-bulk', {
    tag_ids: tagIds, action, reject_reason: rejectReason,
  }).then((r) => r.data)

/** 待审批描述列表 */
export const getPendingNotes = () =>
  v2.get('/tags/notes/pending').then((r) => r.data)

/** 审批描述 */
export const reviewNote = (id, action, rejectReason = '') =>
  v2.patch(`/tags/notes/${id}/review`, { action, reject_reason: rejectReason }).then((r) => r.data)

// ── 标签描述 ──────────────────────────────────────────────────────────────────

/** 某标签的所有 active 描述（公开） */
export const getTagNotes = (tagId) =>
  v2.get(`/tags/${tagId}/notes`).then((r) => r.data)

/** 当前用户对某标签的描述 */
export const getMyTagNote = (tagId) =>
  v2.get(`/tags/${tagId}/notes/me`).then((r) => r.data)

/** 写/改当前用户对某标签的描述 */
export const submitTagNote = (tagId, note) =>
  v2.post(`/tags/${tagId}/notes`, { note }).then((r) => r.data)

// ── 系统设置 ──────────────────────────────────────────────────────────────────

/** 查询审批开关状态（admin） */
export const getTagApprovalSetting = () =>
  v2.get('/settings/tag-approval').then((r) => r.data)

/** 切换审批开关（admin） */
export const setTagApprovalSetting = (enabled) =>
  v2.patch('/settings/tag-approval', { enabled }).then((r) => r.data)
