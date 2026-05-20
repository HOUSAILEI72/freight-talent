import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, AlertCircle, CheckCircle, ChevronRight, Plus, Trash2,
  Sparkles, ChevronDown, X,
} from 'lucide-react'
import { candidatesApi } from '../../api/candidates'
import RegionSelector from '../../components/RegionSelector'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { TerminalSelect } from '../../components/terminal/TerminalSelect'
import { JOB_TITLE_SUGGESTIONS } from '../../data/jobTitleSuggestions'
import { getBusinessAreaByLocationCode } from '../../utils/businessArea'
import { JOB_TAGS_DATA } from '../../data/jobTagsData'
import { ALL_SOFT_SKILLS, SOFT_SKILL_DESCRIPTIONS } from '../../data/softSkillsLookup'

// ── location code migration ──────────────────────────────────────────────────
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

const BENEFIT_OPTIONS = [
  '五险一金', '带薪年假', '法定节假日', '节日福利', '生日福利',
  '年度体检', '团建旅游', '商业保险', '股权激励', '期权激励',
  '弹性上下班', '晚班交通补贴', '高温补贴',
]

const DEGREE_OPTIONS = ['不限', '初中及以下', '高中', '大专', '本科', '硕士', '博士']

const EMPTY_EDU = { school: '', major: '', degree: '', period_start: '', period_end: '', enrollment_type: '' }

// ── helpers ──────────────────────────────────────────────────────────────────
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
function tagsToText(arr) {
  return Array.isArray(arr) ? arr.join('、') : ''
}

const EMPTY_WORK = {
  company_name: '', title: '', start_month: '', end_month: '',
  responsibilities: '', achievements: '', salary: '', salary_months: '',
  commission_bonus_period: 'not_applicable', commission_bonus_amount: '',
  has_year_end_bonus: '', year_end_bonus_quick: null, year_end_bonus_custom: '',
  benefits: [],
  department: '', reporting_to: '', is_management: '', direct_reports_count: '', reason_for_leaving: '',
}

const EMPTY_PROJECT = {
  name: '', role: '', link: '', start: '', end: '',
  description: '', achievements: '',
}

const EMPTY_LANG        = { language: '', proficiency_level: '' }
const EMPTY_TRAINING    = { course_name: '', institution: '', location: '', start_date: '', end_date: '' }
const EMPTY_CERT_ENTRY  = { name: '', level: '', issue_date: '' }
const EMPTY_DESIRED_POS = { title: '', salary_min: '', salary_max: '', salary_period: 'month', salary_months: '', industries: '' }

function workExperienceToPayload(row) {
  const out = { company_name: (row.company_name || '').trim(), title: (row.title || '').trim() }
  const sm = (row.start_month || '').trim(); const em = (row.end_month || '').trim()
  if (sm) out.start_month = sm
  if (em) out.end_month = em
  if (sm || em) out.period = `${sm || '?'} - ${em || '至今'}`
  const resp = (row.responsibilities || '').trim(); const ach = (row.achievements || '').trim()
  if (resp) out.responsibilities = resp
  if (ach) out.achievements = ach
  const numKeys = ['salary', 'salary_months', 'year_end_bonus_months']
  for (const k of numKeys) { const v = row[k]; if (v === '' || v == null) continue; const n = Number(v); if (!Number.isFinite(n)) continue; out[k] = n }
  if (row.commission_bonus_period && row.commission_bonus_period !== 'not_applicable') {
    out.commission_bonus_period = row.commission_bonus_period
    const ca = Number(row.commission_bonus_amount)
    if (Number.isFinite(ca) && ca > 0) out.commission_bonus_amount = ca
  } else { out.commission_bonus_period = 'not_applicable' }
  const yebBool = row.has_year_end_bonus === 'true'
  out.has_year_end_bonus = yebBool
  if (yebBool && row.year_end_bonus_quick != null) {
    const yebVal = row.year_end_bonus_quick === 'custom' ? Number(row.year_end_bonus_custom) : row.year_end_bonus_quick
    if (Number.isFinite(yebVal) && yebVal > 0) out.year_end_bonus_months = yebVal
  }
  if (Array.isArray(row.benefits) && row.benefits.length > 0) out.benefits = row.benefits
  if ((row.department || '').trim()) out.department = row.department.trim()
  if ((row.reporting_to || '').trim()) out.reporting_to = row.reporting_to.trim()
  if (row.is_management === 'yes' || row.is_management === 'no') out.is_management = row.is_management === 'yes'
  if (row.is_management === 'yes') {
    const drc = parseInt(row.direct_reports_count, 10)
    if (Number.isFinite(drc) && drc >= 0) out.direct_reports_count = drc
  }
  if ((row.reason_for_leaving || '').trim()) out.reason_for_leaving = row.reason_for_leaving.trim()
  return out
}

// ── AutoTextarea ─────────────────────────────────────────────────────────────
function AutoTextarea({ value, onChange, style, rows = 1, ...rest }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    el.style.height = '0'; el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea ref={ref} value={value} onChange={onChange}
      style={{ minHeight: 0, overflow: 'hidden', ...style }} rows={rows} {...rest} />
  )
}

// ── MonthYearPicker ───────────────────────────────────────────────────────────
function MonthYearPicker({ value, onChange, allowEmpty = false }) {
  const parseValue = (v) => { const m = v ? v.match(/^(\d{4})-(\d{2})$/) : null; return m ? [m[1], m[2]] : ['', ''] }
  const [initYear, initMonth] = parseValue(value)
  const [localYear, setLocalYear] = useState(initYear)
  const [localMonth, setLocalMonth] = useState(initMonth)
  useEffect(() => { const [y, m] = parseValue(value); Promise.resolve().then(() => { setLocalYear(y); setLocalMonth(m) }) }, [value])
  const currentYear = new Date().getFullYear()
  const yearOptions = [{ value: '', label: '年份' }, ...Array.from({ length: currentYear - 1980 + 1 }, (_, i) => { const y = String(currentYear - i); return { value: y, label: y } })]
  const monthOptions = [{ value: '', label: allowEmpty ? '至今' : '月份' }, ...Array.from({ length: 12 }, (_, i) => { const m = String(i + 1).padStart(2, '0'); return { value: m, label: `${i + 1}月` } })]
  function handleYearChange(y) { setLocalYear(y); if (y && localMonth) onChange(`${y}-${localMonth}`); else onChange('') }
  function handleMonthChange(m) { setLocalMonth(m); if (!m) { onChange(''); return }; if (localYear && m) onChange(`${localYear}-${m}`); else onChange('') }
  return (
    <div className="flex gap-1.5">
      <TerminalSelect value={localYear} onChange={handleYearChange} options={yearOptions} placeholder="年份" hasValue={!!localYear} />
      <TerminalSelect value={localMonth} onChange={handleMonthChange} options={monthOptions} placeholder={allowEmpty ? '至今' : '月份'} hasValue={!!localMonth} />
    </div>
  )
}

// ── AI polish button ──────────────────────────────────────────────────────────
function AiPolishButton({ field, content, context, onResult }) {
  const [state, setState] = useState('idle') // idle | loading | done | error
  const abortRef = useRef(null)

  async function handlePolish() {
    if (!content?.trim()) return
    setState('loading')
    abortRef.current = new AbortController()
    const token = localStorage.getItem('token') || ''
    try {
      const res = await fetch('/api/v2/ai/polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ field, content, context: context || {} }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) { setState('error'); return }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''; let result = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const chunk = line.slice(5).trim()
          if (chunk === '[DONE]') { setState('done'); onResult(result); return }
          if (chunk.startsWith('[ERROR')) { setState('error'); return }
          result += chunk
          onResult(result)
        }
      }
      setState('done')
      if (result) onResult(result)
    } catch (e) {
      if (e.name !== 'AbortError') setState('error')
      else setState('idle')
    }
  }

  useEffect(() => () => abortRef.current?.abort(), [])

  if (state === 'loading') {
    return (
      <button type="button" onClick={() => abortRef.current?.abort()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, border: '1px solid var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        <Loader2 size={10} className="animate-spin" />停止
      </button>
    )
  }
  return (
    <button type="button" onClick={handlePolish}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, fontSize: 11, border: `1px solid ${state === 'error' ? 'var(--t-danger)' : 'var(--t-border)'}`, background: 'var(--t-bg-elevated)', color: state === 'error' ? 'var(--t-danger)' : 'var(--t-text-secondary)', cursor: content?.trim() ? 'pointer' : 'not-allowed', opacity: content?.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>
      <Sparkles size={10} />{state === 'error' ? '重试润色' : 'AI润色'}
    </button>
  )
}

// ── SoftSkillOption ──────────────────────────────────────────────────────────
function SoftSkillOption({ skill, description, checked, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const rowRef = useRef(null)
  const bg = checked ? 'var(--t-primary-muted)' : hovered ? 'var(--t-bg-hover)' : 'transparent'
  function handleMouseEnter() {
    setHovered(true)
    if (!description || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    setTooltipStyle({ top: rect.top + rect.height / 2, left: rect.right + 10 })
  }
  return (
    <div ref={rowRef} onMouseDown={e => { e.preventDefault(); onToggle(skill) }}
      onMouseEnter={handleMouseEnter} onMouseLeave={() => { setHovered(false); setTooltipStyle(null) }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', fontSize: 13, background: bg, color: 'var(--t-text)' }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${checked ? 'var(--t-primary)' : 'var(--t-border)'}`, background: checked ? 'var(--t-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      {skill}
      {tooltipStyle && description && createPortal(
        <div style={{ position: 'fixed', top: tooltipStyle.top, left: tooltipStyle.left, transform: 'translateY(-50%)', zIndex: 10000, maxWidth: 220, padding: '6px 10px', borderRadius: 6, fontSize: 12, lineHeight: 1.6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: 'var(--t-text)', boxShadow: 'var(--t-shadow-elevated)', pointerEvents: 'none' }}>{description}</div>,
        document.body
      )}
    </div>
  )
}

// ── SelectedSkillTag ─────────────────────────────────────────────────────────
function SelectedSkillTag({ skill, description, onMouseDown }) {
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const tagRef = useRef(null)
  function handleMouseEnter() {
    if (!description || !tagRef.current) return
    const rect = tagRef.current.getBoundingClientRect()
    setTooltipStyle({ left: rect.left + rect.width / 2, bottom: window.innerHeight - rect.top + 8 })
  }
  return (
    <span ref={tagRef} onMouseDown={onMouseDown} onMouseEnter={handleMouseEnter} onMouseLeave={() => setTooltipStyle(null)}
      style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--t-chip-selected-bg)', color: 'var(--t-text)', border: '1px solid var(--t-chip-selected-border)', whiteSpace: 'nowrap', cursor: 'default' }}>
      {skill}
      {tooltipStyle && description && createPortal(
        <div style={{ position: 'fixed', left: tooltipStyle.left, bottom: tooltipStyle.bottom, transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 240, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', pointerEvents: 'none' }}>
          <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 3, whiteSpace: 'nowrap' }}>{skill}</p>
          <p style={{ fontSize: 13, color: 'var(--t-text)', lineHeight: 1.5 }}>{description}</p>
        </div>,
        document.body
      )}
    </span>
  )
}


// ── SidebarNavItem ────────────────────────────────────────────────────────────
function SidebarNavItem({ label, active, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '7px 16px', gap: 8, background: active ? 'var(--t-bg-active)' : hovered ? 'var(--t-bg-hover)' : 'transparent', border: 'none', borderLeft: `2px solid ${active ? 'var(--t-primary)' : 'transparent'}`, cursor: 'pointer', transition: 'background 80ms' }}>
      <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? 'var(--t-text)' : 'var(--t-text-secondary)', textAlign: 'left', lineHeight: 1.4 }}>{label}</span>
    </button>
  )
}

// ── DeleteButton ──────────────────────────────────────────────────────────────
function DeleteButton({ onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: hov ? 'var(--t-danger)' : 'var(--t-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 3, transition: 'color 120ms' }}>
      <Trash2 size={11} />删除
    </button>
  )
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, aiHighlight }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 14, borderBottom: '1px solid var(--t-border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: 'var(--t-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)', letterSpacing: '0.01em' }}>{title}</span>
        {subtitle && <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 400 }}>{subtitle}</span>}
        {aiHighlight && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: 'rgba(99,102,241,0.15)', color: 'var(--t-primary)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <Sparkles size={9} />AI 已填
          </span>
        )}
      </div>
      {!subtitle && !aiHighlight && null}
    </div>
  )
}

// ── Chip style helper ─────────────────────────────────────────────────────────
function chipStyle(active) {
  return {
    className: 'px-3 py-1.5 rounded-lg text-sm border transition-colors',
    style: active
      ? { background: 'var(--t-primary-muted)', color: 'var(--t-primary)', borderColor: 'var(--t-primary)', fontWeight: 600 }
      : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' },
  }
}

// ── BenefitMultiSelect ────────────────────────────────────────────────────────
function BenefitMultiSelect({ value = [], onChange }) {
  const [open, setOpen] = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  useEffect(() => {
    function handle(e) {
      if (open && !triggerRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function openDrop() {
    const rect = triggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelH = 240
    const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
    setDropPos({ top, left: rect.left, width: Math.max(rect.width, 200) })
  }

  function toggle(b) {
    onChange(value.includes(b) ? value.filter(x => x !== b) : [...value, b])
  }

  return (
    <div ref={triggerRef} style={{ position: 'relative' }}>
      <div
        onMouseDown={e => { e.preventDefault(); if (!open) openDrop(); setOpen(o => !o) }}
        style={{ background: 'var(--t-bg-input)', color: 'var(--t-text)', border: `1px solid ${open ? 'var(--t-border-focus)' : 'var(--t-border)'}`, borderRadius: 'var(--t-radius-sm)', minHeight: 30, paddingLeft: 8, paddingRight: 28, paddingTop: value.length > 0 ? 4 : 0, paddingBottom: value.length > 0 ? 4 : 0, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', cursor: 'pointer', userSelect: 'none', fontSize: 12, transition: 'border-color 120ms', position: 'relative' }}
      >
        {value.length > 0
          ? value.map(b => (
              <span key={b} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--t-chip-selected-bg)', color: 'var(--t-text)', border: '1px solid var(--t-chip-selected-border)', whiteSpace: 'nowrap' }}>{b}</span>
            ))
          : <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>选择福利（可多选）</span>
        }
        <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-muted)', pointerEvents: 'none' }}>
          <ChevronDown size={11} style={{ transition: 'transform 150ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </div>
      </div>
      {open && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999, maxHeight: 240, overflowY: 'auto', borderRadius: 'var(--t-radius)', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: 'var(--t-shadow-elevated)', padding: '4px 0' }}>
          {BENEFIT_OPTIONS.map(b => {
            const checked = value.includes(b)
            return (
              <div key={b} onMouseDown={e => { e.preventDefault(); toggle(b) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: checked ? 'var(--t-primary)' : 'var(--t-text)', background: checked ? 'var(--t-primary-muted)' : 'transparent' }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${checked ? 'var(--t-primary)' : 'var(--t-border)'}`, background: checked ? 'var(--t-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                {b}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}

// ── SECTIONS config ───────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'basic-info',           label: '基础信息' },
  { id: 'personal-advantages',  label: '个人优势' },
  { id: 'current-position',     label: '当前任职' },
  { id: 'salary',               label: '期望职位' },
  { id: 'work-exp',             label: '工作经历' },
  { id: 'project-exp',          label: '项目经历' },
  { id: 'skills',               label: '能力标签' },
  { id: 'education',            label: '教育证书' },
]

// ── Main component ────────────────────────────────────────────────────────────
export default function CandidateProfileEdit({ terminal: _terminal = false, onDone, saveRef, onSavingChange }) {
  const navigate = useNavigate()

  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadErr] = useState('')
  const [saving, setSaving]     = useState(false)
  const [saveError, setSaveErr] = useState('')
  const [showLatestPrompt, setShowLatestPrompt] = useState(false)
  const [confirmingLatest, setConfirmingLatest] = useState(false)
  const [activeSection, setActiveSection] = useState('basic-info')
  const [aiFilledSections, setAiFilledSections] = useState(new Set())
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false)


  const sectionRefs            = useRef({})
  const scrollRef              = useRef(null)
  const programmaticScrollRef  = useRef(false)
  const programmaticScrollTimer = useRef(null)

  // ── Section 1: 基础信息 ─────────────────────────────────────────────────
  const [fullName,    setFullName]    = useState('')
  const [phone,       setPhone]       = useState('')
  const [email,       setEmail]       = useState('')
  const [location,    setLocation]    = useState(null)
  const [availability, setAvailability] = useState('open')
  const [birthYear,   setBirthYear]   = useState('')
  const [birthMonth,  setBirthMonth]  = useState('')
  const [gender,      setGender]      = useState('')

  // ── Section 2: 当前任职 ─────────────────────────────────────────────────
  const [currentCompany,          setCurrentCompany]          = useState('')
  const [currentTitle,            setCurrentTitle]            = useState('')
  const [currentResponsibilities, setCurrentResponsibilities] = useState('')
  const [functionCode,            setFunctionCode]            = useState('')
  const [isManagementStr,         setIsManagementStr]         = useState('')
  const [mgmtHeadcount,           setMgmtHeadcount]           = useState('')
  const [csMin,                   setCsMin]                   = useState('')
  const [csMax,                   setCsMax]                   = useState('')
  const [csMinFocused,            setCsMinFocused]            = useState(false)
  const [csMaxFocused,            setCsMaxFocused]            = useState(false)
  const [csMonths,                setCsMonths]                = useState('')
  const [csCommissionPeriod,      setCsCommissionPeriod]      = useState('not_applicable')
  const [csCommissionAmount,      setCsCommissionAmount]      = useState('')
  const [csCommissionAmountFocused, setCsCommissionAmountFocused] = useState(false)
  const [csHasYeb,                setCsHasYeb]                = useState('')
  const [csYebQuickSelect,        setCsYebQuickSelect]        = useState(null)
  const [csYebCustom,             setCsYebCustom]             = useState('')

  // ── Section 3: 工作经历 ─────────────────────────────────────────────────
  const [workRows,      setWorkRows]      = useState([{ ...EMPTY_WORK }])
  const [salaryFocusIdx, setSalaryFocusIdx] = useState(null)

  // ── Section 4: 项目经历 ─────────────────────────────────────────────────
  const [projectRows, setProjectRows] = useState([])

  // ── Section 5: 能力标签 ─────────────────────────────────────────────────
  const [selectedJobTags,    setSelectedJobTags]    = useState([])
  const [jobTagCategory,     setJobTagCategory]     = useState(null)
  const [jobTagOpen,         setJobTagOpen]         = useState(false)
  const [jobTagDropPos,      setJobTagDropPos]      = useState({ top: 0, left: 0, width: 0 })
  const [jobTagScrollTarget, setJobTagScrollTarget] = useState(null)
  const jobTagWrapRef        = useRef(null)
  const jobTagTriggerRef     = useRef(null)
  const jobTagPanelRef       = useRef(null)
  const jobTagRightPanelRef  = useRef(null)
  const [selectedSoftSkills, setSelectedSoftSkills] = useState([])
  const [softSkillOpen,      setSoftSkillOpen]      = useState(false)
  const [softSkillDropPos,   setSoftSkillDropPos]   = useState({ top: 0, left: 0, width: 0 })
  const softSkillWrapRef     = useRef(null)
  const softSkillTriggerRef  = useRef(null)
  const softSkillPanelRef    = useRef(null)
  const [customJobTagInput, setCustomJobTagInput] = useState('')
  const [customSkillInput,  setCustomSkillInput]  = useState('')

  // ── Section: 个人优势 ─────────────────────────────────────────────────
  const [summary, setSummary] = useState('')

  // ── Section 6: 教育与证书 ─────────────────────────────────────────────
  const [education,        setEducation]        = useState('')
  const [educationRows,    setEducationRows]    = useState([])
  const [englishLevel,     setEnglishLevel]     = useState('')
  const [certificatesText, setCertificatesText] = useState('')

  // ── Section 7: 期望薪资 ───────────────────────────────────────────────
  const [expectedSalaryMin,    setExpectedSalaryMin]    = useState('')
  const [expectedSalaryMax,    setExpectedSalaryMax]    = useState('')
  const [_expectedSalaryPeriod, setExpectedSalaryPeriod] = useState('month')
  const [esMINFocused,         setEsMinFocused]         = useState(false)
  const [esMAXFocused,         setEsMaxFocused]         = useState(false)
  const [desiredPosition,      setDesiredPosition]      = useState('')

  // ── 简历增强字段 ──────────────────────────────────────────────────────
  const [hukouLocation,      setHukouLocation]      = useState(null)
  const [languageRows,       setLanguageRows]       = useState([])
  const [trainingRows,       setTrainingRows]       = useState([])
  const [certificateEntries, setCertificateEntries] = useState([])
  const [expectedSalaryMonths, setExpectedSalaryMonths] = useState('')
  const [desiredPositions,   setDesiredPositions]   = useState([])

  // Desired position autocomplete
  const [posSugOpen,    setPosSugOpen]    = useState(false)
  const [posActiveIdx,  setPosActiveIdx]  = useState(-1)
  const [posDropPos,    setPosDropPos]    = useState({ top: 0, left: 0, width: 0 })
  const posWrapRef = useRef(null)

  const posSuggestions = useMemo(() => {
    if (!desiredPosition.trim()) return []
    const q = desiredPosition.trim()
    return JOB_TITLE_SUGGESTIONS.filter(s => s.includes(q))
  }, [desiredPosition])

  useEffect(() => {
    function onDown(e) {
      if (posWrapRef.current && !posWrapRef.current.contains(e.target)) {
        setPosSugOpen(false); setPosActiveIdx(-1)
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
    if (e.key === 'ArrowDown') { e.preventDefault(); setPosActiveIdx(i => Math.min(i + 1, posSuggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setPosActiveIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && posActiveIdx >= 0) { e.preventDefault(); setDesiredPosition(posSuggestions[posActiveIdx]); setPosSugOpen(false); setPosActiveIdx(-1) }
    else if (e.key === 'Escape') { setPosSugOpen(false); setPosActiveIdx(-1) }
  }, [posSugOpen, posSuggestions, posActiveIdx])

  // ── Hydrate ────────────────────────────────────────────────────────────────
  const hydrateProfile = useCallback((p) => {
    if (!p) return
    setFullName(p.full_name || '')
    setPhone(p.phone || '')
    setEmail(p.email || '')
    if (p.location_code) {
      const migratedCode = migrateLegacyLocationCode(p.location_code)
      const area = getBusinessAreaByLocationCode(migratedCode)
      setLocation({ location_code: migratedCode, location_name: p.location_name, location_path: p.location_path, location_type: p.location_type, business_area_code: area?.code ?? p.business_area_code, business_area_name: area?.name ?? p.business_area_name })
    }
    setAvailability(p.availability_status || 'open')
    setBirthYear(p.birth_year != null ? String(p.birth_year) : '')
    setBirthMonth(p.birth_month != null ? String(p.birth_month) : '')
    setGender(p.gender || '')
    setCurrentCompany(p.current_company || '')
    setCurrentTitle(p.current_title || '')
    setCurrentResponsibilities(p.current_responsibilities || '')
    setFunctionCode(p.function_code || '')
    setIsManagementStr(p.is_management_role === true ? 'yes' : p.is_management_role === false ? 'no' : '')
    setMgmtHeadcount(p.management_headcount != null ? String(p.management_headcount) : '')
    setCsMin(p.current_salary_min != null ? String(p.current_salary_min) : '')
    setCsMax(p.current_salary_max != null ? String(p.current_salary_max) : '')
    setCsMonths(p.current_salary_months != null ? String(p.current_salary_months) : '')
    setCsCommissionPeriod(p.current_commission_bonus_period || 'not_applicable')
    setCsCommissionAmount(p.current_commission_bonus_amount != null ? String(p.current_commission_bonus_amount) : '')
    setCsHasYeb(p.current_has_year_end_bonus == null ? '' : String(p.current_has_year_end_bonus))
    if (p.current_has_year_end_bonus && p.current_year_end_bonus_months != null && p.current_year_end_bonus_months > 0) {
      const m = p.current_year_end_bonus_months
      if ([1, 2, 3].includes(m)) { setCsYebQuickSelect(m); setCsYebCustom('') }
      else { setCsYebQuickSelect('custom'); setCsYebCustom(String(m)) }
    } else { setCsYebQuickSelect(null); setCsYebCustom('') }

    if (Array.isArray(p.work_experiences) && p.work_experiences.length > 0) {
      setWorkRows(p.work_experiences.map(w => ({
        ...EMPTY_WORK,
        company_name: w.company_name || w.company || '',
        title: w.title || '',
        start_month: w.start_month || '',
        end_month: w.end_month || '',
        responsibilities: w.responsibilities || '',
        achievements: w.achievements || '',
        salary: w.salary != null ? String(w.salary) : (w.salary_min != null ? String(w.salary_min) : ''),
        salary_months: w.salary_months != null ? String(w.salary_months) : '',
        commission_bonus_period: w.commission_bonus_period || 'not_applicable',
        commission_bonus_amount: w.commission_bonus_amount != null ? String(w.commission_bonus_amount) : '',
        has_year_end_bonus: w.has_year_end_bonus == null ? '' : String(w.has_year_end_bonus),
        year_end_bonus_quick: (() => { if (!w.has_year_end_bonus || w.year_end_bonus_months == null || w.year_end_bonus_months <= 0) return null; return [1, 2, 3].includes(w.year_end_bonus_months) ? w.year_end_bonus_months : 'custom' })(),
        year_end_bonus_custom: (() => { if (!w.has_year_end_bonus || w.year_end_bonus_months == null || w.year_end_bonus_months <= 0) return ''; return [1, 2, 3].includes(w.year_end_bonus_months) ? '' : String(w.year_end_bonus_months) })(),
        benefits: w.benefits || [],
        department: w.department || '',
        reporting_to: w.reporting_to || '',
        is_management: w.is_management === true ? 'yes' : w.is_management === false ? 'no' : '',
        direct_reports_count: w.direct_reports_count != null ? String(w.direct_reports_count) : '',
        reason_for_leaving: w.reason_for_leaving || '',
      })))
    }

    if (Array.isArray(p.project_experiences) && p.project_experiences.length > 0) {
      setProjectRows(p.project_experiences.map(pr => ({ ...EMPTY_PROJECT, name: pr.name || '', role: pr.role || '', link: pr.link || '', start: pr.start || '', end: pr.end || '', description: pr.description || '', achievements: pr.achievements || '' })))
    }

    setSelectedJobTags([...(p.knowledge_tags || []), ...(p.hard_skill_tags || [])])
    setSelectedSoftSkills(p.soft_skill_tags || [])
    setEducation(p.education || '')
    setEducationRows(Array.isArray(p.education_experiences) && p.education_experiences.length > 0
      ? p.education_experiences.map(e => {
          const parts = (e.period || '').split(/\s*[-–]\s*/)
          return { school: e.school || '', major: e.major || '', degree: e.degree || '', period_start: parts[0] || '', period_end: parts[1] || '', enrollment_type: e.enrollment_type || '' }
        })
      : [])
    setSummary(p.summary || '')
    setEnglishLevel(p.english_level || '')
    setCertificatesText(tagsToText(p.certificates))
    setExpectedSalaryMin(p.expected_salary_min != null ? String(p.expected_salary_min) : '')
    setExpectedSalaryMax(p.expected_salary_max != null ? String(p.expected_salary_max) : '')
    setExpectedSalaryPeriod(p.expected_salary_period || 'month')
    setDesiredPosition(p.desired_position || '')
    // 增强字段（户籍城市：后端只存 location_name 字符串，无法还原 location_code，保持 null 让用户重选）
    setHukouLocation(null)
    setLanguageRows(Array.isArray(p.language_abilities) && p.language_abilities.length > 0
      ? p.language_abilities.map(l => ({ language: l.language || '', proficiency_level: l.proficiency_level || '' }))
      : [])
    setTrainingRows(Array.isArray(p.training_experiences) && p.training_experiences.length > 0
      ? p.training_experiences.map(t => ({ course_name: t.course_name || '', institution: t.institution || '', location: t.location || '', start_date: t.start_date || '', end_date: t.end_date || '' }))
      : [])
    setCertificateEntries(Array.isArray(p.certificate_entries) && p.certificate_entries.length > 0
      ? p.certificate_entries.map(c => ({ name: c.name || '', level: c.level || '', issue_date: c.issue_date || '' }))
      : [])
    setExpectedSalaryMonths(p.expected_salary_months != null ? String(p.expected_salary_months) : '')
    setDesiredPositions(Array.isArray(p.desired_positions) && p.desired_positions.length > 0
      ? p.desired_positions.map(d => ({
          title: d.title || '',
          salary_min: d.salary_min != null ? String(d.salary_min) : '',
          salary_max: d.salary_max != null ? String(d.salary_max) : '',
          salary_period: d.salary_period || 'month',
          salary_months: d.salary_months != null ? String(d.salary_months) : '',
          industries: Array.isArray(d.industries) ? d.industries.join('、') : (d.industries || ''),
        }))
      : [])
  }, [])

  const mergeAiData = useCallback((ai) => {
    if (!ai) return
    const filled = new Set()

    // 规范化 YYYY.MM → YYYY-MM，简历中的点号/中文格式日期
    function normalizeMonth(s) {
      if (!s) return ''
      const m = String(s).match(/^(\d{4})[.\-/](\d{1,2})$/)
      return m ? `${m[1]}-${String(m[2]).padStart(2, '0')}` : String(s)
    }

    // 基础信息
    if (ai.full_name)       { setFullName(ai.full_name); filled.add('basic-info') }
    if (ai.phone)           { setPhone(ai.phone); filled.add('basic-info') }
    if (ai.email)           { setEmail(ai.email); filled.add('basic-info') }
    if (ai.gender)          { setGender(ai.gender); filled.add('basic-info') }
    if (ai.birth_year != null)  { setBirthYear(String(ai.birth_year)); filled.add('basic-info') }
    if (ai.birth_month != null) { setBirthMonth(String(ai.birth_month)); filled.add('basic-info') }
    if (ai.availability_status) { setAvailability(ai.availability_status); filled.add('basic-info') }

    // 当前任职
    if (ai.function_code) { setFunctionCode(ai.function_code); filled.add('current-position') }
    if (ai.is_management_role != null) {
      setIsManagementStr(ai.is_management_role ? 'yes' : 'no')
      filled.add('current-position')
    }
    if (ai.management_headcount != null) {
      setMgmtHeadcount(String(ai.management_headcount))
      filled.add('current-position')
    }
    if (ai.current_responsibilities) {
      setCurrentResponsibilities(ai.current_responsibilities)
      filled.add('current-position')
    }
    if (ai.current_salary != null) {
      setCsMin(String(ai.current_salary))
      setCsMax(String(ai.current_salary))
      filled.add('current-position')
    }
    if (ai.current_salary_months != null) {
      setCsMonths(String(ai.current_salary_months))
      filled.add('current-position')
    }
    if (ai.current_has_year_end_bonus != null) {
      setCsHasYeb(String(ai.current_has_year_end_bonus))
      filled.add('current-position')
    }
    // 当前公司/职位取第一段工作经历（end_month=null 即在职）
    if (Array.isArray(ai.work_experiences) && ai.work_experiences.length > 0) {
      const first = ai.work_experiences[0]
      if (first.company_name) { setCurrentCompany(first.company_name); filled.add('current-position') }
      if (first.title)        { setCurrentTitle(first.title); filled.add('current-position') }
    }

    // 期望职位
    if (ai.desired_position)          { setDesiredPosition(ai.desired_position); filled.add('salary') }
    if (ai.expected_salary_min != null) { setExpectedSalaryMin(String(ai.expected_salary_min)); filled.add('salary') }
    if (ai.expected_salary_max != null) { setExpectedSalaryMax(String(ai.expected_salary_max)); filled.add('salary') }
    if (ai.expected_salary_period)    { setExpectedSalaryPeriod(ai.expected_salary_period); filled.add('salary') }

    // 工作经历
    if (Array.isArray(ai.work_experiences) && ai.work_experiences.length > 0) {
      setWorkRows(ai.work_experiences.map(w => ({
        ...EMPTY_WORK,
        company_name:  w.company_name || '',
        industry:      w.industry || '',
        title:         w.title || '',
        start_month:   normalizeMonth(w.start_month),
        end_month:     normalizeMonth(w.end_month),
        responsibilities: w.responsibilities || '',
        achievements:  w.achievements || '',
        salary:        w.salary != null ? String(w.salary) : '',
        salary_months: w.salary_months != null ? String(w.salary_months) : '',
        has_year_end_bonus: w.has_year_end_bonus == null ? '' : String(w.has_year_end_bonus),
        benefits:      Array.isArray(w.benefits) ? w.benefits : [],
      })))
      filled.add('work-exp')
    }

    // 项目经历
    if (Array.isArray(ai.project_experiences) && ai.project_experiences.length > 0) {
      setProjectRows(ai.project_experiences.map(p => ({
        ...EMPTY_PROJECT,
        name:         p.name || '',
        role:         p.role || '',
        start:        normalizeMonth(p.start),
        end:          normalizeMonth(p.end),
        description:  p.description || '',
        achievements: p.achievements || '',
      })))
      filled.add('project-exp')
    }

    // 能力标签
    if (Array.isArray(ai.hard_skill_tags) && ai.hard_skill_tags.length > 0) {
      setSelectedJobTags(ai.hard_skill_tags); filled.add('skills')
    }
    if (Array.isArray(ai.soft_skill_tags) && ai.soft_skill_tags.length > 0) {
      setSelectedSoftSkills(ai.soft_skill_tags); filled.add('skills')
    }

    // 个人优势
    if (ai.summary) { setSummary(ai.summary); filled.add('personal-advantages') }

    // 教育与证书
    if (ai.education)     { setEducation(ai.education); filled.add('education') }
    if (ai.english_level) { setEnglishLevel(ai.english_level); filled.add('education') }
    if (Array.isArray(ai.certificates) && ai.certificates.length > 0) {
      setCertificatesText(ai.certificates.join('、')); filled.add('education')
    }
    if (Array.isArray(ai.education_experiences) && ai.education_experiences.length > 0) {
      setEducationRows(ai.education_experiences.map(e => {
        // period can be "YYYY-YYYY" or "YYYY.YYYY" or "YYYY年-YYYY年"
        const normalized = (e.period || '').replace(/年/g, '').replace(/[.\s]/g, '-')
        const parts = normalized.split(/[-–]/).map(s => s.trim()).filter(Boolean)
        return { school: e.school || '', major: e.major || '', degree: e.degree || '', period_start: parts[0] || '', period_end: parts[1] || '' }
      }))
      filled.add('education')
    }

    setAiFilledSections(filled)
  }, [])

  useEffect(() => {
    let cancelled = false
    const aiPrefill = new URLSearchParams(window.location.search).get('ai_prefill') === '1'
    candidatesApi.getMyCandidateProfile()
      .then(res => {
        if (!cancelled) {
          hydrateProfile(res.data?.profile)
          if (aiPrefill) {
            const raw = sessionStorage.getItem('ai_parse_result')
            if (raw) {
              try { mergeAiData(JSON.parse(raw)) } catch { /* ignore parse error */ }
              sessionStorage.removeItem('ai_parse_result')
            }
            const params = new URLSearchParams(window.location.search)
            params.delete('ai_prefill')
            const q = params.toString()
            window.history.replaceState(null, '', window.location.pathname + (q ? '?' + q : ''))
          }
        }
      })
      .catch(err => { if (!cancelled) setLoadErr(err.response?.data?.message || '加载档案失败，请刷新重试') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [hydrateProfile, mergeAiData])

  // ── Active section tracking via scroll ────────────────────────────────────
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    function updateActive() {
      if (programmaticScrollRef.current) return
      // Near-bottom: select last rendered section
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 8) {
        for (let i = SECTIONS.length - 1; i >= 0; i--) {
          if (sectionRefs.current[SECTIONS[i].id]) { setActiveSection(SECTIONS[i].id); return }
        }
      }
      const containerRect = container.getBoundingClientRect()
      const line = containerRect.top + 60
      let best = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = sectionRefs.current[s.id]
        if (!el) continue
        if (el.getBoundingClientRect().top <= line) best = s.id
      }
      setActiveSection(best)
    }
    container.addEventListener('scroll', updateActive, { passive: true })
    updateActive()
    return () => container.removeEventListener('scroll', updateActive)
  }, [loading])

  function scrollToSection(id) {
    setActiveSection(id)
    const el        = sectionRefs.current[id]
    const container = scrollRef.current
    if (!el || !container) return
    // Suppress scroll-tracker during animation so it can't override the selection
    programmaticScrollRef.current = true
    clearTimeout(programmaticScrollTimer.current)
    programmaticScrollTimer.current = setTimeout(() => { programmaticScrollRef.current = false }, 800)
    // Calculate offset relative to container (not viewport) so sections near the
    // bottom that can't reach the top still land in the right place
    const top = container.scrollTop + el.getBoundingClientRect().top - container.getBoundingClientRect().top
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const certsArr = useMemo(() => splitTokens(certificatesText), [certificatesText])

  function updateWorkRow(i, patch) { setWorkRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addWorkRow()             { setWorkRows(rows => [...rows, { ...EMPTY_WORK }]) }
  function removeWorkRow(i)         { setWorkRows(rows => rows.length <= 1 ? rows : rows.filter((_, idx) => idx !== i)) }

  function updateProjectRow(i, patch) { setProjectRows(rows => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r)) }
  function addProjectRow()            { setProjectRows(rows => [...rows, { ...EMPTY_PROJECT }]) }
  function removeProjectRow(i)        { setProjectRows(rows => rows.filter((_, idx) => idx !== i)) }

  // ── Validation ─────────────────────────────────────────────────────────────
  function validate() {
    if (!fullName.trim()) return '请填写姓名'
    if (!phone.trim())    return '请填写手机号码'
    if (!email.trim())    return '请填写邮箱'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return '邮箱格式不正确'
    if (!location?.location_code || !location?.location_name || !location?.location_path || !location?.location_type) return '请选择当前住址'
    if (availability !== 'open') {
      if (!currentCompany.trim())          return '请填写当前公司'
      if (!currentTitle.trim())            return '请填写当前职位'
      if (!currentResponsibilities.trim()) return '请填写岗位描述'
    }
    if (!functionCode) return '请选择业务方向'
    if (isManagementStr !== 'yes' && isManagementStr !== 'no') return '请选择是否带团队'
    if (csMin !== '' && !/^\d+$/.test(csMin)) return '当前薪资 min 必须为纯数字'
    if (csMax !== '' && !/^\d+$/.test(csMax)) return '当前薪资 max 必须为纯数字'
    if (csMin !== '' && csMax !== '' && Number(csMin) > Number(csMax)) return '当前薪资 min 不能大于 max'
    if (csMonths !== '' && !['12', '13', '14'].includes(csMonths)) return '当前薪资月数只能是 12/13/14'
    if (csHasYeb === 'true' && csYebQuickSelect === null) return '请选择年终奖预估平均额'
    if (csHasYeb === 'true' && csYebQuickSelect === 'custom') {
      const yb = Number(csYebCustom)
      if (!Number.isFinite(yb) || yb <= 0 || yb > 24) return '年终奖月数必须在 0-24 之间'
    }
    const esMinRaw = expectedSalaryMin.replace(/,/g, '')
    const esMaxRaw = expectedSalaryMax.replace(/,/g, '')
    if (esMinRaw !== '' && !/^\d+$/.test(esMinRaw)) return '期望薪资最小值必须为纯数字'
    if (esMaxRaw !== '' && !/^\d+$/.test(esMaxRaw)) return '期望薪资最大值必须为纯数字'
    if (esMinRaw !== '' && esMaxRaw !== '' && Number(esMinRaw) > Number(esMaxRaw)) return '期望薪资最小值不能大于最大值'
    if (!Array.isArray(workRows) || workRows.length === 0) return '至少填写一段工作经历'
    for (let i = 0; i < workRows.length; i++) {
      const r = workRows[i]
      if (!r.company_name.trim()) return `工作经历 #${i + 1}：公司名称不能为空`
      if (!r.title.trim())        return `工作经历 #${i + 1}：职位不能为空`
      if (r.salary !== '' && !/^\d+$/.test(r.salary)) return `工作经历 #${i + 1}：薪资必须为纯数字`
      if (r.salary_months !== '' && !['12', '13', '14'].includes(String(r.salary_months))) return `工作经历 #${i + 1}：薪资月数只能是 12/13/14`
      if (r.has_year_end_bonus === 'true' && r.year_end_bonus_quick === null) return `工作经历 #${i + 1}：请选择年终奖预估平均额`
    }
    for (let i = 0; i < educationRows.length; i++) {
      if (!educationRows[i].school.trim()) return `教育经历第 ${i + 1} 条：学校名称不能为空`
    }
    if (selectedJobTags.length === 0) return '请至少选择 1 个岗位标签'
    if (selectedSoftSkills.length === 0) return '请至少选择 1 个岗位所需软技能'
    return ''
  }

  // ── handleSave ─────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveErr('')
    const msg = validate()
    if (msg) { setSaveErr(msg); return }
    const isManagement = isManagementStr === 'yes'
    const fnLabel = FUNCTION_OPTIONS.find(f => f.key === functionCode)?.label || functionCode
    const payload = {
      full_name: fullName.trim(), phone: phone.trim(), email: email.trim(),
      location_code: location.location_code, location_name: location.location_name,
      location_path: location.location_path, location_type: location.location_type,
      current_city: location.location_name,
      current_company: currentCompany.trim(), current_title: currentTitle.trim(),
      current_responsibilities: currentResponsibilities.trim(),
      function_code: functionCode, function_name: fnLabel, business_type: fnLabel,
      is_management_role: isManagement, job_type: isManagement ? '管理' : '非管理',
      ...(isManagement && mgmtHeadcount !== '' ? { management_headcount: Number(mgmtHeadcount) } : {}),
      knowledge_tags: selectedJobTags, hard_skill_tags: [], soft_skill_tags: selectedSoftSkills,
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
      project_experiences: projectRows.map(r => ({
        name: r.name.trim(), role: r.role.trim(),
        ...(r.link.trim()    ? { link: r.link.trim() } : {}),
        ...(r.start.trim()   ? { start: r.start.trim() } : {}),
        ...(r.end.trim()     ? { end: r.end.trim() } : {}),
        ...(r.description.trim()   ? { description: r.description.trim() } : {}),
        ...(r.achievements.trim()  ? { achievements: r.achievements.trim() } : {}),
      })).filter(r => r.name),
      education: education.trim() || null,
      education_experiences: educationRows.filter(r => r.school.trim()).map(r => {
        const e = { school: r.school.trim() }
        if (r.major.trim()) e.major = r.major.trim()
        if (r.degree) e.degree = r.degree
        if (r.period_start || r.period_end) e.period = `${r.period_start || '?'}-${r.period_end || '至今'}`
        if (r.enrollment_type) e.enrollment_type = r.enrollment_type
        return e
      }),
      english_level: englishLevel.trim() || null,
      certificates: certsArr,
      ...(expectedSalaryMin.replace(/,/g, '') !== '' ? { expected_salary_min: Number(expectedSalaryMin.replace(/,/g, '')) } : { expected_salary_min: null }),
      ...(expectedSalaryMax.replace(/,/g, '') !== '' ? { expected_salary_max: Number(expectedSalaryMax.replace(/,/g, '')) } : { expected_salary_max: null }),
      expected_salary_period: 'month',
      summary: summary.trim() || null,
      desired_position: desiredPosition.trim() || null,
      availability_status: availability,
      ...(gender !== '' ? { gender } : {}),
      ...(birthYear !== '' ? { birth_year: Number(birthYear) } : {}),
      ...(birthMonth !== '' ? { birth_month: Number(birthMonth) } : {}),
      confirm_latest: false,
      // 增强字段
      hukou_city: hukouLocation?.location_name || null,
      ...(expectedSalaryMonths !== '' ? { expected_salary_months: Number(expectedSalaryMonths) } : { expected_salary_months: null }),
      desired_positions: desiredPositions.filter(d => d.title.trim()).map(d => {
        const entry = { title: d.title.trim(), salary_period: d.salary_period || 'month' }
        const sMin = String(d.salary_min).replace(/,/g, '')
        const sMax = String(d.salary_max).replace(/,/g, '')
        if (sMin !== '') entry.salary_min = Number(sMin)
        if (sMax !== '') entry.salary_max = Number(sMax)
        if (d.salary_months !== '') entry.salary_months = Number(d.salary_months)
        const inds = String(d.industries).split(/[,，、]+/).map(s => s.trim()).filter(Boolean)
        if (inds.length > 0) entry.industries = inds
        return entry
      }),
      language_abilities: languageRows.filter(l => l.language.trim()).map(l => {
        const entry = { language: l.language.trim() }
        if (l.proficiency_level.trim()) entry.proficiency_level = l.proficiency_level.trim()
        return entry
      }),
      training_experiences: trainingRows.filter(t => t.course_name.trim()).map(t => {
        const entry = { course_name: t.course_name.trim() }
        if (t.institution.trim()) entry.institution = t.institution.trim()
        if (t.location.trim()) entry.location = t.location.trim()
        if (t.start_date.trim()) entry.start_date = t.start_date.trim()
        if (t.end_date.trim()) entry.end_date = t.end_date.trim()
        return entry
      }),
      certificate_entries: certificateEntries.filter(c => c.name.trim()).map(c => {
        const entry = { name: c.name.trim() }
        if (c.level.trim()) entry.level = c.level.trim()
        if (c.issue_date.trim()) entry.issue_date = c.issue_date.trim()
        return entry
      }),
    }
    setSaving(true)
    try {
      const res = await candidatesApi.updateMyCandidateProfile(payload)
      hydrateProfile(res.data?.profile)
      setShowLatestPrompt(true)
    } catch (err) {
      setSaveErr(err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => { if (saveRef) saveRef.current = handleSave })
  useEffect(() => { if (onSavingChange) onSavingChange(saving) }, [saving, onSavingChange])

  async function handleConfirmLatest() {
    setConfirmingLatest(true); setSaveErr('')
    try {
      await candidatesApi.confirmLatestResume()
      if (onDone) onDone(); else navigate('/candidate/tags')
    } catch (err) {
      setSaveErr(err.response?.data?.message || '确认失败，请重试')
      setShowLatestPrompt(false)
    } finally { setConfirmingLatest(false) }
  }

  // ── Skills dropdown helpers ────────────────────────────────────────────────
  function openJobTagDrop() {
    const rect = jobTagTriggerRef.current?.getBoundingClientRect(); if (!rect) return
    setSoftSkillOpen(false)
    const panelH = 340; const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
    setJobTagDropPos({ top, left: rect.left, width: rect.width })
  }
  function openSoftSkillDrop() {
    const rect = softSkillTriggerRef.current?.getBoundingClientRect(); if (!rect) return
    setJobTagOpen(false)
    const panelH = 228; const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
    setSoftSkillDropPos({ top, left: rect.left, width: rect.width })
  }
  function toggleJobTag(tag) { setSelectedJobTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]) }
  function toggleSoftSkill(skill) { setSelectedSoftSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]) }

  useEffect(() => {
    function handle(e) {
      if (softSkillOpen) { const inWrap = softSkillWrapRef.current?.contains(e.target); const inPanel = softSkillPanelRef.current?.contains(e.target); if (!inWrap && !inPanel) setSoftSkillOpen(false) }
      if (jobTagOpen)    { const inWrap = jobTagWrapRef.current?.contains(e.target); const inPanel = jobTagPanelRef.current?.contains(e.target); if (!inWrap && !inPanel) setJobTagOpen(false) }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [softSkillOpen, jobTagOpen])

  useEffect(() => {
    if (!jobTagScrollTarget || !jobTagOpen || !jobTagRightPanelRef.current) return
    const panel = jobTagRightPanelRef.current
    const el = panel.querySelector(`[data-tag="${CSS.escape(jobTagScrollTarget)}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
    setJobTagScrollTarget(null)
  }, [jobTagScrollTarget, jobTagOpen, jobTagCategory])

  // ── Style tokens ───────────────────────────────────────────────────────────
  const IS  = { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)', transition: 'border-color 120ms' }
  const IC  = 'w-full px-3 py-2 rounded border text-[12px] focus:outline-none'
  const TC  = IC + ' resize-none'
  const LC  = 'block text-[11px] font-medium mb-1.5'
  const LS  = { color: 'var(--t-text-secondary)' }
  const HS  = { color: 'var(--t-text-secondary)', fontSize: 11, marginBottom: 4, display: 'block' }

  function multiTriggerStyle(isOpen, hasItems) {
    return { background: 'var(--t-bg-input)', color: 'var(--t-text)', border: `1px solid ${isOpen ? 'var(--t-border-focus)' : 'var(--t-border)'}`, borderRadius: 'var(--t-radius-sm)', minHeight: 30, paddingLeft: 8, paddingRight: 28, paddingTop: hasItems ? 4 : 0, paddingBottom: hasItems ? 4 : 0, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', cursor: 'pointer', userSelect: 'none', fontSize: 12, transition: 'border-color 120ms' }
  }

  // ── Loading guards ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="terminal-mode flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center" style={{ background: 'var(--t-bg)', color: 'var(--t-text-muted)' }}>
        <div className="flex items-center gap-2 text-sm"><Loader2 size={14} className="animate-spin" /><span>正在加载候选人档案...</span></div>
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="terminal-mode flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center px-6" style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}>
        <div className="mx-auto max-w-md w-full rounded-lg border p-5" style={{ background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--t-danger)' }}><AlertCircle size={16} /><span className="text-sm font-semibold">无法加载档案</span></div>
          <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>{loadError}</p>
        </div>
      </div>
    )
  }

  // ── Section renders ────────────────────────────────────────────────────────

  // 基础信息
  const sBasicInfo = (
    <div ref={el => sectionRefs.current['basic-info'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="基础信息" aiHighlight={aiFilledSections.has('basic-info')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div><label className={LC} style={LS}>姓名 *</label><input className={IC} style={IS} value={fullName} onChange={e => setFullName(e.target.value)} placeholder="真实姓名" /></div>
        <div><label className={LC} style={LS}>手机号码 *</label><input className={IC} style={IS} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+86 138..." /></div>
        <div><label className={LC} style={LS}>个人邮箱 *</label><input className={IC} style={IS} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
        <div>
          <label className={LC} style={LS}>求职状态</label>
          <TerminalSelect value={availability} onChange={setAvailability} options={[{ value: 'open', label: '离职-随时到岗' }, { value: 'passive_now', label: '在职-月内到岗' }, { value: 'passive', label: '在职-考虑机会' }]} placeholder="请选择" hasValue={true} />
        </div>
        <div><label className={LC} style={LS}>出生年份</label><TerminalSelect value={String(birthYear)} onChange={setBirthYear} options={[{ value: '', label: '年份' }, ...Array.from({ length: new Date().getFullYear() - 16 - 1950 + 1 }, (_, i) => new Date().getFullYear() - 16 - i).map(y => ({ value: String(y), label: String(y) }))]} placeholder="年份" hasValue={!!birthYear} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><label className={LC} style={LS}>出生月份</label><TerminalSelect value={String(birthMonth)} onChange={setBirthMonth} options={[{ value: '', label: '月份' }, ...Array.from({ length: 12 }, (_, i) => i + 1).map(m => ({ value: String(m), label: `${m}月` }))]} placeholder="月份" hasValue={!!birthMonth} /></div>
          <div><label className={LC} style={LS}>性别</label><TerminalSelect value={gender} onChange={setGender} options={[{ value: '', label: '性别' }, { value: 'male', label: '男' }, { value: 'female', label: '女' }]} placeholder="性别" hasValue={!!gender} /></div>
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className={LC} style={LS}>当前住址 *</label>
          <RegionSelector value={location} onChange={setLocation} terminal placeholder="请选择当前住址" />
          {location?.location_path && <p style={{ ...HS, marginTop: 4 }}>已选：{location.location_path}{location.business_area_name ? `（${location.business_area_name}）` : ''}</p>}
        </div>
        <div>
          <label className={LC} style={LS}>户籍城市</label>
          <RegionSelector value={hukouLocation} onChange={setHukouLocation} terminal placeholder="请选择户籍城市（户口所在地）" />
          {hukouLocation?.location_name && <p style={{ ...HS, marginTop: 4 }}>已选：{hukouLocation.location_path || hukouLocation.location_name}</p>}
        </div>
      </div>
    </div>
  )

  // 个人优势
  const sPersonalAdvantages = (
    <div ref={el => sectionRefs.current['personal-advantages'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="个人优势" aiHighlight={aiFilledSections.has('personal-advantages')} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className={LC} style={LS}>个人优势描述</label>
          <AiPolishButton field="summary" content={summary} context={{}} onResult={setSummary} />
        </div>
        <AutoTextarea
          className={TC}
          style={IS}
          rows={1}
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="深耕行业背景与核心竞争力：如多年货代经验、擅长海运/空运操作、具备客户开发能力、熟悉 Cargowise 系统等..."
        />
        <p style={{ ...HS, marginTop: 4 }}>展示你的核心竞争力，企业端可直接看到此内容</p>
      </div>
    </div>
  )

  // 当前任职
  const sCurrentPosition = (
    <div ref={el => sectionRefs.current['current-position'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="当前任职" aiHighlight={aiFilledSections.has('current-position')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <div><label className={LC} style={LS}>当前公司 *</label><input className={IC} style={IS} value={currentCompany} onChange={e => setCurrentCompany(e.target.value)} placeholder="公司名称" /></div>
        <div><label className={LC} style={LS}>当前职位 *</label><input className={IC} style={IS} value={currentTitle} onChange={e => setCurrentTitle(e.target.value)} placeholder="如：海运操作主管" /></div>
        <div><label className={LC} style={LS}>业务方向 *</label><TerminalSelect value={functionCode} onChange={setFunctionCode} options={[{ value: '', label: '请选择' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]} placeholder="请选择" hasValue={!!functionCode} /></div>
        <div><label className={LC} style={LS}>是否带团队 *</label><TerminalSelect value={isManagementStr} onChange={setIsManagementStr} options={[{ value: '', label: '请选择' }, { value: 'yes', label: '是' }, { value: 'no', label: '否' }]} placeholder="请选择" hasValue={isManagementStr === 'yes' || isManagementStr === 'no'} /></div>
        {isManagementStr === 'yes' && <div><label className={LC} style={LS}>团队人数</label><input className={IC} style={IS} inputMode="numeric" value={mgmtHeadcount} onChange={e => setMgmtHeadcount(e.target.value.replace(/\D/g, ''))} placeholder="如 10" /></div>}
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className={LC} style={LS}>岗位描述 *</label>
          <AiPolishButton field="responsibilities" content={currentResponsibilities} context={{ title: currentTitle, company: currentCompany }} onResult={setCurrentResponsibilities} />
        </div>
        <AutoTextarea className={TC} style={IS} rows={1} value={currentResponsibilities} onChange={e => setCurrentResponsibilities(e.target.value)} placeholder="主要职责、负责的业务范围..." />
      </div>
      <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 10 }}>
        <p className={LC} style={LS}>当前薪资结构</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <div><label style={HS}>最低月薪（元）</label><input className={IC} style={IS} inputMode="numeric" value={csMinFocused ? csMin : formatThousand(csMin)} onFocus={() => setCsMinFocused(true)} onBlur={() => setCsMinFocused(false)} onChange={e => setCsMin(e.target.value.replace(/[^\d]/g, ''))} placeholder="18,000" /></div>
          <div><label style={HS}>最高月薪（元）</label><input className={IC} style={IS} inputMode="numeric" value={csMaxFocused ? csMax : formatThousand(csMax)} onFocus={() => setCsMaxFocused(true)} onBlur={() => setCsMaxFocused(false)} onChange={e => setCsMax(e.target.value.replace(/[^\d]/g, ''))} placeholder="25,000" /></div>
          <div><label style={HS}>薪资月数</label><TerminalSelect value={csMonths} onChange={setCsMonths} options={[{ value: '', label: '未填' }, { value: '12', label: '12个月' }, { value: '13', label: '13个月' }, { value: '14', label: '14个月' }]} placeholder="未填" hasValue={!!csMonths} /></div>
          <div><label style={HS}>是否有年终奖</label><TerminalSelect value={csHasYeb} onChange={(val) => { setCsHasYeb(val); if (val !== 'true') { setCsYebQuickSelect(null); setCsYebCustom('') } }} options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]} placeholder="请选择" hasValue={csHasYeb === 'true' || csHasYeb === 'false'} /></div>
        </div>
        {csHasYeb === 'true' && (
          <div style={{ marginTop: 8 }}>
            <label style={HS}>年终奖预估平均额</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {YEAR_END_BONUS_QUICK.map(opt => { const cs = chipStyle(csYebQuickSelect === opt.value); return <button key={String(opt.value)} type="button" className={cs.className} style={cs.style} onClick={() => { setCsYebQuickSelect(opt.value); if (opt.value !== 'custom') setCsYebCustom('') }}>{opt.label}</button> })}
            </div>
            {csYebQuickSelect === 'custom' && <input type="text" inputMode="decimal" className={IC} style={{ ...IS, marginTop: 6 }} placeholder="例：2 表示 2 个月基本工资" value={csYebCustom} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setCsYebCustom(v) }} />}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
          <div><label style={HS}>提成/计件奖金周期</label><TerminalSelect value={csCommissionPeriod} onChange={(val) => { setCsCommissionPeriod(val); if (val === 'not_applicable') setCsCommissionAmount('') }} options={COMMISSION_BONUS_PERIODS.map(p => ({ value: p.value, label: p.label }))} placeholder="请选择" hasValue={csCommissionPeriod !== 'not_applicable'} /></div>
          <div><label style={HS}>预估平均额（元）</label><input className={IC} style={{ ...IS, opacity: csCommissionPeriod === 'not_applicable' ? 0.4 : 1 }} inputMode="numeric" placeholder={csCommissionPeriod === 'not_applicable' ? '请先选择周期' : '例：5,000'} value={csCommissionPeriod === 'not_applicable' ? '' : (csCommissionAmountFocused ? csCommissionAmount : formatThousand(csCommissionAmount))} disabled={csCommissionPeriod === 'not_applicable'} onFocus={() => setCsCommissionAmountFocused(true)} onBlur={() => setCsCommissionAmountFocused(false)} onChange={e => { const r = e.target.value.replace(/,/g, ''); if (r === '' || /^\d+$/.test(r)) setCsCommissionAmount(r) }} /></div>
        </div>
      </div>
    </div>
  )

  // 工作经历
  const sWorkExp = (
    <div ref={el => sectionRefs.current['work-exp'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="工作经历" subtitle={`${workRows.length} 段`} aiHighlight={aiFilledSections.has('work-exp')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {workRows.map((r, i) => (
          <div key={i} style={{ borderRadius: 8, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--t-bg-panel)', borderBottom: '1px solid var(--t-border-subtle)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>工作经历 #{i + 1}</span>
              {workRows.length > 1 && <DeleteButton onClick={() => removeWorkRow(i)} />}
            </div>
            <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
              <div><label style={HS}>公司 *</label><input className={IC} style={IS} value={r.company_name} onChange={e => updateWorkRow(i, { company_name: e.target.value })} /></div>
              <div><label style={HS}>所属行业</label><input className={IC} style={IS} value={r.industry || ''} onChange={e => updateWorkRow(i, { industry: e.target.value })} placeholder="如：国际物流" /></div>
              <div><label style={HS}>职位 *</label><input className={IC} style={IS} value={r.title} onChange={e => updateWorkRow(i, { title: e.target.value })} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div><label style={HS}>起始</label><MonthYearPicker value={r.start_month} onChange={val => updateWorkRow(i, { start_month: val })} /></div>
              <div><label style={HS}>结束（留空=至今）</label><MonthYearPicker value={r.end_month} onChange={val => updateWorkRow(i, { end_month: val })} allowEmpty /></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={HS}>工作内容</label>
                <AiPolishButton field="responsibilities" content={r.responsibilities} context={{ title: r.title, company: r.company_name }} onResult={v => updateWorkRow(i, { responsibilities: v })} />
              </div>
              <AutoTextarea className={TC} style={IS} rows={1} value={r.responsibilities} onChange={e => updateWorkRow(i, { responsibilities: e.target.value })} placeholder="主要职责..." />
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={HS}>工作业绩（选填）</label>
                <AiPolishButton field="achievements" content={r.achievements} context={{ title: r.title, company: r.company_name }} onResult={v => updateWorkRow(i, { achievements: v })} />
              </div>
              <AutoTextarea className={TC} style={IS} rows={1} value={r.achievements} onChange={e => updateWorkRow(i, { achievements: e.target.value })} placeholder="量化成果、荣誉..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div><label style={HS}>月薪（元）</label><input className={IC} style={IS} inputMode="numeric" placeholder="20,000" value={salaryFocusIdx === i ? r.salary : formatThousand(r.salary)} onFocus={() => setSalaryFocusIdx(i)} onBlur={() => setSalaryFocusIdx(null)} onChange={e => updateWorkRow(i, { salary: e.target.value.replace(/[^\d]/g, '') })} /></div>
              <div><label style={HS}>薪资月数</label><TerminalSelect value={r.salary_months} onChange={val => updateWorkRow(i, { salary_months: val })} options={[{ value: '', label: '未填' }, { value: '12', label: '12' }, { value: '13', label: '13' }, { value: '14', label: '14' }]} placeholder="未填" hasValue={!!r.salary_months} /></div>
              <div><label style={HS}>是否有年终奖</label><TerminalSelect value={r.has_year_end_bonus} onChange={val => updateWorkRow(i, { has_year_end_bonus: val, ...(val !== 'true' ? { year_end_bonus_quick: null, year_end_bonus_custom: '' } : {}) })} options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]} placeholder="请选择" hasValue={r.has_year_end_bonus === 'true' || r.has_year_end_bonus === 'false'} /></div>
            </div>
            {r.has_year_end_bonus === 'true' && (
              <div style={{ marginTop: 8 }}>
                <label style={HS}>年终奖预估平均额</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {YEAR_END_BONUS_QUICK.map(opt => { const cs = chipStyle(r.year_end_bonus_quick === opt.value); return <button key={String(opt.value)} type="button" className={cs.className} style={cs.style} onClick={() => updateWorkRow(i, { year_end_bonus_quick: opt.value, ...(opt.value !== 'custom' ? { year_end_bonus_custom: '' } : {}) })}>{opt.label}</button> })}
                </div>
                {r.year_end_bonus_quick === 'custom' && <input type="text" inputMode="decimal" className={IC} style={{ ...IS, marginTop: 6 }} placeholder="月数，如 2" value={r.year_end_bonus_custom} onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) updateWorkRow(i, { year_end_bonus_custom: v }) }} />}
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              <label style={HS}>福利列表</label>
              <div style={{ marginTop: 4 }}>
                <BenefitMultiSelect
                  value={r.benefits || []}
                  onChange={benefits => updateWorkRow(i, { benefits })}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--t-border-subtle)' }}>
              <div><label style={HS}>所在部门</label><input className={IC} style={IS} value={r.department || ''} onChange={e => updateWorkRow(i, { department: e.target.value })} placeholder="如：人力资源板块" /></div>
              <div><label style={HS}>汇报对象（职位）</label><input className={IC} style={IS} value={r.reporting_to || ''} onChange={e => updateWorkRow(i, { reporting_to: e.target.value })} placeholder="如：总经理、HRD" /></div>
              <div>
                <label style={HS}>是否带团队</label>
                <TerminalSelect
                  value={r.is_management}
                  onChange={val => updateWorkRow(i, { is_management: val, ...(val !== 'yes' ? { direct_reports_count: '' } : {}) })}
                  options={[{ value: '', label: '请选择' }, { value: 'yes', label: '是' }, { value: 'no', label: '否' }]}
                  placeholder="请选择"
                  hasValue={r.is_management === 'yes' || r.is_management === 'no'}
                  style={{ height: 32 }}
                />
              </div>
              {r.is_management === 'yes' && (
                <div><label style={HS}>直属下属人数</label><input className={IC} style={IS} inputMode="numeric" value={r.direct_reports_count || ''} onChange={e => updateWorkRow(i, { direct_reports_count: e.target.value.replace(/\D/g, '') })} placeholder="如：10" /></div>
              )}
              <div style={{ gridColumn: 'span 3' }}><label style={HS}>离职原因（选填）</label><input className={IC} style={IS} value={r.reason_for_leaving || ''} onChange={e => updateWorkRow(i, { reason_for_leaving: e.target.value })} placeholder="如：寻求更好发展" /></div>
            </div>
            </div>{/* end padding wrapper */}
          </div>
        ))}
      </div>
      <button type="button" onClick={addWorkRow} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
        <Plus size={12} />新增一段工作经历
      </button>
    </div>
  )

  // 项目经历
  const sProjectExp = (
    <div ref={el => sectionRefs.current['project-exp'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="项目经历" subtitle={projectRows.length > 0 ? `${projectRows.length} 个` : '选填'} aiHighlight={aiFilledSections.has('project-exp')} />
      {projectRows.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 10 }}>添加参与过的项目，有助于展示你的实战能力</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {projectRows.map((r, i) => (
          <div key={i} style={{ borderRadius: 8, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--t-bg-panel)', borderBottom: '1px solid var(--t-border-subtle)' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>项目经历 #{i + 1}</span>
              <DeleteButton onClick={() => removeProjectRow(i)} />
            </div>
            <div style={{ padding: '12px 14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
              <div style={{ gridColumn: 'span 2' }}><label style={HS}>项目名称</label><input className={IC} style={IS} value={r.name} onChange={e => updateProjectRow(i, { name: e.target.value })} placeholder="项目名称" /></div>
              <div><label style={HS}>担任角色</label><input className={IC} style={IS} value={r.role} onChange={e => updateProjectRow(i, { role: e.target.value })} placeholder="如：负责人" /></div>
              <div style={{ gridColumn: 'span 2' }}><label style={HS}>项目链接（选填）</label><input className={IC} style={IS} value={r.link} onChange={e => updateProjectRow(i, { link: e.target.value })} placeholder="https://..." /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div><label style={HS}>起始</label><MonthYearPicker value={r.start} onChange={val => updateProjectRow(i, { start: val })} /></div>
              <div><label style={HS}>结束（留空=至今）</label><MonthYearPicker value={r.end} onChange={val => updateProjectRow(i, { end: val })} allowEmpty /></div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <label style={HS}>项目描述</label>
                <AiPolishButton field="project_description" content={r.description} context={{ name: r.name, role: r.role }} onResult={v => updateProjectRow(i, { description: v })} />
              </div>
              <AutoTextarea className={TC} style={IS} rows={1} value={r.description} onChange={e => updateProjectRow(i, { description: e.target.value })} placeholder="项目背景、技术方案、解决的问题..." />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <label style={HS}>项目成果（选填）</label>
                <AiPolishButton field="project_achievements" content={r.achievements} context={{ name: r.name, role: r.role }} onResult={v => updateProjectRow(i, { achievements: v })} />
              </div>
              <AutoTextarea className={TC} style={IS} rows={1} value={r.achievements} onChange={e => updateProjectRow(i, { achievements: e.target.value })} placeholder="量化成果..." />
            </div>
            </div>{/* end padding wrapper */}
          </div>
        ))}
      </div>
      <button type="button" onClick={addProjectRow} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
        <Plus size={12} />新增一段项目经历
      </button>
    </div>
  )

  // 能力标签
  const currentTagsForCategory = jobTagCategory ? (JOB_TAGS_DATA.find(d => d.category === jobTagCategory)?.tags ?? []) : []
  const jobTagDropContent = (
    <div ref={jobTagPanelRef} style={{ display: 'flex', flexDirection: 'row', maxHeight: 340, overflow: 'hidden', borderRadius: 'var(--t-radius)', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: 'var(--t-shadow-elevated)' }}>
      <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid var(--t-border)', overflowY: 'auto', padding: '4px 0', background: 'var(--t-bg-panel)' }}>
        {JOB_TAGS_DATA.map(d => { const active = jobTagCategory === d.category; const hasSelected = d.tags.some(t => selectedJobTags.includes(t)); return (
          <div key={d.category} onMouseDown={e => { e.preventDefault(); setJobTagCategory(d.category) }}
            style={{ padding: '7px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, background: active ? 'var(--t-primary)' : 'transparent', color: active ? 'var(--t-primary-fg)' : 'var(--t-text-secondary)', fontWeight: active ? 600 : 400, borderLeft: active ? '3px solid var(--t-primary-hover)' : '3px solid transparent' }}>
            {hasSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: active ? 'var(--t-primary-fg)' : 'var(--t-primary)' }} />}
            <span style={{ flex: 1, lineHeight: 1.4 }}>{d.category}</span>
          </div>
        ) })}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--t-bg-elevated)' }}>
        <div ref={jobTagRightPanelRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {jobTagCategory === null
            ? <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center' }}>请先从左侧选择分类</div>
            : currentTagsForCategory.map(tag => { const checked = selectedJobTags.includes(tag); return (
                <div key={tag} data-tag={tag} onMouseDown={e => { e.preventDefault(); toggleJobTag(tag) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: checked ? 'var(--t-primary)' : 'var(--t-text)', background: checked ? 'var(--t-primary-muted)' : 'transparent' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: `1.5px solid ${checked ? 'var(--t-primary)' : 'var(--t-border)'}`, background: checked ? 'var(--t-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  {tag}
                </div>
              ) })
          }
        </div>
        <div style={{ padding: '5px 8px', borderTop: '1px solid var(--t-border-subtle)', display: 'flex', gap: 4, flexShrink: 0 }}>
          <input type="text" value={customJobTagInput} onChange={e => setCustomJobTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const tag = customJobTagInput.trim(); if (tag && !selectedJobTags.includes(tag)) setSelectedJobTags(prev => [...prev, tag]); setCustomJobTagInput('') } }} placeholder="自定义标签，回车添加" style={{ flex: 1, padding: '4px 7px', fontSize: 11, borderRadius: 3, border: '1px solid var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text)', outline: 'none', fontFamily: 'inherit' }} />
          <button type="button" onMouseDown={e => { e.preventDefault(); const tag = customJobTagInput.trim(); if (tag && !selectedJobTags.includes(tag)) setSelectedJobTags(prev => [...prev, tag]); setCustomJobTagInput('') }} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 3, whiteSpace: 'nowrap', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer' }}>添加</button>
        </div>
      </div>
    </div>
  )

  const sSkills = (
    <div ref={el => sectionRefs.current['skills'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="能力标签" aiHighlight={aiFilledSections.has('skills')} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* 岗位标签 */}
        <div ref={jobTagWrapRef} style={{ position: 'relative' }}>
          <label className={LC} style={LS}>岗位标签 *{selectedJobTags.length > 0 ? ` · 已选 ${selectedJobTags.length} 项` : ' · 请点击下方选择'}</label>
          <div style={{ position: 'relative' }} ref={jobTagTriggerRef}>
            <div onMouseDown={e => { e.preventDefault(); if (!jobTagOpen) openJobTagDrop(); setJobTagOpen(o => !o) }} style={multiTriggerStyle(jobTagOpen, selectedJobTags.length > 0)}>
              {selectedJobTags.length > 0 ? selectedJobTags.map(tag => <SelectedSkillTag key={tag} skill={tag} description={null} onMouseDown={e => { e.preventDefault(); e.stopPropagation(); const cat = JOB_TAGS_DATA.find(d => d.tags.includes(tag))?.category ?? null; if (cat) setJobTagCategory(cat); setJobTagScrollTarget(tag); if (!jobTagOpen) openJobTagDrop(); setJobTagOpen(true) }} />) : <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>从下拉框中选择岗位标签</span>}
            </div>
            <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', padding: 2, lineHeight: 0, pointerEvents: 'none', color: 'var(--t-text-muted)' }}>
              <ChevronDown size={11} style={{ transition: 'transform 150ms', transform: jobTagOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
          </div>
          {jobTagOpen && createPortal(<div style={{ position: 'fixed', top: jobTagDropPos.top, left: jobTagDropPos.left, width: jobTagDropPos.width, zIndex: 9999 }}>{jobTagDropContent}</div>, document.body)}
        </div>
        {/* 软技能 */}
        <div ref={softSkillWrapRef} style={{ position: 'relative' }}>
          <label className={LC} style={LS}>岗位所需软技能 *{selectedSoftSkills.length > 0 ? ` · 已选 ${selectedSoftSkills.length} 项` : ' · 请点击下方选择'}</label>
          <div style={{ position: 'relative' }} ref={softSkillTriggerRef}>
            <div onMouseDown={e => { e.preventDefault(); if (!softSkillOpen) openSoftSkillDrop(); setSoftSkillOpen(o => !o) }} style={multiTriggerStyle(softSkillOpen, selectedSoftSkills.length > 0)}>
              {selectedSoftSkills.length > 0 ? selectedSoftSkills.map(skill => <SelectedSkillTag key={skill} skill={skill} description={SOFT_SKILL_DESCRIPTIONS[skill]} />) : <span style={{ color: 'var(--t-text-muted)', fontSize: 12 }}>从下拉框中选择软技能标签</span>}
            </div>
            <div style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', padding: 2, lineHeight: 0, pointerEvents: 'none', color: 'var(--t-text-muted)' }}>
              <ChevronDown size={11} style={{ transition: 'transform 150ms', transform: softSkillOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </div>
          </div>
          {softSkillOpen && createPortal(
            <div ref={softSkillPanelRef} style={{ position: 'fixed', top: softSkillDropPos.top, left: softSkillDropPos.left, width: softSkillDropPos.width, zIndex: 9999, maxHeight: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 'var(--t-radius)', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: 'var(--t-shadow-elevated)' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>{ALL_SOFT_SKILLS.map(skill => <SoftSkillOption key={skill} skill={skill} description={SOFT_SKILL_DESCRIPTIONS[skill]} checked={selectedSoftSkills.includes(skill)} onToggle={toggleSoftSkill} />)}</div>
              <div style={{ padding: '5px 8px', borderTop: '1px solid var(--t-border-subtle)', display: 'flex', gap: 4, flexShrink: 0 }}>
                <input type="text" value={customSkillInput} onChange={e => setCustomSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const s = customSkillInput.trim(); if (s && !selectedSoftSkills.includes(s)) setSelectedSoftSkills(prev => [...prev, s]); setCustomSkillInput('') } }} placeholder="自定义技能，回车添加" style={{ flex: 1, padding: '4px 7px', fontSize: 11, borderRadius: 3, border: '1px solid var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text)', outline: 'none', fontFamily: 'inherit' }} />
                <button type="button" onMouseDown={e => { e.preventDefault(); const s = customSkillInput.trim(); if (s && !selectedSoftSkills.includes(s)) setSelectedSoftSkills(prev => [...prev, s]); setCustomSkillInput('') }} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 3, whiteSpace: 'nowrap', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer' }}>添加</button>
              </div>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  )

  // 教育与证书
  const eduYearOptions = [{ value: '', label: '年份' }, ...Array.from({ length: new Date().getFullYear() - 1980 + 1 }, (_, i) => { const y = String(new Date().getFullYear() - i); return { value: y, label: y } })]
  const sEducation = (
    <div ref={el => sectionRefs.current['education'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="教育与证书" aiHighlight={aiFilledSections.has('education')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
        <div><label className={LC} style={LS}>学历摘要</label><input className={IC} style={IS} value={education} onChange={e => setEducation(e.target.value)} placeholder="如：本科 · 国际贸易" /></div>
        <div><label className={LC} style={LS}>英语水平</label><input className={IC} style={IS} value={englishLevel} onChange={e => setEnglishLevel(e.target.value)} placeholder="如：CET-6 / 流利 / 一般" /></div>
        <div>
          <label className={LC} style={LS}>资格证书（{certsArr.length}）</label>
          <input className={IC} style={IS} value={certificatesText} onChange={e => setCertificatesText(e.target.value)} placeholder="报关员证、国际货代证..." />
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className={LC} style={{ ...LS, marginBottom: 0 }}>教育经历</label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {educationRows.map((r, i) => (
            <div key={i} style={{ borderRadius: 8, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--t-bg-panel)', borderBottom: '1px solid var(--t-border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>教育经历 #{i + 1}</span>
                <DeleteButton onClick={() => setEducationRows(rows => rows.filter((_, idx) => idx !== i))} />
              </div>
              <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
                <div><label style={HS}>院校 *</label><input className={IC} style={IS} value={r.school} onChange={e => setEducationRows(rows => rows.map((row, idx) => idx === i ? { ...row, school: e.target.value } : row))} placeholder="如：上海海事大学" /></div>
                <div><label style={HS}>专业</label><input className={IC} style={IS} value={r.major} onChange={e => setEducationRows(rows => rows.map((row, idx) => idx === i ? { ...row, major: e.target.value } : row))} placeholder="如：国际贸易" /></div>
                <div><label style={HS}>学历</label><TerminalSelect value={r.degree} onChange={val => setEducationRows(rows => rows.map((row, idx) => idx === i ? { ...row, degree: val } : row))} options={[{ value: '', label: '请选择' }, ...DEGREE_OPTIONS.map(d => ({ value: d, label: d }))]} placeholder="请选择" hasValue={!!r.degree} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div><label style={HS}>入学年份</label><TerminalSelect value={r.period_start} onChange={val => setEducationRows(rows => rows.map((row, idx) => idx === i ? { ...row, period_start: val } : row))} options={eduYearOptions} placeholder="年份" hasValue={!!r.period_start} /></div>
                <div><label style={HS}>毕业年份</label><TerminalSelect value={r.period_end} onChange={val => setEducationRows(rows => rows.map((row, idx) => idx === i ? { ...row, period_end: val } : row))} options={[{ value: '', label: '至今' }, ...Array.from({ length: new Date().getFullYear() + 6 - 1980 + 1 }, (_, i2) => { const y = String(new Date().getFullYear() + 6 - i2); return { value: y, label: y } })]} placeholder="至今" hasValue={!!r.period_end} /></div>
                <div><label style={HS}>就读类型</label><TerminalSelect value={r.enrollment_type} onChange={val => setEducationRows(rows => rows.map((row, idx) => idx === i ? { ...row, enrollment_type: val } : row))} options={[{ value: '', label: '未选' }, { value: '统招', label: '统招' }, { value: '非统招', label: '非统招（成考/自考/网教）' }]} placeholder="未选" hasValue={!!r.enrollment_type} /></div>
              </div>
              </div>{/* end padding wrapper */}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setEducationRows(rows => [...rows, { ...EMPTY_EDU }])} style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <Plus size={12} />新增一段教育经历
        </button>
      </div>

      {/* 语言能力 */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--t-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className={LC} style={{ ...LS, marginBottom: 0 }}>语言能力{languageRows.length > 0 ? ` · ${languageRows.length} 项` : '（选填）'}</label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {languageRows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input className={IC} style={IS} value={r.language} onChange={e => setLanguageRows(rows => rows.map((row, idx) => idx === i ? { ...row, language: e.target.value } : row))} placeholder="语言（如：英语、法语）" />
              <input className={IC} style={IS} value={r.proficiency_level} onChange={e => setLanguageRows(rows => rows.map((row, idx) => idx === i ? { ...row, proficiency_level: e.target.value } : row))} placeholder="熟练程度（如：商务洽谈、基础沟通）" />
              <DeleteButton onClick={() => setLanguageRows(rows => rows.filter((_, idx) => idx !== i))} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLanguageRows(rows => [...rows, { ...EMPTY_LANG }])} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <Plus size={12} />新增语言
        </button>
      </div>

      {/* 培训经历 */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--t-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className={LC} style={{ ...LS, marginBottom: 0 }}>培训经历{trainingRows.length > 0 ? ` · ${trainingRows.length} 条` : '（选填）'}</label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {trainingRows.map((r, i) => (
            <div key={i} style={{ borderRadius: 8, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', background: 'var(--t-bg-panel)', borderBottom: '1px solid var(--t-border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)' }}>培训经历 #{i + 1}</span>
                <DeleteButton onClick={() => setTrainingRows(rows => rows.filter((_, idx) => idx !== i))} />
              </div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ gridColumn: 'span 2' }}><label style={HS}>课程名称 *</label><input className={IC} style={IS} value={r.course_name} onChange={e => setTrainingRows(rows => rows.map((row, idx) => idx === i ? { ...row, course_name: e.target.value } : row))} placeholder="培训课程名称" /></div>
                <div><label style={HS}>培训机构</label><input className={IC} style={IS} value={r.institution} onChange={e => setTrainingRows(rows => rows.map((row, idx) => idx === i ? { ...row, institution: e.target.value } : row))} placeholder="如：清华大学、XX机构" /></div>
                <div><label style={HS}>培训地点</label><input className={IC} style={IS} value={r.location} onChange={e => setTrainingRows(rows => rows.map((row, idx) => idx === i ? { ...row, location: e.target.value } : row))} placeholder="如：上海" /></div>
                <div><label style={HS}>开始时间</label><MonthYearPicker value={r.start_date} onChange={val => setTrainingRows(rows => rows.map((row, idx) => idx === i ? { ...row, start_date: val } : row))} /></div>
                <div><label style={HS}>结束时间（留空=至今）</label><MonthYearPicker value={r.end_date} onChange={val => setTrainingRows(rows => rows.map((row, idx) => idx === i ? { ...row, end_date: val } : row))} allowEmpty /></div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setTrainingRows(rows => [...rows, { ...EMPTY_TRAINING }])} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <Plus size={12} />新增培训经历
        </button>
      </div>

      {/* 结构化证书 */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--t-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <label className={LC} style={{ ...LS, marginBottom: 0 }}>结构化证书{certificateEntries.length > 0 ? ` · ${certificateEntries.length} 个` : '（选填，含等级和日期）'}</label>
        </div>
        <p style={{ ...HS, marginBottom: 8 }}>与上方"资格证书"文本框并行，此处可补录证书等级和签发日期</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {certificateEntries.map((c, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input className={IC} style={IS} value={c.name} onChange={e => setCertificateEntries(rows => rows.map((row, idx) => idx === i ? { ...row, name: e.target.value } : row))} placeholder="证书名称" />
              <input className={IC} style={IS} value={c.level} onChange={e => setCertificateEntries(rows => rows.map((row, idx) => idx === i ? { ...row, level: e.target.value } : row))} placeholder="等级（如：一级）" />
              <div>
                <MonthYearPicker value={c.issue_date} onChange={val => setCertificateEntries(rows => rows.map((row, idx) => idx === i ? { ...row, issue_date: val } : row))} />
              </div>
              <DeleteButton onClick={() => setCertificateEntries(rows => rows.filter((_, idx) => idx !== i))} />
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setCertificateEntries(rows => [...rows, { ...EMPTY_CERT_ENTRY }])} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <Plus size={12} />新增证书
        </button>
      </div>
    </div>
  )

  // 期望职位
  const sSalary = (
    <div ref={el => sectionRefs.current['salary'] = el} style={{ marginBottom: 32 }}>
      <SectionHeader title="期望职位" aiHighlight={aiFilledSections.has('salary')} />
      {/* Row 1: 期望岗位 — full width */}
      <div ref={posWrapRef} style={{ position: 'relative', marginBottom: 10 }}>
        <label className={LC} style={LS}>期望岗位</label>
        <input className={IC} style={IS} value={desiredPosition} autoComplete="off" placeholder="如：海运操作主管、报关专员" onChange={e => { setDesiredPosition(e.target.value); if (e.target.value.trim()) openPosDrop(); else setPosSugOpen(false); setPosActiveIdx(-1) }} onFocus={() => { if (desiredPosition.trim()) openPosDrop() }} onKeyDown={handlePosKeyDown} />
        {posSugOpen && posSuggestions.length > 0 && createPortal(
          <ul style={{ position: 'fixed', top: posDropPos.top, left: posDropPos.left, width: posDropPos.width, zIndex: 9999, maxHeight: 220, overflowY: 'auto', borderRadius: 'var(--t-radius)', border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', boxShadow: 'var(--t-shadow-elevated)', padding: '4px 0', listStyle: 'none', margin: 0 }}>
            {posSuggestions.map((s, ii) => <li key={s} onMouseDown={e => { e.preventDefault(); setDesiredPosition(s); setPosSugOpen(false); setPosActiveIdx(-1) }} onMouseEnter={() => setPosActiveIdx(ii)} style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', color: ii === posActiveIdx ? 'var(--t-primary-fg)' : 'var(--t-text)', background: ii === posActiveIdx ? 'var(--t-primary)' : 'transparent' }}>{s}</li>)}
          </ul>,
          document.body
        )}
      </div>
      {/* Row 2: 期望薪资 range + 年包月数 */}
      <div>
        <div style={{ marginBottom: 3 }}>
          <label className={LC} style={{ ...LS, marginBottom: 0 }}>期望薪资（元/月）</label>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className={IC} style={{ ...IS, flex: 1 }} placeholder="最低" value={esMINFocused ? expectedSalaryMin.replace(/,/g, '') : formatThousand(expectedSalaryMin.replace(/,/g, ''))} onFocus={() => { setEsMinFocused(true); setExpectedSalaryMin(expectedSalaryMin.replace(/,/g, '')) }} onBlur={() => setEsMinFocused(false)} onChange={e => setExpectedSalaryMin(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
          <span style={{ color: 'var(--t-text-muted)', fontSize: 12, flexShrink: 0 }}>—</span>
          <input className={IC} style={{ ...IS, flex: 1 }} placeholder="最高" value={esMAXFocused ? expectedSalaryMax.replace(/,/g, '') : formatThousand(expectedSalaryMax.replace(/,/g, ''))} onFocus={() => { setEsMaxFocused(true); setExpectedSalaryMax(expectedSalaryMax.replace(/,/g, '')) }} onBlur={() => setEsMaxFocused(false)} onChange={e => setExpectedSalaryMax(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" />
          <div style={{ flexShrink: 0, width: 100 }}>
            <TerminalSelect value={expectedSalaryMonths} onChange={setExpectedSalaryMonths} options={[{ value: '', label: '年包薪' }, { value: '12', label: '×12薪' }, { value: '13', label: '×13薪' }, { value: '14', label: '×14薪' }, { value: '15', label: '×15薪' }, { value: '16', label: '×16薪' }]} placeholder="年包薪" hasValue={!!expectedSalaryMonths} />
          </div>
        </div>
      </div>

      {/* 多求职意向 */}
      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--t-border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label className={LC} style={{ ...LS, marginBottom: 0 }}>其他求职意向{desiredPositions.length > 0 ? ` · ${desiredPositions.length} 个` : '（选填，可添加多个平行意向）'}</label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {desiredPositions.map((d, i) => (
            <div key={i} style={{ borderRadius: 8, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', background: 'var(--t-bg-panel)', borderBottom: '1px solid var(--t-border-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--t-text-secondary)' }}>求职意向 #{i + 1}</span>
                <DeleteButton onClick={() => setDesiredPositions(rows => rows.filter((_, idx) => idx !== i))} />
              </div>
              <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <div style={{ gridColumn: 'span 2' }}><label style={HS}>期望岗位</label><input className={IC} style={IS} value={d.title} onChange={e => setDesiredPositions(rows => rows.map((row, idx) => idx === i ? { ...row, title: e.target.value } : row))} placeholder="如：招聘经理、HRBP" /></div>
                <div><label style={HS}>年包月数</label><TerminalSelect value={d.salary_months} onChange={val => setDesiredPositions(rows => rows.map((row, idx) => idx === i ? { ...row, salary_months: val } : row))} options={[{ value: '', label: '未填' }, { value: '12', label: '×12薪' }, { value: '13', label: '×13薪' }, { value: '14', label: '×14薪' }, { value: '15', label: '×15薪' }, { value: '16', label: '×16薪' }]} placeholder="未填" hasValue={!!d.salary_months} /></div>
                <div><label style={HS}>薪资最低（元）</label><input className={IC} style={IS} inputMode="numeric" value={d.salary_min} onChange={e => setDesiredPositions(rows => rows.map((row, idx) => idx === i ? { ...row, salary_min: e.target.value.replace(/\D/g, '') } : row))} placeholder="15,000" /></div>
                <div><label style={HS}>薪资最高（元）</label><input className={IC} style={IS} inputMode="numeric" value={d.salary_max} onChange={e => setDesiredPositions(rows => rows.map((row, idx) => idx === i ? { ...row, salary_max: e.target.value.replace(/\D/g, '') } : row))} placeholder="20,000" /></div>
                <div><label style={HS}>薪资周期</label><TerminalSelect value={d.salary_period} onChange={val => setDesiredPositions(rows => rows.map((row, idx) => idx === i ? { ...row, salary_period: val } : row))} options={[{ value: 'month', label: '/月' }, { value: 'year', label: '/年' }]} placeholder="/月" hasValue={true} /></div>
                <div style={{ gridColumn: 'span 3' }}><label style={HS}>目标行业（逗号分隔）</label><input className={IC} style={IS} value={d.industries} onChange={e => setDesiredPositions(rows => rows.map((row, idx) => idx === i ? { ...row, industries: e.target.value } : row))} placeholder="如：货运/物流/仓储，贸易/进出口" /></div>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setDesiredPositions(rows => [...rows, { ...EMPTY_DESIRED_POS }])} style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: '1px dashed var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          <Plus size={12} />新增求职意向
        </button>
      </div>
    </div>
  )


  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="terminal-mode" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', minWidth: 0, height: '100%', minHeight: 0, overflow: 'hidden', background: 'var(--t-bg)', color: 'var(--t-text)' }}>
      {/* Error banner */}
      {saveError && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderBottom: '1px solid var(--t-danger)', background: 'var(--t-danger-muted)', color: 'var(--t-danger)', fontSize: 12 }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />{saveError}
        </div>
      )}

      {/* AI prefill banner */}
      {aiFilledSections.size > 0 && !aiBannerDismissed && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 16px', borderBottom: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)', color: 'var(--t-primary)', fontSize: 12, lineHeight: 1.5 }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ flex: 1 }}>
            <strong>AI 已根据简历预填：</strong>
            {Array.from(aiFilledSections).map(id => SECTIONS.find(s => s.id === id)?.label).filter(Boolean).join('、')}
            。请确认内容并补充<strong>手机号、邮箱、当前住址</strong>等必填信息。
          </span>
          <button type="button" onClick={() => setAiBannerDismissed(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-primary)', padding: 2, flexShrink: 0, lineHeight: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Body: sidebar + content */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left sidebar nav */}
        <div style={{ width: 180, flexShrink: 0, borderRight: '1px solid var(--t-border-subtle)', overflowY: 'auto', padding: '16px 0', background: 'var(--t-bg-panel)' }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--t-text-muted)', padding: '0 16px 10px' }}>SECTIONS</p>
          {SECTIONS.filter(s => s.id !== 'current-position' || availability !== 'open').map(s => (
            <SidebarNavItem key={s.id} label={s.label} active={activeSection === s.id} onClick={() => scrollToSection(s.id)} />
          ))}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          <div style={{ maxWidth: 840, margin: '0 auto' }}>
            {sBasicInfo}
            {sPersonalAdvantages}
            {availability !== 'open' && sCurrentPosition}
            {sSalary}
            {sWorkExp}
            {sProjectExp}
            {sSkills}
            {sEducation}
            <div style={{ height: 280 }} />
          </div>
        </div>
      </div>

      {/* Latest prompt modal */}
      {showLatestPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
          <div style={{ width: '100%', maxWidth: 440, borderRadius: 'var(--t-radius-lg)', border: '1px solid var(--t-border)', background: 'var(--t-bg-panel)', padding: 20, boxShadow: 'var(--t-shadow-elevated)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircle size={18} style={{ color: 'var(--t-primary)', flexShrink: 0 }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text)' }}>是否为最新简历</h2>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--t-text-secondary)', marginBottom: 16 }}>档案内容已保存。确认后会刷新简历更新时间，并影响企业端的简历鲜度排序。</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" onClick={() => setShowLatestPrompt(false)} disabled={confirmingLatest} style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontSize: 13, cursor: 'pointer' }}>否，继续修改</button>
              <button type="button" onClick={handleConfirmLatest} disabled={confirmingLatest} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: 'var(--t-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {confirmingLatest && <Loader2 size={13} className="animate-spin" />}是，设为最新简历
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
