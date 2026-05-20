/**
 * scripts/build-mainland-locations.js
 *
 * Reads the @province-city-china/data npm package's data.json and writes a
 * filtered, back-end-friendly JSON to:
 *
 *   backend/app/data/mainland_locations.json
 *
 * Filter rules (mirrored in front-end RegionSelector):
 *   - keep only `town === 0` (drop township / village rows)
 *   - keep only mainland province prefixes (11 / 12 / 13 / 14 / 15
 *                                           21 / 22 / 23
 *                                           31 / 32 / 33 / 34 / 35 / 36 / 37
 *                                           41 / 42 / 43
 *                                           44 / 45 / 46
 *                                           50 / 51 / 52 / 53 / 54
 *                                           61 / 62 / 63 / 64 / 65)
 *   - exclude prefixes 71 (台湾) / 81 (香港) / 82 (澳门) — use HK/TW/MO codes instead
 *
 * Output rows preserve `code`, `name`, `province`, `city`, `area`. Rationale:
 *   - the back-end whitelists location codes by lookup; we don't need
 *     name_en / town / pinyin server-side.
 *   - this file becomes the authoritative server-side mainland whitelist.
 *     Front-end can keep using the npm package directly.
 *
 * Usage:
 *
 *   node scripts/build-mainland-locations.js
 *
 * Re-run after upgrading @province-city-china/data.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')

const SRC_PATH = join(REPO_ROOT, 'node_modules', '@province-city-china', 'data', 'data.json')
const OUT_DIR  = join(REPO_ROOT, 'backend', 'app', 'data')
const OUT_PATH = join(OUT_DIR, 'mainland_locations.json')

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

function isMainlandRow(r) {
  if (r.town !== 0) return false
  // r.province in this dataset is the 2-digit prefix string ("11"…"65"/"71"/"81"/"82")
  if (FORBIDDEN_PREFIXES.has(r.province)) return false
  return ALLOWED_PREFIXES.has(r.province)
}

async function main() {
  const raw = await readFile(SRC_PATH, 'utf8')
  const all = JSON.parse(raw)
  if (!Array.isArray(all)) {
    throw new Error(`expected array at ${SRC_PATH}, got ${typeof all}`)
  }

  const filtered = all
    .filter(isMainlandRow)
    .map((r) => ({
      code:     r.code,
      name:     r.name,
      province: r.province,
      city:     r.city,
      area:     r.area,
    }))

  // Sanity counts (rough)
  const provLevel = filtered.filter((r) => r.city === 0 && r.area === 0).length
  const cityLevel = filtered.filter((r) => r.city !== 0 && r.area === 0).length
  const areaLevel = filtered.filter((r) => r.city !== 0 && r.area !== 0).length

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT_PATH, JSON.stringify(filtered, null, 0) + '\n', 'utf8')

  console.log('mainland_locations.json written')
  console.log('  src:        ', SRC_PATH)
  console.log('  out:        ', OUT_PATH)
  console.log('  total rows: ', filtered.length)
  console.log('  province:   ', provLevel)
  console.log('  city:       ', cityLevel)
  console.log('  area/county:', areaLevel)
  console.log('  excluded province codes: 71 / 81 / 82 (HK / TW / MO)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
