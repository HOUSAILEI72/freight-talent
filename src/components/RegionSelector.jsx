import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X, Globe2, MapPin } from 'lucide-react'
import {
  TOP_LEVEL_GROUPS,
  MAINLAND_TREE,
  buildMainlandLocation,
  buildOverseasCountryLocation,
  searchRegion,
} from '../utils/regionTree.js'
import { OVERSEAS_COUNTRIES } from '../utils/overseasCountries.js'
import {
  buildLocationObject,
  CN_MAINLAND_ALL_LOCATION,
  HK_LOCATION,
  TW_LOCATION,
  MO_LOCATION,
} from '../utils/businessArea.js'

const TOP_LEVEL_LABELS_ZH = {
  GLOBAL: '全球',
  GREAT_CHINA: '中国',
  OVERSEAS: '海外',
  REMOTE: '远程',
}

const SPECIAL_LOCATION_LABELS_ZH = {
  Global: '全球',
  Remote: '远程',
  China: '中国',
  Overseas: '海外',
  'Hong Kong': '香港',
  Taiwan: '台湾',
  Macau: '澳门',
  'Mainland China': '中国大陆',
}

/**
 * RegionSelector
 * ──────────────
 * Constrained location picker for jobs / candidate profiles. Users may NEVER
 * free-form text — the only path to a value is to pick from the tree or a
 * search hit. Returns the standard location object documented in
 * `src/utils/businessArea.js`:
 *
 *   {
 *     location_code, location_name, location_path, location_type,
 *     business_area_code, business_area_name,
 *   }
 *
 * Props
 *  - value:       location object | null
 *  - onChange:    (loc | null) => void
 *  - disabled:    boolean
 *  - placeholder: string
 *  - terminal:    boolean   — switch palette to terminal tokens
 *  - className:   string    — extra classes on the trigger
 *  - onOpenChange: optional callback for parent scroll-reserve coordination
 *
 * Architecture
 *  - All static data + search lives in `src/utils/regionTree.js` (JSX-free).
 *  - The component is two views inside one popover:
 *      1) drill-down (no query):  top-level groups → China tree /
 *         Overseas country list
 *      2) search results:         flat list across every selectable node
 */
export default function RegionSelector({
  value = null,
  onChange = () => {},
  disabled = false,
  placeholder = 'Select location',
  terminal = false,
  className = '',
  highlightStyle,
  onOpenChange,
}) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [navStack, setNavStack] = useState([]) // [{type:'great-china'|'overseas'|'province'|'city', node?}]
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 340 })

  const wrapperRef = useRef(null)
  const panelRef   = useRef(null)
  const searchRef  = useRef(null)

  // ── Close on outside click / Escape ───────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      const inWrap  = wrapperRef.current?.contains(e.target)
      const inPanel = panelRef.current?.contains(e.target)
      if (!inWrap && !inPanel) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // ── Reset transient state on open ─────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // Defer focus until after the popover is in the DOM.
      const t = setTimeout(() => searchRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    onOpenChange?.(open)
    return () => {
      if (open) onOpenChange?.(false)
    }
  }, [open, onOpenChange])

  function commit(location) {
    if (!location) {
      onChange(null)
    } else {
      // Run through buildLocationObject so the back-end-canonical
      // business_area is always attached. Front-end can't lie about it
      // (and the back-end recomputes anyway).
      onChange(buildLocationObject(location))
    }
    setOpen(false)
  }

  function clear(e) {
    e.stopPropagation()
    onChange(null)
  }

  // ── Search hits ───────────────────────────────────────────────────────────
  const hits = useMemo(() => searchRegion(query, 100), [query])
  const isSearching = query.trim().length > 0

  // ── Drill-down state ──────────────────────────────────────────────────────
  const top = navStack[0]
  const province = navStack.find(s => s.type === 'province')?.node || null
  const city     = navStack.find(s => s.type === 'city')?.node || null

  // ── Styling primitives (split per terminal/light to avoid tailwind hover
  //    leaking into public mode) ─────────────────────────────────────────────
  const triggerStyle = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: value ? 'var(--t-text)' : 'var(--t-text-muted)', ...highlightStyle }
    : undefined
  const popoverStyle = terminal
    ? { background: 'var(--t-bg-elevated, #18243a)', borderColor: 'var(--t-border, #2c4060)', color: 'var(--t-text, #e2e8f0)' }
    : undefined
  const searchInputStyle = terminal
    ? {
        background: 'var(--t-bg-input)',
        borderColor: 'var(--t-border)',
        color: 'var(--t-text)',
        fontFamily: 'var(--t-font-cjk, "PingFang SC", "Microsoft YaHei", sans-serif)',
        fontSize: 12,
      }
    : undefined

  function formatLocationText(text) {
    if (!text) return ''
    return String(text)
      .split('/')
      .map((segment) => SPECIAL_LOCATION_LABELS_ZH[segment] || segment)
      .join('/')
      .replace('全国 (Mainland China)', '全国（中国大陆）')
  }

  function formatSearchHitLabel(hit) {
    const country = OVERSEAS_COUNTRIES.find((c) => c.code === hit.location.location_code || c.name === hit.displayLabel)
    return country?.name_zh || formatLocationText(hit.displayLabel)
  }

  function formatSearchHitPath(hit) {
    const country = OVERSEAS_COUNTRIES.find((c) => c.code === hit.location.location_code || c.name === hit.displayLabel)
    if (country) return `海外/${country.name_zh}`
    return formatLocationText(hit.displayPath)
  }

  function rowBaseClass(active = false) {
    if (terminal) {
      return 'flex items-center gap-2 cursor-pointer transition-colors'
    }
    return active
      ? 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer bg-blue-50 text-blue-700'
      : 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700'
  }
  function rowStyle(active = false) {
    if (!terminal) return undefined
    const base = {
      padding: '5px 10px',
      fontFamily: 'var(--t-font-cjk, "PingFang SC", "Microsoft YaHei", sans-serif)',
      fontSize: 12,
      lineHeight: 1.45,
    }
    return active
      ? { ...base, background: 'var(--t-bg-active)', color: 'var(--t-text)' }
      : base
  }
  // JS-driven hover so terminal mode doesn't leak into public mode.
  function rowMouseEnter(e) {
    if (!terminal) return
    if (e.currentTarget.dataset.active === 'true') return
    e.currentTarget.style.background = 'var(--t-bg-hover)'
  }
  function rowMouseLeave(e) {
    if (!terminal) return
    if (e.currentTarget.dataset.active === 'true') return
    e.currentTarget.style.background = 'transparent'
  }

  // ── Renderers ─────────────────────────────────────────────────────────────

  function getScrollableAncestor() {
    let node = wrapperRef.current?.parentElement
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node)
      const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY)
      if (canScrollY && node.scrollHeight > node.clientHeight + 1) return node
      node = node.parentElement
    }
    return null
  }

  function scrollColumnForDropdown() {
    const rect = wrapperRef.current?.getBoundingClientRect()
    const scrollEl = getScrollableAncestor()
    if (!rect || !scrollEl) return false

    const margin = 6
    const desiredPanelH = 340
    const scrollRect = scrollEl.getBoundingClientRect()
    const visibleBottom = Math.min(window.innerHeight, scrollRect.bottom) - margin
    const projectedDropdownBottom = rect.bottom + margin + desiredPanelH
    if (projectedDropdownBottom <= visibleBottom) return false

    const targetTriggerTop = scrollRect.top + 96
    const overflowFix = projectedDropdownBottom - visibleBottom + 16
    const liftIntoView = Math.max(0, rect.top - targetTriggerTop)
    const scrollNeed = Math.max(overflowFix, liftIntoView)
    const maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight - scrollEl.scrollTop
    const nextScroll = Math.min(scrollNeed, Math.max(0, maxScroll))
    if (nextScroll <= 0) return false

    scrollEl.scrollBy({ top: nextScroll, behavior: 'auto' })
    return true
  }

  const updateDropdownPosition = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return false
    // When html has overflow-y:scroll, position:fixed is relative to the html
    // element, not the viewport. Subtract html's own rect to correct the offset.
    const htmlRect = document.documentElement.getBoundingClientRect()
    const margin = 6
    const preferredPanelH = 340
    const minUsablePanelH = 96
    const scrollEl = getScrollableAncestor()
    const scrollRect = scrollEl?.getBoundingClientRect()
    const visibleBottom = Math.min(window.innerHeight, scrollRect?.bottom ?? window.innerHeight) - margin
    const spaceBelow = visibleBottom - rect.bottom
    const maxHeight = Math.max(
      minUsablePanelH,
      Math.min(preferredPanelH, spaceBelow),
    )
    const rawTop = rect.bottom - htmlRect.top + margin
    const top = Math.max(margin, rawTop)
    const left = rect.left - htmlRect.left
    setDropPos(prev => {
      if (prev && prev.top === top && prev.left === left && prev.width === rect.width && prev.maxHeight === maxHeight) return prev
      return { top, left, width: rect.width, maxHeight }
    })
    return true
  }, [])

  function openDropdown() {
    setQuery('')
    setNavStack([])
    if (terminal) {
      onOpenChange?.(true)
      setOpen(true)
      return
    }
    const didScroll = scrollColumnForDropdown()
    if (didScroll) {
      window.requestAnimationFrame(() => {
        updateDropdownPosition()
        setOpen(true)
      })
      return
    }
    updateDropdownPosition()
    setOpen(true)
  }

  useLayoutEffect(() => {
    if (!open || !terminal) return undefined
    let secondRaf = 0
    scrollColumnForDropdown()
    const raf = window.requestAnimationFrame(() => {
      scrollColumnForDropdown()
      updateDropdownPosition()
      secondRaf = window.requestAnimationFrame(updateDropdownPosition)
    })
    window.addEventListener('resize', updateDropdownPosition)
    window.addEventListener('scroll', updateDropdownPosition, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.cancelAnimationFrame(secondRaf)
      window.removeEventListener('resize', updateDropdownPosition)
      window.removeEventListener('scroll', updateDropdownPosition, true)
    }
  }, [open, terminal, updateDropdownPosition])

  function renderTrigger() {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          if (open) {
            setOpen(false)
          } else {
            openDropdown()
          }
        }}
        className={`relative inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
          terminal ? '' : (value ? 'border-slate-200 text-slate-700' : 'border-slate-200 text-slate-400')
        } ${className}`}
        style={triggerStyle}
      >
        <Globe2 size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
        <span className="flex-1 min-w-0 truncate">
          {value ? formatLocationText(value.location_path || value.location_name) : placeholder}
        </span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={clear}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') clear(e) }}
            className="flex h-4 w-4 items-center justify-center rounded hover:opacity-70"
            style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
          >
            <X size={12} />
          </span>
        )}
        <ChevronDown size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
      </button>
    )
  }

  function renderSearchHits() {
    if (hits.length === 0) {
      return (
        <div
          className="px-4 py-6 text-center text-xs"
          style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
        >
          未找到匹配地区
        </div>
      )
    }
    return (
      <div className="max-h-72 overflow-y-auto" style={terminal ? { scrollbarColor: 'var(--t-border) transparent' } : undefined}>
        {hits.map((h) => (
          <div
            key={`${h.location.location_code}|${h.location.location_path}`}
            className={rowBaseClass()}
            style={rowStyle()}
            onMouseEnter={rowMouseEnter}
            onMouseLeave={rowMouseLeave}
            onClick={() => commit(h.location)}
          >
            <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
            <div className="min-w-0 flex-1">
              <div className="truncate" style={terminal ? { color: 'var(--t-text)' } : undefined}>
                {formatSearchHitLabel(h)}
              </div>
              <div className="truncate text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
                {formatSearchHitPath(h)}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderTopLevel() {
    return (
      <div className="max-h-72 overflow-y-auto">
        {TOP_LEVEL_GROUPS.map((g) => {
          const onClickGroup = () => {
            if (g.kind === 'leaf') {
              commit(g.location)
            } else if (g.key === 'GREAT_CHINA') {
              setNavStack([{ type: 'great-china' }])
            } else if (g.key === 'OVERSEAS') {
              setNavStack([{ type: 'overseas' }])
            }
          }
          return (
            <div
              key={g.key}
              className={rowBaseClass()}
              style={rowStyle()}
              onMouseEnter={rowMouseEnter}
              onMouseLeave={rowMouseLeave}
              onClick={onClickGroup}
            >
              <Globe2 size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
              <span className="flex-1 truncate" style={terminal ? { color: 'var(--t-text)' } : undefined}>
                {TOP_LEVEL_LABELS_ZH[g.key] || g.label_zh || g.label}
              </span>
              {g.kind === 'group' && (
                <span className="text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>›</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderBreadcrumb() {
    if (!top) return null
    const segments = []
    if (top.type === 'great-china') segments.push({ label: '中国', onClick: () => setNavStack([{ type: 'great-china' }]) })
    if (top.type === 'overseas')    segments.push({ label: '海外', onClick: () => setNavStack([{ type: 'overseas' }]) })
    if (province) segments.push({ label: province.name, onClick: () => setNavStack(navStack.slice(0, navStack.findIndex(s => s.type === 'province') + 1)) })
    if (city)     segments.push({ label: city.name,     onClick: () => setNavStack(navStack.slice(0, navStack.findIndex(s => s.type === 'city') + 1)) })
    return (
      <div
        className="flex items-center gap-1 border-b px-3 py-2 text-xs"
        style={terminal ? { borderColor: 'var(--t-border-subtle)', color: 'var(--t-text-secondary)' } : { borderColor: '#e2e8f0', color: '#64748b' }}
      >
        <button
          type="button"
          onClick={() => setNavStack([])}
          style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
        >
          ‹ 返回
        </button>
        {segments.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#cbd5e1' }}>/</span>
            <button type="button" onClick={s.onClick} className="hover:underline">{s.label}</button>
          </span>
        ))}
      </div>
    )
  }

  function renderGreatChina() {
    // 1) "全国 (Mainland China)" + 2) HK / TW / MO + 3) provinces grid
    const chinaSpecials = [
      { loc: HK_LOCATION, label: '香港' },
      { loc: TW_LOCATION, label: '台湾' },
      { loc: MO_LOCATION, label: '澳门' },
    ]
    return (
      <>
        <div
          className={rowBaseClass()}
          style={rowStyle()}
          onMouseEnter={rowMouseEnter}
          onMouseLeave={rowMouseLeave}
          onClick={() => commit(CN_MAINLAND_ALL_LOCATION)}
        >
          <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
          <span className="flex-1" style={terminal ? { color: 'var(--t-text)' } : undefined}>
            全国 / 中国大陆
          </span>
        </div>
        <div className="max-h-60 overflow-y-auto">
          {MAINLAND_TREE.map((p) => {
            const hasChildren = p.children?.length > 0
            return (
              <div
                key={p.code}
                className={rowBaseClass()}
                style={rowStyle()}
                onMouseEnter={rowMouseEnter}
                onMouseLeave={rowMouseLeave}
                onClick={() => {
                  if (hasChildren) {
                    setNavStack([{ type: 'great-china' }, { type: 'province', node: p }])
                  } else {
                    commit(buildMainlandLocation(p, []))
                  }
                }}
              >
                <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                <span
                  className="flex-1 min-w-0 truncate"
                  style={terminal ? { color: 'var(--t-text)' } : undefined}
                >
                  {p.name}
                </span>
                {hasChildren && (
                  <span
                    className="ml-2 text-xs"
                    style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
                  >
                    ›
                  </span>
                )}
              </div>
            )
          })}
          {chinaSpecials.map(({ loc, label }) => (
            <div
              key={loc.location_code}
              className={rowBaseClass()}
              style={rowStyle()}
              onMouseEnter={rowMouseEnter}
              onMouseLeave={rowMouseLeave}
              onClick={() => commit(loc)}
            >
              <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
              <span className="flex-1" style={terminal ? { color: 'var(--t-text)' } : undefined}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </>
    )
  }

  function renderProvinceChildren() {
    // Show province itself as selectable + list of its children (cities for
    // a normal province, areas for a direct-administered municipality).
    if (!province) return null
    const isMuni = province.isMunicipality
    return (
      <div className="max-h-72 overflow-y-auto">
        <div
          className={rowBaseClass()}
          style={rowStyle()}
          onMouseEnter={rowMouseEnter}
          onMouseLeave={rowMouseLeave}
          onClick={() => commit(buildMainlandLocation(province, []))}
        >
          <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
          <span className="flex-1" style={terminal ? { color: 'var(--t-text)' } : undefined}>
            <em>选择 {province.name} 整体</em>
          </span>
        </div>
        {province.children.map((child) => {
          const hasGrandchildren = !isMuni && child.children?.length > 0
          return (
            <div
              key={child.code}
              className={rowBaseClass()}
              style={rowStyle()}
              onMouseEnter={rowMouseEnter}
              onMouseLeave={rowMouseLeave}
              onClick={() => {
                if (hasGrandchildren) {
                  // Standard province: this child is a city with districts —
                  // drill into the city level so the user can pick a district.
                  // "选择 XX 整体" inside the next level still allows committing
                  // the city as a whole.
                  setNavStack([
                    { type: 'great-china' },
                    { type: 'province', node: province },
                    { type: 'city', node: child },
                  ])
                } else {
                  // Direct municipality (child is an area), or city without
                  // districts → commit directly.
                  commit(buildMainlandLocation(child, [province]))
                }
              }}
            >
              <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
              <span
                className="flex-1 min-w-0 truncate"
                style={terminal ? { color: 'var(--t-text)' } : undefined}
              >
                {child.name}
              </span>
              {hasGrandchildren && (
                <span
                  className="ml-2 text-xs"
                  style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
                >
                  ›
                </span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function renderCityChildren() {
    if (!city || !province) return null
    return (
      <div className="max-h-72 overflow-y-auto">
        <div
          className={rowBaseClass()}
          style={rowStyle()}
          onMouseEnter={rowMouseEnter}
          onMouseLeave={rowMouseLeave}
          onClick={() => commit(buildMainlandLocation(city, [province]))}
        >
          <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
          <span className="flex-1" style={terminal ? { color: 'var(--t-text)' } : undefined}>
            <em>选择 {city.name} 整体</em>
          </span>
        </div>
        {(city.children || []).map((area) => (
          <div
            key={area.code}
            className={rowBaseClass()}
            style={rowStyle()}
            onMouseEnter={rowMouseEnter}
            onMouseLeave={rowMouseLeave}
            onClick={() => commit(buildMainlandLocation(area, [province, city]))}
          >
            <MapPin size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
            <span className="flex-1 truncate" style={terminal ? { color: 'var(--t-text)' } : undefined}>
              {area.name}
            </span>
          </div>
        ))}
      </div>
    )
  }

  function renderOverseas() {
    return (
      <div className="max-h-72 overflow-y-auto">
        {OVERSEAS_COUNTRIES.map((c) => (
          <div
            key={c.code}
            className={rowBaseClass()}
            style={rowStyle()}
            onMouseEnter={rowMouseEnter}
            onMouseLeave={rowMouseLeave}
            onClick={() => commit(buildOverseasCountryLocation(c))}
          >
            <Globe2 size={12} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
            <span className="flex-1 truncate" style={terminal ? { color: 'var(--t-text)' } : undefined}>
              {c.name_zh}
              <span className="ml-2 text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
                {c.code}
              </span>
            </span>
          </div>
        ))}
      </div>
    )
  }

  function renderDrillDown() {
    if (!top) return renderTopLevel()
    if (top.type === 'great-china') {
      if (city)     return renderCityChildren()
      if (province) return renderProvinceChildren()
      return renderGreatChina()
    }
    if (top.type === 'overseas') return renderOverseas()
    return renderTopLevel()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const popoverContent = open ? (
    <div
      ref={panelRef}
      className={terminal ? 'terminal-mode terminal-region-popover rounded-lg border' : 'absolute z-50 mt-1 w-full rounded-lg border shadow-lg'}
      style={terminal
        ? {
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            maxHeight: dropPos.maxHeight,
            overflowY: 'auto',
            fontSize: 12,
            fontFamily: 'var(--t-font-cjk, "PingFang SC", "Microsoft YaHei", sans-serif)',
            ...popoverStyle,
            boxShadow: 'var(--t-shadow-elevated, 0 18px 46px rgba(0, 0, 0, 0.72))',
          }
        : popoverStyle}
    >
      {/* Search box */}
      <div
        className="flex items-center gap-2 border-b"
        style={terminal ? { borderColor: 'var(--t-border-subtle)', padding: '6px 8px' } : { borderColor: '#e2e8f0' }}
      >
        <Search size={terminal ? 11 : 14} style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索地区名称 / 编码（如 上海、德国、440300、DE）"
          className="w-full bg-transparent outline-none border-none"
          style={searchInputStyle}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Body */}
      {isSearching ? renderSearchHits() : (
        <>
          {renderBreadcrumb()}
          {renderDrillDown()}
        </>
      )}
    </div>
  ) : null

  return (
    <div ref={wrapperRef} className="relative w-full">
      {renderTrigger()}
      {/* Portal to body. body[data-terminal-theme] is mirrored by TerminalLayout
          so --t-* tokens resolve correctly even outside .terminal-shell. */}
      {terminal
        ? popoverContent && createPortal(popoverContent, document.body)
        : popoverContent}
    </div>
  )
}
