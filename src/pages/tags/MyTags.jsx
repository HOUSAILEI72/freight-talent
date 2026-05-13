import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckCircle, Clock, XCircle, Loader2, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getTags, getMyTags, submitTag, getCategories } from '../../api/tagsV2'

const STATUS_LABEL = {
  active:   { color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: CheckCircle, text: '已通过' },
  pending:  { color: 'text-amber-600 bg-amber-50 border-amber-200',       icon: Clock,       text: '审批中' },
  rejected: { color: 'text-red-600 bg-red-50 border-red-200',             icon: XCircle,     text: '已拒绝' },
}

const STATUS_TERMINAL = {
  active:   { color: 'var(--t-success)',  bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)' },
  pending:  { color: 'var(--t-warning)',  bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)' },
  rejected: { color: 'var(--t-danger)',   bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
}

function StatusBadge({ status, terminal = false }) {
  if (terminal) {
    const cfg = STATUS_TERMINAL[status] || STATUS_TERMINAL.pending
    const LightCfg = STATUS_LABEL[status] || STATUS_LABEL.pending
    const Icon = LightCfg.icon
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '1px 8px', borderRadius: 9999, fontSize: 11,
        color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      }}>
        <Icon size={11} />
        {LightCfg.text}
      </span>
    )
  }
  const cfg = STATUS_LABEL[status] || STATUS_LABEL.pending
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}>
      <Icon size={11} />
      {cfg.text}
    </span>
  )
}

function SubmitForm({ categories, onDone, onCancel, terminal = false }) {
  const [category, setCategory] = useState(categories[0] || '')
  const [customCat, setCustomCat] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit() {
    const cat = (category === '__new__' ? customCat : category).trim()
    if (!cat) { setError('请填写分类'); return }
    if (!name.trim()) { setError('请填写标签名'); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await submitTag({
        category: cat,
        name: name.trim(),
        description: description.trim() || undefined,
      })
      setDone(true)
      setTimeout(() => { onDone(res); }, 800)
    } catch (e) {
      setError(e.response?.data?.detail || '提交失败，请重试')
      setSubmitting(false)
    }
  }

  if (done) {
    return terminal ? (
      <div style={{
        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
        borderRadius: 'var(--t-radius)', padding: '24px', textAlign: 'center',
      }}>
        <CheckCircle size={28} style={{ margin: '0 auto 8px', color: 'var(--t-success)' }} />
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-success)' }}>提交成功</p>
        <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>管理员审批通过后即可使用</p>
      </div>
    ) : (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <CheckCircle size={28} className="mx-auto text-emerald-500 mb-2" />
        <p className="text-sm font-medium text-emerald-700">提交成功</p>
        <p className="text-xs text-emerald-600 mt-1">管理员审批通过后即可使用</p>
      </div>
    )
  }

  if (terminal) {
    return (
      <div style={{
        background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
        borderRadius: 'var(--t-radius)', padding: 20,
      }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)', marginBottom: 12 }}>申请新标签</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>分类</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{
                width: '100%', fontSize: 13, background: 'var(--t-bg-input)',
                border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                padding: '6px 10px', color: 'var(--t-text)', outline: 'none',
              }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
              <option value="__new__">+ 新建分类...</option>
            </select>
          </div>
          {category === '__new__' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>新分类名</label>
              <input
                value={customCat}
                onChange={e => setCustomCat(e.target.value)}
                placeholder="例如：地区、语言、专业..."
                style={{
                  width: '100%', fontSize: 13, background: 'var(--t-bg-input)',
                  border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                  padding: '6px 10px', color: 'var(--t-text)', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>标签名</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：上海、英语、报关..."
              style={{
                width: '100%', fontSize: 13, background: 'var(--t-bg-input)',
                border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                padding: '6px 10px', color: 'var(--t-text)', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>说明（可选）</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="说明这个标签的含义，便于管理员审批"
              style={{
                width: '100%', fontSize: 13, background: 'var(--t-bg-input)',
                border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                padding: '6px 10px', color: 'var(--t-text)', outline: 'none',
                resize: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          {error && <p style={{ fontSize: 11, color: 'var(--t-danger)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                flex: 1, padding: '7px 16px', fontSize: 12,
                background: 'var(--t-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--t-radius-sm)',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = 'var(--t-primary-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-primary)' }}
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              {submitting ? '提交中...' : '提交申请'}
            </button>
            <button
              onClick={onCancel}
              style={{
                padding: '7px 16px', fontSize: 12,
                background: 'transparent', color: 'var(--t-text-secondary)',
                border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-sm)',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              取消
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">申请新标签</h3>
      <div>
        <label className="block text-xs text-slate-500 mb-1">分类</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        >
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__new__">+ 新建分类...</option>
        </select>
      </div>
      {category === '__new__' && (
        <div>
          <label className="block text-xs text-slate-500 mb-1">新分类名</label>
          <input
            value={customCat}
            onChange={e => setCustomCat(e.target.value)}
            placeholder="例如：地区、语言、专业..."
            className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
          />
        </div>
      )}
      <div>
        <label className="block text-xs text-slate-500 mb-1">标签名</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例如：上海、英语、报关..."
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="block text-xs text-slate-500 mb-1">说明（可选）</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          placeholder="说明这个标签的含义，便于管理员审批"
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-none"
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-1"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? '提交中...' : '提交申请'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
        >
          取消
        </button>
      </div>
    </div>
  )
}

export default function MyTags({ terminal = false }) {
  const { user } = useAuth()
  const [activeTags, setActiveTags] = useState([])
  const [myTags, setMyTags] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [allRes, mineRes, catsRes] = await Promise.all([
        getTags(),
        getMyTags(),
        getCategories(),
      ])
      setActiveTags(allRes.tags || [])
      setMyTags(mineRes.tags || [])
      setCategories(catsRes.categories || [])
    } catch (e) {
      // 失败时保留旧值
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // 按分类聚合 active 标签
  const grouped = activeTags.reduce((acc, t) => {
    if (search && !t.name.includes(search) && !t.category.includes(search)) return acc
    if (!acc[t.category]) acc[t.category] = []
    acc[t.category].push(t)
    return acc
  }, {})

  const pendingCount = myTags.filter(t => t.status === 'pending').length
  const activeCount  = myTags.filter(t => t.status === 'active').length
  const rejectedCount = myTags.filter(t => t.status === 'rejected').length

  return (
    <div
      className={
        terminal
          ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-6 space-y-6'
          : 'max-w-5xl mx-auto px-6 py-8 space-y-6'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
    >
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">标签申请</h1>
          <p className="text-sm text-slate-500 mt-1">
            浏览所有可用标签；如果缺少需要的标签，可以提交申请，管理员通过后即可使用。
          </p>
        </div>
        {!showForm && (
          terminal ? (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', fontSize: 12,
                background: 'var(--t-primary)', color: '#fff',
                border: 'none', borderRadius: 'var(--t-radius-sm)', cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-primary-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-primary)' }}
            >
              <Plus size={13} />
              申请新标签
            </button>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus size={14} />
              申请新标签
            </button>
          )
        )}
      </div>

      {showForm && (
        <SubmitForm
          categories={categories}
          onDone={() => { setShowForm(false); refresh() }}
          onCancel={() => setShowForm(false)}
          terminal={terminal}
        />
      )}

      {/* 我的申请 */}
      {myTags.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800">我的申请</h2>
            <div className="flex gap-3 text-xs text-slate-500">
              {activeCount > 0 && <span>已通过 {activeCount}</span>}
              {pendingCount > 0 && <span>审批中 {pendingCount}</span>}
              {rejectedCount > 0 && <span>已拒绝 {rejectedCount}</span>}
            </div>
          </div>
          <div className="space-y-2">
            {myTags.map(t => (
              terminal ? (
                <div
                  key={t.id}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: 12,
                    borderRadius: 'var(--t-radius-sm)',
                    border: '1px solid var(--t-border)',
                    background: 'var(--t-bg-panel)',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-bg-panel)' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>{t.category}</span>
                      <span style={{ color: 'var(--t-text-muted)' }}>·</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t-text)' }}>{t.name}</span>
                      <StatusBadge status={t.status} terminal />
                    </div>
                    {t.description && (
                      <p style={{ fontSize: 11, color: 'var(--t-text-secondary)', marginTop: 4 }}>{t.description}</p>
                    )}
                    {t.status === 'rejected' && t.reject_reason && (
                      <p style={{ fontSize: 11, color: 'var(--t-danger)', marginTop: 4 }}>拒绝原因：{t.reject_reason}</p>
                    )}
                    <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginTop: 4 }}>
                      提交于 {t.created_at?.slice(0, 10)}
                      {t.reviewed_at && ` · 审批于 ${t.reviewed_at.slice(0, 10)}`}
                    </p>
                  </div>
                </div>
              ) : (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400">{t.category}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-sm font-medium text-slate-800">{t.name}</span>
                      <StatusBadge status={t.status} />
                    </div>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-1">{t.description}</p>
                    )}
                    {t.status === 'rejected' && t.reject_reason && (
                      <p className="text-xs text-red-500 mt-1">拒绝原因：{t.reject_reason}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      提交于 {t.created_at?.slice(0, 10)}
                      {t.reviewed_at && ` · 审批于 ${t.reviewed_at.slice(0, 10)}`}
                    </p>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}

      {/* 全部 active 标签浏览 */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">所有可用标签</h2>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索..."
              className="pl-7 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-400 w-44"
            />
          </div>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
            <Loader2 size={14} className="animate-spin" /> 加载中...
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">
            {activeTags.length === 0 ? '标签库为空，可以提交申请' : '没有匹配的标签'}
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).map(([cat, tags]) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-slate-400 mb-2">{cat}（{tags.length}）</p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    terminal ? (
                      <span key={t.id} style={{
                        padding: '3px 10px', fontSize: 11, borderRadius: 9999,
                        background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)',
                        border: '1px solid var(--t-border)',
                      }}>
                        {t.name}
                      </span>
                    ) : (
                      <span key={t.id} className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 rounded-full">
                        {t.name}
                      </span>
                    )
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
