/**
 * businessArea.js — Front-end source of truth for the system's
 * `business_area_code` taxonomy and the rule that maps a `location_code`
 * (the user-selectable item) to a `business_area_code` (the analytics /
 * filter bucket).
 *
 * IMPORTANT INVARIANTS (mirrored in backend/app/utils/business_area.py):
 *   1. `business_area_code` is computed by the back-end on save. Front-end
 *      values are display-only and MUST NOT be trusted server-side.
 *   2. Hong Kong, Taiwan, Macau are NOT part of Great China.
 *   3. Province-level codes 71 / 81 / 82 are NOT valid mainland location
 *      codes — the system uses the special codes `HK` / `TW` instead.
 *      (Macau is currently not supported.)
 *   4. The mainland-China province-prefix → business-area mapping is the
 *      single rule for any 6-digit code; all 6-digit codes that share the
 *      same first two digits resolve to the same business area.
 *
 * Re-export keys exactly as documented in the spec — DO NOT rename.
 */

import { OVERSEAS_COUNTRY_CODES, findOverseasCountry } from './overseasCountries.js'

// ── Business area taxonomy ───────────────────────────────────────────────────

export const BUSINESS_AREAS = {
  GLOBAL:        { code: 'GLOBAL',        name: 'Global' },
  REMOTE:        { code: 'REMOTE',        name: 'Remote' },
  GREAT_CHINA:   { code: 'GREAT_CHINA',   name: 'Great China' },
  EAST_CHINA:    { code: 'EAST_CHINA',    name: 'East China' },
  NORTH_CHINA:   { code: 'NORTH_CHINA',   name: 'North China' },
  SOUTH_CHINA:   { code: 'SOUTH_CHINA',   name: 'South China' },
  WEST_CHINA:    { code: 'WEST_CHINA',    name: 'West China' },
  CENTRAL_CHINA: { code: 'CENTRAL_CHINA', name: 'Central China' },
  HONG_KONG:     { code: 'HONG_KONG',     name: 'Hong Kong' },
  TAIWAN:        { code: 'TAIWAN',        name: 'Taiwan' },
  OVERSEAS:      { code: 'OVERSEAS',      name: 'Overseas' },
}

/** Default order for filter chips on Jobs / Candidates list pages. */
export const DEFAULT_AREA_FILTERS = [
  BUSINESS_AREAS.GLOBAL,
  BUSINESS_AREAS.GREAT_CHINA,
  BUSINESS_AREAS.EAST_CHINA,
  BUSINESS_AREAS.NORTH_CHINA,
  BUSINESS_AREAS.SOUTH_CHINA,
  BUSINESS_AREAS.WEST_CHINA,
  BUSINESS_AREAS.HONG_KONG,
  BUSINESS_AREAS.TAIWAN,
  BUSINESS_AREAS.OVERSEAS,
]

// ── Mainland-China province-prefix → business-area map ───────────────────────
//
// Key is a 2-digit string (the `province` field from @province-city-china/data,
// equivalent to the first two digits of a 6-digit `code`).
//
// Coverage check:
//   East China:    31, 32, 33, 34, 35, 36, 37            (7)
//   North China:   11, 12, 13, 14, 15                    (5)
//   South China:   44, 45, 46                            (3)
//   West China:    50, 51, 52, 53, 54, 61, 62, 63, 64, 65 (10)
//   Central China: 41, 42, 43                            (3)
//   Northeast (21/22/23) → bucketed under NORTH_CHINA per spec defaults
//                          (spec doesn't list Northeast separately;
//                           keeping it under NORTH_CHINA matches the
//                           shipping industry's working partition).
//
// HK/TW/MO (71/81/82) are NOT in this map; they have dedicated business areas
// and dedicated location codes (HK / TW). Macau is currently unsupported as a
// location code and would resolve to null here.
const PROVINCE_TO_AREA = {
  // North China
  '11': BUSINESS_AREAS.NORTH_CHINA,
  '12': BUSINESS_AREAS.NORTH_CHINA,
  '13': BUSINESS_AREAS.NORTH_CHINA,
  '14': BUSINESS_AREAS.NORTH_CHINA,
  '15': BUSINESS_AREAS.NORTH_CHINA,

  // Northeast → grouped with North China (no NORTHEAST_CHINA bucket in spec)
  '21': BUSINESS_AREAS.NORTH_CHINA,
  '22': BUSINESS_AREAS.NORTH_CHINA,
  '23': BUSINESS_AREAS.NORTH_CHINA,

  // East China
  '31': BUSINESS_AREAS.EAST_CHINA,
  '32': BUSINESS_AREAS.EAST_CHINA,
  '33': BUSINESS_AREAS.EAST_CHINA,
  '34': BUSINESS_AREAS.EAST_CHINA,
  '35': BUSINESS_AREAS.EAST_CHINA,
  '36': BUSINESS_AREAS.EAST_CHINA,
  '37': BUSINESS_AREAS.EAST_CHINA,

  // Central China
  '41': BUSINESS_AREAS.CENTRAL_CHINA,
  '42': BUSINESS_AREAS.CENTRAL_CHINA,
  '43': BUSINESS_AREAS.CENTRAL_CHINA,

  // South China
  '44': BUSINESS_AREAS.SOUTH_CHINA,
  '45': BUSINESS_AREAS.SOUTH_CHINA,
  '46': BUSINESS_AREAS.SOUTH_CHINA,

  // West China (incl. southwest + northwest)
  '50': BUSINESS_AREAS.WEST_CHINA,
  '51': BUSINESS_AREAS.WEST_CHINA,
  '52': BUSINESS_AREAS.WEST_CHINA,
  '53': BUSINESS_AREAS.WEST_CHINA,
  '54': BUSINESS_AREAS.WEST_CHINA,
  '61': BUSINESS_AREAS.WEST_CHINA,
  '62': BUSINESS_AREAS.WEST_CHINA,
  '63': BUSINESS_AREAS.WEST_CHINA,
  '64': BUSINESS_AREAS.WEST_CHINA,
  '65': BUSINESS_AREAS.WEST_CHINA,
}

/** Province codes (2-digit prefixes) that are NOT valid as mainland codes
 *  but DO appear in the npm data — we explicitly reject them. */
const FORBIDDEN_MAINLAND_PREFIXES = new Set(['71', '81', '82'])

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the 6-digit province-level code for any mainland 6-digit code,
 *  or `null` if the input is not a 6-digit numeric mainland code. */
export function getProvinceCode(locationCode) {
  if (!locationCode) return null
  const s = String(locationCode)
  if (!/^[0-9]{6}$/.test(s)) return null
  return s.slice(0, 2) + '0000'
}

/** True iff the input is a 6-digit numeric code whose first two digits map
 *  to a known mainland province (and is NOT 71 / 81 / 82). */
export function isMainlandChinaCode(locationCode) {
  if (!locationCode) return false
  const s = String(locationCode)
  if (!/^[0-9]{6}$/.test(s)) return false
  const prefix = s.slice(0, 2)
  if (FORBIDDEN_MAINLAND_PREFIXES.has(prefix)) return false
  return Object.prototype.hasOwnProperty.call(PROVINCE_TO_AREA, prefix)
}

/** True iff `code` is one of the special non-numeric location codes the
 *  system accepts (Global / Remote / mainland aggregate / HK / TW). */
export function isAllowedSpecialLocationCode(code) {
  return (
    code === 'GLOBAL' ||
    code === 'REMOTE' ||
    code === 'CN_MAINLAND_ALL' ||
    code === 'HK' ||
    code === 'TW'
  )
}

/** True iff `code` is on the system's overseas-country whitelist. */
export function isKnownOverseasCountryCode(code) {
  return OVERSEAS_COUNTRY_CODES.has(code)
}

/**
 * The single rule that maps a `location_code` to its `business_area`.
 * Returns `null` for unknown / forbidden codes.
 */
export function getBusinessAreaByLocationCode(locationCode) {
  if (!locationCode) return null

  if (locationCode === 'GLOBAL')          return BUSINESS_AREAS.GLOBAL
  if (locationCode === 'REMOTE')          return BUSINESS_AREAS.REMOTE
  if (locationCode === 'CN_MAINLAND_ALL') return BUSINESS_AREAS.GREAT_CHINA
  if (locationCode === 'HK')              return BUSINESS_AREAS.HONG_KONG
  if (locationCode === 'TW')              return BUSINESS_AREAS.TAIWAN

  if (isKnownOverseasCountryCode(locationCode)) return BUSINESS_AREAS.OVERSEAS

  if (isMainlandChinaCode(locationCode)) {
    const prefix = String(locationCode).slice(0, 2)
    return PROVINCE_TO_AREA[prefix] || null
  }

  return null
}

// ── Optional convenience constructors (used by RegionSelector & forms) ──────

/** Build a standard location object from a selected option.
 *  `option` shape varies by source, so we accept the union and normalise. */
export function buildLocationObject(option) {
  if (!option || !option.location_code) return null
  const area = getBusinessAreaByLocationCode(option.location_code)
  if (!area) return null
  return {
    location_code: option.location_code,
    location_name: option.location_name,
    location_path: option.location_path,
    location_type: option.location_type,
    business_area_code: area.code,
    business_area_name: area.name,
  }
}

/** Returns `null` if the given location object passes all front-end shape /
 *  whitelist checks; otherwise an error message string. Front-end gate only;
 *  the back-end MUST run `validate_location_payload` of its own. */
export function validateLocationObject(loc) {
  if (!loc) return 'location is required'
  if (!loc.location_code) return 'location_code is required'
  if (!loc.location_name) return 'location_name is required'
  if (!loc.location_path) return 'location_path is required'
  if (!loc.location_type) return 'location_type is required'

  const code = loc.location_code
  const allowed =
    isAllowedSpecialLocationCode(code) ||
    isKnownOverseasCountryCode(code) ||
    isMainlandChinaCode(code)
  if (!allowed) return `Unknown location_code: ${code}`

  // Cross-check: business_area should match what the rule computes.
  // We don't fail on mismatch here — just normalise via buildLocationObject.
  return null
}

// ── Static helper for HK/TW display ─────────────────────────────────────────

export const HK_LOCATION = {
  location_code: 'HK',
  location_name: 'Hong Kong',
  location_path: 'Hong Kong',
  location_type: 'hong_kong',
}

export const TW_LOCATION = {
  location_code: 'TW',
  location_name: 'Taiwan',
  location_path: 'Taiwan',
  location_type: 'taiwan',
}

export const GLOBAL_LOCATION = {
  location_code: 'GLOBAL',
  location_name: 'Global',
  location_path: 'Global',
  location_type: 'global',
}

export const REMOTE_LOCATION = {
  location_code: 'REMOTE',
  location_name: 'Remote',
  location_path: 'Remote',
  location_type: 'remote',
}

export const CN_MAINLAND_ALL_LOCATION = {
  location_code: 'CN_MAINLAND_ALL',
  location_name: '全国',
  location_path: 'Great China/全国',
  location_type: 'mainland_china',
}

/** Convenience: re-export the overseas-country lookup so callers don't need
 *  a second import for the common "build a location object from country
 *  code" path. */
export function buildOverseasLocation(code) {
  const c = findOverseasCountry(code)
  if (!c) return null
  return {
    location_code: c.code,
    location_name: c.name,
    location_path: `Overseas/${c.name}`,
    location_type: 'overseas_country',
  }
}
