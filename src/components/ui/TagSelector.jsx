import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Plus, ChevronDown } from 'lucide-react'
import { getTags, getCategories, submitTag } from '../../api/tagsV2'

/**
 * TagSelector — 多选标签选择器
 *
 * Props:
 *   value       string[]              已选标签名数组
 *   onChange    (tags: string[]) => void
 *   placeholder string               默认 "搜索或添加标签..."
 *   disabled    boolean
 */
export function TagSelector({ value = [], onChange, placeholder = '搜索或添加标签...', disabled = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tagsByCategory, setTagsByCategory] = useState({}) // { category: [{id,name,...}] }
  const [loading, setLoading] = useState(false)
  const [submitState, setSubmitState] = useState(null) // null | 'form' | 'submitting' | 'done'
  const [newCategory, setNewCategory] = useState('')
  const [customCategory, setCustomCategory] = useState('')  // 用户手动输入的新分类名
  const [newName, setNewName] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [categories, setCategories] = useState([])
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setSubmitState(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 加载分类列表（一次性）
  useEffect(() => {
    getCategories()
      .then((data) => setCategories(data.categories || []))
      .catch(() => {})
  }, [])

  // 防抖搜索
  const fetchTags = useCallback((q) => {
    setLoading(true)
    getTags({ q: q || undefined })
      .then((data) => {
        const grouped = {}
        for (const tag of data.tags || []) {
          if (!grouped[tag.category]) grouped[tag.category] = []
          grouped[tag.category].push(tag)
        }
        setTagsByCategory(grouped)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!open) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchTags(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, open, fetchTags])

  const handleOpen = () => {
    if (disabled) return
    setOpen(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const select = (tagName) => {
    if (!value.includes(tagName)) onChange([...value, tagName])
  }

  const deselect = (tagName) => {
    onChange(value.filter((t) => t !== tagName))
  }

  const handleSubmitNew = async () => {
    const cat = (newCategory === '__new__' ? customCategory : newCategory).trim()
    const name = newName.trim()
    if (!cat) { setSubmitError('请填写分类'); return }
    if (!name) { setSubmitError('请填写标签名'); return }
    setSubmitError('')
    setSubmitState('submitting')
    try {
      const res = await submitTag({ category: cat, name })
      if (res.status === 'active') {
        // 直接选入
        select(name)
        fetchTags(query)
      }
      setSubmitState('done')
      setNewCategory('')
      setCustomCategory('')
      setNewName('')
      setTimeout(() => setSubmitState(null), 2000)
    } catch (e) {
      const msg = e.response?.data?.detail || '提交失败，请重试'
      setSubmitError(msg)
      setSubmitState('form')
    }
  }

  const allCategories = Object.keys(tagsByCategory).sort()
  const hasResults = allCategories.length > 0

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 已选标签展示区 */}
      <div
        onClick={handleOpen}
        className={`min-h-[42px] w-full rounded-lg border px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-text
          ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'bg-white border-slate-300 hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200'}
        `}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deselect(tag) }}
                className="ml-0.5 hover:text-blue-900"
              >
                <X size={10} />
              </button>
            )}
          </span>
        ))}
        <span className="text-sm text-slate-400 flex-1 min-w-[80px]">
          {value.length === 0 && placeholder}
        </span>
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
      </div>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-80 overflow-y-auto">
          {/* 搜索框 */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2 flex items-center gap-2">
            <Search size={14} className="text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标签..."
              className="flex-1 text-sm outline-none bg-transparent"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
                <X size={12} />
              </button>
            )}
          </div>

          {/* 标签列表 */}
          <div className="py-1">
            {loading && (
              <p className="text-xs text-slate-400 px-4 py-3 text-center">加载中...</p>
            )}
            {!loading && !hasResults && (
              <p className="text-xs text-slate-400 px-4 py-3 text-center">暂无匹配标签</p>
            )}
            {!loading && allCategories.map((cat) => (
              <div key={cat}>
                <div className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50">
                  {cat}
                </div>
                {tagsByCategory[cat].map((tag) => {
                  const selected = value.includes(tag.name)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => selected ? deselect(tag.name) : select(tag.name)}
                      className={`w-full text-left px-4 py-1.5 text-sm flex items-center justify-between hover:bg-slate-50
                        ${selected ? 'text-blue-600 font-medium' : 'text-slate-700'}
                      `}
                    >
                      <span>{tag.name}</span>
                      {selected && <span className="text-blue-400 text-xs">✓</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          {/* 申请新标签入口 */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100">
            {submitState === null && (
              <button
                type="button"
                onClick={() => { setSubmitState('form'); setNewCategory(categories[0] || '') }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 font-medium"
              >
                <Plus size={14} />
                申请新标签
              </button>
            )}

            {submitState === 'form' && (
              <div className="p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-500">申请新标签</p>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-400"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__new__">+ 新建分类...</option>
                </select>
                {newCategory === '__new__' && (
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="输入新分类名"
                    className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-400"
                  />
                )}
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="标签名称"
                  className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmitNew()}
                />
                {submitError && <p className="text-xs text-red-500">{submitError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmitNew}
                    className="flex-1 text-xs bg-blue-600 text-white rounded px-3 py-1.5 hover:bg-blue-700"
                  >
                    提交
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSubmitState(null); setSubmitError('') }}
                    className="flex-1 text-xs border border-slate-200 text-slate-600 rounded px-3 py-1.5 hover:bg-slate-50"
                  >
                    取消
                  </button>
                </div>
              </div>
            )}

            {submitState === 'submitting' && (
              <p className="text-xs text-slate-500 px-4 py-2.5 text-center">提交中...</p>
            )}

            {submitState === 'done' && (
              <p className="text-xs text-emerald-600 px-4 py-2.5 text-center font-medium">
                已提交，等待管理员审批
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
