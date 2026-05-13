import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2, ChevronRight, Briefcase, Mail } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { jobsApi } from '../../api/jobs'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import RegionSelector from '../../components/RegionSelector'
import { useAuth } from '../../context/AuthContext'

// ─── Constants ─────────────────────────────────────────────────────────────────

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

const SALARY_MONTHS_OPTIONS = [12, 13, 14]
const EXPERIENCE_YEAR_OPTIONS = ['不限', '1年以内', '1-3年', '3-5年', '5-10年', '10年以上']
const DEGREE_REQUIRED_OPTIONS = ['不限', '初中及以下', '高中', '大专', '本科', '硕士', '博士']
const EMPLOYMENT_TYPE_OPTIONS = ['全职', '兼职', '实习生']

const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly', label: '月度' },
  { value: 'quarterly', label: '季度' },
  { value: 'semi_annual', label: '半年度' },
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

// ─── Page ──────────────────────────────────────────────────────────────────────

const STEP_FORM    = 0
const STEP_SUCCESS = 2

export default function PostJob({ terminal = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep]               = useState(STEP_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [, setCreatedJobId]           = useState(null)
  const [showEmailModal, setShowEmailModal] = useState(false)

  // ── Form state ────────────────────────────────────────────────────────────
  const [title, setTitle]                     = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [degreeRequired, setDegreeRequired]   = useState('')

  const [functionCode, setFunctionCode]       = useState('')

  const [isManagementRole, setIsManagementRole] = useState('')
  const [managementHeadcount, setManagementHeadcount] = useState('')

  const [location, setLocation]               = useState(null)
  const [addressDetail, setAddressDetail]     = useState('')
  const [employmentType, setEmploymentType]   = useState('')

  const [knowledgeText, setKnowledgeText]     = useState('')
  const [hardSkillText, setHardSkillText]     = useState('')
  const [softSkillText, setSoftSkillText]     = useState('')

  const [salaryMin,    setSalaryMin]          = useState('')
  const [salaryMax,    setSalaryMax]          = useState('')
  const [salaryMonths, setSalaryMonths]       = useState(13)

  const [salaryMinFocused, setSalaryMinFocused] = useState(false)
  const [salaryMaxFocused, setSalaryMaxFocused] = useState(false)

  const [commissionBonusPeriod, setCommissionBonusPeriod] = useState('not_applicable')
  const [commissionBonusAmount, setCommissionBonusAmount] = useState('')

  const [hasYearEndBonus,     setHasYearEndBonus]    = useState('')
  const [yearEndBonusQuickSelect, setYearEndBonusQuickSelect] = useState(null)
  const [yearEndBonusCustom, setYearEndBonusCustom]  = useState('')

  const [description,  setDescription]  = useState('')

  // ── Derived ───────────────────────────────────────────────────────────────
  const knowledgeArr   = useMemo(() => splitTokens(knowledgeText), [knowledgeText])
  const hardSkillArr   = useMemo(() => splitTokens(hardSkillText), [hardSkillText])
  const softSkillArr   = useMemo(() => splitTokens(softSkillText), [softSkillText])

  const selectedFunction = FUNCTION_OPTIONS.find(f => f.key === functionCode) || null

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    if (!title.trim())                return '请填写岗位名称'
    if (!selectedFunction)            return '请选择板块'
    if (isManagementRole !== 'true' && isManagementRole !== 'false') return '请选择该岗位是否属于管理行列'
    if (isManagementRole === 'true') {
      if (!managementHeadcount.trim()) return '请填写预计管理人数'
      if (!/^\d+$/.test(managementHeadcount.trim())) return '预计管理人数必须为纯数字'
      if (Number(managementHeadcount) <= 0) return '预计管理人数必须大于 0'
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
    if (knowledgeArr.length === 0)   return '请填写知识要求'
    if (hardSkillArr.length === 0)   return '请填写硬技能要求'
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
      if (!commissionBonusAmount.trim()) return '请填写计提/计件奖金预估平均额'
      const ca = Number(commissionBonusAmount)
      if (!Number.isFinite(ca) || ca <= 0) return '预估平均额必须为有效数字'
    }
    if (commissionBonusPeriod === 'not_applicable' && commissionBonusAmount.trim()) {
      return '请先选择计提/计件奖金周期，再填写预估平均额'
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

      location_code: location.location_code,
      location_name: location.location_name,
      location_path: location.location_path,
      location_type: location.location_type,
      address: addressDetail.trim() || null,
      employment_type: employmentType,

      skill_tags: mergeUnique(knowledgeArr, hardSkillArr, softSkillArr),
      knowledge_requirements:  knowledgeArr,
      hard_skill_requirements: hardSkillArr,
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

      description:  description.trim(),

      status: 'published',
    }

    setSubmitting(true)
    try {
      const res = await jobsApi.createJob(payload)
      const job = res?.data?.job
      setCreatedJobId(job?.id ?? null)
      setStep(STEP_SUCCESS)
      setShowEmailModal(true)
    } catch (err) {
      console.error('Failed to create job:', {
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
        '发布失败，请稍后重试'
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
    ? 'flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-1'
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

  // ── Commission bonus amount disabled ──────────────────────────────────────
  const commissionAmountDisabled = commissionBonusPeriod === 'not_applicable'

  // ── Shared field blocks (used in both terminal and light layouts) ─────────

  const fieldTitle = (
    <div>
      <label className={labelClass} style={labelStyle}>岗位名称 *</label>
      <input className={inputClass} style={inputStyle} placeholder="例：海运操作主管"
        value={title} onChange={(e) => setTitle(e.target.value)} />
    </div>
  )

  const fieldFunction = (
    <div>
      <label className={labelClass} style={labelStyle}>岗位板块 *</label>
      <select className={inputClass} style={inputStyle} value={functionCode}
        onChange={(e) => setFunctionCode(e.target.value)}>
        <option value="">请选择板块</option>
        {FUNCTION_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
    </div>
  )

  const fieldExperience = (
    <div>
      <label className={labelClass} style={labelStyle}>经验要求 *</label>
      <select className={inputClass} style={inputStyle} value={experienceYears}
        onChange={(e) => setExperienceYears(e.target.value)}>
        <option value="">请选择</option>
        {EXPERIENCE_YEAR_OPTIONS.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  )

  const fieldDegree = (
    <div>
      <label className={labelClass} style={labelStyle}>最低学历要求 *</label>
      <select className={inputClass} style={inputStyle} value={degreeRequired}
        onChange={(e) => setDegreeRequired(e.target.value)}>
        <option value="">请选择</option>
        {DEGREE_REQUIRED_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
    </div>
  )

  const fieldManagement = (
    <div>
      <label className={labelClass} style={labelStyle}>是否管理行列 *</label>
      <select className={inputClass} style={inputStyle} value={isManagementRole}
        onChange={(e) => { setIsManagementRole(e.target.value); if (e.target.value !== 'true') setManagementHeadcount('') }}>
        <option value="">请选择</option>
        <option value="true">是</option>
        <option value="false">否</option>
      </select>
    </div>
  )

  const fieldHeadcount = isManagementRole === 'true' ? (
    <div>
      <label className={labelClass} style={labelStyle}>预计管理人数 *</label>
      <input className={inputClass} style={inputStyle} inputMode="numeric" pattern="[0-9]*"
        placeholder="例：5" value={managementHeadcount}
        onChange={(e) => {
          const next = e.target.value
          if (next === '' || /^\d*$/.test(next)) setManagementHeadcount(next)
          else setSubmitError('预计管理人数必须为纯数字')
        }}
      />
    </div>
  ) : null

  const fieldEmploymentType = (
    <div>
      <label className={labelClass} style={labelStyle}>应聘类型 *</label>
      <select className={inputClass} style={inputStyle} value={employmentType}
        onChange={(e) => setEmploymentType(e.target.value)}>
        <option value="">请选择</option>
        {EMPLOYMENT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
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
    <div className={terminal ? 'flex flex-col flex-1 min-h-0' : ''}>
      <label className={labelClass} style={labelStyle}>岗位职责 *</label>
      <textarea rows={terminal ? 7 : 6} className={textareaClass + (terminal ? ' flex-1 min-h-0' : '')}
        style={textareaStyle} placeholder="描述该岗位的主要工作职责..."
        value={description} onChange={(e) => setDescription(e.target.value)} />
    </div>
  )

  const fieldKnowledge = (
    <div>
      <label className={labelClass} style={labelStyle}>知识 *</label>
      <textarea rows={2} className={textareaClass} style={textareaStyle}
        placeholder="例：国际贸易, HS编码, 危险品分类"
        value={knowledgeText} onChange={(e) => setKnowledgeText(e.target.value)} />
      <p className={helperClass} style={helperStyle}>已识别 {knowledgeArr.length} 项</p>
    </div>
  )

  const fieldHardSkill = (
    <div>
      <label className={labelClass} style={labelStyle}>硬技能 *</label>
      <textarea rows={2} className={textareaClass} style={textareaStyle}
        placeholder="例：Cargowise, Excel, SAP"
        value={hardSkillText} onChange={(e) => setHardSkillText(e.target.value)} />
      <p className={helperClass} style={helperStyle}>已识别 {hardSkillArr.length} 项</p>
    </div>
  )

  const fieldSoftSkill = (
    <div>
      <label className={labelClass} style={labelStyle}>软技能 *</label>
      <textarea rows={2} className={textareaClass} style={textareaStyle}
        placeholder="例：英语沟通, 抗压能力, 团队协作"
        value={softSkillText} onChange={(e) => setSoftSkillText(e.target.value)} />
      <p className={helperClass} style={helperStyle}>已识别 {softSkillArr.length} 项</p>
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
        <select className={inputClass} style={inputStyle} value={salaryMonths}
          onChange={(e) => setSalaryMonths(Number(e.target.value))}>
          {SALARY_MONTHS_OPTIONS.map((m) => <option key={m} value={m}>{m} 个月</option>)}
        </select>
      </div>
    </div>
  )

  const fieldCommission = (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelClass} style={labelStyle}>计提/计件奖金</label>
        <select className={inputClass} style={inputStyle} value={commissionBonusPeriod}
          onChange={(e) => {
            setCommissionBonusPeriod(e.target.value)
            if (e.target.value === 'not_applicable') setCommissionBonusAmount('')
          }}>
          {COMMISSION_BONUS_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass} style={labelStyle}>预估平均额</label>
        <input type="number" className={commissionAmountDisabled ? disabledInputClass : inputClass}
          style={commissionAmountDisabled ? disabledInputStyle : inputStyle}
          placeholder="例：5000" value={commissionBonusAmount} disabled={commissionAmountDisabled}
          onChange={(e) => setCommissionBonusAmount(e.target.value)} />
        {commissionAmountDisabled && <p className={helperClass} style={helperStyle}>请先选择周期</p>}
      </div>
    </div>
  )

  const fieldYearEndBonus = (
    <>
      <div>
        <label className={labelClass} style={labelStyle}>是否有年终奖 *</label>
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

  const submitButtons = (
    <div className="flex items-center justify-end gap-3">
      <Button terminal={terminal} variant="secondary" onClick={() => navigate('/employer/jobs')} disabled={submitting}>
        取消
      </Button>
      <Button terminal={terminal} onClick={handlePublish} disabled={submitting}>
        {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
        {submitting ? '正在发布...' : '确认发布'}
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
        className="terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-hidden px-6 py-5"
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
          <div className="grid grid-cols-[minmax(280px,1fr)_minmax(320px,1.15fr)_minmax(280px,1fr)] gap-4 flex-1 min-h-0 overflow-hidden">

            {/* ── Col 1: 基本信息 ── */}
            <div className={cardClass} style={cardStyle}>
              <div className={sectionTitleClass} style={sectionTitleStyle}><Briefcase size={11} /> 基本信息</div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldTitle}
                {fieldFunction}
                {fieldExperience}
                {fieldDegree}
                {fieldManagement}
                {fieldHeadcount}
                {fieldEmploymentType}
                {fieldLocation}
                {fieldAddress}
              </div>
            </div>

            {/* ── Col 2: 岗位描述 ── */}
            <div className={cardClass} style={cardStyle}>
              <div className={sectionTitleClass} style={sectionTitleStyle}><Briefcase size={11} /> 岗位描述</div>
              <div className="flex flex-col flex-1 min-h-0 space-y-3">
                {fieldDescription}
                {fieldKnowledge}
                {fieldHardSkill}
                {fieldSoftSkill}
              </div>
            </div>

            {/* ── Col 3: 薪酬福利 ── */}
            <div className={cardClass} style={cardStyle}>
              <div className={sectionTitleClass} style={sectionTitleStyle}><Briefcase size={11} /> 薪酬福利</div>
              <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
                {fieldSalaryRange}
                {fieldCommission}
                {fieldYearEndBonus}
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
            {fieldKnowledge}
            {fieldHardSkill}
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
          </div>

          {submitButtons}
        </div>
      </div>
  )
}
