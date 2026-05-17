import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown, Briefcase, Mail, FileText, DollarSign, Sparkles, Bookmark, X } from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { Button } from '../../components/ui/Button'
import { jobsApi } from '../../api/jobs'
import { analyzeJob } from '../../api/aiAnalyze'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { TerminalSelect } from '../../components/terminal/TerminalSelect'
import RegionSelector from '../../components/RegionSelector'
import { useAuth } from '../../context/AuthContext'
import { SOFT_SKILL_MAP, ALL_SOFT_SKILLS, SOFT_SKILL_DESCRIPTIONS } from '../../data/softSkillsLookup'
import { JOB_TITLE_SUGGESTIONS } from '../../data/jobTitleSuggestions'
import { JOB_TAGS_DATA } from '../../data/jobTagsData'

// ─── Auto-resize textarea hook ─────────────────────────────────────────────────
function useAutoResize(value) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return ref
}

// ─── Constants ─────────────────────────────────────────────────────────────────


const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

const SALARY_MONTHS_OPTIONS = [12, 13, 14]
const EXPERIENCE_YEAR_OPTIONS = ['不限', '1年以内', '1-3年', '3-5年', '5-10年', '10年以上']
const DEGREE_REQUIRED_OPTIONS = ['不限', '初中及以下', '高中', '大专', '本科', '硕士', '博士']
const EMPLOYMENT_TYPE_OPTIONS = ['全职', '兼职', '实习生']

const JOB_LEVEL_OPTIONS = ['高管层', '总监级', '高级经理级', '经理级', '主管级', '专员级', '助理岗']

const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly', label: '月度' },
  { value: 'quarterly', label: '季度' },
  { value: 'semi_annual', label: '半年度' },
]

const BENEFIT_OPTIONS = [
  '五险一金','带薪年假','法定节假日','节日福利','生日福利',
  '年度体检','团建旅游','商业保险','股权激励','期权激励',
  '弹性上下班','晚班交通补贴','高温补贴',
]

const YEAR_END_BONUS_QUICK = [
  { value: 1, label: '1个月' },
  { value: 2, label: '2个月' },
  { value: 3, label: '3个月' },
  { value: 'custom', label: '自行填数' },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function splitTokens(str) {
  if (!str) return []
  const parts = String(str)
    .split(/[,，、\n\r;；]+/)
    .map(s => s.trim())
    .filter(Boolean)
  const seen = new Set()
  const out = []
  for (const p of parts) {
    if (!seen.has(p)) {
      seen.add(p)
      out.push(p)
    }
  }
  return out
}

function mergeUnique(...arrays) {
  const seen = new Set()
  const out = []
  for (const arr of arrays) {
    if (!arr) continue
    for (const t of arr) {
      if (!t) continue
      if (!seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
  }
  return out
}

function formatThousand(val) {
  if (!val) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

function getTerminalPortalTarget(node) {
  return node?.closest?.('.terminal-shell') || document.body
}

// ─── TemplatePickerModal ───────────────────────────────────────────────────────

function TemplatePickerModal({ open, terminal, onClose, onSelect }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(null)
  const [hovId, setHovId] = useState(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setErr(null)
    jobsApi.getTemplates()
      .then(r => setList(r.data.jobs || []))
      .catch(() => setErr('加载失败，请重试'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  // Modal 挂载到 document.body（portal），CSS token 在此无效，必须用 hardcoded 值
  const T = {
    bg:          '#111720',
    bgHover:     '#1e2e48',
    border:      '1px solid #2c4060',
    text:        '#e2e8f0',
    textSec:     '#a8bbd0',
    primary:     '#3b82f6',
    err:         '#f87171',
    radius:      '10px',
    radiusSm:    '4px',
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998 }
  const modalStyle = terminal ? {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    zIndex: 9999, width: 'clamp(320px,46vw,480px)', maxHeight: '60vh',
    display: 'flex', flexDirection: 'column',
    background: T.bg, border: T.border, borderRadius: T.radius, overflow: 'hidden',
  } : {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
    zIndex: 9999, width: 'clamp(320px,46vw,480px)', maxHeight: '60vh',
    display: 'flex', flexDirection: 'column',
    background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  }

  const dividerStyle = terminal ? { borderBottom: T.border } : { borderBottom: '1px solid #e5e7eb' }
  const titleColor   = terminal ? T.text    : '#111'
  const closeColor   = terminal ? T.textSec : '#6b7280'
  const bodyColor    = terminal ? T.textSec : '#9ca3af'
  const errColor     = terminal ? T.err     : '#ef4444'
  const emptyColor   = terminal ? T.textSec : '#9ca3af'

  return createPortal(
    <>
      <div style={overlayStyle} onClick={onClose} />
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', ...dividerStyle }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: titleColor }}>选择模板岗位</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: closeColor, display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 24, color: bodyColor }}>
              <Loader2 size={20} className="animate-spin" style={{ display: 'inline-block' }} />
            </div>
          )}
          {err && (
            <div style={{ textAlign: 'center', padding: 24, color: errColor, fontSize: 12 }}>{err}</div>
          )}
          {!loading && !err && list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: emptyColor, fontSize: 12 }}>
              暂无模板 — 在岗位广场中点击「设为模板」可保存
            </div>
          )}
          {!loading && !err && list.map(job => {
            const subtitle = [job.function_name, job.location_path, job.salary_label].filter(Boolean).join(' · ')
            const isHov = hovId === job.id
            return (
              <div
                key={job.id}
                onMouseEnter={() => setHovId(job.id)}
                onMouseLeave={() => setHovId(null)}
                onClick={() => onSelect(job)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '10px 8px',
                  borderRadius: terminal ? T.radiusSm : 8,
                  cursor: 'pointer', marginBottom: 4,
                  background: isHov ? (terminal ? T.bgHover : '#f3f4f6') : 'transparent',
                  transition: 'background 120ms ease-out',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: terminal ? T.text : '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {job.title}
                  </div>
                  {subtitle && (
                    <div style={{ fontSize: 11, color: terminal ? T.textSec : '#6b7280', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {subtitle}
                    </div>
                  )}
                </div>
                <Bookmark size={14} style={{ flexShrink: 0, color: terminal ? T.primary : '#f59e0b' }} />
              </div>
            )
          })}
        </div>

        <div style={{ padding: '10px 16px', textAlign: 'right', ...(terminal ? { borderTop: T.border } : { borderTop: '1px solid #e5e7eb' }) }}>
          <button
            onClick={onClose}
            style={{
              fontSize: 12, padding: '5px 12px',
              borderRadius: terminal ? T.radiusSm : 6,
              border: terminal ? T.border : '1px solid #d1d5db',
              background: 'none', cursor: 'pointer',
              color: terminal ? T.textSec : '#374151',
            }}
          >
            取消
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── SoftSkillOption ───────────────────────────────────────────────────────────

function SoftSkillOption({ skill, description, checked, terminal, onToggle }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const rowRef = useRef(null)

  const bg = checked
    ? (terminal ? 'var(--t-primary-muted)' : '#eff6ff')
    : hovered
      ? (terminal ? 'var(--t-bg-elevated)' : '#f8fafc')
      : 'transparent'

  function handleMouseEnter() {
    setHovered(true)
    if (!description || !rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    setTooltipStyle({ top: rect.top + rect.height / 2, left: rect.right + 10 })
  }

  return (
    <div
      ref={rowRef}
      onMouseDown={(e) => { e.preventDefault(); onToggle(skill) }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setTooltipStyle(null) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', cursor: 'pointer', fontSize: 13,
        background: bg,
        color: terminal ? 'var(--t-text)' : '#1e293b',
      }}
    >
      <div style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        border: `1.5px solid ${checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : (terminal ? 'var(--t-border)' : '#cbd5e1')}`,
        background: checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      {skill}
      {tooltipStyle && description && createPortal(
        <div style={{
          position: 'fixed',
          top: tooltipStyle.top,
          left: tooltipStyle.left,
          transform: 'translateY(-50%)',
          zIndex: 10000,
          maxWidth: 220,
          padding: '6px 10px',
          borderRadius: 6,
          fontSize: 12,
          lineHeight: 1.6,
          background: terminal ? 'var(--t-bg-elevated)' : '#1e293b',
          border: terminal ? '1px solid var(--t-border)' : 'none',
          color: terminal ? 'var(--t-text)' : '#f1f5f9',
          boxShadow: terminal ? 'var(--t-shadow-elevated)' : '0 4px 12px rgba(0,0,0,0.25)',
          pointerEvents: 'none',
          whiteSpace: 'normal',
        }}>
          {description}
        </div>,
        getTerminalPortalTarget(rowRef.current)
      )}
    </div>
  )
}

// ─── SelectedSkillTag ──────────────────────────────────────────────────────────

function SelectedSkillTag({ skill, description, terminal }) {
  const [tooltipStyle, setTooltipStyle] = useState(null)
  const tagRef = useRef(null)

  function handleMouseEnter() {
    if (!description || !tagRef.current) return
    const rect = tagRef.current.getBoundingClientRect()
    setTooltipStyle({
      left: rect.left + rect.width / 2,
      bottom: window.innerHeight - rect.top + 8,
    })
  }

  return (
    <span
      ref={tagRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipStyle(null)}
      style={{
        display: 'inline-flex', alignItems: 'center',
        fontSize: 11, lineHeight: '1.4',
        padding: '2px 7px',
        borderRadius: 4,
        background: terminal ? 'var(--t-chip-selected-bg)' : '#eff6ff',
        color: terminal ? 'var(--t-text)' : '#2563eb',
        border: `1px solid ${terminal ? 'var(--t-chip-selected-border)' : '#bfdbfe'}`,
        whiteSpace: 'nowrap',
        cursor: 'default',
      }}
    >
      {skill}
      {tooltipStyle && description && createPortal(
        <div style={{
          position: 'fixed',
          left: tooltipStyle.left,
          bottom: tooltipStyle.bottom,
          transform: 'translateX(-50%)',
          zIndex: 10000,
          maxWidth: 240,
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid rgba(30,45,64,0.9)',
          background: 'rgba(11,14,19,0.96)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          <p style={{ fontSize: 11, color: 'rgba(148,163,184,0.9)', marginBottom: 3, whiteSpace: 'nowrap' }}>
            {skill}
          </p>
          <p style={{ fontSize: 13, color: '#f1f5f9', lineHeight: 1.5, whiteSpace: 'normal' }}>
            {description}
          </p>
        </div>,
        getTerminalPortalTarget(tagRef.current)
      )}
    </span>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const STEP_FORM    = 0
const STEP_SUCCESS = 2

export default function PostJob({ terminal = false, mode = 'create' }) {
  const navigate = useNavigate()
  const { jobId } = useParams()
  const { user } = useAuth()
  const isEdit = mode === 'edit'
  const [step, setStep]               = useState(STEP_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [, setCreatedJobId]           = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [loadingJob, setLoadingJob]   = useState(isEdit)

  // ── Form state ────────────────────────────────────────────────────────────
  const [title, setTitle]                     = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [degreeRequired, setDegreeRequired]   = useState('')

  const [functionCode, setFunctionCode]       = useState('')

  const [isManagementRole, setIsManagementRole] = useState('')
  const [managementHeadcount, setManagementHeadcount] = useState('')
  const [jobLevel, setJobLevel] = useState('')

  const [location, setLocation]               = useState(null)
  const [addressDetail, setAddressDetail]     = useState('')
  const [employmentType, setEmploymentType]   = useState('')

  const [selectedJobTags, setSelectedJobTags]   = useState([])
  const [jobTagCategory, setJobTagCategory]     = useState(null)
  const [jobTagOpen, setJobTagOpen]             = useState(false)
  const [jobTagDropPos, setJobTagDropPos]       = useState({ top: 0, left: 0, width: 0 })
  const jobTagWrapRef    = useRef(null)
  const jobTagTriggerRef = useRef(null)
  const jobTagPanelRef   = useRef(null)
  const [softSkillDropPos, setSoftSkillDropPos] = useState({ top: 0, left: 0, width: 0 })
  const softSkillTriggerRef = useRef(null)
  const [selectedSoftSkills, setSelectedSoftSkills] = useState([])
  const [softSkillOpen, setSoftSkillOpen]       = useState(false)
  const [softSkillMatchedList, setSoftSkillMatchedList] = useState([])
  const softSkillWrapRef = useRef(null)

  const [salaryMin,    setSalaryMin]          = useState('')
  const [salaryMax,    setSalaryMax]          = useState('')
  const [salaryMonths, setSalaryMonths]       = useState(13)

  const [salaryMinFocused, setSalaryMinFocused] = useState(false)
  const [salaryMaxFocused, setSalaryMaxFocused] = useState(false)

  const [commissionBonusPeriod, setCommissionBonusPeriod] = useState('not_applicable')
  const [commissionBonusAmount, setCommissionBonusAmount] = useState('')
  const [commissionAmountFocused, setCommissionAmountFocused] = useState(false)

  const [hasYearEndBonus,     setHasYearEndBonus]    = useState('')
  const [yearEndBonusQuickSelect, setYearEndBonusQuickSelect] = useState(null)
  const [yearEndBonusCustom, setYearEndBonusCustom]  = useState('')
  const [selectedBenefits, setSelectedBenefits]  = useState([])
  const [benefitDropOpen, setBenefitDropOpen]   = useState(false)
  const [benefitDropPos, setBenefitDropPos]     = useState({ top: 0, left: 0, width: 0 })
  const benefitTriggerRef = useRef(null)
  const benefitWrapRef    = useRef(null)
  const benefitPanelRef   = useRef(null)

  const [description,  setDescription]  = useState('')

  // ── AI 分析状态 ───────────────────────────────────────────────────────────
  const [aiLoading,   setAiLoading]   = useState(false)
  const [aiError,     setAiError]     = useState('')
  const [aiFieldHint, setAiFieldHint] = useState(false)
  const [aiButtonHovered, setAiButtonHovered] = useState(false)

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [tplHovered, setTplHovered] = useState(false)

  // ── Auto-resize refs ──────────────────────────────────────────────────────
  const descRef      = useAutoResize(description)

  // ── Load job for edit mode ────────────────────────────────────────────────
  useEffect(() => {
    if (!isEdit || !jobId) return
    let cancelled = false
    setLoadingJob(true)
    jobsApi.getJobById(jobId)
      .then(res => {
        if (cancelled) return
        const j = res.data.job
        setTitle(j.title || '')
        setExperienceYears(j.experience_required || '')
        setDegreeRequired(j.degree_required || '')
        setFunctionCode(j.function_code || '')
        setIsManagementRole(j.is_management_role == null ? '' : String(j.is_management_role))
        setManagementHeadcount(j.management_headcount != null ? String(j.management_headcount) : '')
        setJobLevel(j.job_level || '')
        if (j.location_code) {
          setLocation({
            location_code: j.location_code,
            location_name: j.location_name || '',
            location_path: j.location_path || '',
            location_type: j.location_type || '',
          })
        }
        setAddressDetail(j.address || '')
        setEmploymentType(j.employment_type || '')
        setSelectedJobTags([
          ...(j.knowledge_requirements || []),
          ...(j.hard_skill_requirements || []),
        ])
        setSelectedSoftSkills(j.soft_skill_requirements || [])
        setSalaryMin(j.salary_min != null ? String(j.salary_min) : '')
        setSalaryMax(j.salary_max != null ? String(j.salary_max) : '')
        setSalaryMonths(j.salary_months ?? 13)
        setCommissionBonusPeriod(j.commission_bonus_period || 'not_applicable')
        setCommissionBonusAmount(j.commission_bonus_amount != null ? String(j.commission_bonus_amount) : '')
        setHasYearEndBonus(j.has_year_end_bonus == null ? '' : String(j.has_year_end_bonus))
        if (j.has_year_end_bonus && j.year_end_bonus_months != null) {
          const m = j.year_end_bonus_months
          if ([1, 2, 3].includes(m)) {
            setYearEndBonusQuickSelect(m)
          } else {
            setYearEndBonusQuickSelect('custom')
            setYearEndBonusCustom(String(m))
          }
        }
        setDescription(j.description || '')
        setSelectedBenefits(j.benefits || [])
      })
      .catch(() => {
        if (!cancelled) setSubmitError('加载岗位失败，请刷新重试')
      })
      .finally(() => { if (!cancelled) setLoadingJob(false) })
    return () => { cancelled = true }
  }, [isEdit, jobId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────
  const jobTagArr  = selectedJobTags
  const softSkillArr = selectedSoftSkills

  const selectedFunction = FUNCTION_OPTIONS.find(f => f.key === functionCode) || null

  // AI 分析触发条件：岗位名 + 板块 + 城市三项已填
  const canAiAnalyze = !!(title.trim() && functionCode && location?.location_code)

  async function handleAiAnalyze() {
    if (!title.trim() || !functionCode || !location?.location_code) {
      setAiFieldHint(true)
      setTimeout(() => setAiFieldHint(false), 3000)
      return
    }
    setAiError('')
    const hasExisting = description.trim() || selectedJobTags.length > 0 || selectedSoftSkills.length > 0
    if (hasExisting) {
      const ok = window.confirm('AI 将覆盖已填写的岗位职责、岗位标签和软技能，确认继续？')
      if (!ok) return
    }
    setAiLoading(true)
    try {
      const result = await analyzeJob({
        title: title.trim(),
        function_code: functionCode,
        location_name: location?.location_name || '',
        experience_required: experienceYears || null,
        degree_required: degreeRequired || null,
        employment_type: employmentType || null,
        is_management_role: isManagementRole === 'true' ? true : isManagementRole === 'false' ? false : null,
        management_headcount: isManagementRole === 'true' && managementHeadcount ? Number(managementHeadcount) : null,
        job_level: jobLevel || null,
        salary_min: salaryMin ? Number(salaryMin) : null,
        salary_max: salaryMax ? Number(salaryMax) : null,
      })
      if (result.description) setDescription(result.description)
      if (result.job_tags?.length)   setSelectedJobTags(result.job_tags)
      if (result.soft_skills?.length) setSelectedSoftSkills(result.soft_skills)
    } catch (e) {
      setAiError(e?.response?.data?.detail || 'AI 分析失败，请稍后重试')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Apply Template ────────────────────────────────────────────────────────
  function applyTemplate(job) {
    setTitle(job.title || '')
    setExperienceYears(job.experience_required || '')
    setDegreeRequired(job.degree_required || '')
    setFunctionCode(job.function_code || '')
    setIsManagementRole(job.is_management_role == null ? '' : String(job.is_management_role))
    setManagementHeadcount(job.management_headcount != null ? String(job.management_headcount) : '')
    setJobLevel(job.job_level || '')
    if (job.location_code) {
      setLocation({
        location_code: job.location_code,
        location_name: job.location_name || '',
        location_path: job.location_path || '',
        location_type: job.location_type || '',
      })
    }
    setAddressDetail(job.address || '')
    setEmploymentType(job.employment_type || '')
    setSelectedJobTags([...(job.knowledge_requirements || []), ...(job.hard_skill_requirements || [])])
    setSelectedSoftSkills(job.soft_skill_requirements || [])
    setSalaryMin(job.salary_min != null ? String(job.salary_min) : '')
    setSalaryMax(job.salary_max != null ? String(job.salary_max) : '')
    setSalaryMonths(job.salary_months ?? 13)
    setCommissionBonusPeriod(job.commission_bonus_period || 'not_applicable')
    setCommissionBonusAmount(job.commission_bonus_amount != null ? String(job.commission_bonus_amount) : '')
    setHasYearEndBonus(job.has_year_end_bonus == null ? '' : String(job.has_year_end_bonus))
    const m = job.year_end_bonus_months
    if (job.has_year_end_bonus && m != null) {
      if ([1, 2, 3].includes(m)) {
        setYearEndBonusQuickSelect(m)
        setYearEndBonusCustom('')
      } else {
        setYearEndBonusQuickSelect('custom')
        setYearEndBonusCustom(String(m))
      }
    } else {
      setYearEndBonusQuickSelect(null)
      setYearEndBonusCustom('')
    }
    setSelectedBenefits(job.benefits || [])
    setDescription(job.description || '')
    setSubmitError('')
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    if (!title.trim())                return '请填写岗位名称'
    if (!selectedFunction)            return '请选择板块'
    if (isManagementRole !== 'true' && isManagementRole !== 'false') return '请选择该岗位是否带团队'
    if (isManagementRole === 'true') {
      if (!managementHeadcount.trim()) return '请填写预计团队人数'
      if (!/^\d+$/.test(managementHeadcount.trim())) return '预计团队人数必须为纯数字'
      if (Number(managementHeadcount) <= 0) return '预计团队人数必须大于 0'
    }
    if (!location || !location.location_code) return '请选择地区'
    if (!location.location_name || !location.location_path || !location.location_type) {
      return '地区数据不完整，请重新选择'
    }
    if (!employmentType) return '请选择应聘类型'
    if (addressDetail.trim().length > 200) return '详细地址不能超过 200 个字符'

    if (!description.trim())         return '请填写岗位职责'

    if (experienceYears === '')      return '请选择经验要求'
    if (!degreeRequired.trim())      return '请填写最低学历要求'
    if (jobTagArr.length === 0)      return '请选择至少一个岗位标签'
    if (softSkillArr.length === 0)   return '请填写软技能要求'

    const sMin = Number(salaryMin)
    const sMax = Number(salaryMax)
    if (!Number.isFinite(sMin) || !Number.isFinite(sMax) || sMin <= 0 || sMax <= 0) {
      return '请填写有效的薪资区间（数字）'
    }
    if (sMin > sMax) return '最低月薪不能大于最高月薪'

    const sm = Number(salaryMonths)
    if (![12, 13, 14].includes(sm)) return 'salary_months 只能是 12 / 13 / 14'

    // Commission bonus validation
    if (commissionBonusPeriod !== 'not_applicable') {
      if (!commissionBonusAmount.trim()) return '请填写提成/计件奖金预估平均额'
      const ca = Number(commissionBonusAmount)
      if (!Number.isFinite(ca) || ca <= 0) return '预估平均额必须为有效数字'
    }
    if (commissionBonusPeriod === 'not_applicable' && commissionBonusAmount.trim()) {
      return '请先选择提成/计件奖金周期，再填写预估平均额'
    }

    if (hasYearEndBonus !== 'true' && hasYearEndBonus !== 'false') return '请选择是否有年终奖'
    if (hasYearEndBonus === 'true') {
      if (yearEndBonusQuickSelect === null) return '请选择年终奖预估平均额'
      if (yearEndBonusQuickSelect === 'custom') {
        const yb = Number(yearEndBonusCustom)
        if (!Number.isFinite(yb) || yb <= 0 || yb > 24) return '年终奖月数必须在 0-24 之间'
      }
    }

    return null
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handlePublish() {
    setSubmitError('')
    const err = validate()
    if (err) { setSubmitError(err); return }

    const sMin = Number(salaryMin)
    const sMax = Number(salaryMax)
    const sm   = Number(salaryMonths)

    const yearEndBonusMonthsVal =
      hasYearEndBonus === 'true'
        ? (yearEndBonusQuickSelect === 'custom'
            ? Number(yearEndBonusCustom)
            : yearEndBonusQuickSelect)
        : null

    const payload = {
      title: title.trim(),
      experience_required: experienceYears,
      degree_required:     degreeRequired.trim(),

      function_code: selectedFunction.key,
      function_name: selectedFunction.label,
      business_type: selectedFunction.label,

      is_management_role: isManagementRole === 'true',
      management_headcount:
        isManagementRole === 'true' ? Number(managementHeadcount.trim()) : null,
      job_type: isManagementRole === 'true' ? '管理' : '非管理',
      job_level: jobLevel || null,

      location_code: location.location_code,
      location_name: location.location_name,
      location_path: location.location_path,
      location_type: location.location_type,
      address: addressDetail.trim() || null,
      employment_type: employmentType,

      skill_tags: mergeUnique(jobTagArr, softSkillArr),
      knowledge_requirements:  jobTagArr,
      hard_skill_requirements: [],
      soft_skill_requirements: softSkillArr,

      salary_min: sMin,
      salary_max: sMax,
      salary_months: sm,
      salary_label: `${sMin}-${sMax} × ${sm}`,

      average_bonus_percent: null,
      commission_bonus_period: commissionBonusPeriod,
      commission_bonus_amount:
        commissionBonusPeriod !== 'not_applicable' ? Number(commissionBonusAmount) : null,

      has_year_end_bonus: hasYearEndBonus === 'true',
      year_end_bonus_months: yearEndBonusMonthsVal,
      benefits: selectedBenefits,

      description:  description.trim(),

      status: 'published',
    }

    setSubmitting(true)
    try {
      if (isEdit) {
        await jobsApi.updateJob(jobId, payload)
        navigate('/employer/jobs')
      } else {
        const res = await jobsApi.createJob(payload)
        const job = res?.data?.job
        setCreatedJobId(job?.id ?? null)
        setStep(STEP_SUCCESS)
        setShowEmailModal(true)
      }
    } catch (err) {
      console.error('Failed to save job:', {
        status: err.response?.status,
        data: err.response?.data,
        code: err.code,
        message: err.message,
      })
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.message ||
        (isEdit ? '保存失败，请稍后重试' : '发布失败，请稍后重试')
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Style helpers (terminal vs light) ─────────────────────────────────────

  const labelClass = terminal
    ? 'block terminal-field-label-cn mb-1'
    : 'block text-sm font-medium text-slate-700 mb-1'
  const labelStyle = terminal ? {} : undefined

  const helperClass = terminal ? 'mt-1 text-xs' : 'mt-1 text-xs text-slate-400'
  const helperStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  const inputClass = terminal
    ? 'w-full px-3 py-2 rounded border text-sm focus:outline-none'
    : 'w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', color: 'var(--t-text)', borderColor: 'var(--t-border)', height: 30 }
    : undefined

  const textareaClass = inputClass + ' resize-none'
  const textareaStyle = terminal
    ? { background: 'var(--t-bg-input)', color: 'var(--t-text)', borderColor: 'var(--t-border)' }
    : undefined

  const cardClass = terminal
    ? 'p-4 space-y-3 rounded-[var(--t-radius-lg)] border flex flex-col min-h-0'
    : 'card p-5 space-y-4'
  const cardStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    : undefined

  const sectionTitleClass = terminal
    ? 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] mb-1'
    : 'flex items-center gap-2 text-sm font-semibold text-slate-800 mb-2.5'
  const sectionTitleStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  // ── Chip style helper (for year-end bonus quick select) ───────────────────
  function chipStyle(active) {
    if (!terminal) {
      return {
        className: `px-3 py-1.5 rounded-lg text-sm border transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
          active
            ? 'bg-blue-600 text-white border-blue-600'
            : 'border-slate-200 text-slate-600 hover:border-blue-300'
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

  // ── Multi-select trigger style (job tags / soft skills / benefits) ────────
  // Matches TerminalSelect visually: same border token, same open-state highlight,
  // same min-height so single-row state aligns with TerminalSelect (height:30).
  function multiTriggerStyle(isOpen, hasItems) {
    if (!terminal) return {
      minHeight: '2.375rem',
      paddingRight: '1.75rem',
      paddingTop: hasItems ? 6 : undefined,
      paddingBottom: hasItems ? 6 : undefined,
      cursor: 'pointer',
      userSelect: 'none',
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      alignItems: 'center',
    }
    return {
      background: 'var(--t-bg-input)',
      color: 'var(--t-text)',
      border: `1px solid ${isOpen ? 'var(--t-border-focus)' : 'var(--t-border)'}`,
      borderRadius: 'var(--t-radius-sm)',
      minHeight: 30,
      paddingLeft: 8,
      paddingRight: 28,
      paddingTop: hasItems ? 4 : 0,
      paddingBottom: hasItems ? 4 : 0,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      alignItems: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      fontSize: 12,
      transition: 'border-color 120ms',
    }
  }

  // ── Disabled input style ──────────────────────────────────────────────────
  const disabledInputStyle = terminal
    ? { ...inputStyle, cursor: 'not-allowed' }
    : undefined
  const disabledInputClass = terminal
    ? inputClass + ' cursor-not-allowed'
    : inputClass + ' cursor-not-allowed'

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === STEP_SUCCESS) {
    return (
      <>
        <div
          className={
            terminal
              ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center px-6'
              : 'max-w-lg mx-auto px-6 py-24 text-center'
          }
          style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
        >
          <div className={terminal ? 'mx-auto w-full max-w-lg text-center' : ''}>
            <div
              className={
                terminal
                  ? 'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border'
                  : 'w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4'
              }
              style={
                terminal
                  ? { background: 'var(--t-success-muted)', borderColor: 'var(--t-success)' }
                  : undefined
              }
            >
              <CheckCircle
                size={32}
                className={terminal ? '' : 'text-emerald-500'}
                style={terminal ? { color: 'var(--t-success)' } : undefined}
              />
            </div>
            <h2
              className={terminal ? 'text-2xl font-bold mb-2' : 'text-2xl font-bold text-slate-800 mb-2'}
              style={terminal ? { color: 'var(--t-text)' } : undefined}
            >
              岗位已发布！
            </h2>
            <p
              className={terminal ? 'mb-1' : 'text-slate-500 mb-1'}
              style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
            >
              候选人匹配将持续进行
            </p>
          </div>
        </div>

        {/* ── Email notification modal ────────────────────────────────── */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={() => { setShowEmailModal(false); navigate('/employer/jobs') }}
            />
            <div
              className={
                terminal
                  ? 'relative w-full max-w-sm rounded-[var(--t-radius-lg)] border p-6 z-10'
                  : 'relative w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 z-10'
              }
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)', color: 'var(--t-text)' } : undefined}
            >
              <div
                className={
                  terminal
                    ? 'w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-4 border'
                    : 'w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4'
                }
                style={terminal ? { background: 'var(--t-primary-muted)', borderColor: 'var(--t-primary)' } : undefined}
              >
                <Mail
                  size={20}
                  className={terminal ? '' : 'text-blue-500'}
                  style={terminal ? { color: 'var(--t-primary)' } : undefined}
                />
              </div>

              <h3
                className={terminal ? 'text-base font-semibold text-center mb-2' : 'text-base font-semibold text-slate-800 text-center mb-2'}
                style={terminal ? { color: 'var(--t-text)' } : undefined}
              >
                简历接收通知
              </h3>

              <p
                className={terminal ? 'text-sm text-center mb-1' : 'text-sm text-slate-500 text-center mb-1'}
                style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
              >
                候选人简历将发送至
              </p>
              <p
                className={terminal ? 'text-sm font-semibold text-center mb-4 break-all' : 'text-sm font-semibold text-blue-600 text-center mb-4 break-all'}
                style={terminal ? { color: 'var(--t-primary)' } : undefined}
              >
                {user?.email ?? '（未知邮箱）'}
              </p>

              <p
                className={terminal ? 'text-xs text-center mb-5' : 'text-xs text-slate-400 text-center mb-5'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                如需更改邮箱，请前往
                <button
                  type="button"
                  className={terminal ? 'underline mx-1' : 'underline text-blue-500 mx-1'}
                  style={terminal ? { color: 'var(--t-primary)' } : undefined}
                  onClick={() => navigate('/employer/settings')}
                >
                  个人中心
                </button>
                修改
              </p>

              <Button
                terminal={terminal}
                className="w-full"
                onClick={() => { setShowEmailModal(false); navigate('/employer/jobs') }}
              >
                我知道了
              </Button>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Computed display values for salary (thousand separator) ───────────────
  const salaryMinDisplay = salaryMinFocused ? salaryMin : formatThousand(salaryMin)
  const salaryMaxDisplay = salaryMaxFocused ? salaryMax : formatThousand(salaryMax)
  const commissionAmountDisplay = commissionAmountFocused ? commissionBonusAmount : formatThousand(commissionBonusAmount)

  // ── Commission bonus amount disabled ──────────────────────────────────────
  const commissionAmountDisabled = commissionBonusPeriod === 'not_applicable'

  // ── Shared field blocks (used in both terminal and light layouts) ─────────

  // ── Title autocomplete ────────────────────────────────────────────────────
  const [titleSugOpen, setTitleSugOpen] = useState(false)
  const [titleActiveIdx, setTitleActiveIdx] = useState(-1)
  const titleWrapRef = useRef(null)
  const [titleDropPos, setTitleDropPos] = useState({ top: 0, left: 0, width: 0 })

  const titleSuggestions = useMemo(() => {
    if (!title.trim()) return []
    const q = title.trim()
    return JOB_TITLE_SUGGESTIONS.filter(s => s.includes(q))
  }, [title])

  // Close title suggestions on outside click
  useEffect(() => {
    function onDown(e) {
      if (titleWrapRef.current && !titleWrapRef.current.contains(e.target)) {
        setTitleSugOpen(false)
        setTitleActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function openTitleDrop() {
    const rect = titleWrapRef.current?.getBoundingClientRect()
    if (!rect) return
    setTitleDropPos({ top: rect.bottom + 2, left: rect.left, width: rect.width })
    setTitleSugOpen(true)
  }

  // Close soft skill dropdown on outside click
  const softSkillPanelRef = useRef(null)
  useEffect(() => {
    function onDown(e) {
      const inWrap = softSkillWrapRef.current?.contains(e.target)
      const inPanel = softSkillPanelRef.current?.contains(e.target)
      if (!inWrap && !inPanel) {
        setSoftSkillOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Close job tag dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      const inWrap  = jobTagWrapRef.current?.contains(e.target)
      const inPanel = jobTagPanelRef.current?.contains(e.target)
      if (!inWrap && !inPanel) {
        setJobTagOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Auto-open soft skill dropdown when level + title match CSV
  useEffect(() => {
    const key = `${jobLevel}|${title.trim()}`
    const matched = SOFT_SKILL_MAP[key]
    if (matched && matched.length > 0) {
      setSoftSkillMatchedList(matched)
      setSoftSkillOpen(true)
      setSelectedSoftSkills([])
    } else {
      setSoftSkillMatchedList([])
      setSoftSkillOpen(false)
    }
  }, [jobLevel, title])

  // Close benefits dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      const inWrap  = benefitWrapRef.current?.contains(e.target)
      const inPanel = benefitPanelRef.current?.contains(e.target)
      if (!inWrap && !inPanel) setBenefitDropOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const handleTitleKeyDown = useCallback((e) => {
    if (!titleSugOpen || titleSuggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTitleActiveIdx(i => Math.min(i + 1, titleSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setTitleActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && titleActiveIdx >= 0) {
      e.preventDefault()
      setTitle(titleSuggestions[titleActiveIdx])
      setTitleSugOpen(false)
      setTitleActiveIdx(-1)
    } else if (e.key === 'Escape') {
      setTitleSugOpen(false)
      setTitleActiveIdx(-1)
    }
  }, [titleSugOpen, titleSuggestions, titleActiveIdx])

  // ── Edit mode: loading screen (must be after all hooks) ─────────────────
  if (loadingJob) {
    return (
      <div
        className={terminal ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center' : 'flex items-center justify-center py-24'}
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text-muted)' } : undefined}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={terminal ? { color: 'var(--t-primary)' } : { color: '#3b82f6' }} />
          <span className="text-sm">加载岗位信息...</span>
        </div>
      </div>
    )
  }

  const hintBorderStyle = {
    boxShadow: '0 0 0 2px #f59e0b inset',
    borderRadius: 6,
  }
  const hintTriggerStyle = { boxShadow: '0 0 0 2px #f59e0b inset' }

  const aiButtonReady = canAiAnalyze || aiLoading
  const aiButtonStyle = terminal
    ? {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 40,
        padding: '0 14px 0 10px',
        borderRadius: 'var(--t-radius-sm)',
        border: aiButtonReady ? '1px solid rgba(96, 165, 250, 0.48)' : '1px solid var(--t-border)',
        background: aiLoading
          ? 'var(--t-primary-muted)'
          : aiButtonReady
            ? aiButtonHovered
              ? 'var(--t-bg-hover)'
              : 'var(--t-bg-elevated)'
            : 'var(--t-bg-panel)',
        color: aiButtonReady ? 'var(--t-primary)' : 'var(--t-text-muted)',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.02em',
        lineHeight: 1,
        cursor: aiLoading ? 'not-allowed' : 'pointer',
        opacity: aiLoading ? 0.78 : 1,
        boxShadow: aiButtonReady
          ? aiButtonHovered && !aiLoading
            ? 'var(--t-shadow-elevated)'
            : 'none'
          : 'none',
        transform: aiButtonHovered && aiButtonReady && !aiLoading ? 'translateY(-1px)' : 'none',
        transition: 'background 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out, transform 150ms ease-out, color 150ms ease-out',
        whiteSpace: 'nowrap',
      }
    : {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 6,
        border: canAiAnalyze ? '1px solid #6366f1' : '1px solid #d1d5db',
        background: aiLoading
          ? '#f0f0ff'
          : canAiAnalyze
            ? '#ede9fe'
            : '#f9fafb',
        color: canAiAnalyze ? '#4f46e5' : '#9ca3af',
        fontSize: 12,
        fontWeight: 500,
        cursor: aiLoading ? 'not-allowed' : 'pointer',
        opacity: aiLoading ? 0.7 : 1,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }

  const aiIconWrapStyle = terminal
    ? {
        width: 24,
        height: 24,
        borderRadius: 7,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: aiButtonReady ? '1px solid var(--t-border-focus)' : '1px solid var(--t-border)',
        background: aiButtonReady ? 'var(--t-primary-muted)' : 'var(--t-bg-elevated)',
        color: aiButtonReady ? 'var(--t-primary)' : 'var(--t-text-muted)',
      }
    : null

  const aiButtonNode = (
    <button
      type="button"
      disabled={aiLoading}
      onClick={handleAiAnalyze}
      onMouseEnter={() => { if (terminal && !aiLoading) setAiButtonHovered(true) }}
      onMouseLeave={() => { if (terminal) setAiButtonHovered(false) }}
      style={aiButtonStyle}
    >
      {terminal ? (
        <span style={aiIconWrapStyle}>
          {aiLoading
            ? <Loader2 size={14} className="animate-spin" />
            : <Sparkles size={14} />
          }
        </span>
      ) : (
        aiLoading
          ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
          : <Sparkles size={12} />
      )}
      <span>{aiLoading ? 'AI 分析中…' : 'AI 智能分析'}</span>
    </button>
  )

  const templateButtonNode = (
    <button
      type="button"
      onClick={() => setTemplatePickerOpen(true)}
      onMouseEnter={() => setTplHovered(true)}
      onMouseLeave={() => setTplHovered(false)}
      style={terminal ? {
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 40, padding: '0 12px 0 9px',
        borderRadius: 'var(--t-radius-sm)', border: '1px solid var(--t-border)',
        background: tplHovered ? 'var(--t-bg-hover)' : 'var(--t-bg-elevated)',
        color: 'var(--t-text-secondary)', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 150ms ease-out',
      } : {
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 6, border: '1px solid #d1d5db',
        background: tplHovered ? '#f1f5f9' : '#f9fafb',
        color: '#374151', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
      }}
    >
      <Bookmark size={13} />
      <span>从模板选择</span>
    </button>
  )

  const fieldTitle = (
    <div ref={titleWrapRef} style={{ position: 'relative' }}>
      <label
        className={terminal ? 'block text-xs font-medium mb-2' : labelClass}
        style={{
          ...labelStyle,
          ...(aiFieldHint && !title.trim() ? { color: '#f59e0b', fontWeight: 600 } : {}),
        }}
      >
        岗位名称 *
        {aiFieldHint && !title.trim() && (
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: '#f59e0b' }}>← AI 分析需先填写</span>
        )}
      </label>
      <div style={aiFieldHint && !title.trim() ? hintBorderStyle : {}}>
      <input
        className={inputClass}
        style={terminal ? { ...inputStyle, paddingLeft: 14, paddingRight: 14 } : inputStyle}
        placeholder="例：海运操作主管"
        value={title}
        autoComplete="off"
        onChange={(e) => {
          setTitle(e.target.value)
          if (e.target.value.trim()) openTitleDrop()
          else setTitleSugOpen(false)
          setTitleActiveIdx(-1)
        }}
        onFocus={() => { if (title.trim()) openTitleDrop() }}
        onKeyDown={handleTitleKeyDown}
      />
      {titleSugOpen && titleSuggestions.length > 0 && (terminal
        ? createPortal(
          <ul
            style={{
              position: 'fixed',
              top: titleDropPos.top,
              left: titleDropPos.left,
              width: titleDropPos.width,
              zIndex: 9999,
              maxHeight: 220,
              overflowY: 'auto',
              borderRadius: 'var(--t-radius)',
              border: '1px solid var(--t-border)',
              background: 'var(--t-bg-elevated)',
              boxShadow: 'var(--t-shadow-elevated)',
              listStyle: 'none',
              padding: '4px 0',
              margin: 0,
            }}
          >
            {titleSuggestions.map((s, i) => (
              <li
                key={s}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setTitle(s)
                  setTitleSugOpen(false)
                  setTitleActiveIdx(-1)
                }}
                onMouseEnter={() => setTitleActiveIdx(i)}
                style={{
                  padding: '7px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: i === titleActiveIdx ? 'var(--t-primary-fg)' : 'var(--t-text)',
                  background: i === titleActiveIdx ? 'var(--t-primary)' : 'transparent',
                }}
              >
                {s}
              </li>
            ))}
          </ul>,
          getTerminalPortalTarget(titleWrapRef.current)
        )
        : (
          <ul
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 999,
              maxHeight: 220,
              overflowY: 'auto',
              marginTop: 4,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              background: '#fff',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              listStyle: 'none',
              padding: 0,
            }}
          >
            {titleSuggestions.map((s, i) => (
              <li
                key={s}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setTitle(s)
                  setTitleSugOpen(false)
                  setTitleActiveIdx(-1)
                }}
                onMouseEnter={() => setTitleActiveIdx(i)}
                style={{
                  padding: '7px 12px',
                  fontSize: 13,
                  cursor: 'pointer',
                  color: i === titleActiveIdx ? '#fff' : '#1e293b',
                  background: i === titleActiveIdx ? '#2563eb' : 'transparent',
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )
      )}
      </div>
    </div>
  )

  const fieldFunction = (
    <div>
      <label
        className={labelClass}
        style={{
          ...labelStyle,
          ...(aiFieldHint && !functionCode ? { color: '#f59e0b', fontWeight: 600 } : {}),
        }}
      >
        岗位板块 *
        {aiFieldHint && !functionCode && (
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: '#f59e0b' }}>← AI 分析需先填写</span>
        )}
      </label>
      <div style={!terminal && aiFieldHint && !functionCode ? hintBorderStyle : {}}>
      {terminal ? (
        <TerminalSelect
          value={functionCode}
          onChange={setFunctionCode}
          options={[{ value: '', label: '请选择板块' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
          placeholder="请选择板块"
          hasValue={!!functionCode}
          highlightStyle={aiFieldHint && !functionCode ? hintTriggerStyle : undefined}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={functionCode}
          onChange={(e) => setFunctionCode(e.target.value)}>
          <option value="">请选择板块</option>
          {FUNCTION_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      )}
      </div>
    </div>
  )

  const fieldExperience = (
    <div>
      <label className={labelClass} style={labelStyle}>经验要求 *</label>
      {terminal ? (
        <TerminalSelect
          value={experienceYears}
          onChange={setExperienceYears}
          options={[{ value: '', label: '请选择' }, ...EXPERIENCE_YEAR_OPTIONS.map(y => ({ value: y, label: y }))]}
          placeholder="请选择"
          hasValue={!!experienceYears}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={experienceYears}
          onChange={(e) => setExperienceYears(e.target.value)}>
          <option value="">请选择</option>
          {EXPERIENCE_YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      )}
    </div>
  )

  const fieldDegree = (
    <div>
      <label className={labelClass} style={labelStyle}>最低学历要求 *</label>
      {terminal ? (
        <TerminalSelect
          value={degreeRequired}
          onChange={setDegreeRequired}
          options={[{ value: '', label: '请选择' }, ...DEGREE_REQUIRED_OPTIONS.map(d => ({ value: d, label: d }))]}
          placeholder="请选择"
          hasValue={!!degreeRequired}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={degreeRequired}
          onChange={(e) => setDegreeRequired(e.target.value)}>
          <option value="">请选择</option>
          {DEGREE_REQUIRED_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
    </div>
  )

  const fieldJobLevel = (
    <div>
      <label className={labelClass} style={labelStyle}>职级层级</label>
      {terminal ? (
        <TerminalSelect
          value={jobLevel}
          onChange={setJobLevel}
          options={[{ value: '', label: '请选择' }, ...JOB_LEVEL_OPTIONS.map(l => ({ value: l, label: l }))]}
          placeholder="请选择"
          hasValue={!!jobLevel}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={jobLevel}
          onChange={(e) => setJobLevel(e.target.value)}>
          <option value="">请选择</option>
          {JOB_LEVEL_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      )}
    </div>
  )

  const fieldManagement = (
    <div>
      <label className={labelClass} style={labelStyle}>是否带团队 *</label>
      {terminal ? (
        <TerminalSelect
          value={isManagementRole}
          onChange={(val) => { setIsManagementRole(val); if (val !== 'true') setManagementHeadcount('') }}
          options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]}
          placeholder="请选择"
          hasValue={isManagementRole === 'true' || isManagementRole === 'false'}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={isManagementRole}
          onChange={(e) => { setIsManagementRole(e.target.value); if (e.target.value !== 'true') setManagementHeadcount('') }}>
          <option value="">请选择</option>
          <option value="true">是</option>
          <option value="false">否</option>
        </select>
      )}
    </div>
  )

  const fieldHeadcount = isManagementRole === 'true' ? (
    <div>
      <label className={labelClass} style={labelStyle}>预计团队人数 *</label>
      <input className={inputClass} style={inputStyle} inputMode="numeric" pattern="[0-9]*"
        placeholder="例：5" value={managementHeadcount}
        onChange={(e) => {
          const next = e.target.value
          if (next === '' || /^\d*$/.test(next)) setManagementHeadcount(next)
          else setSubmitError('预计团队人数必须为纯数字')
        }}
      />
    </div>
  ) : null

  const fieldEmploymentType = (
    <div>
      <label className={labelClass} style={labelStyle}>应聘类型 *</label>
      {terminal ? (
        <TerminalSelect
          value={employmentType}
          onChange={setEmploymentType}
          options={[{ value: '', label: '请选择' }, ...EMPLOYMENT_TYPE_OPTIONS.map(t => ({ value: t, label: t }))]}
          placeholder="请选择"
          hasValue={!!employmentType}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={employmentType}
          onChange={(e) => setEmploymentType(e.target.value)}>
          <option value="">请选择</option>
          {EMPLOYMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
    </div>
  )

  const fieldLocation = (
    <div>
      <label
        className={labelClass}
        style={{
          ...labelStyle,
          ...(aiFieldHint && !location?.location_code ? { color: '#f59e0b', fontWeight: 600 } : {}),
        }}
      >
        岗位工作城市 *
        {aiFieldHint && !location?.location_code && (
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 400, color: '#f59e0b' }}>← AI 分析需先填写</span>
        )}
      </label>
      <div style={!terminal && aiFieldHint && !location?.location_code ? hintBorderStyle : {}}>
        <RegionSelector
          value={location}
          onChange={setLocation}
          terminal={terminal}
          placeholder="请选择岗位城市"
          highlightStyle={aiFieldHint && !location?.location_code ? hintTriggerStyle : undefined}
        />
      </div>
      {location?.location_path && (
        <p className={helperClass} style={helperStyle}>
          已选：{location.location_path}（{location.business_area_name ?? ''}）
        </p>
      )}
    </div>
  )

  const fieldAddress = (
    <div>
      <label className={labelClass} style={labelStyle}>详细地址</label>
      <input className={inputClass} style={inputStyle} maxLength={200}
        placeholder="例：杨浦区安联大厦1108-2"
        value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} />
    </div>
  )

  const fieldDescription = (
    <div>
      {/* Label row: terminal shows label only (AI button is in header); light shows label + AI button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>岗位职责 *</label>
        {!terminal && aiButtonNode}
      </div>
      {aiError && (
        <p style={{ fontSize: 12, color: terminal ? 'var(--t-error, #f87171)' : '#ef4444', marginBottom: 6 }}>
          {aiError}
        </p>
      )}
      <textarea ref={descRef} rows={1} className={textareaClass + ' overflow-hidden'}
        style={textareaStyle} placeholder="描述该岗位的主要工作职责..."
        value={description} onChange={(e) => setDescription(e.target.value)} />
    </div>
  )

  const fieldJobTags = (() => {
    function openJobTagDrop() {
      const rect = jobTagTriggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelH = 340
      const spaceBelow = window.innerHeight - rect.bottom - 4
      const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
      setJobTagDropPos({ top, left: rect.left, width: rect.width })
    }

    function toggleJobTag(tag) {
      setSelectedJobTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      )
    }

    const currentTags = jobTagCategory
      ? (JOB_TAGS_DATA.find(d => d.category === jobTagCategory)?.tags ?? [])
      : []

    const dropContent = (
      <div
        ref={jobTagPanelRef}
        style={{
          display: 'flex',
          flexDirection: 'row',
          maxHeight: 340,
          overflow: 'hidden',
          borderRadius: terminal ? 'var(--t-radius)' : 8,
          border: terminal ? '1px solid var(--t-border)' : '1px solid #e2e8f0',
          background: terminal ? 'var(--t-bg-elevated)' : '#fff',
          boxShadow: terminal ? 'var(--t-shadow-elevated)' : '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        {/* 左侧：一级分类 */}
        <div style={{
          width: 160,
          flexShrink: 0,
          borderRight: terminal ? '1px solid var(--t-border)' : '1px solid #e2e8f0',
          overflowY: 'auto',
          padding: '4px 0',
          background: terminal ? 'var(--t-bg-panel)' : '#f8fafc',
        }}>
          {JOB_TAGS_DATA.map(d => {
            const active = jobTagCategory === d.category
            const hasSelected = d.tags.some(t => selectedJobTags.includes(t))
            return (
              <div
                key={d.category}
                onMouseDown={(e) => { e.preventDefault(); setJobTagCategory(d.category) }}
                style={{
                  padding: '7px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: active
                    ? (terminal ? 'var(--t-primary)' : '#eff6ff')
                    : 'transparent',
                  color: active
                    ? (terminal ? 'var(--t-primary-fg)' : '#2563eb')
                    : (terminal ? 'var(--t-text-secondary)' : '#374151'),
                  fontWeight: active ? 600 : 400,
                  borderLeft: active
                    ? (terminal ? '3px solid var(--t-primary-hover)' : '3px solid #2563eb')
                    : '3px solid transparent',
                }}
              >
                {hasSelected && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: active ? (terminal ? 'var(--t-primary-fg)' : '#2563eb') : (terminal ? 'var(--t-primary)' : '#2563eb'),
                  }} />
                )}
                <span style={{ flex: 1, lineHeight: 1.4 }}>{d.category}</span>
              </div>
            )
          })}
        </div>

        {/* 右侧：二级标签 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', background: terminal ? 'var(--t-bg-elevated)' : '#fff' }}>
          {jobTagCategory === null ? (
            <div style={{
              padding: '20px 12px',
              fontSize: 12,
              color: terminal ? 'var(--t-text-muted)' : '#94a3b8',
              textAlign: 'center',
            }}>
              请先从左侧选择分类
            </div>
          ) : currentTags.map(tag => {
            const checked = selectedJobTags.includes(tag)
            return (
              <div
                key={tag}
                onMouseDown={(e) => { e.preventDefault(); toggleJobTag(tag) }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  color: checked
                    ? (terminal ? 'var(--t-primary)' : '#2563eb')
                    : (terminal ? 'var(--t-text)' : '#1e293b'),
                  background: checked
                    ? (terminal ? 'var(--t-primary-muted)' : '#eff6ff')
                    : 'transparent',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: `1.5px solid ${checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : (terminal ? 'var(--t-border)' : '#cbd5e1')}`,
                  background: checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && (
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {tag}
              </div>
            )
          })}
        </div>
      </div>
    )

    return (
      <div ref={jobTagWrapRef} style={{ position: 'relative' }}>
        <label className={labelClass} style={labelStyle}>岗位标签 *</label>
        <div style={{ position: 'relative' }} ref={jobTagTriggerRef}>
          <div
            className={terminal ? undefined : inputClass}
            onMouseDown={(e) => {
              e.preventDefault()
              if (!jobTagOpen) openJobTagDrop()
              setJobTagOpen(o => !o)
            }}
            style={multiTriggerStyle(jobTagOpen, selectedJobTags.length > 0)}
          >
            {selectedJobTags.length > 0
              ? selectedJobTags.map(tag => (
                  <SelectedSkillTag key={tag} skill={tag} description={null} terminal={terminal} />
                ))
              : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: terminal ? 12 : 13 }}>从下拉框中选择岗位标签</span>
            }
          </div>
          <div style={{
            position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
            padding: 2, lineHeight: 0, pointerEvents: 'none',
            color: terminal ? 'var(--t-text-muted)' : '#64748b',
          }}>
            <ChevronDown size={terminal ? 11 : 14} style={{ transition: 'transform 150ms', transform: jobTagOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </div>
        </div>
        {jobTagOpen && (terminal
          ? createPortal(
            <div style={{
              position: 'fixed',
              top: jobTagDropPos.top,
              left: jobTagDropPos.left,
              width: jobTagDropPos.width,
              zIndex: 9999,
            }}>
              {dropContent}
            </div>,
            getTerminalPortalTarget(jobTagTriggerRef.current)
          )
          : (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
              marginTop: 4,
            }}>
              {dropContent}
            </div>
          )
        )}
        <p className={helperClass} style={helperStyle}>已选 {selectedJobTags.length} 项</p>
      </div>
    )
  })()

  const softSkillDropdownList = softSkillMatchedList.length > 0 ? softSkillMatchedList : ALL_SOFT_SKILLS

  function toggleSoftSkill(skill) {
    setSelectedSoftSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }


  function openSoftSkillDrop() {
    const rect = softSkillTriggerRef.current?.getBoundingClientRect()
    if (!rect) return
    const panelH = 228
    const spaceBelow = window.innerHeight - rect.bottom - 4
    const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
    setSoftSkillDropPos({ top, left: rect.left, width: rect.width })
  }

  const fieldSoftSkill = (
    <div ref={softSkillWrapRef} style={{ position: 'relative' }}>
      <label className={labelClass} style={labelStyle}>软技能 *</label>
      <div style={{ position: 'relative' }} ref={softSkillTriggerRef}>
        <div
          className={terminal ? undefined : inputClass}
          onMouseDown={(e) => {
            e.preventDefault()
            if (!softSkillOpen) openSoftSkillDrop()
            setSoftSkillOpen(o => !o)
          }}
          style={multiTriggerStyle(softSkillOpen, selectedSoftSkills.length > 0)}
        >
          {selectedSoftSkills.length > 0
            ? selectedSoftSkills.map(skill => (
                <SelectedSkillTag
                  key={skill}
                  skill={skill}
                  description={SOFT_SKILL_DESCRIPTIONS[skill]}
                  terminal={terminal}
                />
              ))
            : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: terminal ? 12 : 13 }}>从下拉框中选择软技能标签</span>
          }
        </div>
        <div
          style={{
            position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
            padding: 2, lineHeight: 0, pointerEvents: 'none',
            color: terminal ? 'var(--t-text-muted)' : '#64748b',
          }}
        >
          <ChevronDown size={terminal ? 11 : 14} style={{ transition: 'transform 150ms', transform: softSkillOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </div>
      </div>
      {softSkillOpen && (terminal
        ? createPortal(
          <div ref={softSkillPanelRef} style={{
            position: 'fixed',
            top: softSkillDropPos.top,
            left: softSkillDropPos.left,
            width: softSkillDropPos.width,
            zIndex: 9999,
            maxHeight: 228,
            overflowY: 'auto',
            borderRadius: 'var(--t-radius)',
            border: '1px solid var(--t-border)',
            background: 'var(--t-bg-elevated)',
            boxShadow: 'var(--t-shadow-elevated)',
            padding: '4px 0',
          }}>
            {softSkillDropdownList.map(skill => {
              const checked = selectedSoftSkills.includes(skill)
              return (
                <SoftSkillOption
                  key={skill}
                  skill={skill}
                  description={SOFT_SKILL_DESCRIPTIONS[skill]}
                  checked={checked}
                  terminal={terminal}
                  onToggle={toggleSoftSkill}
                />
              )
            })}
          </div>,
          getTerminalPortalTarget(softSkillTriggerRef.current)
        )
        : (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
            maxHeight: 228, overflowY: 'auto', marginTop: 4,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#fff',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            padding: '4px 0',
          }}>
            {softSkillDropdownList.map(skill => {
              const checked = selectedSoftSkills.includes(skill)
              return (
                <SoftSkillOption
                  key={skill}
                  skill={skill}
                  description={SOFT_SKILL_DESCRIPTIONS[skill]}
                  checked={checked}
                  terminal={terminal}
                  onToggle={toggleSoftSkill}
                />
              )
            })}
          </div>
        )
      )}
      <p className={helperClass} style={helperStyle}>已选 {selectedSoftSkills.length} 项</p>
    </div>
  )

  const fieldSalaryRange = (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className={labelClass} style={labelStyle}>最低月薪 *</label>
        <input type="text" inputMode="numeric" className={`${inputClass}${terminal ? ' terminal-tabular-num' : ''}`} style={inputStyle}
          placeholder="20,000" value={salaryMinDisplay}
          onFocus={() => setSalaryMinFocused(true)} onBlur={() => setSalaryMinFocused(false)}
          onChange={(e) => {
            const r = e.target.value.replace(/,/g, '')
            if (r === '' || /^\d+$/.test(r)) setSalaryMin(r)
          }}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>最高月薪 *</label>
        <input type="text" inputMode="numeric" className={`${inputClass}${terminal ? ' terminal-tabular-num' : ''}`} style={inputStyle}
          placeholder="30,000" value={salaryMaxDisplay}
          onFocus={() => setSalaryMaxFocused(true)} onBlur={() => setSalaryMaxFocused(false)}
          onChange={(e) => {
            const r = e.target.value.replace(/,/g, '')
            if (r === '' || /^\d+$/.test(r)) setSalaryMax(r)
          }}
        />
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>薪资月数 *</label>
        {terminal ? (
          <TerminalSelect
            value={String(salaryMonths)}
            onChange={(val) => setSalaryMonths(Number(val))}
            options={SALARY_MONTHS_OPTIONS.map(m => ({ value: String(m), label: `${m} 个月` }))}
            placeholder="请选择"
            hasValue={true}
          />
        ) : (
          <select className={inputClass} style={inputStyle} value={salaryMonths}
            onChange={(e) => setSalaryMonths(Number(e.target.value))}>
            {SALARY_MONTHS_OPTIONS.map((m) => <option key={m} value={m}>{m} 个月</option>)}
          </select>
        )}
      </div>
    </div>
  )

  const fieldCommission = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelClass} style={labelStyle}>提成/计件奖金</label>
        {terminal ? (
          <TerminalSelect
            value={commissionBonusPeriod}
            onChange={(val) => { setCommissionBonusPeriod(val); if (val === 'not_applicable') setCommissionBonusAmount('') }}
            options={COMMISSION_BONUS_PERIODS.map(p => ({ value: p.value, label: p.label }))}
            placeholder="请选择"
            hasValue={commissionBonusPeriod !== 'not_applicable'}
          />
        ) : (
          <select className={inputClass} style={inputStyle} value={commissionBonusPeriod}
            onChange={(e) => {
              setCommissionBonusPeriod(e.target.value)
              if (e.target.value === 'not_applicable') setCommissionBonusAmount('')
            }}>
            {COMMISSION_BONUS_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        )}
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>预估平均额</label>
        <input type="text" inputMode="numeric" className={`${commissionAmountDisabled ? disabledInputClass : inputClass}${terminal ? ' terminal-tabular-num' : ''}`}
          style={commissionAmountDisabled ? disabledInputStyle : inputStyle}
          placeholder={commissionAmountDisabled ? '请先选择周期' : '例：5,000'}
          value={commissionAmountDisabled ? '' : commissionAmountDisplay}
          disabled={commissionAmountDisabled}
          onFocus={() => setCommissionAmountFocused(true)}
          onBlur={() => setCommissionAmountFocused(false)}
          onChange={(e) => {
            const r = e.target.value.replace(/,/g, '')
            if (r === '' || /^\d+$/.test(r)) setCommissionBonusAmount(r)
          }} />
      </div>
    </div>
  )

  const fieldYearEndBonus = (
    <>
      <div>
        <label className={labelClass} style={labelStyle}>是否有年终奖 *</label>
        {terminal ? (
          <TerminalSelect
            value={hasYearEndBonus}
            onChange={(val) => { setHasYearEndBonus(val); if (val !== 'true') { setYearEndBonusQuickSelect(null); setYearEndBonusCustom('') } }}
            options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]}
            placeholder="请选择"
            hasValue={hasYearEndBonus === 'true' || hasYearEndBonus === 'false'}
          />
        ) : (
          <select className={inputClass} style={inputStyle} value={hasYearEndBonus}
            onChange={(e) => {
              setHasYearEndBonus(e.target.value)
              if (e.target.value !== 'true') {
                setYearEndBonusQuickSelect(null)
                setYearEndBonusCustom('')
              }
            }}>
            <option value="">请选择</option>
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        )}
      </div>
      {hasYearEndBonus === 'true' && (
        <div>
          <label className={labelClass} style={labelStyle}>年终奖预估平均额 *</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {YEAR_END_BONUS_QUICK.map((opt) => {
              const active = yearEndBonusQuickSelect === opt.value
              const cs = chipStyle(active)
              return (
                <button key={String(opt.value)} type="button" className={cs.className} style={cs.style}
                  onClick={() => {
                    setYearEndBonusQuickSelect(opt.value)
                    if (opt.value !== 'custom') setYearEndBonusCustom('')
                  }}>
                  {opt.label}
                </button>
              )
            })}
          </div>
          {yearEndBonusQuickSelect === 'custom' && (
            <div>
              <input type="number" step="0.1" className={inputClass} style={inputStyle}
                placeholder="例：2 表示 2 个月基本工资" value={yearEndBonusCustom}
                onChange={(e) => setYearEndBonusCustom(e.target.value)} />
              <p className={helperClass} style={helperStyle}>0-24 之间，可填小数</p>
            </div>
          )}
        </div>
      )}
    </>
  )

  const fieldBenefits = (() => {
    function openBenefitDrop() {
      const rect = benefitTriggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const panelH = 260
      const spaceBelow = window.innerHeight - rect.bottom - 4
      const top = spaceBelow >= panelH ? rect.bottom + 4 : rect.top - panelH - 4
      setBenefitDropPos({ top, left: rect.left, width: rect.width })
    }

    function toggleBenefit(opt) {
      setSelectedBenefits(prev =>
        prev.includes(opt) ? prev.filter(b => b !== opt) : [...prev, opt]
      )
    }

    const dropContent = (
      <div
        ref={benefitPanelRef}
        style={{
          maxHeight: 260,
          overflowY: 'auto',
          borderRadius: terminal ? 'var(--t-radius)' : 8,
          border: terminal ? '1px solid var(--t-border)' : '1px solid #e2e8f0',
          background: terminal ? 'var(--t-bg-elevated)' : '#fff',
          boxShadow: terminal ? 'var(--t-shadow-elevated)' : '0 4px 16px rgba(0,0,0,0.12)',
          padding: '4px 0',
        }}
      >
        {BENEFIT_OPTIONS.map(opt => {
          const checked = selectedBenefits.includes(opt)
          return (
            <div
              key={opt}
              onMouseDown={(e) => { e.preventDefault(); toggleBenefit(opt) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                color: checked
                  ? (terminal ? 'var(--t-primary)' : '#2563eb')
                  : (terminal ? 'var(--t-text)' : '#1e293b'),
                background: checked
                  ? (terminal ? 'var(--t-primary-muted)' : '#eff6ff')
                  : 'transparent',
              }}
            >
              <div style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : (terminal ? 'var(--t-border)' : '#cbd5e1')}`,
                background: checked ? (terminal ? 'var(--t-primary)' : '#2563eb') : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {checked && (
                  <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                    <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {opt}
            </div>
          )
        })}
      </div>
    )

    return (
      <div ref={benefitWrapRef} style={{ position: 'relative' }}>
        <label className={labelClass} style={labelStyle}>福利列表</label>
        <div style={{ position: 'relative' }} ref={benefitTriggerRef}>
          <div
            className={terminal ? undefined : inputClass}
            onMouseDown={(e) => {
              e.preventDefault()
              if (!benefitDropOpen) openBenefitDrop()
              setBenefitDropOpen(o => !o)
            }}
            style={multiTriggerStyle(benefitDropOpen, selectedBenefits.length > 0)}
          >
            {selectedBenefits.length > 0
              ? selectedBenefits.map(b => (
                  <SelectedSkillTag key={b} skill={b} description={null} terminal={terminal} />
                ))
              : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: terminal ? 12 : 13 }}>从下拉框中选择福利项目</span>
            }
          </div>
          <div style={{
            position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)',
            padding: 2, lineHeight: 0, pointerEvents: 'none',
            color: terminal ? 'var(--t-text-muted)' : '#64748b',
          }}>
            <ChevronDown size={terminal ? 11 : 14} style={{ transition: 'transform 150ms', transform: benefitDropOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </div>
        </div>
        {benefitDropOpen && (terminal
          ? createPortal(
            <div style={{
              position: 'fixed',
              top: benefitDropPos.top,
              left: benefitDropPos.left,
              width: benefitDropPos.width,
              zIndex: 9999,
            }}>
              {dropContent}
            </div>,
            getTerminalPortalTarget(benefitTriggerRef.current)
          )
          : (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
              marginTop: 4,
            }}>
              {dropContent}
            </div>
          )
        )}
        <p className={helperClass} style={helperStyle}>已选 {selectedBenefits.length} 项</p>
      </div>
    )
  })()


  const submitButtons = (
    <div className="flex items-center justify-end gap-3">
      <Button terminal={terminal} variant="secondary" onClick={() => navigate('/employer/jobs')} disabled={submitting}>
        取消
      </Button>
      <Button terminal={terminal} onClick={handlePublish} disabled={submitting || loadingJob}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        {submitting ? (isEdit ? '正在保存...' : '正在发布...') : (isEdit ? '保存修改' : '确认发布')}
        {!submitting && <ChevronRight size={16} />}
      </Button>
    </div>
  )

  const errorBanner = submitError ? (
    <div
      className={terminal
        ? 'flex items-center gap-2 px-3 py-2 border rounded text-sm'
        : 'mb-5 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm'}
      style={terminal
        ? { background: 'var(--t-danger-muted)', borderColor: 'var(--t-danger)', color: 'var(--t-danger)' }
        : undefined}
    >
      <AlertCircle size={15} className="flex-shrink-0" />
      {submitError}
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
          {/* Header */}
          <div className="flex items-center justify-between mb-3 flex-shrink-0 flex-wrap gap-2">
            <div>
              <p style={{ fontFamily: 'var(--t-font-ui)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t-text-muted)', marginBottom: 2 }}>
                {isEdit ? 'EDIT JOB' : 'NEW JOB POSTING'}
              </p>
              <h1 className="text-base font-semibold" style={{ color: 'var(--t-text)' }}>发布招聘岗位</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>填写完整后即可立即发布并启动候选人匹配</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {templateButtonNode}
              {aiButtonNode}
              {submitButtons}
            </div>
          </div>

          {/* Error */}
          {errorBanner && <div className="mb-2 flex-shrink-0">{errorBanner}</div>}

          {/* AI error (terminal) */}
          {aiError && (
            <div className="mb-2 flex-shrink-0" style={{ fontSize: 12, color: 'var(--t-error, #f87171)' }}>
              {aiError}
            </div>
          )}

          {/* 3-column grid */}
          <div className="terminal-form-grid-3">

            {/* ── Col 1: 基本信息 ── */}
            <div className={cardClass} style={{ ...cardStyle, borderTop: '2px solid var(--t-primary)' }}>
              <div className={sectionTitleClass} style={{ color: 'var(--t-primary)', borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 6, marginBottom: 0 }}>
                <Briefcase size={11} /> 基本信息
              </div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldTitle}
                {fieldFunction}
                {fieldExperience}
                {fieldDegree}
                {fieldJobLevel}
                {fieldManagement}
                {fieldHeadcount}
                {fieldEmploymentType}
                {fieldLocation}
                {fieldAddress}
              </div>
            </div>

            {/* ── Col 2: 岗位描述 ── */}
            <div className={cardClass} style={{ ...cardStyle, borderTop: '2px solid var(--t-success)' }}>
              <div className={sectionTitleClass} style={{ color: 'var(--t-success)', borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 6, marginBottom: 0 }}>
                <FileText size={11} /> 岗位描述
              </div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldDescription}
                {fieldJobTags}
                {fieldSoftSkill}
              </div>
            </div>

            {/* ── Col 3: 薪酬福利 ── */}
            <div className={cardClass} style={{ ...cardStyle, borderTop: '2px solid var(--t-chart-amber)' }}>
              <div className={sectionTitleClass} style={{ color: 'var(--t-chart-amber)', borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 6, marginBottom: 0 }}>
                <DollarSign size={11} /> 薪酬福利
              </div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldSalaryRange}
                {fieldCommission}
                {fieldBenefits}
                {fieldYearEndBonus}
              </div>
            </div>

          </div>
        </div>
        <TemplatePickerModal
          open={templatePickerOpen}
          terminal={terminal}
          onClose={() => setTemplatePickerOpen(false)}
          onSelect={(job) => { applyTemplate(job); setTemplatePickerOpen(false) }}
        />
      </div>
    )
  }

  // ── Light layout (unchanged) ───────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-5" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">发布招聘岗位</h1>
          <p className="mt-1 text-sm text-slate-500">填写完整后即可立即发布并启动候选人匹配</p>
        </div>
        {templateButtonNode}
      </div>
      {errorBanner}

      <div className="space-y-4">

          {/* ════ Section 1: 岗位名称与定位 ════ */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              <Briefcase size={14} /> 岗位名称与定位
            </div>
            {fieldTitle}
            {fieldFunction}
            {fieldJobLevel}
            {fieldManagement}
            {fieldHeadcount}
            {fieldEmploymentType}
            {fieldLocation}
            {fieldAddress}
          </div>

          {/* ════ Section 2: 岗位要求 ════ */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              <Briefcase size={14} /> 岗位要求
            </div>
            <div className="grid grid-cols-2 gap-4">
              {fieldExperience}
              {fieldDegree}
            </div>
            {fieldDescription}
            {fieldJobTags}
            {fieldSoftSkill}
          </div>

          {/* ════ Section 3: 薪酬待遇 ════ */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              <Briefcase size={14} /> 薪酬待遇
            </div>
            {fieldSalaryRange}
            {fieldCommission}
            {fieldBenefits}
            {fieldYearEndBonus}
          </div>

          {submitButtons}
        </div>
      <TemplatePickerModal
        open={templatePickerOpen}
        terminal={terminal}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={(job) => { applyTemplate(job); setTemplatePickerOpen(false) }}
      />
      </div>
  )
}
