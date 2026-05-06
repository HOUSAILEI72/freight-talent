import { useState, useEffect, useCallback } from 'react'
import { Check, X, Loader2, ShieldCheck, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getPendingTags, reviewTag, reviewTagsBulk,
  getPendingNotes, reviewNote,
} from '../../api/tagsV2'

function Section({ items, onApprove, onReject, processing, rejectId, setRejectId,
                  rejectReason, setRejectReason, renderItem, emptyText }) {
  if (!items.length) {
    return (
      <div className="py-16 text-center text-slate-400">
        <Check size={32} className="mx-auto mb-3 text-emerald-200" />
        <p className="text-sm">{emptyText}</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">{renderItem(item)}</div>
            {rejectId !== item.id && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => onApprove(item.id)}
                  disabled={processing === item.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  {processing === item.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  通过
                </button>
                <button
                  onClick={() => { setRejectId(item.id); setRejectReason('') }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <X size={12} />拒绝
                </button>
              </div>
            )}
          </div>
          {rejectId === item.id && (
            <div className="mt-3 space-y-2">
              <input
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="请填写拒绝原因（必填）"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onReject(item.id)}
                  disabled={processing === item.id}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  确认拒绝
                </button>
                <button
                  onClick={() => { setRejectId(null); setRejectReason('') }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded-lg"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function PendingTagsPanel() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [collapsed, setCollapsed] = useState({})         // category -> bool
  const [bulkRejectCat, setBulkRejectCat] = useState(null)
  const [bulkRejectReason, setBulkRejectReason] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getPendingTags().then(d => setTags(d.tags || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    setProcessing(id)
    try { await reviewTag(id, 'approve'); setTags(ts => ts.filter(t => t.id !== id)) }
    catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  const reject = async (id) => {
    if (!rejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(id)
    try {
      await reviewTag(id, 'reject', rejectReason)
      setTags(ts => ts.filter(t => t.id !== id))
      setRejectId(null); setRejectReason('')
    } catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  const bulkApprove = async (cat, ids) => {
    if (!confirm(`通过分类「${cat}」下全部 ${ids.length} 个标签？`)) return
    setProcessing(`cat:${cat}`)
    try {
      await reviewTagsBulk(ids, 'approve')
      setTags(ts => ts.filter(t => !ids.includes(t.id)))
    } catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  const bulkReject = async (cat, ids) => {
    if (!bulkRejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(`cat:${cat}`)
    try {
      await reviewTagsBulk(ids, 'reject', bulkRejectReason)
      setTags(ts => ts.filter(t => !ids.includes(t.id)))
      setBulkRejectCat(null); setBulkRejectReason('')
    } catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />加载中...
    </div>
  )
  if (!tags.length) return (
    <div className="py-16 text-center text-slate-400">
      <Check size={32} className="mx-auto mb-3 text-emerald-200" />
      <p className="text-sm">暂无待审批标签</p>
    </div>
  )

  // 按 category 分组
  const groups = tags.reduce((acc, t) => {
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).map(([cat, list]) => {
        const ids = list.map(t => t.id)
        const isCollapsed = collapsed[cat]
        const isBulkReject = bulkRejectCat === cat
        return (
          <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden">
            {/* 分类标题 + 批量操作 */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <button
                onClick={() => setCollapsed(c => ({ ...c, [cat]: !isCollapsed }))}
                className="flex items-center gap-2 text-sm font-medium text-slate-700 flex-1 text-left"
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                <span>{cat}</span>
                <span className="text-xs text-slate-400">{list.length} 个待审批</span>
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => bulkApprove(cat, ids)}
                  disabled={processing === `cat:${cat}`}
                  className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  整组通过
                </button>
                <button
                  onClick={() => { setBulkRejectCat(cat); setBulkRejectReason('') }}
                  className="px-3 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  整组拒绝
                </button>
              </div>
            </div>

            {/* 整组拒绝输入框 */}
            {isBulkReject && (
              <div className="px-4 py-3 bg-red-50 border-b border-red-100 space-y-2">
                <input
                  value={bulkRejectReason}
                  onChange={e => setBulkRejectReason(e.target.value)}
                  placeholder="请填写整组拒绝的原因（必填）"
                  className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 outline-none focus:border-red-400 bg-white"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => bulkReject(cat, ids)}
                    disabled={processing === `cat:${cat}`}
                    className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                  >
                    确认拒绝
                  </button>
                  <button
                    onClick={() => { setBulkRejectCat(null); setBulkRejectReason('') }}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* 子列表 */}
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {list.map(tag => (
                  <div key={tag.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800">{tag.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          申请人：{tag.creator_name || '系统'}（{tag.creator_role || '-'}）
                          · {tag.created_at?.slice(0, 10)}
                        </p>
                        {tag.description && (
                          <p className="text-xs text-slate-600 mt-1">{tag.description}</p>
                        )}
                      </div>
                      {rejectId !== tag.id && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => approve(tag.id)}
                            disabled={processing === tag.id}
                            className="px-2.5 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-60 inline-flex items-center gap-1"
                          >
                            {processing === tag.id ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                            通过
                          </button>
                          <button
                            onClick={() => { setRejectId(tag.id); setRejectReason('') }}
                            className="px-2.5 py-1 text-xs bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 inline-flex items-center gap-1"
                          >
                            <X size={11} />拒绝
                          </button>
                        </div>
                      )}
                    </div>
                    {rejectId === tag.id && (
                      <div className="mt-2 space-y-2">
                        <input
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="请填写拒绝原因（必填）"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-red-300"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => reject(tag.id)}
                            disabled={processing === tag.id}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
                          >
                            确认拒绝
                          </button>
                          <button
                            onClick={() => { setRejectId(null); setRejectReason('') }}
                            className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded-lg"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PendingNotesPanel() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [rejectId, setRejectId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getPendingNotes().then(d => setNotes(d.notes || [])).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    setProcessing(id)
    try { await reviewNote(id, 'approve'); setNotes(ns => ns.filter(n => n.id !== id)) }
    catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  const reject = async (id) => {
    if (!rejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(id)
    try {
      await reviewNote(id, 'reject', rejectReason)
      setNotes(ns => ns.filter(n => n.id !== id))
      setRejectId(null); setRejectReason('')
    } catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />加载中...
    </div>
  )

  return (
    <Section
      items={notes}
      onApprove={approve}
      onReject={reject}
      processing={processing}
      rejectId={rejectId}
      setRejectId={setRejectId}
      rejectReason={rejectReason}
      setRejectReason={setRejectReason}
      emptyText="暂无待审批描述"
      renderItem={(note) => (
        <>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-slate-400">{note.tag_category}</span>
            <span className="font-semibold text-slate-800">{note.tag_name}</span>
          </div>
          <p className="text-sm text-slate-700 mt-1 leading-relaxed">"{note.note}"</p>
          <p className="text-xs text-slate-500 mt-1">
            作者：{note.user_name}（{note.user_role}） · {note.created_at?.slice(0, 10)}
          </p>
        </>
      )}
    />
  )
}

export default function Approvals() {
  const [tab, setTab] = useState('tags')
  const [tagCount, setTagCount] = useState(0)
  const [noteCount, setNoteCount] = useState(0)

  // 仅取一次未读数量；进入面板后由面板自行管理
  useEffect(() => {
    getPendingTags().then(d => setTagCount((d.tags || []).length)).catch(() => {})
    getPendingNotes().then(d => setNoteCount((d.notes || []).length)).catch(() => {})
  }, [])

  const tabs = [
    { key: 'tags',  label: '标签审批', icon: ShieldCheck,    count: tagCount },
    { key: 'notes', label: '描述审批', icon: MessageSquare,  count: noteCount },
  ]

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">审批中心</h1>
        <p className="text-sm text-slate-500 mt-1">
          审批用户提交的新标签与标签描述。通过后该标签 / 描述立即生效。
        </p>
      </div>

      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(t => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {t.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white">
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        {tab === 'tags' ? <PendingTagsPanel /> : <PendingNotesPanel />}
      </div>
    </div>
  )
}
