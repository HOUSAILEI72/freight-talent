import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2, ChevronRight, ChevronDown, Briefcase, Mail, FileText, DollarSign } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { jobsApi } from '../../api/jobs'
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
        document.body
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
        background: terminal ? 'var(--t-primary-muted)' : '#eff6ff',
        color: terminal ? 'var(--t-primary)' : '#2563eb',
        border: `1px solid ${terminal ? 'var(--t-primary)' : '#bfdbfe'}`,
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
        document.body
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

  const [description,  setDescription]  = useState('')

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
    ? 'block text-xs font-medium mb-1'
    : 'block text-sm font-medium text-slate-700 mb-1'
  const labelStyle = terminal ? { color: 'var(--t-text-secondary)' } : undefined

  const helperClass = terminal ? 'mt-1 text-xs' : 'mt-1 text-xs text-slate-400'
  const helperStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  const inputClass = terminal
    ? 'w-full px-3 py-2 rounded border text-sm focus:outline-none'
    : 'w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined

  const textareaClass = inputClass + ' resize-none'
  const textareaStyle = inputStyle

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
        className: `px-3 py-1.5 rounded-lg text-sm border transition-colors ${
          active
            ? 'bg-blue-600 text-white border-blue-600'
            : 'border-slate-200 text-slate-600 hover:border-blue-300'
        }`,
      }
    }
    return {
      className: 'px-3 py-1.5 rounded-lg text-sm border transition-colors',
      style: active
        ? { background: 'var(--t-primary)', color: '#fff', borderColor: 'var(--t-primary)' }
        : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' },
    }
  }

  // ── Disabled input style ──────────────────────────────────────────────────
  const disabledInputStyle = terminal
    ? { ...inputStyle, opacity: 0.45, cursor: 'not-allowed' }
    : undefined
  const disabledInputClass = terminal
    ? inputClass + ' opacity-45 cursor-not-allowed'
    : inputClass + ' opacity-45 cursor-not-allowed'

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

  const fieldTitle = (
    <div ref={titleWrapRef} style={{ position: 'relative' }}>
      <label className={labelClass} style={labelStyle}>岗位名称 *</label>
      <input
        className={inputClass}
        style={inputStyle}
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
                  padding: '7px 12px',
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
          document.body
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
  )

  const fieldFunction = (
    <div>
      <label className={labelClass} style={labelStyle}>岗位板块 *</label>
      {terminal ? (
        <TerminalSelect
          value={functionCode}
          onChange={setFunctionCode}
          options={[{ value: '', label: '请选择板块' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
          placeholder="请选择板块"
          hasValue={!!functionCode}
        />
      ) : (
        <select className={inputClass} style={inputStyle} value={functionCode}
          onChange={(e) => setFunctionCode(e.target.value)}>
          <option value="">请选择板块</option>
          {FUNCTION_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      )}
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
      <label className={labelClass} style={labelStyle}>岗位工作城市 *</label>
      <RegionSelector value={location} onChange={setLocation} terminal={terminal}
        placeholder="请选择岗位城市" />
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
      <label className={labelClass} style={labelStyle}>岗位职责 *</label>
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
          border: terminal ? '1px solid #3a5070' : '1px solid #e2e8f0',
          background: terminal ? '#1a2d45' : '#fff',
          boxShadow: terminal ? '0 8px 32px rgba(0,0,0,0.6)' : '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        {/* 左侧：一级分类 */}
        <div style={{
          width: 160,
          flexShrink: 0,
          borderRight: terminal ? '1px solid #3a5070' : '1px solid #e2e8f0',
          overflowY: 'auto',
          padding: '4px 0',
          background: terminal ? '#0f1e30' : '#f8fafc',
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
                    ? (terminal ? '#3b82f6' : '#eff6ff')
                    : 'transparent',
                  color: active
                    ? (terminal ? '#ffffff' : '#2563eb')
                    : (terminal ? '#c8daf0' : '#374151'),
                  fontWeight: active ? 600 : 400,
                  borderLeft: active
                    ? (terminal ? '3px solid #93c5fd' : '3px solid #2563eb')
                    : '3px solid transparent',
                }}
              >
                {hasSelected && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: active ? (terminal ? '#bfdbfe' : '#2563eb') : (terminal ? '#60a5fa' : '#2563eb'),
                  }} />
                )}
                <span style={{ flex: 1, lineHeight: 1.4 }}>{d.category}</span>
              </div>
            )
          })}
        </div>

        {/* 右侧：二级标签 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0', background: terminal ? '#1a2d45' : '#fff' }}>
          {jobTagCategory === null ? (
            <div style={{
              padding: '20px 12px',
              fontSize: 12,
              color: terminal ? '#7a9abf' : '#94a3b8',
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
                    ? (terminal ? '#93c5fd' : '#2563eb')
                    : (terminal ? '#c8daf0' : '#1e293b'),
                  background: checked
                    ? (terminal ? 'rgba(59,130,246,0.15)' : '#eff6ff')
                    : 'transparent',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  border: `1.5px solid ${checked ? (terminal ? '#3b82f6' : '#2563eb') : (terminal ? '#4a6a8a' : '#cbd5e1')}`,
                  background: checked ? (terminal ? '#3b82f6' : '#2563eb') : 'transparent',
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
            className={inputClass}
            onMouseDown={(e) => {
              e.preventDefault()
              if (!jobTagOpen) openJobTagDrop()
              setJobTagOpen(o => !o)
            }}
            style={{
              ...inputStyle,
              minHeight: '2.25rem',
              paddingRight: '1.75rem',
              paddingTop: selectedJobTags.length > 0 ? 6 : undefined,
              paddingBottom: selectedJobTags.length > 0 ? 6 : undefined,
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              alignItems: 'center',
            }}
          >
            {selectedJobTags.length > 0
              ? selectedJobTags.map(tag => (
                  <SelectedSkillTag key={tag} skill={tag} description={null} terminal={terminal} />
                ))
              : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: 13 }}>从下拉框中选择岗位标签</span>
            }
          </div>
          <div style={{
            position: 'absolute', right: 7, top: 8,
            padding: 2, lineHeight: 0, pointerEvents: 'none',
            color: terminal ? 'var(--t-text-secondary)' : '#64748b',
          }}>
            <ChevronDown size={14} />
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
            document.body
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
          className={inputClass}
          onMouseDown={(e) => {
            e.preventDefault()
            if (!softSkillOpen) openSoftSkillDrop()
            setSoftSkillOpen(o => !o)
          }}
          style={{
            ...inputStyle,
            minHeight: '2.25rem',
            paddingRight: '1.75rem',
            paddingTop: selectedSoftSkills.length > 0 ? 6 : undefined,
            paddingBottom: selectedSoftSkills.length > 0 ? 6 : undefined,
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            alignItems: 'center',
          }}
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
            : <span style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8', fontSize: 13 }}>从下拉框中选择软技能标签</span>
          }
        </div>
        <div
          style={{
            position: 'absolute', right: 7, top: 8,
            padding: 2, lineHeight: 0, pointerEvents: 'none',
            color: terminal ? 'var(--t-text-secondary)' : '#64748b',
          }}
        >
          <ChevronDown size={14} />
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
          document.body
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
        <input type="text" inputMode="numeric" className={inputClass} style={inputStyle}
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
        <input type="text" inputMode="numeric" className={inputClass} style={inputStyle}
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
        <input type="text" inputMode="numeric" className={commissionAmountDisabled ? disabledInputClass : inputClass}
          style={commissionAmountDisabled ? disabledInputStyle : inputStyle}
          placeholder="例：5,000" value={commissionAmountDisabled ? '' : commissionAmountDisplay}
          disabled={commissionAmountDisabled}
          onFocus={() => setCommissionAmountFocused(true)}
          onBlur={() => setCommissionAmountFocused(false)}
          onChange={(e) => {
            const r = e.target.value.replace(/,/g, '')
            if (r === '' || /^\d+$/.test(r)) setCommissionBonusAmount(r)
          }} />
        {commissionAmountDisabled && <p className={helperClass} style={helperStyle}>请先选择周期</p>}
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

  const fieldBenefits = (
    <div>
      <label className={labelClass} style={labelStyle}>福利列表</label>
      <div className="flex flex-wrap gap-2">
        {BENEFIT_OPTIONS.map((opt) => {
          const active = selectedBenefits.includes(opt)
          const cs = chipStyle(active)
          return (
            <button key={opt} type="button" className={cs.className} style={cs.style}
              onClick={() => setSelectedBenefits(prev =>
                prev.includes(opt) ? prev.filter(b => b !== opt) : [...prev, opt]
              )}>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )


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
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <div>
              <h1 className="text-base font-semibold" style={{ color: 'var(--t-text)' }}>发布招聘岗位</h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>填写完整后即可立即发布并启动候选人匹配</p>
            </div>
            {submitButtons}
          </div>

          {/* Error */}
          {errorBanner && <div className="mb-2 flex-shrink-0">{errorBanner}</div>}

          {/* 3-column grid */}
          <div className="terminal-form-grid-3">

            {/* ── Col 1: 基本信息 ── */}
            <div className={cardClass} style={cardStyle}>
              <div className={sectionTitleClass} style={sectionTitleStyle}><Briefcase size={11} /> 基本信息</div>
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
            <div className={cardClass} style={cardStyle}>
              <div className={sectionTitleClass} style={sectionTitleStyle}><FileText size={11} /> 岗位描述</div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldDescription}
                {fieldJobTags}
                {fieldSoftSkill}
              </div>
            </div>

            {/* ── Col 3: 薪酬福利 ── */}
            <div className={cardClass} style={cardStyle}>
              <div className={sectionTitleClass} style={sectionTitleStyle}><DollarSign size={11} /> 薪酬福利</div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldSalaryRange}
                {fieldCommission}
                {fieldYearEndBonus}
                {fieldBenefits}
              </div>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ── Light layout (unchanged) ───────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-slate-800">发布招聘岗位</h1>
        <p className="mt-1 text-sm text-slate-500">填写完整后即可立即发布并启动候选人匹配</p>
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
            {fieldYearEndBonus}
            {fieldBenefits}
          </div>

          {submitButtons}
        </div>
      </div>
  )
}
