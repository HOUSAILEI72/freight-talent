/**
 * candidateProfile.js
 *
 * Single front-end rule for "is the candidate profile complete enough that
 * the candidate may subscribe to tags / apply to jobs?". Used by:
 *   - /candidate/tags (gate around TerminalCandidateTags)
 *   - JobMarketplace "投递岗位" button (CAND-6)
 *
 * Keep this rule loose enough that it works against the current schema (so
 * the gate can ship in CAND-1 before CAND-3 adds new columns). Fields that
 * don't exist on the server yet are treated as "missing" — i.e. an existing
 * candidate whose row doesn't have current_responsibilities or the three
 * skill arrays will be steered into the builder, which is what we want.
 */

const REQUIRED_STRING_FIELDS = [
  'full_name',
  'phone',
  'email',
  'current_company',
  'current_title',
  'current_responsibilities',
]

const REQUIRED_LOCATION_FIELDS = [
  'location_code',
  'location_name',
  'location_path',
  'location_type',
]

const REQUIRED_TAG_FIELDS = [
  'knowledge_tags',
  'hard_skill_tags',
  'soft_skill_tags',
]

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0
}

function isNonEmptyArray(v) {
  return Array.isArray(v) && v.length > 0
}

/**
 * Returns the list of missing field keys, or an empty array if the profile
 * passes the completeness rule. Callers can show a granular checklist by
 * inspecting the returned keys.
 */
export function getMissingProfileFields(profile) {
  if (!profile || typeof profile !== 'object') {
    return ['profile']
  }
  const missing = []

  for (const k of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(profile[k])) missing.push(k)
  }
  for (const k of REQUIRED_LOCATION_FIELDS) {
    if (!isNonEmptyString(profile[k])) missing.push(k)
  }
  for (const k of REQUIRED_TAG_FIELDS) {
    if (!isNonEmptyArray(profile[k])) missing.push(k)
  }
  if (!isNonEmptyArray(profile.work_experiences)) {
    missing.push('work_experiences')
  }

  return missing
}

export function isCandidateProfileComplete(profile) {
  return getMissingProfileFields(profile).length === 0
}

/**
 * Friendly Chinese labels for the field keys returned by
 * `getMissingProfileFields`. Used by the gate's checklist UI.
 */
export const PROFILE_FIELD_LABELS = {
  profile:                  '档案未创建',
  full_name:                '姓名',
  phone:                    '手机号码',
  email:                    '个人邮箱',
  current_company:          '当前公司',
  current_title:            '当前职位',
  current_responsibilities: '岗位职责',
  location_code:            '所在地区',
  location_name:            '所在地区',
  location_path:            '所在地区',
  location_type:            '所在地区',
  knowledge_tags:           '知识标签（至少 1 项）',
  hard_skill_tags:          '硬技能标签（至少 1 项）',
  soft_skill_tags:          '软技能标签（至少 1 项）',
  work_experiences:         '至少一段工作经历',
}

/** Deduplicate the missing-field list to one human-readable label per item. */
export function summarizeMissingFields(missing) {
  const seen = new Set()
  const out = []
  for (const key of missing) {
    const label = PROFILE_FIELD_LABELS[key] || key
    if (seen.has(label)) continue
    seen.add(label)
    out.push(label)
  }
  return out
}
