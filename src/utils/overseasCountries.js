/**
 * Fixed list of overseas countries the system allows as a job / candidate
 * `location_code`. Users may NOT free-form additional countries — search
 * and select are constrained to this list (also mirrored in
 * `backend/app/utils/business_area.py`).
 *
 * Each entry:
 *   - code:    ISO 3166-1 alpha-2 (used as `location_code`)
 *   - name:    English display name (used as `location_name`)
 *   - name_zh: Simplified Chinese display name (search alias only)
 *
 * Adding a country: also add it to OVERSEAS_COUNTRY_CODES in
 * `backend/app/utils/business_area.py`. Front-end and back-end whitelists
 * MUST stay in lock-step or `validate_location_payload` will 400.
 */
export const OVERSEAS_COUNTRIES = [
  // Americas
  { code: 'US', name: 'United States', name_zh: '美国' },
  { code: 'CA', name: 'Canada',        name_zh: '加拿大' },
  { code: 'MX', name: 'Mexico',        name_zh: '墨西哥' },
  { code: 'BR', name: 'Brazil',        name_zh: '巴西' },
  { code: 'CL', name: 'Chile',         name_zh: '智利' },

  // Europe
  { code: 'GB', name: 'United Kingdom', name_zh: '英国' },
  { code: 'DE', name: 'Germany',        name_zh: '德国' },
  { code: 'FR', name: 'France',         name_zh: '法国' },
  { code: 'NL', name: 'Netherlands',    name_zh: '荷兰' },
  { code: 'BE', name: 'Belgium',        name_zh: '比利时' },
  { code: 'IT', name: 'Italy',          name_zh: '意大利' },
  { code: 'ES', name: 'Spain',          name_zh: '西班牙' },
  { code: 'PL', name: 'Poland',         name_zh: '波兰' },

  // Asia
  { code: 'JP', name: 'Japan',          name_zh: '日本' },
  { code: 'KR', name: 'South Korea',    name_zh: '韩国' },
  { code: 'SG', name: 'Singapore',      name_zh: '新加坡' },
  { code: 'MY', name: 'Malaysia',       name_zh: '马来西亚' },
  { code: 'TH', name: 'Thailand',       name_zh: '泰国' },
  { code: 'VN', name: 'Vietnam',        name_zh: '越南' },
  { code: 'ID', name: 'Indonesia',      name_zh: '印度尼西亚' },
  { code: 'PH', name: 'Philippines',    name_zh: '菲律宾' },
  { code: 'IN', name: 'India',          name_zh: '印度' },

  // Middle East
  { code: 'AE', name: 'United Arab Emirates', name_zh: '阿联酋' },
  { code: 'SA', name: 'Saudi Arabia',         name_zh: '沙特阿拉伯' },

  // Oceania
  { code: 'AU', name: 'Australia',  name_zh: '澳大利亚' },
  { code: 'NZ', name: 'New Zealand', name_zh: '新西兰' },

  // Africa
  { code: 'ZA', name: 'South Africa', name_zh: '南非' },
  { code: 'EG', name: 'Egypt',        name_zh: '埃及' },
]

export const OVERSEAS_COUNTRY_CODES = new Set(OVERSEAS_COUNTRIES.map((c) => c.code))

export function findOverseasCountry(code) {
  if (!code) return null
  return OVERSEAS_COUNTRIES.find((c) => c.code === code) || null
}

/**
 * Search overseas countries by ISO code, English name or Chinese name.
 * Used by RegionSelector. Case-insensitive on code/English.
 */
export function searchOverseasCountries(query) {
  const q = String(query || '').trim()
  if (!q) return OVERSEAS_COUNTRIES
  const qUpper = q.toUpperCase()
  const qLower = q.toLowerCase()
  return OVERSEAS_COUNTRIES.filter((c) =>
    c.code === qUpper ||
    c.name.toLowerCase().includes(qLower) ||
    c.name_zh.includes(q),
  )
}
