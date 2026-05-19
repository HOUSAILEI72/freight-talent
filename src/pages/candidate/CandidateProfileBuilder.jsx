import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, AlertCircle, CheckCircle, ChevronRight, Plus, Trash2,
  User, Briefcase, GraduationCap, Sparkles, ListChecks, ChevronDown,
} from 'lucide-react'
import { candidatesApi } from '../../api/candidates'
import RegionSelector from '../../components/RegionSelector'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { TerminalSelect } from '../../components/terminal/TerminalSelect'
import { JOB_TITLE_SUGGESTIONS } from '../../data/jobTitleSuggestions'
import { getBusinessAreaByLocationCode } from '../../utils/businessArea'
import { JOB_TAGS_DATA } from '../../data/jobTagsData'
import { ALL_SOFT_SKILLS, SOFT_SKILL_DESCRIPTIONS } from '../../data/softSkillsLookup'

// Migrate legacy CN-XX-XXXX location codes (e.g. CN-33-0113 → 330113)
function migrateLegacyLocationCode(code) {
  if (!code) return code
  const m = String(code).match(/^CN-(\d{2})-(\d{4})$/)
  return m ? m[1] + m[2] : code
}

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly',        label: '月度' },
  { value: 'quarterly',      label: '季度' },
  { value: 'semi_annual',    label: '半年度' },
]

const YEAR_END_BONUS_QUICK = [
  { value: 1,        label: '1个月' },
  { value: 2,        label: '2个月' },
  { value: 3,        label: '3个月' },
  { value: 'custom', label: '自行填数' },
]

function getTerminalPortalTarget(_node) {
  return document.body
}

function SoftSkillOption({ skill, description, checked, terminal, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const rowRef = useRef(null)
  const bg = checked
    ? (terminal ? 'var(--t-primary-muted)' : '#eff6ff')
    : hovered ? (terminal ? 'var(--t-bg-elevated)' : '#f8fafc') : 'transparent'
  function handleMouseEnter() {
    setHovered(true)
    if (!description || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    setTooltipStyle({ top: rect.top + rect.height / 2, left: rect.right + 10 })
  }
  return (
    <div ref={rowRef}
      onMouseDown={(e) => { e.preventDefault(); onToggle(skill) }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setTooltipStyle(null) }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, background: bg, color: terminal ? 'var(--t-text)' : '#1e293b' }}
    >
      <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : (terminal ? 'var(--t-border)' : '#cbd5e1')}`, background: checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      {skill}
      {tooltipStyle && description && createPortal(
        <div style={{ position: 'fixed', top: tooltipStyle.top, left: tooltipStyle.left, transform: 'translateY(-50%)', zIndex: 10000, maxWidth: 220, padding: '6px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.6, background: terminal ? 'var(--t-bg-elevated)' : '#1e293b', border: terminal ? '1px solid var(--t-border)' : 'none', color: terminal ? 'var(--t-text)' : '#f1f5f9', boxShadow: terminal ? 'var(--t-shadow-elevated)' : '0 4px 12px rgba(0,0,0,0.25)', pointerEvents: 'none' }}>{description}</div>,
        document.body
      )}
    </div>
  )
}

function SelectedSkillTag({ skill, description, terminal, onMouseDown }) {
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const tagRef = useRef(null)
  function handleMouseEnter() {
    if (!description || !tagRef.current) return
    const rect = tagRef.current.getBoundingClientRect()
    setTooltipStyle({ left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + 8 })
  }
  return (
    <span ref={tagRef} onMouseDown={onMouseDown} onMouseEnter={handleMouseEnter} onMouseLeave={() => setTooltipStyle(null)}
      style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, lineHeight: '1.4', padding: '2px 7px', borderRadius: 4, background: terminal ? 'var(--t-chip-selected-bg)' : '#eff6ff', color: terminal ? 'var(--t-text)' : '#2563eb', border: `1px solid ${terminal ? 'var(--t-chip-selected-border)' : '#bfdbfe'}`, whiteSpace: 'nowrap', cursor: 'default' }}
    >
      {skill}
      {tooltipStyle && description && createPortal(
        <div style={{ position: 'fixed', left: tooltipStyle.left, bottom: tooltipStyle.bottom, transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 240, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 3, whiteSpace: 'nowrap' }}>{skill}</p>
          <p style={{ fontSize: 13, color: 'var(--t-text)', lineHeight: 1.5, whiteSpace: 'normal' }}>{description}</p>
        </div>,
        document.body
      )}
    </span>
  )
}

// ── Token helpers (mirrors PostJob.jsx) ──────────────────────────────────────
function splitTokens(str) {
  if (!str) return []
  const parts = String(str).split(/[,，、\n\r;；]+/).map(s => s.trim()).filter(Boolean)
  const seen = new Set(); const out = []
  for (const p of parts) { if (!seen.has(p)) { seen.add(p); out.push(p) } }
  return out
}
function mergeUnique(...arrays) {
  const seen = new Set(); const out = []
  for (const a of arrays) {
    if (!a) continue
    for (const t of a) { if (t && !seen.has(t)) { seen.add(t); out.push(t) } }
  }
  return out
}

function formatThousand(val) {
  if (!val && val !== 0) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

function formatK(val) {
  const raw = String(val || '').replace(/,/g, '')
  const n = parseInt(raw, 10)
  if (!raw || isNaN(n)) return ''
  if (n >= 1000) return `${parseFloat((n / 1000).toFixed(1))}K`
  return raw
}

// Coerce server values back to "raw textarea" string for builder hydration.
function tagsToText(arr) {
  return Array.isArray(arr) ? arr.join('、') : ''
}

const EMPTY_WORK_EXPERIENCE = {
  company_name: '',
  title: '',
  start_month: '',
  end_month: '',
  responsibilities: '',
  achievements: '',
  salary: '',
  salary_months: '',
  commission_bonus_period: 'not_applicable',
  commission_bonus_amount: '',
  has_year_end_bonus: '',
  year_end_bonus_quick: null,
  year_end_bonus_custom: '',
}

// Convert one work-experience form row to the JSON shape that CAND-2A's
// validator accepts — only company_name + title are required server-side,
// everything else stays optional but we coerce numeric strings to numbers.
function workExperienceToPayload(row) {
  const out = {
    company_name: (row.company_name || '').trim(),
    title:        (row.title || '').trim(),
  }
  const sm = (row.start_month || '').trim()
  const em = (row.end_month || '').trim()
  if (sm) out.start_month = sm
  if (em) out.end_month = em
  if (sm || em) out.period = `${sm || '?'} - ${em || '至今'}`
  const resp = (row.responsibilities || '').trim()
  const ach  = (row.achievements || '').trim()
  if (resp) out.responsibilities = resp
  if (ach)  out.achievements     = ach
  const numKeys = ['salary', 'salary_months', 'year_end_bonus_months']
  for (const k of numKeys) {
    const v = row[k]
    if (v === '' || v == null) continue
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    out[k] = n
  }
  if (row.commission_bonus_period && row.commission_bonus_period !== 'not_applicable') {
    out.commission_bonus_period = row.commission_bonus_period
    const ca = Number(row.commission_bonus_amount)
    if (Number.isFinite(ca) && ca > 0) out.commission_bonus_amount = ca
  } else {
    out.commission_bonus_period = 'not_applicable'
  }
  const yebBool = row.has_year_end_bonus === 'true'
  out.has_year_end_bonus = yebBool
  if (yebBool && row.year_end_bonus_quick != null) {
    const yebVal = row.year_end_bonus_quick === 'custom'
      ? Number(row.year_end_bonus_custom)
      : row.year_end_bonus_quick
    if (Number.isFinite(yebVal) && yebVal > 0) out.year_end_bonus_months = yebVal
  }
  return out
}

// Education experience textarea: each line "学校 | 专业 | 学位 | 起止"
// Normalize fullwidth pipe ｜ (U+FF5C) to ASCII | before splitting so users
// who paste pipe-separated strings from other sources still get parsed correctly.
function parseEducationLines(text) {
  if (!text) return []
  return text.split(/\r?\n+/).map(l => l.trim()).filter(Boolean).map(line => {
    const normalized = line.replace(/｜/g, '|')
    const parts = normalized.split(/\s*\|\s*/)
    return {
      school: parts[0] || '',
      major:  parts[1] || '',
      degree: parts[2] || '',
      period: parts[3] || '',
    }
  })
}
function educationLinesToText(rows) {
  if (!Array.isArray(rows)) return ''
  return rows.map(r =>
    [r.school, r.major, r.degree, r.period].filter(Boolean).join(' | ')
  ).join('\n')
}

function AutoTextarea({ value, onChange, className, style, rows = 1, ...rest }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      style={{ minHeight: 0, ...style, overflow: 'hidden' }}
      rows={rows}
      {...rest}
    />
  )
}

function MonthYearPicker({ value, onChange, allowEmpty = false, terminal }) {
  const parseValue = (v) => {
    const m = v ? v.match(/^(\d{4})-(\d{2})$/) : null
    return m ? [m[1], m[2]] : ['', '']
  }
  const [initYear, initMonth] = parseValue(value)
  const [localYear, setLocalYear] = useState(initYear)
  const [localMonth, setLocalMonth] = useState(initMonth)

  useEffect(() => {
    const [y, m] = parseValue(value)
    Promise.resolve().then(() => { setLocalYear(y); setLocalMonth(m) })
  }, [value])

  const currentYear = new Date().getFullYear()
  const yearOptions = [
    { value: '', label: '年份' },
    ...Array.from({ length: currentYear - 1980 + 1 }, (_, i) => {
      const y = String(currentYear - i)
      return { value: y, label: y }
    }),
  ]
  const monthOptions = [
    { value: '', label: allowEmpty ? '至今' : '月份' },
    ...Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0')
      return { value: m, label: `${i + 1}月` }
    }),
  ]

  function handleYearChange(y) {
    setLocalYear(y)
    if (y && localMonth) onChange(`${y}-${localMonth}`)
    else onChange('')
  }
  function handleMonthChange(m) {
    setLocalMonth(m)
    if (!m) { onChange(''); return }
    if (localYear && m) onChange(`${localYear}-${m}`)
    else onChange('')
  }

  const cls = terminal
    ? 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none'
    : 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const sty = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined

  if (terminal) {
    return (
      <div className="flex gap-2">
        <TerminalSelect value={localYear} onChange={handleYearChange} options={yearOptions} placeholder="年份" hasValue={!!localYear} />
        <TerminalSelect value={localMonth} onChange={handleMonthChange} options={monthOptions} placeholder={allowEmpty ? '至今' : '月份'} hasValue={!!localMonth} />
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <select className={cls} style={sty} value={localYear} onChange={e => handleYearChange(e.target.value)}>
        {yearOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select className={cls} style={sty} value={localMonth} onChange={e => handleMonthChange(e.target.value)}>
        {monthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export default function CandidateProfileBuilder({ terminal = false, onDone, saveRef, onSavingChange }) {
  const navigate = useNavigate()

  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadErr] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveErr] = useState('')
  const [showLatestPrompt, setShowLatestPrompt] = useState(false)
  const [confirmingLatest, setConfirmingLatest] = useState(false)

  // ── Section 1: 基础信息 ─────────────────────────────────────────────────
  const [fullName, setFullName] = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [location, setLocation] = useState(null)
  const [availability, setAvailability] = useState('open')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [gender, setGender] = useState('')

  // ── Section 2: 当前任职 ─────────────────────────────────────────────────
  const [currentCompany,        setCurrentCompany]        = useState('')
  const [currentTitle,          setCurrentTitle]          = useState('')
  const [currentResponsibilities, setCurrentResponsibilities] = useState('')
  const [functionCode, setFunctionCode]                 = useState('')
  const [isManagementStr, setIsManagementStr]           = useState('') // '' | 'yes' | 'no'
  const [mgmtHeadcount, setMgmtHeadcount]               = useState('')
  const [csMin, setCsMin]                                = useState('')
  const [csMax, setCsMax]                                = useState('')
  const [csMinFocused, setCsMinFocused]                  = useState(false)
  const [csMaxFocused, setCsMaxFocused]                  = useState(false)
  const [csMonths, setCsMonths]                              = useState('')
  const [csCommissionPeriod, setCsCommissionPeriod]          = useState('not_applicable')
  const [csCommissionAmount, setCsCommissionAmount]          = useState('')
  const [csCommissionAmountFocused, setCsCommissionAmountFocused] = useState(false)
  const [csHasYeb, setCsHasYeb]                              = useState('')
  const [csYebQuickSelect, setCsYebQuickSelect]              = useState(null)
  const [csYebCustom, setCsYebCustom]                        = useState('')

  // ── Section 3: 工作经历 ─────────────────────────────────────────────────
  const [workRows, setWorkRows] = useState([{ ...EMPTY_WORK_EXPERIENCE }])
  const [salaryFocusIdx, setSalaryFocusIdx] = useState(null)

  // ── Section 4: 能力画像 ─────────────────────────────────────────────────
  const [selectedJobTags,    setSelectedJobTags]    = useState([])
  const [jobTagCategory,     setJobTagCategory]     = useState(null)
  const [jobTagOpen,         setJobTagOpen]         = useState(false)
  const [jobTagDropPos,      setJobTagDropPos]      = useState({ top: 0, left: 0, width: 0 })
  const [jobTagScrollTarget, setJobTagScrollTarget] = useState(null)
  const jobTagWrapRef       = useRef(null)
  const jobTagTriggerRef    = useRef(null)
  const jobTagPanelRef      = useRef(null)
  const jobTagRightPanelRef = useRef(null)
  const [selectedSoftSkills, setSelectedSoftSkills] = useState([])
  const [softSkillOpen,      setSoftSkillOpen]      = useState(false)
  const [softSkillDropPos,   setSoftSkillDropPos]   = useState({ top: 0, left: 0, width: 0 })
  const softSkillWrapRef    = useRef(null)
  const softSkillTriggerRef = useRef(null)
  const softSkillPanelRef   = useRef(null)
  const [customJobTagInput, setCustomJobTagInput] = useState('')
  const [customSkillInput,  setCustomSkillInput]  = useState('')

  // ── Section 5: 教育与证书 ──────────────────────────────────────────────
  const [education, setEducation]                 = useState('')
  const [educationLines, setEducationLines]       = useState('')
  const [certificatesText, setCertificatesText]   = useState('')
  const [expectedSalaryMin, setExpectedSalaryMin] = useState('')
  const [expectedSalaryMax, setExpectedSalaryMax] = useState('')
  const [expectedSalaryPeriod, setExpectedSalaryPeriod] = useState('month')
  const [esMINFocused, setEsMinFocused] = useState(false)
  const [esMAXFocused, setEsMaxFocused] = useState(false)
  const [desiredPosition, setDesiredPosition] = useState('')

  // ── Desired position autocomplete ────────────────────────────────────────
  const [posSugOpen, setPosSugOpen] = useState(false)
  const [posActiveIdx, setPosActiveIdx] = useState(-1)
  const [posDropPos, setPosDropPos] = useState({ top: 0, left: 0, width: 0 })
  const posWrapRef = useRef(null)

  const posSuggestions = useMemo(() => {
    if (!desiredPosition.trim()) return []
    const q = desiredPosition.trim()
    return JOB_TITLE_SUGGESTIONS.filter(s => s.includes(q))
  }, [desiredPosition])

  useEffect(() => {
    function onDown(e) {
      if (posWrapRef.current && !posWrapRef.current.contains(e.target)) {
        setPosSugOpen(false)
        setPosActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function openPosDrop() {
    const rect = posWrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setPosDropPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    setPosSugOpen(true)
  }

  const handlePosKeyDown = useCallback((e) => {
    if (!posSugOpen || posSuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setPosActiveIdx(i => Math.min(i + 1, posSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setPosActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && posActiveIdx >= 0) {
      e.preventDefault()
      setDesiredPosition(posSuggestions[posActiveIdx])
      setPosSugOpen(false)
      setPosActiveIdx(-1)
    } else if (e.key === 'Escape') {
      setPosSugOpen(false)
      setPosActiveIdx(-1)
    }
  }, [posSugOpen, posSuggestions, posActiveIdx])

  // ── Hydrate from server ─────────────────────────────────────────────────
  const hydrateProfile = useCallback((p) => {
    if (!p) return
    setFullName(p.full_name || '')
    setPhone(p.phone || '')
    setEmail(p.email || '')
    if (p.location_code) {
      const migratedCode = migrateLegacyLocationCode(p.location_code)
      const area = getBusinessAreaByLocationCode(migratedCode)
      setLocation({
        location_code: migratedCode,
        location_name: p.location_name,
        location_path: p.location_path,
        location_type: p.location_type,
        business_area_code: area?.code ?? p.business_area_code,
        business_area_name: area?.name ?? p.business_area_name,
      })
    }
    setAvailability(p.availability_status || 'open')
    setBirthYear(p.birth_year != null ? String(p.birth_year) : '')
    setBirthMonth(p.birth_month != null ? String(p.birth_month) : '')
    setGender(p.gender || '')

    setCurrentCompany(p.current_company || '')
    setCurrentTitle(p.current_title || '')
    setCurrentResponsibilities(p.current_responsibilities || '')
    setFunctionCode(p.function_code || '')
    setIsManagementStr(
      p.is_management_role === true ? 'yes' :
      p.is_management_role === false ? 'no' : ''
    )
    setMgmtHeadcount(p.management_headcount != null ? String(p.management_headcount) : '')
    setCsMin(p.current_salary_min != null ? String(p.current_salary_min) : '')
    setCsMax(p.current_salary_max != null ? String(p.current_salary_max) : '')
    setCsMonths(p.current_salary_months != null ? String(p.current_salary_months) : '')
    setCsCommissionPeriod(p.current_commission_bonus_period || 'not_applicable')
    setCsCommissionAmount(p.current_commission_bonus_amount != null ? String(p.current_commission_bonus_amount) : '')
    setCsHasYeb(p.current_has_year_end_bonus == null ? '' : String(p.current_has_year_end_bonus))
    if (p.current_has_year_end_bonus && p.current_year_end_bonus_months != null) {
      const m = p.current_year_end_bonus_months
      if ([1, 2, 3].includes(m)) {
        setCsYebQuickSelect(m)
        setCsYebCustom('')
      } else {
        setCsYebQuickSelect('custom')
        setCsYebCustom(String(m))
      }
    } else {
      setCsYebQuickSelect(null)
      setCsYebCustom('')
    }

    if (Array.isArray(p.work_experiences) && p.work_experiences.length > 0) {
      setWorkRows(p.work_experiences.map(w => ({
        ...EMPTY_WORK_EXPERIENCE,
        company_name: w.company_name || w.company || '',
        title: w.title || '',
        start_month: w.start_month || '',
        end_month:   w.end_month   || '',
        responsibilities: w.responsibilities || '',
        achievements:     w.achievements     || '',
        salary:       w.salary != null ? String(w.salary) : (w.salary_min != null ? String(w.salary_min) : (w.salary_max != null ? String(w.salary_max) : '')),
        salary_months: w.salary_months != null ? String(w.salary_months) : '',
        commission_bonus_period: w.commission_bonus_period || 'not_applicable',
        commission_bonus_amount: w.commission_bonus_amount != null ? String(w.commission_bonus_amount) : '',
        has_year_end_bonus: w.has_year_end_bonus == null ? '' : String(w.has_year_end_bonus),
        year_end_bonus_quick: (() => {
          if (!w.has_year_end_bonus || w.year_end_bonus_months == null) return null
          return [1, 2, 3].includes(w.year_end_bonus_months) ? w.year_end_bonus_months : 'custom'
        })(),
        year_end_bonus_custom: (() => {
          if (!w.has_year_end_bonus || w.year_end_bonus_months == null) return ''
          return [1, 2, 3].includes(w.year_end_bonus_months) ? '' : String(w.year_end_bonus_months)
        })(),
      })))
    }

    setSelectedJobTags([...(p.knowledge_tags || []), ...(p.hard_skill_tags || [])])
    setSelectedSoftSkills(p.soft_skill_tags || [])

    setEducation(p.education || '')
    setEducationLines(educationLinesToText(p.education_experiences))
    setCertificatesText(tagsToText(p.certificates))
    setExpectedSalaryMin(p.expected_salary_min != null ? String(p.expected_salary_min) : '')
    setExpectedSalaryMax(p.expected_salary_max != null ? String(p.expected_salary_max) : '')
    setExpectedSalaryPeriod(p.expected_salary_period || 'month')
    setDesiredPosition(p.desired_position || '')
  }, [])

  useEffect(() => {
    let cancelled = false
    candidatesApi.getMyCandidateProfile()
      .then(res => {
        if (cancelled) return
        hydrateProfile(res.data?.profile)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load candidate profile:', {
          status: err.response?.status,
          data: err.response?.data,
          code: err.code,
          message: err.message,
        })
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载档案失败，请刷新重试'
        setLoadErr(errMsg)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hydrateProfile])

  // ── Derived ─────────────────────────────────────────────────────────────

  const certsArr     = useMemo(() => splitTokens(certificatesText), [certificatesText])

  function updateWorkRow(i, patch) {
    setWorkRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }
  function addWorkRow() {
    setWorkRows(rows => [...rows, { ...EMPTY_WORK_EXPERIENCE }])
  }
  function removeWorkRow(i) {
    setWorkRows(rows => rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i))
  }

  // ── Validation ──────────────────────────────────────────────────────────
  function validate() {
    if (!fullName.trim())  return '请填写姓名'
    if (!phone.trim())     return '请填写手机号码'
    if (!email.trim())     return '请填写邮箱'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '邮箱格式不正确'
    if (!location || !location.location_code || !location.location_name ||
        !location.location_path || !location.location_type) {
      return '请选择所在地区'
    }
    if (availability !== 'open') {
      if (!currentCompany.trim())          return '请填写当前公司'
      if (!currentTitle.trim())            return '请填写当前职位'
      if (!currentResponsibilities.trim()) return '请填写岗位描述'
    }
    if (!functionCode)                   return '请选择业务方向'
    if (isManagementStr !== 'yes' && isManagementStr !== 'no') return '请选择是否带团队'

    if (csMin !== '' && !/^\d+$/.test(csMin)) return '当前薪资 min 必须为纯数字'
    if (csMax !== '' && !/^\d+$/.test(csMax)) return '当前薪资 max 必须为纯数字'
    if (csMin !== '' && csMax !== '' && Number(csMin) > Number(csMax)) {
      return '当前薪资 min 不能大于 max'
    }
    if (csMonths !== '' && !['12', '13', '14'].includes(csMonths)) {
      return '当前薪资月数只能是 12 / 13 / 14'
    }
    if (csCommissionPeriod !== 'not_applicable' && csCommissionAmount !== '') {
      const ca = Number(csCommissionAmount)
      if (!Number.isFinite(ca) || ca < 0) return '提成/计件奖金预估平均额必须为非负数字'
    }
    if (csHasYeb === 'true') {
      if (csYebQuickSelect === null) return '请选择年终奖预估平均额'
      if (csYebQuickSelect === 'custom') {
        const yb = Number(csYebCustom)
        if (!Number.isFinite(yb) || yb <= 0 || yb > 24) return '年终奖月数必须在 0-24 之间'
      }
    }

    const esMinRaw = expectedSalaryMin.replace(/,/g, '')
    const esMaxRaw = expectedSalaryMax.replace(/,/g, '')
    if (esMinRaw !== '' && !/^\d+$/.test(esMinRaw)) return '期望薪资最小值必须为纯数字'
    if (esMaxRaw !== '' && !/^\d+$/.test(esMaxRaw)) return '期望薪资最大值必须为纯数字'
    if (esMinRaw !== '' && esMaxRaw !== '' && Number(esMinRaw) > Number(esMaxRaw)) {
      return '期望薪资最小值不能大于最大值'
    }

    if (!Array.isArray(workRows) || workRows.length === 0) return '至少填写一段工作经历'
    for (let i = 0; i < workRows.length; i++) {
      const r = workRows[i]
      if (!r.company_name.trim()) return `工作经历 #${i + 1}：公司名称不能为空`
      if (!r.title.trim())        return `工作经历 #${i + 1}：职位不能为空`
      if (r.salary !== '' && !/^\d+$/.test(r.salary)) return `工作经历 #${i + 1}：薪资必须为纯数字`
      if (r.salary_months !== '' && !['12', '13', '14'].includes(String(r.salary_months))) {
        return `工作经历 #${i + 1}：薪资月数只能是 12 / 13 / 14`
      }
      if (r.commission_bonus_period !== 'not_applicable' && r.commission_bonus_amount !== '') {
        const ca = Number(r.commission_bonus_amount)
        if (!Number.isFinite(ca) || ca < 0) return `工作经历 #${i + 1}：提成/计件奖金预估平均额必须为非负数字`
      }
      if (r.has_year_end_bonus === 'true') {
        if (r.year_end_bonus_quick === null) return `工作经历 #${i + 1}：请选择年终奖预估平均额`
        if (r.year_end_bonus_quick === 'custom') {
          const yb = Number(r.year_end_bonus_custom)
          if (!Number.isFinite(yb) || yb <= 0 || yb > 24) return `工作经历 #${i + 1}：年终奖月数必须在 0-24 之间`
        }
      }
    }

    if (educationLines.trim()) {
      const eduRows = parseEducationLines(educationLines)
      for (let i = 0; i < eduRows.length; i++) {
        const r = eduRows[i]
        if (!r.school.trim()) return `教育经历第 ${i + 1} 行：学校名称不能为空`
        if (/[|｜]/.test(r.school)) return `教育经历第 ${i + 1} 行：格式有误，请用 | 分隔各字段（学校 | 专业 | 学位 | 起止年份）`
      }
    }

    if (selectedJobTags.length === 0) return '请至少选择 1 个岗位标签'
    if (selectedSoftSkills.length === 0) return '请至少选择 1 个岗位所需软技能'

    return ''
  }

  // ── handleSave (extracted for terminal header button) ──────────────────
  async function handleSave() {
    setSaveErr('')
    const msg = validate()
    if (msg) { setSaveErr(msg); return }

    const isManagement = isManagementStr === 'yes'
    const fnLabel = FUNCTION_OPTIONS.find(f => f.key === functionCode)?.label || functionCode

    const payload = {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      location_code: location.location_code,
      location_name: location.location_name,
      location_path: location.location_path,
      location_type: location.location_type,
      current_city: location.location_name,

      current_company: currentCompany.trim(),
      current_title: currentTitle.trim(),
      current_responsibilities: currentResponsibilities.trim(),
      function_code: functionCode,
      function_name: fnLabel,
      business_type: fnLabel,
      is_management_role: isManagement,
      job_type: isManagement ? '管理' : '非管理',
      ...(isManagement && mgmtHeadcount !== '' ? { management_headcount: Number(mgmtHeadcount) } : {}),

      knowledge_tags: selectedJobTags,
      hard_skill_tags: [],
      soft_skill_tags: selectedSoftSkills,
      skill_tags: mergeUnique(selectedJobTags, selectedSoftSkills),

      ...(csMin    !== '' ? { current_salary_min:    Number(csMin) } : {}),
      ...(csMax    !== '' ? { current_salary_max:    Number(csMax) } : {}),
      ...(csMonths !== '' ? { current_salary_months: Number(csMonths) } : {}),
      current_commission_bonus_period: csCommissionPeriod,
      ...(csCommissionPeriod !== 'not_applicable' && csCommissionAmount !== ''
        ? { current_commission_bonus_amount: Number(csCommissionAmount) }
        : { current_commission_bonus_amount: null }),
      current_has_year_end_bonus: csHasYeb === 'true',
      current_year_end_bonus_months: (() => {
        if (csHasYeb !== 'true' || csYebQuickSelect == null) return null
        return csYebQuickSelect === 'custom' ? Number(csYebCustom) : csYebQuickSelect
      })(),

      work_experiences: workRows.map(workExperienceToPayload),

      education: education.trim() || null,
      education_experiences: parseEducationLines(educationLines),
      certificates: certsArr,

      ...(expectedSalaryMin.replace(/,/g, '') !== '' ? { expected_salary_min: Number(expectedSalaryMin.replace(/,/g, '')) } : { expected_salary_min: null }),
      ...(expectedSalaryMax.replace(/,/g, '') !== '' ? { expected_salary_max: Number(expectedSalaryMax.replace(/,/g, '')) } : { expected_salary_max: null }),
      expected_salary_period: expectedSalaryPeriod || 'month',
      desired_position: desiredPosition.trim() || null,

      availability_status: availability,
      ...(gender !== '' ? { gender } : {}),
      ...(birthYear !== '' ? { birth_year: Number(birthYear) } : {}),
      ...(birthMonth !== '' ? { birth_month: Number(birthMonth) } : {}),
      confirm_latest: false,
    }

    setSaving(true)
    try {
      const res = await candidatesApi.updateMyCandidateProfile(payload)
      hydrateProfile(res.data?.profile)
      setShowLatestPrompt(true)
    } catch (err) {
      console.error('Failed to save candidate profile:', {
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '保存失败，请重试'
      setSaveErr(errMsg)
    } finally {
      setSaving(false)
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    await handleSave()
  }

  // Register handleSave with parent's saveRef so the tab-strip button can call it
  useEffect(() => {
    if (saveRef) saveRef.current = handleSave
  })

  // Propagate saving state so parent can disable the tab-strip button
  useEffect(() => {
    if (onSavingChange) onSavingChange(saving)
  }, [saving, onSavingChange])

  async function handleConfirmLatest() {
    setConfirmingLatest(true)
    setSaveErr('')
    try {
      await candidatesApi.confirmLatestResume()
      if (onDone) {
        onDone()
      } else {
        navigate('/candidate/tags')
      }
    } catch (err) {
      console.error('Failed to confirm latest resume:', {
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '确认失败，请重试'
      setSaveErr(errMsg)
      setShowLatestPrompt(false)
    } finally {
      setConfirmingLatest(false)
    }
  }

  function handleKeepEditing() {
    setShowLatestPrompt(false)
  }

  // ── Style helpers (mirrors PostJob.jsx) ─────────────────────────────────
  const labelClass = terminal
    ? 'block text-sm font-medium mb-1.5'
    : 'block text-sm font-medium text-slate-700 mb-1.5'
  const labelStyle = terminal ? { color: 'var(--t-text-secondary)' } : undefined

  const helperClass = terminal ? 'text-xs' : 'text-xs text-slate-400'
  const helperStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  const inputClass = terminal
    ? 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none'
    : 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined

  const textareaClass = inputClass + ' resize-none'

  const cardClass = terminal
    ? 'p-4 space-y-3 rounded-[var(--t-radius-lg)] border flex flex-col min-h-0'
    : 'card p-6 space-y-4'
  const cardStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    : undefined

  const sectionTitleClass = terminal
    ? 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] mb-1'
    : 'flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3'
  const sectionTitleStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  function chipStyle(active) {
    if (!terminal) {
      return {
        className: `px-3 py-1.5 rounded-lg text-sm border transition-colors ${
          active ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600'
        }`,
      }
    }
    return {
      className: 'px-3 py-1.5 rounded-lg text-sm border transition-colors',
      style: active
        ? { background: 'var(--t-chip-selected-bg)', color: 'var(--t-text)', borderColor: 'var(--t-chip-selected-border)' }
        : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' },
    }
  }

  function multiTriggerStyle(isOpen, hasItems) {
    if (!terminal) return {
      minHeight: '2.375rem', paddingRight: '1.75rem',
      paddingTop: hasItems ? 6 : undefined, paddingBottom: hasItems ? 6 : undefined,
      cursor: 'pointer', userSelect: 'none', display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
    }
    return {
      background: 'var(--t-bg-input)', color: 'var(--t-text)',
      border: `1px solid ${isOpen ? 'var(--t-border-focus)' : 'var(--t-border)'}`,
      borderRadius: 'var(--t-radius-sm)', minHeight: 30,
      paddingLeft: 8, paddingRight: 28,
      paddingTop: hasItems ? 4 : 0, paddingBottom: hasItems ? 4 : 0,
      display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center',
      cursor: 'pointer', userSelect: 'none', fontSize: 12, transition: 'border-color 120ms',
    }
  }

  function openJobTagDrop() {
    const rect = jobTagTriggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setSoftSkillOpen(false)
    const panelH = 340
    const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
    setJobTagDropPos({ top, left: rect.left, width: rect.width })
  }

  function openSoftSkillDrop() {
    const rect = softSkillTriggerRef.current?.getBoundingClientRect()
    if (!rect) return
    setJobTagOpen(false)
    const panelH = 228
    const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
    setSoftSkillDropPos({ top, left: rect.left, width: rect.width })
  }

  function toggleJobTag(tag) {
    setSelectedJobTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  function toggleSoftSkill(skill) {
    setSelectedSoftSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
  }

  // click-outside for skill dropdowns
  useEffect(() => {
    function handle(e) {
      if (softSkillOpen) {
        const inWrap = softSkillWrapRef.current?.contains(e.target)
        const inPanel = softSkillPanelRef.current?.contains(e.target)
        if (!inWrap && !inPanel) setSoftSkillOpen(false)
      }
      if (jobTagOpen) {
        const inWrap = jobTagWrapRef.current?.contains(e.target)
        const inPanel = jobTagPanelRef.current?.contains(e.target)
        if (!inWrap && !inPanel) setJobTagOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [softSkillOpen, jobTagOpen])

  // scroll-to-selected tag when dropdown opens
  useEffect(() => {
    if (!jobTagScrollTarget || !jobTagOpen || !jobTagRightPanelRef.current) return
    const panel = jobTagRightPanelRef.current
    const el = panel.querySelector(`[data-tag="${CSS.escape(jobTagScrollTarget)}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
    setJobTagScrollTarget(null)
  }, [jobTagScrollTarget, jobTagOpen, jobTagCategory])

  // ── Loading / error guards ─────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className={
          terminal
            ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center'
            : 'max-w-3xl mx-auto px-6 py-24 text-center text-slate-400'
        }
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text-muted)' } : undefined}
      >
        <div className="flex items-center gap-2 text-sm">
          <Loader2 size={14} className="animate-spin" />
          <span>正在加载候选人档案...</span>
        </div>
      </div>
    )
  }
  if (loadError) {
    return (
      <div
        className={
          terminal
            ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center px-6'
            : 'max-w-3xl mx-auto px-6 py-24'
        }
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
      >
        <div
          className={terminal ? 'mx-auto max-w-md w-full rounded-lg border p-5' : 'rounded-lg border border-red-200 bg-red-50 p-5'}
          style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
        >
          <div className="flex items-center gap-2 mb-2" style={terminal ? { color: 'var(--t-danger)' } : { color: '#dc2626' }}>
            <AlertCircle size={16} /><span className="text-sm font-semibold">无法加载档案</span>
          </div>
          <p className="text-sm" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#7f1d1d' }}>{loadError}</p>
        </div>
      </div>
    )
  }

  // ── Section inner content (shared between terminal and non-terminal) ────

  // innerBasicInfo: fields of 基础信息 (no card wrapper, no h2 title)
  const innerBasicInfo = (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>姓名 *</label>
          <input className={inputClass} style={inputStyle}
            value={fullName} onChange={e => setFullName(e.target.value)} placeholder="真实姓名" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>手机号码 *</label>
          <input className={inputClass} style={inputStyle}
            value={phone} onChange={e => setPhone(e.target.value)} placeholder="如 +86 13800001111" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>个人邮箱 *</label>
          <input className={inputClass} style={inputStyle} type="email"
            value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>求职状态</label>
          {terminal ? (
            <TerminalSelect
              value={availability}
              onChange={setAvailability}
              options={[
                { value: 'open', label: '离职-随时到岗' },
                { value: 'passive_now', label: '在职-月内到岗' },
                { value: 'passive', label: '在职-考虑机会' },
              ]}
              placeholder="请选择"
              hasValue={true}
            />
          ) : (
            <select className={inputClass} style={inputStyle}
              value={availability} onChange={e => setAvailability(e.target.value)}>
              <option value="open">离职-随时到岗</option>
              <option value="passive_now">在职-月内到岗</option>
              <option value="passive">在职-考虑机会</option>
            </select>
          )}
        </div>
      </div>{/* cols-2 top grid end */}
      <div className="grid grid-cols-2 gap-2 items-end">
        <div ref={posWrapRef} style={{ position: 'relative' }}>
          <label className={labelClass} style={labelStyle}>期望岗位</label>
          <input
            className={inputClass}
            style={inputStyle}
            value={desiredPosition}
            autoComplete="off"
            placeholder="如：海运操作主管、报关专员"
            onChange={e => {
              setDesiredPosition(e.target.value)
              if (e.target.value.trim()) openPosDrop()
              else setPosSugOpen(false)
              setPosActiveIdx(-1)
            }}
            onFocus={() => { if (desiredPosition.trim()) openPosDrop() }}
            onKeyDown={handlePosKeyDown}
          />
          {posSugOpen && posSuggestions.length > 0 && (
            <ul style={{
              position: terminal ? 'fixed' : 'absolute',
              ...(terminal
                ? { top: posDropPos.top, left: posDropPos.left, width: posDropPos.width }
                : { top: '100%', left: 0, right: 0, marginTop: 4 }
              ),
              zIndex: 9999,
              maxHeight: 220,
              overflowY: 'auto',
              ...(terminal ? {
                borderRadius: 'var(--t-radius)',
                border: '1px solid var(--t-border)',
                background: 'var(--t-bg-elevated)',
                boxShadow: 'var(--t-shadow-elevated)',
                padding: '4px 0',
              } : {
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                padding: '4px 0',
              }),
              listStyle: 'none',
              margin: 0,
            }}>
              {posSuggestions.map((s, i) => (
                <li key={s}
                  onMouseDown={(e) => { e.preventDefault(); setDesiredPosition(s); setPosSugOpen(false); setPosActiveIdx(-1) }}
                  onMouseEnter={() => setPosActiveIdx(i)}
                  style={{
                    padding: '7px 12px', fontSize: 13, cursor: 'pointer',
                    color: terminal
                      ? (i === posActiveIdx ? 'var(--t-primary-fg)' : 'var(--t-text)')
                      : (i === posActiveIdx ? '#fff' : '#1e293b'),
                    background: terminal
                      ? (i === posActiveIdx ? 'var(--t-primary)' : 'transparent')
                      : (i === posActiveIdx ? '#2563eb' : 'transparent'),
                  }}
                >{s}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={terminal ? 'block text-sm font-medium' : 'block text-sm font-medium text-slate-700'} style={labelStyle}>期望薪资</label>
            <button
              type="button"
              onClick={() => setExpectedSalaryPeriod(p => p === 'month' ? 'year' : 'month')}
              className="text-xs px-2 py-0.5 rounded border"
              style={terminal ? {
                color: 'var(--t-primary)',
                borderColor: 'var(--t-primary)',
                background: 'transparent',
              } : {
                color: '#3b82f6',
                borderColor: '#93c5fd',
                background: 'transparent',
              }}
            >
              {expectedSalaryPeriod === 'month' ? '/月' : '/年'}
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              className={inputClass} style={inputStyle}
              placeholder="最低"
              value={esMINFocused ? expectedSalaryMin.replace(/,/g, '') : formatThousand(expectedSalaryMin.replace(/,/g, ''))}
              onFocus={() => { setEsMinFocused(true); setExpectedSalaryMin(expectedSalaryMin.replace(/,/g, '')) }}
              onBlur={() => setEsMinFocused(false)}
              onChange={e => setExpectedSalaryMin(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
            />
            <span style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>—</span>
            <input
              className={inputClass} style={inputStyle}
              placeholder="最高"
              value={esMAXFocused ? expectedSalaryMax.replace(/,/g, '') : formatThousand(expectedSalaryMax.replace(/,/g, ''))}
              onFocus={() => { setEsMaxFocused(true); setExpectedSalaryMax(expectedSalaryMax.replace(/,/g, '')) }}
              onBlur={() => setEsMaxFocused(false)}
              onChange={e => setExpectedSalaryMax(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
            />
          </div>
        </div>
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>出生年月 / 性别</label>
          <div className="grid grid-cols-3 gap-2">
            {terminal ? (
              <TerminalSelect
                value={String(birthYear)}
                onChange={setBirthYear}
                options={[{ value: '', label: '年份' }, ...Array.from({ length: new Date().getFullYear() - 16 - 1950 + 1 }, (_, i) => new Date().getFullYear() - 16 - i).map(y => ({ value: String(y), label: String(y) }))]}
                placeholder="年份"
                hasValue={!!birthYear}
              />
            ) : (
              <select className={inputClass} style={inputStyle}
                value={birthYear} onChange={e => setBirthYear(e.target.value)}>
                <option value="">年份</option>
                {Array.from({ length: new Date().getFullYear() - 16 - 1950 + 1 }, (_, i) => new Date().getFullYear() - 16 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
            {terminal ? (
              <TerminalSelect
                value={String(birthMonth)}
                onChange={setBirthMonth}
                options={[{ value: '', label: '月份' }, ...Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ value: String(m), label: `${m}月` }))]}
                placeholder="月份"
                hasValue={!!birthMonth}
              />
            ) : (
              <select className={inputClass} style={inputStyle}
                value={birthMonth} onChange={e => setBirthMonth(e.target.value)}>
                <option value="">月份</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            )}
            {terminal ? (
              <TerminalSelect
                value={gender}
                onChange={setGender}
                options={[{ value: '', label: '性别' }, { value: 'male', label: '男' }, { value: 'female', label: '女' }]}
                placeholder="性别"
                hasValue={!!gender}
              />
            ) : (
              <select className={inputClass} style={inputStyle}
                value={gender} onChange={e => setGender(e.target.value)}>
                <option value="">性别</option>
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            )}
          </div>
        </div>
      <div>
        <label className={labelClass} style={labelStyle}>所在地区 *</label>
        <RegionSelector
          value={location}
          onChange={setLocation}
          terminal={terminal}
          placeholder="请选择所在地区（中国大陆 / 香港 / 台湾 / 澳门 / 海外 / Global / Remote）"
        />
        {location?.location_path && (
          <p className={helperClass} style={helperStyle}>
            已选：{location.location_path}
            {location.business_area_name ? `（业务区域 ${location.business_area_name}）` : ''}
          </p>
        )}
      </div>
    </>
  )

  // innerCurrentPosition: fields of 当前任职 (no card wrapper, no h2 title)
  const innerCurrentPosition = (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass} style={labelStyle}>当前公司 *</label>
          <input className={inputClass} style={inputStyle}
            value={currentCompany} onChange={e => setCurrentCompany(e.target.value)} placeholder="公司名称" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>当前职位 *</label>
          <input className={inputClass} style={inputStyle}
            value={currentTitle} onChange={e => setCurrentTitle(e.target.value)} placeholder="如：海运操作主管" />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>业务方向 *</label>
          {terminal ? (
            <TerminalSelect
              value={functionCode}
              onChange={setFunctionCode}
              options={[{ value: '', label: '请选择' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
              placeholder="请选择"
              hasValue={!!functionCode}
            />
          ) : (
            <select className={inputClass} style={inputStyle}
              value={functionCode} onChange={e => setFunctionCode(e.target.value)}>
              <option value="">请选择</option>
              {FUNCTION_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>是否带团队 *</label>
          {terminal ? (
            <TerminalSelect
              value={isManagementStr}
              onChange={setIsManagementStr}
              options={[{ value: '', label: '请选择' }, { value: 'yes', label: '是' }, { value: 'no', label: '否' }]}
              placeholder="请选择"
              hasValue={isManagementStr === 'yes' || isManagementStr === 'no'}
            />
          ) : (
            <select className={inputClass} style={inputStyle}
              value={isManagementStr} onChange={e => setIsManagementStr(e.target.value)}>
              <option value="">请选择</option>
              <option value="yes">是</option>
              <option value="no">否</option>
            </select>
          )}
        </div>
        {isManagementStr === 'yes' && (
          <div>
            <label className={labelClass} style={labelStyle}>团队人数</label>
            <input className={inputClass} style={inputStyle} type="text" inputMode="numeric"
              value={mgmtHeadcount}
              onChange={e => setMgmtHeadcount(e.target.value.replace(/\D/g, ''))}
              placeholder="如 10" />
          </div>
        )}
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>岗位描述 *</label>
        <AutoTextarea rows={1} className={textareaClass} style={inputStyle}
          value={currentResponsibilities}
          onChange={e => setCurrentResponsibilities(e.target.value)}
          placeholder="主要职责、负责的业务范围..." />
      </div>
      <div>
        <p className={labelClass} style={labelStyle}>当前薪资结构</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className={helperClass} style={helperStyle}>最低月薪（元）</label>
            <input className={inputClass} style={inputStyle} type="text" inputMode="numeric"
              value={csMinFocused ? csMin : formatThousand(csMin)}
              onFocus={() => setCsMinFocused(true)}
              onBlur={() => setCsMinFocused(false)}
              onChange={e => setCsMin(e.target.value.replace(/[^\d]/g, ''))} placeholder="如 18,000" />
          </div>
          <div>
            <label className={helperClass} style={helperStyle}>最高月薪（元）</label>
            <input className={inputClass} style={inputStyle} type="text" inputMode="numeric"
              value={csMaxFocused ? csMax : formatThousand(csMax)}
              onFocus={() => setCsMaxFocused(true)}
              onBlur={() => setCsMaxFocused(false)}
              onChange={e => setCsMax(e.target.value.replace(/[^\d]/g, ''))} placeholder="如 25,000" />
          </div>
          <div>
            <label className={helperClass} style={helperStyle}>薪资月数</label>
            {terminal ? (
              <TerminalSelect
                value={csMonths}
                onChange={setCsMonths}
                options={[{ value: '', label: '未填' }, { value: '12', label: '12个月' }, { value: '13', label: '13个月' }, { value: '14', label: '14个月' }]}
                placeholder="未填"
                hasValue={!!csMonths}
              />
            ) : (
              <select className={inputClass} style={inputStyle}
                value={csMonths} onChange={e => setCsMonths(e.target.value)}>
                <option value="">未填</option>
                <option value="12">12个月</option>
                <option value="13">13个月</option>
                <option value="14">14个月</option>
              </select>
            )}
          </div>
          <div>
            <label className={helperClass} style={helperStyle}>提成/计件奖金</label>
            {terminal ? (
              <TerminalSelect
                value={csCommissionPeriod}
                onChange={(val) => { setCsCommissionPeriod(val); if (val === 'not_applicable') setCsCommissionAmount('') }}
                options={COMMISSION_BONUS_PERIODS.map(p => ({ value: p.value, label: p.label }))}
                placeholder="请选择"
                hasValue={csCommissionPeriod !== 'not_applicable'}
              />
            ) : (
              <select className={inputClass} style={inputStyle} value={csCommissionPeriod}
                onChange={e => { setCsCommissionPeriod(e.target.value); if (e.target.value === 'not_applicable') setCsCommissionAmount('') }}>
                {COMMISSION_BONUS_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className={helperClass} style={helperStyle}>预估平均额（元）</label>
            <input
              className={`${csCommissionPeriod === 'not_applicable' ? (terminal ? 'w-full rounded-lg px-3 text-sm border outline-none opacity-40 cursor-not-allowed' : 'w-full rounded-lg border px-3 py-1.5 text-sm bg-slate-50 opacity-40 cursor-not-allowed') : (terminal ? 'w-full px-3 rounded-lg border text-sm focus:outline-none terminal-tabular-num' : inputClass)}`}
              style={csCommissionPeriod === 'not_applicable' ? (terminal ? { background: 'var(--t-bg)', borderColor: 'var(--t-border)', color: 'var(--t-text-muted)', height: 30 } : { color: '#94a3b8' }) : (terminal ? { ...inputStyle, height: 30 } : inputStyle)}
              type="text" inputMode="numeric"
              placeholder={csCommissionPeriod === 'not_applicable' ? '请先选择周期' : '例：5,000'}
              value={csCommissionPeriod === 'not_applicable' ? '' : (csCommissionAmountFocused ? csCommissionAmount : formatThousand(csCommissionAmount))}
              disabled={csCommissionPeriod === 'not_applicable'}
              onFocus={() => setCsCommissionAmountFocused(true)}
              onBlur={() => setCsCommissionAmountFocused(false)}
              onChange={e => { const r = e.target.value.replace(/,/g, ''); if (r === '' || /^\d+$/.test(r)) setCsCommissionAmount(r) }}
            />
          </div>
          <div>
            <label className={helperClass} style={helperStyle}>是否有年终奖</label>
            {terminal ? (
              <TerminalSelect
                value={csHasYeb}
                onChange={(val) => { setCsHasYeb(val); if (val === 'true') { setCsYebQuickSelect(q => q ?? 1) } else { setCsYebQuickSelect(null); setCsYebCustom('') } }}
                options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]}
                placeholder="请选择"
                hasValue={csHasYeb === 'true' || csHasYeb === 'false'}
              />
            ) : (
              <select className={inputClass} style={inputStyle} value={csHasYeb}
                onChange={e => { setCsHasYeb(e.target.value); if (e.target.value === 'true') { setCsYebQuickSelect(q => q ?? 1) } else { setCsYebQuickSelect(null); setCsYebCustom('') } }}>
                <option value="">请选择</option>
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            )}
          </div>
        </div>
        {csHasYeb === 'true' && (
          <div className="mt-2">
            <label className={helperClass} style={helperStyle}>年终奖预估平均额</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {YEAR_END_BONUS_QUICK.map(opt => {
                const active = csYebQuickSelect === opt.value
                const cs = chipStyle(active)
                return (
                  <button key={String(opt.value)} type="button" className={cs.className} style={cs.style}
                    onClick={() => { setCsYebQuickSelect(opt.value); if (opt.value !== 'custom') setCsYebCustom('') }}>
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {csYebQuickSelect === 'custom' && (
              <div>
                <input type="text" inputMode="decimal" className={inputClass} style={inputStyle}
                  placeholder="例：2 表示 2 个月基本工资" value={csYebCustom}
                  onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setCsYebCustom(v) }} />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )

  // innerWorkHistory: the space-y-4 work rows list ONLY (no section title, no "新增一段" button)
  const innerWorkHistory = (
    <div className="space-y-3">
      {workRows.map((r, i) => (
        <div
          key={i}
          className={
            terminal
              ? 'rounded-lg border p-3 space-y-1.5'
              : 'rounded-lg border border-slate-200 bg-slate-50/40 p-3 space-y-1.5'
          }
          style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' } : undefined}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold tracking-[0.01em]"
              style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#64748b' }}
            >
              工作经历 #{i + 1}
            </span>
            {workRows.length > 1 && (
              <button type="button" onClick={() => removeWorkRow(i)}
                className="inline-flex items-center gap-1 text-xs"
                style={terminal ? { color: 'var(--t-danger)' } : { color: '#dc2626' }}
              >
                <Trash2 size={12} /> 删除
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={helperClass} style={helperStyle}>公司 *</label>
              <input className={inputClass} style={inputStyle}
                value={r.company_name}
                onChange={e => updateWorkRow(i, { company_name: e.target.value })} />
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>职位 *</label>
              <input className={inputClass} style={inputStyle}
                value={r.title}
                onChange={e => updateWorkRow(i, { title: e.target.value })} />
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>起始</label>
              <MonthYearPicker
                value={r.start_month}
                onChange={val => updateWorkRow(i, { start_month: val })}
                terminal={terminal}
              />
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>结束（留空表示至今）</label>
              <MonthYearPicker
                value={r.end_month}
                onChange={val => updateWorkRow(i, { end_month: val })}
                allowEmpty
                terminal={terminal}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div>
              <label className={helperClass} style={helperStyle}>职责</label>
              <AutoTextarea rows={1} className={textareaClass} style={inputStyle}
                value={r.responsibilities}
                onChange={e => updateWorkRow(i, { responsibilities: e.target.value })} />
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>成就</label>
              <AutoTextarea rows={1} className={textareaClass} style={inputStyle}
                value={r.achievements}
                onChange={e => updateWorkRow(i, { achievements: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={helperClass} style={helperStyle}>月薪（元）</label>
              <input
                className={terminal ? 'w-full px-3 rounded-lg border text-sm focus:outline-none' : inputClass}
                style={terminal ? { ...inputStyle, height: 30, lineHeight: '30px' } : inputStyle}
                type="text" inputMode="numeric"
                placeholder="例：20,000"
                value={salaryFocusIdx === i ? r.salary : formatThousand(r.salary)}
                onFocus={() => setSalaryFocusIdx(i)}
                onBlur={() => setSalaryFocusIdx(null)}
                onChange={e => updateWorkRow(i, { salary: e.target.value.replace(/[^\d]/g, '') })} />
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>薪资月数</label>
              {terminal ? (
                <TerminalSelect
                  value={r.salary_months}
                  onChange={(val) => updateWorkRow(i, { salary_months: val })}
                  options={[{ value: '', label: '未填' }, { value: '12', label: '12个月' }, { value: '13', label: '13个月' }, { value: '14', label: '14个月' }]}
                  placeholder="未填"
                  hasValue={!!r.salary_months}
                />
              ) : (
                <select className={inputClass} style={inputStyle}
                  value={r.salary_months}
                  onChange={e => updateWorkRow(i, { salary_months: e.target.value })}>
                  <option value="">未填</option>
                  <option value="12">12个月</option>
                  <option value="13">13个月</option>
                  <option value="14">14个月</option>
                </select>
              )}
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>提成/计件奖金</label>
              {terminal ? (
                <TerminalSelect
                  value={r.commission_bonus_period}
                  onChange={(val) => updateWorkRow(i, { commission_bonus_period: val, ...(val === 'not_applicable' ? { commission_bonus_amount: '' } : {}) })}
                  options={COMMISSION_BONUS_PERIODS.map(p => ({ value: p.value, label: p.label }))}
                  placeholder="请选择"
                  hasValue={r.commission_bonus_period !== 'not_applicable'}
                />
              ) : (
                <select className={inputClass} style={inputStyle}
                  value={r.commission_bonus_period}
                  onChange={e => updateWorkRow(i, { commission_bonus_period: e.target.value, ...(e.target.value === 'not_applicable' ? { commission_bonus_amount: '' } : {}) })}>
                  {COMMISSION_BONUS_PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>预估平均额（元）</label>
              <input
                className={`${r.commission_bonus_period === 'not_applicable' ? (terminal ? 'w-full rounded-lg px-3 text-sm border outline-none opacity-40 cursor-not-allowed' : 'w-full rounded-lg border px-3 py-1.5 text-sm bg-slate-50 opacity-40 cursor-not-allowed') : (terminal ? 'w-full px-3 rounded-lg border text-sm focus:outline-none terminal-tabular-num' : inputClass)}`}
                style={r.commission_bonus_period === 'not_applicable' ? (terminal ? { background: 'var(--t-bg)', borderColor: 'var(--t-border)', color: 'var(--t-text-muted)', height: 30 } : { color: '#94a3b8' }) : (terminal ? { ...inputStyle, height: 30 } : inputStyle)}
                type="text" inputMode="numeric"
                placeholder={r.commission_bonus_period === 'not_applicable' ? '请先选择周期' : '例：5,000'}
                value={r.commission_bonus_period === 'not_applicable' ? '' : r.commission_bonus_amount}
                disabled={r.commission_bonus_period === 'not_applicable'}
                onChange={e => { const v = e.target.value.replace(/,/g, ''); if (v === '' || /^\d+$/.test(v)) updateWorkRow(i, { commission_bonus_amount: v }) }}
              />
            </div>
            <div>
              <label className={helperClass} style={helperStyle}>是否有年终奖</label>
              {terminal ? (
                <TerminalSelect
                  value={r.has_year_end_bonus}
                  onChange={(val) => updateWorkRow(i, { has_year_end_bonus: val, ...(val === 'true' ? { year_end_bonus_quick: r.year_end_bonus_quick ?? 1 } : { year_end_bonus_quick: null, year_end_bonus_custom: '' }) })}
                  options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]}
                  placeholder="请选择"
                  hasValue={r.has_year_end_bonus === 'true' || r.has_year_end_bonus === 'false'}
                />
              ) : (
                <select className={inputClass} style={inputStyle}
                  value={r.has_year_end_bonus}
                  onChange={e => updateWorkRow(i, { has_year_end_bonus: e.target.value, ...(e.target.value === 'true' ? { year_end_bonus_quick: r.year_end_bonus_quick ?? 1 } : { year_end_bonus_quick: null, year_end_bonus_custom: '' }) })}>
                  <option value="">请选择</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              )}
            </div>
          </div>
          {r.has_year_end_bonus === 'true' && (
            <div>
              <label className={helperClass} style={helperStyle}>年终奖预估平均额</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {YEAR_END_BONUS_QUICK.map(opt => {
                  const active = r.year_end_bonus_quick === opt.value
                  const cs = chipStyle(active)
                  return (
                    <button key={String(opt.value)} type="button" className={cs.className} style={cs.style}
                      onClick={() => updateWorkRow(i, {
                        year_end_bonus_quick: opt.value,
                        ...(opt.value !== 'custom' ? { year_end_bonus_custom: '' } : {}),
                      })}>
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {r.year_end_bonus_quick === 'custom' && (
                <div>
                  <input type="text" inputMode="decimal" className={inputClass} style={inputStyle}
                    placeholder="例：2 表示 2 个月基本工资" value={r.year_end_bonus_custom}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateWorkRow(i, { year_end_bonus_custom: v }) }} />
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )

  // innerSkills: 岗位标签（双列）+ 软技能（下拉）
  const innerSkills = (() => {
    const currentTags = jobTagCategory
      ? (JOB_TAGS_DATA.find(d => d.category === jobTagCategory)?.tags ?? [])
      : []

    const jobTagDropContent = (
      <div ref={jobTagPanelRef} style={{ display: 'flex', flexDirection: 'row', maxHeight: 340, overflow: 'hidden', borderRadius: terminal ? 'var(--t-radius)' : 8, border: terminal ? '1px solid var(--t-border)' : '1px solid #e2e8f0', background: terminal ? 'var(--t-bg-elevated)' : '#fff', boxShadow: terminal ? 'var(--t-shadow-elevated)' : '0 4px 16px rgba(0,0,0,0.12)' }}>
        <div style={{ width: 160, flexShrink: 0, borderRight: terminal ? '1px solid var(--t-border)' : '1px solid #e2e8f0', overflowY: 'auto', padding: '4px 0', background: terminal ? 'var(--t-bg-panel)' : '#f8fafc' }}>
          {JOB_TAGS_DATA.map(d => {
            const active = jobTagCategory === d.category
            const hasSelected = d.tags.some(t => selectedJobTags.includes(t))
            return (
              <div key={d.category} onMouseDown={(e) => { e.preventDefault(); setJobTagCategory(d.category) }}
                style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: active ? (terminal ? 'var(--t-primary)' : '#eff6ff') : 'transparent', color: active ? (terminal ? 'var(--t-primary-fg)' : '#2563eb') : (terminal ? 'var(--t-text-secondary)' : '#374151'), fontWeight: active ? 600 : 400, borderLeft: active ? (terminal ? '3px solid var(--t-primary-hover)' : '3px solid #2563eb') : '3px solid transparent' }}
              >
                {hasSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: active ? (terminal ? 'var(--t-primary-fg)' : '#2563eb') : (terminal ? 'var(--t-primary)' : '#2563eb') }} />}
                <span style={{ flex: 1, lineHeight: 1.4 }}>{d.category}</span>
              </div>
            )
          })}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: terminal ? 'var(--t-bg-elevated)' : '#fff' }}>
          <div ref={jobTagRightPanelRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {jobTagCategory === null
              ? <div style={{ padding: '20px 12px', fontSize: 12, color: terminal ? 'var(--t-text-muted)' : '#94a3b8', textAlign: 'center' }}>请先从左侧选择分类</div>
              : currentTags.map(tag => {
                  const checked = selectedJobTags.includes(tag)
                  return (
                    <div key={tag} data-tag={tag} onMouseDown={(e) => { e.preventDefault(); toggleJobTag(tag) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : (terminal ? 'var(--t-text)' : '#1e293b'), background: checked ? (terminal ? 'var(--t-primary-muted)' : '#eff6ff') : 'transparent' }}
                    >
                      <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : (terminal ? 'var(--t-border)' : '#cbd5e1')}`, background: checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      {tag}
                    </div>
                  )
                })
            }
          </div>
          <div style={{ padding: '5px 8px', borderTop: terminal ? '1px solid var(--t-border-subtle)' : '1px solid #e2e8f0', display: 'flex', gap: 4, flexShrink: 0 }}>
            <input
              type="text"
              value={customJobTagInput}
              onChange={e => setCustomJobTagInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const tag = customJobTagInput.trim()
                  if (tag && !selectedJobTags.includes(tag)) setSelectedJobTags(prev => [...prev, tag])
                  setCustomJobTagInput('')
                }
              }}
              placeholder="自定义标签，回车添加"
              style={{
                flex: 1, padding: '4px 7px', fontSize: 11, borderRadius: 3,
                border: terminal ? '1px solid var(--t-border)' : '1px solid #d1d5db',
                background: terminal ? 'var(--t-bg-input)' : '#fff',
                color: terminal ? 'var(--t-text)' : '#1e293b',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault()
                const tag = customJobTagInput.trim()
                if (tag && !selectedJobTags.includes(tag)) setSelectedJobTags(prev => [...prev, tag])
                setCustomJobTagInput('')
              }}
              style={{
                padding: '4px 8px', fontSize: 11, borderRadius: 3, whiteSpace: 'nowrap',
                border: terminal ? '1px solid var(--t-border)' : '1px solid #d1d5db',
                background: terminal ? 'var(--t-bg-elevated)' : '#f9fafb',
                color: terminal ? 'var(--t-text-secondary)' : '#374151', cursor: 'pointer',
              }}
            >
              添加
            </button>
          </div>
        </div>
      </div>
    )

    return (
      <>
        <div ref={jobTagWrapRef} style={{ position: 'relative' }}>
          <label className={labelClass} style={labelStyle}>岗位标签 * （已选 {selectedJobTags.length} 项）</label>
          <div style={{ position: 'relative' }} ref={jobTagTriggerRef}>
            <div
              className={terminal ? undefined : inputClass}
              onMouseDown={(e) => { e.preventDefault(); if (!jobTagOpen) openJobTagDrop(); setJobTagOpen(o => !o) }}
              style={multiTriggerStyle(jobTagOpen, selectedJobTags.length > 0)}
            >
              {selectedJobTags.length > 0
                ? selectedJobTags.map(tag => (
                    <SelectedSkillTag key={tag} skill={tag} description={null} terminal={terminal}
                      onMouseDown={(e) => {
                        e.preventDefault(); e.stopPropagation()
                        const cat = JOB_TAGS_DATA.find(d => d.tags.includes(tag))?.category ?? null
                        if (cat) setJobTagCategory(cat)
                        setJobTagScrollTarget(tag)
                        if (!jobTagOpen) openJobTagDrop()
                        setJobTagOpen(true)
                      }}
                    />
                  ))
                : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: terminal ? 12 : 13 }}>从下拉框中选择岗位标签</span>
              }
            </div>
            <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', padding: 2, lineHeight: 0, pointerEvents: 'none', color: terminal ? 'var(--t-text-muted)' : '#64748b' }}>
              <ChevronDown size={terminal ? 11 : 14} style={{ transition: 'transform 150ms', transform: jobTagOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
          </div>
          {jobTagOpen && (terminal
            ? createPortal(
                <div style={{ position: 'fixed', top: jobTagDropPos.top, left: jobTagDropPos.left, width: jobTagDropPos.width, zIndex: 9999 }}>
                  {jobTagDropContent}
                </div>,
                getTerminalPortalTarget(jobTagTriggerRef.current)
              )
            : (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, marginTop: 4 }}>
                  {jobTagDropContent}
                </div>
              )
          )}
        </div>

        <div ref={softSkillWrapRef} style={{ position: 'relative' }}>
          <label className={labelClass} style={labelStyle}>岗位所需软技能 * （已选 {selectedSoftSkills.length} 项）</label>
          <div style={{ position: 'relative' }} ref={softSkillTriggerRef}>
            <div
              className={terminal ? undefined : inputClass}
              onMouseDown={(e) => { e.preventDefault(); if (!softSkillOpen) openSoftSkillDrop(); setSoftSkillOpen(o => !o) }}
              style={multiTriggerStyle(softSkillOpen, selectedSoftSkills.length > 0)}
            >
              {selectedSoftSkills.length > 0
                ? selectedSoftSkills.map(skill => (
                    <SelectedSkillTag key={skill} skill={skill} description={SOFT_SKILL_DESCRIPTIONS[skill]} terminal={terminal} />
                  ))
                : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: terminal ? 12 : 13 }}>从下拉框中选择软技能标签</span>
              }
            </div>
            <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', padding: 2, lineHeight: 0, pointerEvents: 'none', color: terminal ? 'var(--t-text-muted)' : '#64748b' }}>
              <ChevronDown size={terminal ? 11 : 14} style={{ transition: 'transform 150ms', transform: softSkillOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
          </div>
          {softSkillOpen && (terminal
            ? createPortal(
                <div ref={softSkillPanelRef} style={{ position: 'fixed', top: softSkillDropPos.top, left: softSkillDropPos.left, width: softSkillDropPos.width, zIndex: 9999, maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'var(--t-radius)', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: 'var(--t-shadow-elevated)' }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                    {ALL_SOFT_SKILLS.map(skill => (
                      <SoftSkillOption key={skill} skill={skill} description={SOFT_SKILL_DESCRIPTIONS[skill]} checked={selectedSoftSkills.includes(skill)} terminal={terminal} onToggle={toggleSoftSkill} />
                    ))}
                  </div>
                  <div style={{ padding: '5px 8px', borderTop: '1px solid var(--t-border-subtle)', display: 'flex', gap: 4, flexShrink: 0 }}>
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={e => setCustomSkillInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const s = customSkillInput.trim()
                          if (s && !selectedSoftSkills.includes(s)) setSelectedSoftSkills(prev => [...prev, s])
                          setCustomSkillInput('')
                        }
                      }}
                      placeholder="自定义技能，回车添加"
                      style={{ flex: 1, padding: '4px 7px', fontSize: 11, borderRadius: 3, border: '1px solid var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text)', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button type="button" onMouseDown={e => { e.preventDefault(); const s = customSkillInput.trim(); if (s && !selectedSoftSkills.includes(s)) setSelectedSoftSkills(prev => [...prev, s]); setCustomSkillInput('') }}
                      style={{ padding: '4px 8px', fontSize: 11, borderRadius: 3, whiteSpace: 'nowrap', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer' }}>
                      添加
                    </button>
                  </div>
                </div>,
                getTerminalPortalTarget(softSkillTriggerRef.current)
              )
            : (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginTop: 4, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                    {ALL_SOFT_SKILLS.map(skill => (
                      <SoftSkillOption key={skill} skill={skill} description={SOFT_SKILL_DESCRIPTIONS[skill]} checked={selectedSoftSkills.includes(skill)} terminal={terminal} onToggle={toggleSoftSkill} />
                    ))}
                  </div>
                  <div style={{ padding: '5px 8px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 4, flexShrink: 0 }}>
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={e => setCustomSkillInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const s = customSkillInput.trim()
                          if (s && !selectedSoftSkills.includes(s)) setSelectedSoftSkills(prev => [...prev, s])
                          setCustomSkillInput('')
                        }
                      }}
                      placeholder="自定义技能，回车添加"
                      style={{ flex: 1, padding: '4px 7px', fontSize: 11, borderRadius: 3, border: '1px solid #d1d5db', background: '#fff', color: '#1e293b', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button type="button" onMouseDown={e => { e.preventDefault(); const s = customSkillInput.trim(); if (s && !selectedSoftSkills.includes(s)) setSelectedSoftSkills(prev => [...prev, s]); setCustomSkillInput('') }}
                      style={{ padding: '4px 8px', fontSize: 11, borderRadius: 3, whiteSpace: 'nowrap', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>
                      添加
                    </button>
                  </div>
                </div>
              )
          )}
        </div>
      </>
    )
  })()

  // innerEducation: 学历摘要 + 详细教育 + 资格证书 fields
  const innerEducation = (
    <>
      <div>
        <label className={labelClass} style={labelStyle}>学历摘要</label>
        <input className={inputClass} style={inputStyle}
          value={education} onChange={e => setEducation(e.target.value)}
          placeholder="如：本科 · 国际贸易" />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>详细教育经历</label>
        <AutoTextarea rows={1} className={textareaClass} style={inputStyle}
          value={educationLines}
          onChange={e => setEducationLines(e.target.value)}
          placeholder={'每行一条，使用 "|" 分隔字段：学校 | 专业 | 学位 | 起止\n如：上海海事大学 | 国际贸易 | 本科 | 2014-2018'}
        />
        <p className={helperClass} style={helperStyle}>每行一段，4 个字段用「|」分隔。</p>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>资格证书（{certsArr.length}）</label>
        <AutoTextarea rows={1} className={textareaClass} style={inputStyle}
          value={certificatesText} onChange={e => setCertificatesText(e.target.value)}
          placeholder="如：报关员证、国际货代证、CET-6" />
      </div>
    </>
  )

  // ── showLatestPrompt modal (shared) ────────────────────────────────────
  const latestPromptModal = showLatestPrompt ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div
        className={
          terminal
            ? 'w-full max-w-md rounded-[var(--t-radius-lg)] border p-5 shadow-[var(--t-shadow-elevated)]'
            : 'w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl'
        }
        style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
      >
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle
            size={18}
            className={terminal ? '' : 'text-blue-600'}
            style={terminal ? { color: 'var(--t-primary)' } : undefined}
          />
          <h2
            className={terminal ? 'text-base font-semibold' : 'text-base font-semibold text-slate-800'}
            style={terminal ? { color: 'var(--t-text)' } : undefined}
          >
            是否为最新简历
          </h2>
        </div>
        <p
          className={terminal ? 'text-sm leading-relaxed' : 'text-sm leading-relaxed text-slate-600'}
          style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
        >
          档案内容已保存。确认后会刷新简历更新时间，并影响企业端的简历鲜度排序。
        </p>
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleKeepEditing}
            disabled={confirmingLatest}
            className={
              terminal
                ? 'inline-flex items-center px-4 py-2 rounded-lg border text-sm'
                : 'inline-flex items-center px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50'
            }
            style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' } : undefined}
          >
            否，继续修改
          </button>
          <button
            type="button"
            onClick={handleConfirmLatest}
            disabled={confirmingLatest}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: 'var(--t-primary)' }}
          >
            {confirmingLatest && <Loader2 size={14} className="animate-spin" />}
            是，设为最新简历
          </button>
        </div>
      </div>
    </div>
  ) : null

  // ── Terminal 3-column layout ───────────────────────────────────────────────
  if (terminal) {
    return (
      <div
        className="terminal-mode terminal-form-shell flex-1 w-full min-w-0 h-full min-h-0 overflow-hidden flex flex-col"
        style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Error banner */}
          {saveError && (
            <div className="mb-2 flex-shrink-0 flex items-center gap-2 px-3 py-2 border rounded text-sm"
              style={{ background: 'var(--t-danger-muted)', borderColor: 'var(--t-danger)', color: 'var(--t-danger)' }}>
              <AlertCircle size={15} className="flex-shrink-0" />
              {saveError}
            </div>
          )}

          {/* 3-column grid */}
          <div className="terminal-form-grid-3">

            {/* ── Col 1: 基础信息 ── */}
            <div className={cardClass} style={{ ...cardStyle, borderTop: '2px solid rgba(59, 130, 246, 0.32)' }}>
              <div className={sectionTitleClass} style={{ color: 'var(--t-text-muted)', borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 6, marginBottom: 0 }}>
                <span style={{ color: 'var(--t-primary)' }}><User size={11} /></span> 基础信息
              </div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1 pb-64">
                {innerBasicInfo}
              </div>
            </div>

            {/* ── Col 2: 当前任职 + 工作经历 ── */}
            <div className={cardClass} style={{ ...cardStyle, borderTop: '2px solid rgba(34, 197, 94, 0.28)' }}>
              <div className={sectionTitleClass} style={{ color: 'var(--t-text-muted)', borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 6, marginBottom: 0 }}>
                <span style={{ color: 'var(--t-success)' }}><Briefcase size={11} /></span> 任职与经历
              </div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {availability !== 'open' && innerCurrentPosition}
                {availability !== 'open' && <div style={{ height: 1, background: 'var(--t-border-subtle)', margin: '4px 0' }} />}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>
                    工作经历（至少 1 段）
                  </p>
                  <button
                    type="button"
                    onClick={addWorkRow}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border"
                    style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
                  >
                    <Plus size={11} /> 新增
                  </button>
                </div>
                {innerWorkHistory}
              </div>
            </div>

            {/* ── Col 3: 能力画像 + 教育与证书 ── */}
            <div className={cardClass} style={{ ...cardStyle, borderTop: '2px solid rgba(251, 191, 36, 0.28)' }}>
              <div className={sectionTitleClass} style={{ color: 'var(--t-text-muted)', borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 6, marginBottom: 0 }}>
                <span style={{ color: 'var(--t-chart-amber, #f59e0b)' }}><Sparkles size={11} /></span> 能力与教育
              </div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {innerSkills}
                <div style={{ height: 1, background: 'var(--t-border-subtle)', margin: '4px 0' }} />
                <p className="text-xs font-semibold uppercase tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>
                  教育与证书
                </p>
                {innerEducation}
              </div>
            </div>

          </div>
        </div>

        {latestPromptModal}
      </div>
    )
  }

  // ── Non-terminal (light) layout ────────────────────────────────────────────
  return (
    <div
      className="max-w-3xl mx-auto px-6 py-12"
    >
      <div>
        {/* Header */}
        <div className="mb-6">
          <div
            className="flex items-center gap-2 mb-1"
            style={{ color: '#94a3b8' }}
          >
            <ListChecks size={14} />
            <span className="text-[11px] tracking-[0.04em] uppercase">PROFILE · BUILDER</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">
            完善候选人档案
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            完成档案后，你才能订阅个性化推荐和投递岗位。
          </p>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <AlertCircle size={15} /><span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Section 1: 基础信息 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <User size={14} />基础信息
            </h2>
            {innerBasicInfo}
          </div>

          {/* ── Section 2: 当前任职 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <Briefcase size={14} />当前任职
            </h2>
            {availability !== 'open' && innerCurrentPosition}
          </div>

          {/* ── Section 3: 工作经历 ── */}
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between mb-1">
              <h2 className={sectionTitleClass + ' mb-0'} style={sectionTitleStyle}>
                <Briefcase size={14} />工作经历（至少 1 段）
              </h2>
              <button type="button" onClick={addWorkRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Plus size={12} /> 新增一段
              </button>
            </div>
            {innerWorkHistory}
          </div>

          {/* ── Section 4: 能力画像 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <Sparkles size={14} />能力画像
            </h2>
            {innerSkills}
          </div>

          {/* ── Section 5: 教育与证书 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <GraduationCap size={14} />教育与证书
            </h2>
            {innerEducation}
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button"
              onClick={() => navigate('/candidate/tags')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm"
              disabled={saving}
            >
              取消
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: 'var(--t-primary)' }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {saving ? '正在保存...' : '保存档案'}
              {!saving && <ChevronRight size={14} />}
            </button>
          </div>
        </form>

        {latestPromptModal}
      </div>
    </div>
  )
}
