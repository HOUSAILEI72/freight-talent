/**
 * regionTree.js — Build the mainland-China tree from @province-city-china/data
 * and assemble a flat search index over every selectable location in the
 * system. JSX-free so both `RegionSelector.jsx` AND
 * `scripts/verify-region-options.js` can import it.
 *
 * Selectable locations:
 *   - 5 special: Global / Remote / CN_MAINLAND_ALL / HK / TW
 *   - 28 overseas countries (whitelist in src/utils/overseasCountries.js)
 *   - All mainland provinces / cities / counties / districts (3653 nodes)
 *
 * NOT selectable:
 *   - Township-level rows (`town !== 0`) — filtered out
 *   - Province codes 71 (台湾) / 81 (香港) / 82 (澳门) — system uses
 *     dedicated codes `HK` / `TW` instead and does not currently support
 *     Macau as a location
 */
import chinaRegionData from '@province-city-china/data'
import { OVERSEAS_COUNTRIES } from './overseasCountries.js'
import {
  GLOBAL_LOCATION,
  REMOTE_LOCATION,
  CN_MAINLAND_ALL_LOCATION,
  HK_LOCATION,
  TW_LOCATION,
} from './businessArea.js'

// ── English aliases for mainland nodes ──────────────────────────────────────
//
// The npm data has only Chinese names; English-language users still need to
// search for mainland locations by Pinyin/English, so we maintain a small
// alias map. At minimum this covers everything the Phase B spec calls out;
// add more entries here whenever a customer asks for them.

export const MAINLAND_ALIAS = {
  // Direct-administered municipalities
  '110000': 'Beijing',
  '120000': 'Tianjin',
  '310000': 'Shanghai',
  '500000': 'Chongqing',

  // Provinces called out in spec
  '320000': 'Jiangsu',
  '330000': 'Zhejiang',
  '410000': 'Henan',
  '440000': 'Guangdong',
  '510000': 'Sichuan',

  // Major cities called out in spec
  '320100': 'Nanjing',
  '330100': 'Hangzhou',
  '410100': 'Zhengzhou',
  '440100': 'Guangzhou',
  '440300': 'Shenzhen',
  '510100': 'Chengdu',
}

// ── Province-prefix whitelists ──────────────────────────────────────────────

const FORBIDDEN_PREFIXES = new Set(['71', '81', '82'])
const ALLOWED_PREFIXES = new Set([
  '11', '12', '13', '14', '15',
  '21', '22', '23',
  '31', '32', '33', '34', '35', '36', '37',
  '41', '42', '43',
  '44', '45', '46',
  '50', '51', '52', '53', '54',
  '61', '62', '63', '64', '65',
])

/** Direct-administered municipalities (北京/天津/上海/重庆) — these provinces
 *  have NO city-level rows in the npm data. Their districts hang directly
 *  off the province, so the tree skips the synthetic city level for them. */
export const DIRECT_MUNICIPALITY_PREFIXES = new Set(['11', '12', '31', '50'])

// `r.city` and `r.area` are mixed: number 0 for province rows, string '01'
// etc. for sub-rows. Normalise via parseInt.
function intOf(v) {
  if (v === 0 || v === '0') return 0
  return parseInt(v, 10) || 0
}

// ── Build the mainland tree once at module load ─────────────────────────────

function buildMainlandTree() {
  // Group raw rows by province-prefix
  const byProv = new Map()
  for (const r of chinaRegionData) {
    if (r.town !== 0) continue
    const p = r.province
    if (!ALLOWED_PREFIXES.has(p) || FORBIDDEN_PREFIXES.has(p)) continue
    if (!byProv.has(p)) byProv.set(p, [])
    byProv.get(p).push(r)
  }

  const out = []
  for (const [p, rows] of byProv) {
    const provRow = rows.find(r => intOf(r.city) === 0 && intOf(r.area) === 0)
    if (!provRow) continue

    const isMunicipality = DIRECT_MUNICIPALITY_PREFIXES.has(p)
    const provNode = {
      code: provRow.code,
      name: provRow.name,
      name_en: MAINLAND_ALIAS[provRow.code] || null,
      type: 'province',
      isMunicipality,
      children: [],
    }

    if (isMunicipality) {
      // Areas hang directly off the municipality
      provNode.children = rows
        .filter(r => intOf(r.city) > 0 && intOf(r.area) > 0)
        .map(a => ({
          code: a.code,
          name: a.name,
          name_en: MAINLAND_ALIAS[a.code] || null,
          type: 'area',
        }))
    } else {
      // Standard province: cities, then areas under cities
      const cityRows = rows.filter(r => intOf(r.city) > 0 && intOf(r.area) === 0)
      const areasByCityKey = new Map()
      for (const a of rows.filter(r => intOf(r.city) > 0 && intOf(r.area) > 0)) {
        const k = String(a.city)
        if (!areasByCityKey.has(k)) areasByCityKey.set(k, [])
        areasByCityKey.get(k).push(a)
      }
      provNode.children = cityRows.map(c => ({
        code: c.code,
        name: c.name,
        name_en: MAINLAND_ALIAS[c.code] || null,
        type: 'city',
        children: (areasByCityKey.get(String(c.city)) || []).map(a => ({
          code: a.code,
          name: a.name,
          name_en: MAINLAND_ALIAS[a.code] || null,
          type: 'area',
        })),
      }))
    }
    out.push(provNode)
  }
  return out
}

export const MAINLAND_TREE = buildMainlandTree()

// ── Standard location-object builders ──────────────────────────────────────

/** Build a standard mainland location object given a node + ancestor chain.
 *  The chain is e.g. `[provinceNode, cityNode]` for an area-level node,
 *  empty for a province-level node. The result's `location_path` is always
 *  rooted at "Great China". */
export function buildMainlandLocation(node, ancestorChain = []) {
  const segments = ancestorChain.map(a => a.name).concat([node.name])
  return {
    location_code: node.code,
    location_name: node.name,
    location_path: ['Great China', ...segments].join('/'),
    location_type: 'mainland_china',
  }
}

export function buildOverseasCountryLocation(country) {
  return {
    location_code: country.code,
    location_name: country.name,
    location_path: `Overseas/${country.name}`,
    location_type: 'overseas_country',
  }
}

// ── Top-level groups (drives the no-query view in the popover) ─────────────

export const TOP_LEVEL_GROUPS = [
  { kind: 'leaf',  key: 'GLOBAL',      label: 'Global',     label_zh: 'Global',     location: GLOBAL_LOCATION },
  { kind: 'group', key: 'GREAT_CHINA', label: 'Great China', label_zh: 'Great China' },
  { kind: 'leaf',  key: 'HK',          label: 'Hong Kong',  label_zh: '香港',        location: HK_LOCATION },
  { kind: 'leaf',  key: 'TW',          label: 'Taiwan',     label_zh: '台湾',        location: TW_LOCATION },
  { kind: 'group', key: 'OVERSEAS',    label: 'Overseas',   label_zh: 'Overseas' },
  { kind: 'leaf',  key: 'REMOTE',      label: 'Remote',     label_zh: 'Remote',     location: REMOTE_LOCATION },
]

// ── Search index (flat, all selectable items) ──────────────────────────────

function makeSearchItem(location, displayLabel, displayPath, tokens) {
  return {
    location,
    displayLabel,
    displayPath,
    code: location.location_code,
    // Pre-lowercase tokens for fast substring matching.
    tokens: tokens.filter(Boolean).map(t => String(t).toLowerCase()),
  }
}

const _SEARCH_ITEMS = []

// 5 special locations
_SEARCH_ITEMS.push(makeSearchItem(GLOBAL_LOCATION,          'Global',                 'Global',           ['Global', 'GLOBAL', '全球', '全部']))
_SEARCH_ITEMS.push(makeSearchItem(REMOTE_LOCATION,          'Remote',                 'Remote',           ['Remote', 'REMOTE', '远程', 'WFH']))
_SEARCH_ITEMS.push(makeSearchItem(CN_MAINLAND_ALL_LOCATION, '全国 (Mainland China)',   'Great China/全国', ['全国', 'Mainland China', 'Great China', 'CN_MAINLAND_ALL', '中国大陆']))
_SEARCH_ITEMS.push(makeSearchItem(HK_LOCATION,              'Hong Kong',              'Hong Kong',        ['Hong Kong', 'HK', '香港']))
_SEARCH_ITEMS.push(makeSearchItem(TW_LOCATION,              'Taiwan',                 'Taiwan',           ['Taiwan', 'TW', '台湾']))

// Mainland nodes (province + city + area, recursive)
function pushMainlandNode(node, ancestorChain) {
  const loc = buildMainlandLocation(node, ancestorChain)
  _SEARCH_ITEMS.push(makeSearchItem(
    loc,
    node.name,
    loc.location_path,
    [node.name, node.name_en, node.code, ...ancestorChain.map(a => a.name)],
  ))
  if (node.children?.length) {
    for (const child of node.children) {
      pushMainlandNode(child, [...ancestorChain, node])
    }
  }
}
for (const prov of MAINLAND_TREE) pushMainlandNode(prov, [])

// Overseas countries
for (const c of OVERSEAS_COUNTRIES) {
  const loc = buildOverseasCountryLocation(c)
  _SEARCH_ITEMS.push(makeSearchItem(
    loc,
    c.name,
    loc.location_path,
    [c.name, c.name_zh, c.code],
  ))
}

export const SEARCH_ITEMS = _SEARCH_ITEMS

/** Returns up to `limit` search hits for `query`. Empty / null query → [].
 *  Match rules:
 *    - `code` exactly equals query (case-folded for ISO; numeric Chinese
 *      codes also matched here)
 *    - any item-token (Chinese/English/code) substring matches query
 *  Items are pushed in registration order so common picks (the 5 special
 *  locations) bubble to the top of ambiguous queries. */
export function searchRegion(query, limit = 80) {
  if (!query) return []
  const q = String(query).trim()
  if (!q) return []
  const qLower = q.toLowerCase()
  const qUpper = q.toUpperCase()
  const out = []
  for (const item of SEARCH_ITEMS) {
    let hit = false
    if (item.code === qUpper) hit = true
    else {
      for (const t of item.tokens) {
        if (t.includes(qLower)) { hit = true; break }
      }
    }
    if (hit) {
      out.push(item)
      if (out.length >= limit) break
    }
  }
  return out
}
