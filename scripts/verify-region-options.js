#!/usr/bin/env node
/**
 * scripts/verify-region-options.js
 *
 * Validates that RegionSelector's data layer (`src/utils/regionTree.js`) can
 * resolve every Phase B fixture case to the spec-mandated standard location
 * object — and that the search index hits the expected items for the
 * Chinese / English / code queries from the spec.
 *
 * This DOES NOT render the React component. The component is a thin UI on
 * top of `regionTree.js`; if every selection target can be constructed from
 * the data layer and `buildLocationObject(...).business_area_code` matches,
 * the UI is wired correctly.
 */
import {
  TOP_LEVEL_GROUPS,
  MAINLAND_TREE,
  buildMainlandLocation,
  buildOverseasCountryLocation,
  searchRegion,
} from '../src/utils/regionTree.js'
import { OVERSEAS_COUNTRIES } from '../src/utils/overseasCountries.js'
import {
  buildLocationObject,
  GLOBAL_LOCATION,
  REMOTE_LOCATION,
  HK_LOCATION,
  TW_LOCATION,
  CN_MAINLAND_ALL_LOCATION,
} from '../src/utils/businessArea.js'

let pass = 0
let fail = 0
function check(label, ok, extra = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`)
  if (ok) pass++
  else   fail++
}

// Helpers to walk MAINLAND_TREE without hard-coding indices
function findProv(code)  { return MAINLAND_TREE.find(p => p.code === code) || null }
function findCity(prov, code) { return prov?.children?.find(c => c.code === code) || null }
function findArea(parent, code) { return parent?.children?.find(c => c.code === code) || null }

// ── 12 fixture cases ─────────────────────────────────────────────────────────
console.log('-- 12 fixture cases --')

// 1. Global
{
  const built = buildLocationObject(GLOBAL_LOCATION)
  check('1.  Global', built?.location_code === 'GLOBAL' && built?.business_area_code === 'GLOBAL' && built?.location_path === 'Global')
}
// 2. Remote
{
  const built = buildLocationObject(REMOTE_LOCATION)
  check('2.  Remote', built?.location_code === 'REMOTE' && built?.business_area_code === 'REMOTE')
}
// 0全国
{
  const built = buildLocationObject(CN_MAINLAND_ALL_LOCATION)
  check('3.  China / 全国', built?.location_code === 'CN_MAINLAND_ALL' && built?.business_area_code === 'GREAT_CHINA' && built?.location_path === 'China/全国')
}
// 0上海市 (province-level direct municipality)
{
  const sh = findProv('310000')
  const built = buildLocationObject(buildMainlandLocation(sh, []))
  check('4.  China / 上海市', sh && built?.location_code === '310000' && built?.business_area_code === 'EAST_CHINA' && built?.location_path === 'China/上海市')
}
// 0上海市 / 浦东新区  (310115 area under direct municipality)
{
  const sh   = findProv('310000')
  const area = findArea(sh, '310115')
  const built = area && buildLocationObject(buildMainlandLocation(area, [sh]))
  check('5.  China / 上海市 / 浦东新区',
    built?.location_code === '310115' && built?.business_area_code === 'EAST_CHINA' && built?.location_path === 'China/上海市/浦东新区')
}
// 0广东省 / 深圳市
{
  const gd = findProv('440000')
  const sz = findCity(gd, '440300')
  const built = sz && buildLocationObject(buildMainlandLocation(sz, [gd]))
  check('6.  China / 广东省 / 深圳市',
    built?.location_code === '440300' && built?.business_area_code === 'SOUTH_CHINA' && built?.location_path === 'China/广东省/深圳市')
}
// 0北京市
{
  const bj = findProv('110000')
  const built = buildLocationObject(buildMainlandLocation(bj, []))
  check('7.  China / 北京市', built?.location_code === '110000' && built?.business_area_code === 'NORTH_CHINA')
}
// 0四川省 / 成都市
{
  const sc = findProv('510000')
  const cd = findCity(sc, '510100')
  const built = cd && buildLocationObject(buildMainlandLocation(cd, [sc]))
  check('8.  China / 四川省 / 成都市',
    built?.location_code === '510100' && built?.business_area_code === 'WEST_CHINA' && built?.location_path === 'China/四川省/成都市')
}
// 0河南省 / 郑州市
{
  const ha = findProv('410000')
  const zz = findCity(ha, '410100')
  const built = zz && buildLocationObject(buildMainlandLocation(zz, [ha]))
  check('9.  China / 河南省 / 郑州市',
    built?.location_code === '410100' && built?.business_area_code === 'CENTRAL_CHINA' && built?.location_path === 'China/河南省/郑州市')
}
// 10. Hong Kong
{
  const built = buildLocationObject(HK_LOCATION)
  check('10. Hong Kong', built?.location_code === 'HK' && built?.business_area_code === 'HONG_KONG' && built?.location_path === 'China/Hong Kong')
}
// 11. Taiwan
{
  const built = buildLocationObject(TW_LOCATION)
  check('11. Taiwan', built?.location_code === 'TW' && built?.business_area_code === 'TAIWAN' && built?.location_path === 'China/Taiwan')
}
// 12. Overseas / Germany
{
  const de = OVERSEAS_COUNTRIES.find(c => c.code === 'DE')
  const built = de && buildLocationObject(buildOverseasCountryLocation(de))
  check('12. Overseas / Germany',
    built?.location_code === 'DE' && built?.business_area_code === 'OVERSEAS' && built?.location_path === 'Overseas/Germany')
}

// ── Search ability (Chinese / English / code) ─────────────────────────────
console.log('\n-- search ability --')

function expectHit(query, predicate, label) {
  const hits = searchRegion(query, 100)
  const ok = hits.some(predicate)
  check(`search "${query}" → ${label}`, ok, `(${hits.length} hits)`)
}

// Spec list
expectHit('上海',     h => h.code === '310000', 'has 310000 上海市')
expectHit('Shanghai', h => h.code === '310000', 'has 310000 上海市 (English alias)')
expectHit('深圳',     h => h.code === '440300', 'has 440300 深圳市')
expectHit('Shenzhen', h => h.code === '440300', 'has 440300 深圳市 (English alias)')
expectHit('德国',     h => h.code === 'DE',     'has Germany (Chinese)')
expectHit('Germany',  h => h.code === 'DE',     'has Germany (English)')
expectHit('日本',     h => h.code === 'JP',     'has Japan (Chinese)')
expectHit('Japan',    h => h.code === 'JP',     'has Japan (English)')
expectHit('310000',   h => h.code === '310000', 'numeric code')
expectHit('440300',   h => h.code === '440300', 'numeric code')
expectHit('DE',       h => h.code === 'DE',     'ISO code')
expectHit('JP',       h => h.code === 'JP',     'ISO code')
// Chengdu / Zhengzhou / Beijing aliases
expectHit('Chengdu',  h => h.code === '510100', 'Chengdu alias → 510100')
expectHit('Zhengzhou', h => h.code === '410100', 'Zhengzhou alias → 410100')
expectHit('Beijing',   h => h.code === '110000', 'Beijing alias → 110000')

// Special tokens
expectHit('Mainland China', h => h.code === 'CN_MAINLAND_ALL', 'Mainland China alias')
expectHit('全国',           h => h.code === 'CN_MAINLAND_ALL', '全国 alias')
expectHit('Remote',         h => h.code === 'REMOTE',          'Remote')

// "No matching location" — searching gibberish must produce zero hits
{
  const hits = searchRegion('xyz_unknown_country_zzz', 100)
  check('search gibberish → 0 hits (UI shows "No matching location")', hits.length === 0)
}

// Forbidden 71/81/82 must NOT be reachable via search
{
  const tw71 = searchRegion('710000', 100).find(h => h.code === '710000')
  check('search "710000" must NOT match (use TW instead)', !tw71)
  const hk81 = searchRegion('810000', 100).find(h => h.code === '810000')
  check('search "810000" must NOT match (use HK instead)', !hk81)
  const mo82 = searchRegion('820000', 100).find(h => h.code === '820000')
  check('search "820000" must NOT match (use MO instead)', !mo82)
}

// ── Tree integrity ────────────────────────────────────────────────────────
console.log('\n-- tree integrity --')
check('TOP_LEVEL_GROUPS has 4 entries',  TOP_LEVEL_GROUPS.length === 4)
check('MAINLAND_TREE has 31 provinces',  MAINLAND_TREE.length === 31)
check('上海市 has 0 children of type=city (direct municipality)',
  findProv('310000')?.children.every(c => c.type === 'area'))
check('广东省 has city-level children',
  findProv('440000')?.children.every(c => c.type === 'city'))
check('深圳市 has area-level children',
  findCity(findProv('440000'), '440300')?.children.length > 0)
check('No 71/81/82 in MAINLAND_TREE',
  !MAINLAND_TREE.some(p => ['710000','810000','820000'].includes(p.code)))

console.log(`\n  TOTAL: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
