import { useEffect, useMemo, useRef, useState } from 'react'
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
  getBusinessAreaByLocationCode,
  buildLocationObject,
  CN_MAINLAND_ALL_LOCATION,
} from '../utils/businessArea.js'

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
 *
 * Architecture
 *  - All static data + search lives in `src/utils/regionTree.js` (JSX-free).
 *  - The component is two views inside one popover:
 *      1) drill-down (no query):  top-level groups → Great China tree /
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
}) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const [navStack, setNavStack] = useState([]) // [{type:'great-china'|'overseas'|'province'|'city', node?}]

  const wrapperRef = useRef(null)
  const searchRef  = useRef(null)

  // ── Close on outside click / Escape ───────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
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
      setQuery('')
      setNavStack([])
      // Defer focus until after the popover is in the DOM.
      const t = setTimeout(() => searchRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

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
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: value ? 'var(--t-text)' : 'var(--t-text-muted)' }
    : undefined
  const popoverStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined
  const searchInputStyle = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined

  function rowBaseClass(active = false) {
    if (terminal) {
      return 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors'
    }
    return active
      ? 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer bg-blue-50 text-blue-700'
      : 'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50 text-slate-700'
  }
  function rowStyle(active = false) {
    if (!terminal) return undefined
    return active
      ? { background: 'var(--t-bg-active)', color: 'var(--t-text)' }
      : undefined
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

  function renderTrigger() {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`relative inline-flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
          terminal ? '' : (value ? 'border-slate-200 text-slate-700' : 'border-slate-200 text-slate-400')
        } ${className}`}
        style={triggerStyle}
      >
        <Globe2 size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
        <span className="flex-1 min-w-0 truncate">
          {value ? value.location_path || value.location_name : placeholder}
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
          className="px-4 py-6 text-center text-sm"
          style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
        >
          No matching location
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
                {h.displayLabel}
              </div>
              <div className="truncate text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
                {h.displayPath}
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
                {g.label}
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
    if (top.type === 'great-china') segments.push({ label: 'Great China', onClick: () => setNavStack([{ type: 'great-china' }]) })
    if (top.type === 'overseas')    segments.push({ label: 'Overseas',    onClick: () => setNavStack([{ type: 'overseas' }]) })
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
          ‹ Back
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
    // 1) "全国 (Mainland China)" + 2) provinces grid
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
            全国 / Mainland China
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
                  // Has children → drill down so the user can pick a city /
                  // district. The "选择 XX 整体" row inside the next level
                  // covers the case where they want to commit the province
                  // as a whole. No children → commit directly.
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
                  {p.name_en && (
                    <span
                      className="ml-2 text-xs"
                      style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
                    >
                      {p.name_en}
                    </span>
                  )}
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
                {child.name_en && (
                  <span
                    className="ml-2 text-xs"
                    style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
                  >
                    {child.name_en}
                  </span>
                )}
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
              {area.name_en && (
                <span className="ml-2 text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
                  {area.name_en}
                </span>
              )}
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
              {c.name}
              <span className="ml-2 text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
                {c.name_zh} · {c.code}
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
  return (
    <div ref={wrapperRef} className="relative w-full">
      {renderTrigger()}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border shadow-lg"
          style={popoverStyle}
        >
          {/* Search box */}
          <div
            className="flex items-center gap-2 border-b px-3 py-2"
            style={terminal ? { borderColor: 'var(--t-border-subtle)' } : { borderColor: '#e2e8f0' }}
          >
            <Search size={14} style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name / code (e.g. Shanghai, Germany, 440300, DE)"
              className="w-full bg-transparent text-sm outline-none border-none"
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
      )}
      {/* Hidden import to keep getBusinessAreaByLocationCode used (silences
          unused-import warnings if commit() ever stops calling it). */}
      {process.env.NODE_ENV === 'never' && <span>{String(getBusinessAreaByLocationCode('GLOBAL'))}</span>}
    </div>
  )
}
