import { useState, useEffect, useRef } from 'react'
import { Upload, ToggleLeft, ToggleRight, Check, X, ChevronDown, ChevronUp, Loader2, AlertCircle, Tag, FileSpreadsheet } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import {
  getTags, getCategories, importTagsExcel,
  getPendingTags, reviewTag,
  getPendingNotes, reviewNote,
  getTagApprovalSetting, setTagApprovalSetting,
} from '../../api/tagsV2'

// ── 审批开关 ──────────────────────────────────────────────────────────────────
function ApprovalToggle() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getTagApprovalSetting()
      .then(d => setEnabled(d.enabled))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const toggle = async () => {
    setSaving(true)
    try {
      const res = await setTagApprovalSetting(!enabled)
      setEnabled(res.enabled)
    } catch (e) {
      alert(e.response?.data?.detail || '操作失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
        ${enabled
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}
      `}
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      审批功能：{enabled ? '已开启' : '已关闭'}
    </button>
  )
}

// ── 标签库 Tab ─────────────────────────────────────────────────────────────────
function TagLibrary() {
  const [tagsByCategory, setTagsByCategory] = useState({})
  const [categories, setCategories] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [expanded, setExpanded] = useState({})
  const fileRef = useRef(null)

  const load = () => {
    getTags().then(data => {
      const map = {}
      for (const t of data.tags || []) {
        if (!map[t.category]) map[t.category] = []
        map[t.category].push(t)
      }
      setTagsByCategory(map)
    }).catch(() => {})
    getCategories().then(d => setCategories(d.categories || [])).catch(() => {})
  }

  useEffect(load, [])

  const handleFile = async (file) => {
    if (!file) return
    setUploading(true)
    setUploadResult(null)
    setUploadError('')
    try {
      const res = await importTagsExcel(file)
      setUploadResult(res)
      load()
    } catch (e) {
      setUploadError(e.response?.data?.detail || '导入失败，请检查文件格式')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const toggleCat = (cat) => setExpanded(e => ({ ...e, [cat]: !e[cat] }))
  const allCats = Object.keys(tagsByCategory).sort()
  const totalTags = Object.values(tagsByCategory).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="space-y-6">
      {/* Excel 上传 */}
      <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
        <FileSpreadsheet size={28} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm font-medium text-slate-600 mb-1">上传 Excel 批量导入标签</p>
        <p className="text-xs text-slate-400 mb-4">第一行为列名（= 标签分类），每列下方为该分类的标签词条</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
        <Button
          size="sm"
          variant="secondary"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? '导入中...' : '选择 Excel 文件'}
        </Button>

        {uploadResult && (
          <div className="mt-3 px-4 py-2 bg-emerald-50 rounded-lg text-xs text-emerald-700 inline-block">
            导入完成：新增 {uploadResult.imported_count} 个标签，跳过 {uploadResult.skipped_count} 个重复
            {uploadResult.categories_touched?.length > 0 && (
              <span className="ml-1">（涉及分类：{uploadResult.categories_touched.join('、')}）</span>
            )}
          </div>
        )}
        {uploadError && (
          <div className="mt-3 px-4 py-2 bg-red-50 rounded-lg text-xs text-red-600 inline-block">
            {uploadError}
          </div>
        )}
      </div>

      {/* 统计 */}
      <div className="flex items-center gap-4 text-sm text-slate-500">
        <span>共 <strong className="text-slate-700">{allCats.length}</strong> 个分类</span>
        <span>共 <strong className="text-slate-700">{totalTags}</strong> 个标签</span>
      </div>

      {/* 分类列表 */}
      {allCats.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <Tag size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">暂无标签，请上传 Excel 导入</p>
        </div>
      )}
      {allCats.map(cat => (
        <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleCat(cat)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-slate-700">{cat}</span>
              <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                {tagsByCategory[cat]?.length ?? 0} 个
              </span>
            </div>
            {expanded[cat] ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {expanded[cat] && (
            <div className="px-4 py-3 flex flex-wrap gap-2">
              {tagsByCategory[cat]?.map(t => (
                <span key={t.id} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 待审批标签 Tab ─────────────────────────────────────────────────────────────
function PendingTags() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(null)

  const load = () => {
    setLoading(true)
    getPendingTags()
      .then(d => setTags(d.tags || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const approve = async (id) => {
    setProcessing(id)
    try {
      await reviewTag(id, 'approve')
      setTags(ts => ts.filter(t => t.id !== id))
    } catch (e) {
      alert(e.response?.data?.detail || '操作失败')
    } finally {
      setProcessing(null)
    }
  }

  const reject = async (id) => {
    if (!rejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(id)
    try {
      await reviewTag(id, 'reject', rejectReason)
      setTags(ts => ts.filter(t => t.id !== id))
      setRejectId(null)
      setRejectReason('')
    } catch (e) {
      alert(e.response?.data?.detail || '操作失败')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />加载中...
    </div>
  )

  if (tags.length === 0) return (
    <div className="py-16 text-center text-slate-400">
      <Check size={32} className="mx-auto mb-3 text-emerald-200" />
      <p className="text-sm">暂无待审批标签</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {tags.map(tag => (
        <div key={tag.id} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">{tag.category}</span>
                <span className="font-semibold text-slate-800">{tag.name}</span>
              </div>
              <p className="text-xs text-slate-500">
                申请人：{tag.creator_name}（{tag.creator_role}） · {tag.created_at?.slice(0, 10)}
              </p>
              {tag.description && <p className="text-xs text-slate-600 mt-1">{tag.description}</p>}
            </div>
            {rejectId !== tag.id && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => approve(tag.id)} disabled={processing === tag.id}>
                  {processing === tag.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  通过
                </Button>
                <Button size="sm" variant="danger" onClick={() => { setRejectId(tag.id); setRejectReason('') }}>
                  <X size={12} />拒绝
                </Button>
              </div>
            )}
          </div>
          {rejectId === tag.id && (
            <div className="mt-3 space-y-2">
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="请填写拒绝原因（必填）"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-red-300"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => reject(tag.id)} disabled={processing === tag.id}>
                  确认拒绝
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 待审批描述 Tab ─────────────────────────────────────────────────────────────
function PendingNotes() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(null)

  const load = () => {
    setLoading(true)
    getPendingNotes()
      .then(d => setNotes(d.notes || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const approve = async (id) => {
    setProcessing(id)
    try {
      await reviewNote(id, 'approve')
      setNotes(ns => ns.filter(n => n.id !== id))
    } catch (e) {
      alert(e.response?.data?.detail || '操作失败')
    } finally {
      setProcessing(null)
    }
  }

  const reject = async (id) => {
    if (!rejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(id)
    try {
      await reviewNote(id, 'reject', rejectReason)
      setNotes(ns => ns.filter(n => n.id !== id))
      setRejectId(null)
      setRejectReason('')
    } catch (e) {
      alert(e.response?.data?.detail || '操作失败')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />加载中...
    </div>
  )

  if (notes.length === 0) return (
    <div className="py-16 text-center text-slate-400">
      <Check size={32} className="mx-auto mb-3 text-emerald-200" />
      <p className="text-sm">暂无待审批描述</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {notes.map(note => (
        <div key={note.id} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-400">{note.tag_category}</span>
                <span className="font-semibold text-slate-800">{note.tag_name}</span>
              </div>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">"{note.note}"</p>
              <p className="text-xs text-slate-500 mt-1">
                作者：{note.user_name}（{note.user_role}） · {note.created_at?.slice(0, 10)}
              </p>
            </div>
            {rejectId !== note.id && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => approve(note.id)} disabled={processing === note.id}>
                  {processing === note.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  通过
                </Button>
                <Button size="sm" variant="danger" onClick={() => { setRejectId(note.id); setRejectReason('') }}>
                  <X size={12} />拒绝
                </Button>
              </div>
            )}
          </div>
          {rejectId === note.id && (
            <div className="mt-3 space-y-2">
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="请填写拒绝原因（必填）"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-red-300"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => reject(note.id)} disabled={processing === note.id}>
                  确认拒绝
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>
                  取消
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'library',      label: '标签库' },
  { key: 'pending_tags', label: '待审批标签' },
  { key: 'pending_notes', label: '待审批描述' },
]

export default function TagManager() {
  const [activeTab, setActiveTab] = useState('library')

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 页头 */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">标签管理</h1>
            <p className="text-slate-500 mt-1 text-sm">管理候选人与岗位的标签分类体系</p>
          </div>
          <ApprovalToggle />
        </div>

        {/* Tab 导航 */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px
                ${activeTab === tab.key
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/60'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 内容 */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          {activeTab === 'library'       && <TagLibrary />}
          {activeTab === 'pending_tags'  && <PendingTags />}
          {activeTab === 'pending_notes' && <PendingNotes />}
        </div>
      </div>
    </div>
  )
}
