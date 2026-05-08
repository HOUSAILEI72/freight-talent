#!/usr/bin/env node
/**
 * scripts/verify-business-area.js
 *
 * Stand-alone test harness for `src/utils/businessArea.js`. Runs the 16
 * fixture cases agreed in Phase A and prints PASS/FAIL.
 *
 * Usage:  node scripts/verify-business-area.js
 *
 * Exits non-zero if any case fails so it can gate CI later.
 */
import {
  getBusinessAreaByLocationCode,
  isMainlandChinaCode,
  isAllowedSpecialLocationCode,
  isKnownOverseasCountryCode,
  getProvinceCode,
} from '../src/utils/businessArea.js'

const cases = [
  // [input, expected_business_area_code | null, label]
  ['GLOBAL',          'GLOBAL',         '1.  GLOBAL'],
  ['REMOTE',          'REMOTE',         '2.  REMOTE'],
  ['CN_MAINLAND_ALL', 'GREAT_CHINA',    '3.  CN_MAINLAND_ALL → GREAT_CHINA'],
  ['310000',          'EAST_CHINA',     '4.  310000 上海市 → EAST_CHINA'],
  ['310115',          'EAST_CHINA',     '5.  310115 浦东新区 → EAST_CHINA'],
  ['440300',          'SOUTH_CHINA',    '6.  440300 深圳市 → SOUTH_CHINA'],
  ['110000',          'NORTH_CHINA',    '7.  110000 北京市 → NORTH_CHINA'],
  ['510100',          'WEST_CHINA',     '8.  510100 成都市 → WEST_CHINA'],
  ['410100',          'CENTRAL_CHINA',  '9.  410100 郑州市 → CENTRAL_CHINA'],
  ['HK',              'HONG_KONG',      '10. HK → HONG_KONG'],
  ['TW',              'TAIWAN',         '11. TW → TAIWAN'],
  ['DE',              'OVERSEAS',       '12. DE → OVERSEAS'],
  ['710000',          null,             '13. 710000 (台湾省) invalid'],
  ['810000',          null,             '14. 810000 (香港) invalid'],
  ['820000',          null,             '15. 820000 (澳门) invalid'],
  ['999999',          null,             '16. 999999 invalid'],
]

let pass = 0
let fail = 0
for (const [input, expected, label] of cases) {
  const got = getBusinessAreaByLocationCode(input)
  const gotCode = got ? got.code : null
  const ok = gotCode === expected
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)}  expected=${expected}  got=${gotCode}`)
  if (ok) pass++
  else fail++
}

// Bonus: confirm forbidden prefixes also fail the granular helpers
const granular = [
  ['isMainlandChinaCode("310115")', isMainlandChinaCode('310115'), true],
  ['isMainlandChinaCode("710000")', isMainlandChinaCode('710000'), false],
  ['isMainlandChinaCode("810000")', isMainlandChinaCode('810000'), false],
  ['isAllowedSpecialLocationCode("HK")', isAllowedSpecialLocationCode('HK'), true],
  ['isAllowedSpecialLocationCode("MO")', isAllowedSpecialLocationCode('MO'), false],
  ['isKnownOverseasCountryCode("DE")', isKnownOverseasCountryCode('DE'), true],
  ['isKnownOverseasCountryCode("XX")', isKnownOverseasCountryCode('XX'), false],
  ['getProvinceCode("440305")', getProvinceCode('440305'), '440000'],
  ['getProvinceCode("HK")', getProvinceCode('HK'), null],
]
console.log('\n  -- granular helpers --')
for (const [label, got, expected] of granular) {
  const ok = got === expected
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(50)}  expected=${JSON.stringify(expected)}  got=${JSON.stringify(got)}`)
  if (ok) pass++
  else fail++
}

console.log(`\n  TOTAL: ${pass} pass, ${fail} fail`)
process.exit(fail === 0 ? 0 : 1)
