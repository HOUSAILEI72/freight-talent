/**
 * ChartTagSelector — 两级分面筛选
 *
 * value:    Record<string, number[]>   category → 已选 tag id 列表
 * onChange: (value) => void
 *
 * 逻辑：同分类 OR，跨分类 AND。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronDown, Check, Minus } from 'lucide-react'
import { getTags } from '../../api/tagsV2'

export function ChartTagSelector({
  value = {},
  onChange,
  placeholder = '按分类筛选（同类 OR，跨类 AND）',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [tagsByCat, setTagsByCat] = useState({})   // { cat: [{id,name,category}] }
  const [nameMap, setNameMap] = useState({})         // id → name
  const containerRef = useRef(null)
  const debounceRef = useRef(null)

  // 点击外部关闭
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchTags = useCallback((q) => {
    getTags({ q: q || undefined })
      .then((data) => {
        const grouped = {}
        const names = {}
        for (const tag of data.tags || []) {
          if (!grouped[tag.category]) grouped[tag.category] = []
          grouped[tag.category].push(tag)
          names[tag.id] = tag.name
        }
        setTagsByCat(grouped)
        setNameMap(prev => ({ ...prev, ...names }))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchTags(query), 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, open, fetchTags])

  // ── 交互 ──────────────────────────────────────────────────────────────────

  function toggleTag(tag) {
    const prev = value[tag.category] ?? []
    let next
    if (prev.includes(tag.id)) {
      next = prev.filter(id => id !== tag.id)
    } else {
      next = [...prev, tag.id]
    }
    const updated = { ...value }
    if (next.length === 0) {
      delete updated[tag.category]
    } else {
      updated[tag.category] = next
    }
    onChange(updated)
  }

  function toggleCategory(cat) {
    const tagsInCat = tagsByCat[cat] ?? []
    const selectedInCat = value[cat] ?? []
    const allSelected = tagsInCat.length > 0 && selectedInCat.length === tagsInCat.length
    const updated = { ...value }
    if (allSelected) {
      delete updated[cat]
    } else {
      updated[cat] = tagsInCat.map(t => t.id)
    }
    onChange(updated)
  }

  function removeTag(cat, id) {
    const next = (value[cat] ?? []).filter(v => v !== id)
    const updated = { ...value }
    if (next.length === 0) {
      delete updated[cat]
    } else {
      updated[cat] = next
    }
    onChange(updated)
  }

  // ── 计算 ──────────────────────────────────────────────────────────────────

  const totalSelected = Object.values(value).reduce((s, ids) => s + ids.length, 0)

  const catState = (cat) => {
    const tagsInCat = tagsByCat[cat] ?? []
    const sel = value[cat] ?? []
    if (sel.length === 0) return 'none'
    if (sel.length === tagsInCat.length) return 'all'
    return 'some'
  }

  // ── 渲染 ──────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 触发区 */}
      <div
        onClick={() => setOpen(true)}
        className="min-h-[38px] w-full rounded-lg border border-slate-300 px-3 py-2 flex flex-wrap gap-1.5 items-center cursor-pointer hover:border-slate-400 bg-white"
      >
        {totalSelected === 0 ? (
          <span className="text-sm text-slate-400 flex-1">{placeholder}</span>
        ) : (
          Object.entries(value).flatMap(([cat, ids]) =>
            ids.map(id => (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100"
              >
                <span className="text-blue-400 mr-0.5">{cat} ·</span>
                {nameMap[id] ?? id}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(cat, id) }}
                  className="ml-0.5 hover:text-blue-900"
                >
                  <X size={10} />
                </button>
              </span>
            ))
          )
        )}
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0 ml-auto" />
      </div>

      {/* 下拉面板 */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200 shadow-lg max-h-80 overflow-y-auto">
          {/* 搜索框 */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Search size={14} />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="搜索标签..."
                className="flex-1 outline-none bg-transparent"
              />
              {totalSelected > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({})}
                  className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap"
                >
                  清除全部
                </button>
              )}
            </div>
          </div>

          {/* 分类列表 */}
          {Object.keys(tagsByCat).sort().map(cat => {
            const tags = tagsByCat[cat]
            const state = catState(cat)
            return (
              <div key={cat}>
                {/* 分类行 */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">{cat}</span>
                  <button
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border transition-colors ${
                      state === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : state === 'some'
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : 'text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    {state === 'all' ? <Check size={10} /> : state === 'some' ? <Minus size={10} /> : null}
                    全选
                  </button>
                </div>

                {/* 该分类下的标签 */}
                {tags.map(tag => {
                  const selected = (value[cat] ?? []).includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`w-full text-left px-5 py-2 text-sm flex items-center justify-between transition-colors ${
                        selected
                          ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {tag.name}
                      {selected && <Check size={12} className="text-blue-500 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )
          })}

          {Object.keys(tagsByCat).length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-400 text-center">暂无标签</p>
          )}
        </div>
      )}
    </div>
  )
}
