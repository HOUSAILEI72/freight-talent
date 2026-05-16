import { useMemo, useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, Loader2, ChevronRight, UserSearch, CheckCircle,
  FileText, Calculator, Zap, Shield, Brain, X,
} from 'lucide-react'
import { headhuntingApi } from '../../api/headhunting'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { TerminalSelect } from '../../components/terminal/TerminalSelect'
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

const REQUIRED_TERMS = [
  { key: 'type_a',           text: 'A 类型：月收入 ≥ 1 万，服务费为候选人税前年收入 23%，入职 14 日内付 60%，保证期 3 个月届满后 14 日内付清余款' },
  { key: 'type_b',           text: 'B 类型：月收入 < 1 万，服务费为候选人税前 1 个月工资，入职 14 日内付 60%，保证期 1 个月届满后 14 日内付清余款' },
  { key: 'income_scope',     text: 'A/B 月收入或年收入包含基本工资、福利、津贴、分红、住房/车辆津贴、奖金、签约奖金、佣金等' },
  { key: 'replacement',      text: '替换保证：候选人在保证期内离职，我方尽力寻找替换人员且不另收服务费；仅适用于第一笔服务费已付清' },
  { key: 'advertising',      text: '广告及宣传：同意我方在报纸、杂志、展会、媒体等渠道刊登职位广告' },
  { key: 'invoice',          text: '服务费发票于候选人入职之日开具，人民币支付；外币薪酬按 www.xe.com 发票日汇率折算' },
]

// ─── Fee calculation ────────────────────────────────────────────────────────────

function calcAnnualIncome(monthly, months, commissionPeriod, commissionAmount, hasBonus, bonusMonths) {
  const m  = Number(monthly) || 0
  const sm = Number(months) || 13
  const ca = Number(commissionAmount) || 0
  const bm = Number(bonusMonths) || 0

  const commissionAnnual = commissionPeriod === 'monthly'     ? ca * 12
                         : commissionPeriod === 'quarterly'   ? ca * 4
                         : commissionPeriod === 'semi_annual' ? ca * 2
                         : 0
  const bonusAnnual = hasBonus === 'true' ? bm * m : 0
  return m * sm + commissionAnnual + bonusAnnual
}

function calculateHeadhuntingFee(form, addOns) {
  const {
    salaryMin, salaryMax, salaryMonths,
    commissionBonusPeriod, commissionBonusAmount,
    hasYearEndBonus, effectiveBonusMonths,
  } = form
  const { accelerated, backgroundCheck, backgroundCheckCount, personalityReport, personalityReportCount } = addOns

  const sMin = Number(salaryMin) || 0
  const sMax = Number(salaryMax) || 0
  if (!sMin || !sMax) return null

  function feeForSalary(monthly) {
    const annual = calcAnnualIncome(
      monthly, salaryMonths,
      commissionBonusPeriod, commissionBonusAmount,
      hasYearEndBonus, effectiveBonusMonths,
    )
    const monthlyEquiv = annual / 12
    let baseFee, type, guaranteeMonths
    if (monthlyEquiv >= 10000) {
      baseFee = annual * (accelerated ? 0.28 : 0.23)
      type = 'A'
      guaranteeMonths = 3
    } else {
      baseFee = monthlyEquiv * (accelerated ? 1.3 : 1.0)
      type = 'B'
      guaranteeMonths = 1
    }
    return { baseFee, type, guaranteeMonths, annual, monthlyEquiv }
  }

  const low  = feeForSalary(sMin)
  const high = feeForSalary(sMax)

  const addonFee =
    (backgroundCheck   ? (Number(backgroundCheckCount)   || 1) * 500 : 0) +
    (personalityReport ? (Number(personalityReportCount) || 1) * 100 : 0)

  const typeLabel =
    low.type === high.type ? low.type : `${low.type} – ${high.type}`

  const guaranteeLabel =
    low.guaranteeMonths === high.guaranteeMonths
      ? `${low.guaranteeMonths} 个月`
      : `${low.guaranteeMonths} – ${high.guaranteeMonths} 个月`

  return {
    feeLow:       low.baseFee,
    feeHigh:      high.baseFee,
    firstPayLow:  low.baseFee  * 0.6,
    firstPayHigh: high.baseFee * 0.6,
    balanceLow:   low.baseFee  * 0.4,
    balanceHigh:  high.baseFee * 0.4,
    typeLabel,
    guaranteeLabel,
    addonFee,
    totalLow:     low.baseFee  + addonFee,
    totalHigh:    high.baseFee + addonFee,
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function splitTokens(str) {
  if (!str) return []
  const parts = String(str).split(/[,，、\n\r;；]+/).map(s => s.trim()).filter(Boolean)
  const seen = new Set(); const out = []
  for (const p of parts) { if (!seen.has(p)) { seen.add(p); out.push(p) } }
  return out
}

function fmtCNY(n) {
  if (!n || !Number.isFinite(n)) return '—'
  return '¥' + Math.round(n).toLocaleString('zh-CN')
}

function formatThousand(val) {
  if (!val) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

// ─── Design tokens (shared across sub-components) ──────────────────────────────

const T = {
  label:    { display: 'block', fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 4, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.02em' },
  helper:   { fontSize: 10, color: 'var(--t-text-muted)', marginTop: 3, fontFamily: 'var(--t-font-sans)' },
  input:    { width: '100%', padding: '7px 10px', borderRadius: 4, background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '7px 10px', borderRadius: 4, background: 'var(--t-bg-input)', border: '1px solid var(--t-border)', color: 'var(--t-text)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' },
  card:     { background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-lg)', padding: '16px 16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'visible' },
  divider: { borderTop: '1px solid var(--t-border-subtle)', margin: '10px 0' },
}

function SectionHeader({ icon: Icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 10, marginBottom: 14, flexShrink: 0,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24, borderRadius: 4,
        background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
        flexShrink: 0,
      }}>
        <Icon size={12} style={{ color: 'var(--t-text-secondary)' }} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t-text)', lineHeight: 1.2 }}>{title}</div>
        {sub && (
          <div style={{ fontSize: 9, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginTop: 2 }}>{sub}</div>
        )}
      </div>
    </div>
  )
}

function AddOnsHeader({ icon: Icon, title }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      marginBottom: 10,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: 3,
        background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
        flexShrink: 0,
      }}>
        <Icon size={11} style={{ color: 'var(--t-text-secondary)' }} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text)' }}>{title}</span>
    </div>
  )
}

function disabledInput() {
  return { ...T.input, opacity: 0.4, cursor: 'not-allowed' }
}

function chipStyle(active) {
  return active
    ? { padding: '4px 11px', borderRadius: 4, border: '1px solid var(--t-primary)', background: 'var(--t-primary)', color: '#fff', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em' }
    : { padding: '4px 11px', borderRadius: 4, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em' }
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function TermLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--t-font-sans)',
      fontSize: 9,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--t-text-muted)',
      borderBottom: '1px solid var(--t-border-subtle)',
      paddingBottom: 5,
      marginBottom: 8,
      ...style,
    }}>
      {children}
    </div>
  )
}

function FeeRow({ label, low, high, accent }) {
  const color = accent ? 'var(--t-chart-amber)' : 'var(--t-text-secondary)'
  const sameVal = Math.abs(high - low) < 1
  const display = sameVal ? fmtCNY(low) : `${fmtCNY(low)} – ${fmtCNY(high)}`
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color, fontFamily: 'var(--t-font-sans)', fontWeight: accent ? 600 : 400, textAlign: 'right' }}>
        {display}
      </span>
    </div>
  )
}

function TagPill({ text }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 7px', borderRadius: 3,
      background: 'var(--t-primary-muted)', border: '1px solid var(--t-border)',
      color: 'var(--t-chart-blue)', fontSize: 10,
      fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em',
    }}>
      {text}
    </span>
  )
}

// ─── Contact Modal ──────────────────────────────────────────────────────────────

function ContactModal({ user, onConfirm, onCancel, submitting, error }) {
  const [name,   setName]   = useState(user?.name  || '')
  const [phone,  setPhone]  = useState(user?.phone || user?.mobile || '')
  const [email,  setEmail]  = useState(user?.email || '')
  const [wechat, setWechat] = useState('')

  const labelStyle = { display: 'block', fontSize: 11, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em', color: 'var(--t-text-muted)', marginBottom: 4 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} onClick={onCancel} />
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 420,
        background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)',
        borderRadius: 'var(--t-radius-lg)', padding: '24px 24px 20px',
        color: 'var(--t-text)', boxShadow: 'var(--t-shadow-elevated)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--t-font-sans)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 4 }}>
              CONTACT INFO
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)', margin: 0 }}>确认联系信息</h3>
          </div>
          <button onClick={onCancel} disabled={submitting}
            style={{ padding: 4, background: 'transparent', border: 'none', color: 'var(--t-text-muted)', cursor: 'pointer', lineHeight: 1 }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
          {[
            { label: '姓名 *',       val: name,   set: setName,   type: 'text',  ph: '请输入您的姓名' },
            { label: '手机 *',       val: phone,  set: setPhone,  type: 'tel',   ph: '例：+86 138 0000 0000' },
            { label: '邮箱 *',       val: email,  set: setEmail,  type: 'email', ph: 'example@company.com' },
            { label: '微信（选填）', val: wechat, set: setWechat, type: 'text',  ph: '微信号' },
          ].map(f => (
            <div key={f.label}>
              <label style={labelStyle}>{f.label}</label>
              <input type={f.type} style={T.input} value={f.val} placeholder={f.ph}
                onChange={e => f.set(e.target.value)} />
            </div>
          ))}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'var(--t-danger-muted)', border: '1px solid var(--t-danger)', borderRadius: 4, color: 'var(--t-danger)', fontSize: 12, fontFamily: 'var(--t-font-sans)', marginBottom: 14 }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={submitting}
            style={{ flex: 1, height: 34, borderRadius: 4, fontSize: 12, cursor: submitting ? 'not-allowed' : 'pointer', background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-sans)', letterSpacing: '0.02em' }}>
            返回修改
          </button>
          <button onClick={() => onConfirm({ name, phone, email, wechat })} disabled={submitting}
            style={{ flex: 2, height: 34, borderRadius: 4, fontSize: 12, cursor: submitting ? 'not-allowed' : 'pointer', background: submitting ? 'var(--t-primary-muted)' : 'var(--t-primary)', border: 'none', color: '#fff', fontFamily: 'var(--t-font-sans)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? '提交中...' : '确认并提交'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Success Modal ──────────────────────────────────────────────────────────────

function SuccessModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 380,
        background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)',
        borderRadius: 'var(--t-radius-lg)', padding: '36px 28px 28px',
        color: 'var(--t-text)', textAlign: 'center', boxShadow: 'var(--t-shadow-elevated)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px',
          background: 'var(--t-success-muted)', border: '1px solid var(--t-success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle size={24} style={{ color: 'var(--t-success)' }} />
        </div>
        <div style={{ fontFamily: 'var(--t-font-sans)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 10 }}>
          REQUEST SUBMITTED
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text)', marginBottom: 10 }}>需求已提交</h3>
        <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
          专业顾问将于 <span style={{ color: 'var(--t-text)', fontWeight: 600 }}>24 小时</span>内与您取得联系，谢谢！
        </p>
        <button onClick={onClose} style={{
          width: '100%', height: 36, borderRadius: 4,
          background: 'var(--t-primary)', border: 'none', color: '#fff',
          fontFamily: 'var(--t-font-sans)', fontSize: 12, letterSpacing: '0.04em',
          textTransform: 'uppercase', cursor: 'pointer',
        }}>
          返回 Dashboard
        </button>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PersonalHeadhunting({ terminal = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Add-ons state ─────────────────────────────────────────────────────────
  const [accelerated,            setAccelerated]            = useState(false)
  const [backgroundCheck,        setBackgroundCheck]        = useState(false)
  const [backgroundCheckCount,   setBackgroundCheckCount]   = useState(1)
  const [personalityReport,      setPersonalityReport]      = useState(false)
  const [personalityReportCount, setPersonalityReportCount] = useState(1)
  const [noAddOns,               setNoAddOns]               = useState(false)

  // ── Job form state ─────────────────────────────────────────────────────────
  const [title,                   setTitle]                   = useState('')
  const [functionCode,            setFunctionCode]            = useState('')
  const [isManagementRole,        setIsManagementRole]        = useState('')
  const [managementHeadcount,     setManagementHeadcount]     = useState('')
  const [employmentType,          setEmploymentType]          = useState('')
  const [location,                setLocation]                = useState(null)
  const [addressDetail,           setAddressDetail]           = useState('')
  const [experienceYears,         setExperienceYears]         = useState('')
  const [degreeRequired,          setDegreeRequired]          = useState('')
  const [description,             setDescription]             = useState('')
  const [knowledgeText,           setKnowledgeText]           = useState('')
  const [hardSkillText,           setHardSkillText]           = useState('')
  const [softSkillText,           setSoftSkillText]           = useState('')
  const [targetCompaniesText,     setTargetCompaniesText]     = useState('')

  // ── Auto-resize refs ────────────────────────────────────────────────────
  const descRef        = useRef(null)
  const knowledgeRef   = useRef(null)
  const hardSkillRef   = useRef(null)
  const softSkillRef   = useRef(null)
  const targetCoRef    = useRef(null)
  useEffect(() => { const el = descRef.current;      if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [description])
  useEffect(() => { const el = knowledgeRef.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [knowledgeText])
  useEffect(() => { const el = hardSkillRef.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [hardSkillText])
  useEffect(() => { const el = softSkillRef.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [softSkillText])
  useEffect(() => { const el = targetCoRef.current;  if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }, [targetCompaniesText])
  const [salaryMin,               setSalaryMin]               = useState('')
  const [salaryMax,               setSalaryMax]               = useState('')
  const [salaryMonths,            setSalaryMonths]            = useState(13)
  const [salaryMinFocused,        setSalaryMinFocused]        = useState(false)
  const [salaryMaxFocused,        setSalaryMaxFocused]        = useState(false)
  const [commissionBonusPeriod,   setCommissionBonusPeriod]   = useState('not_applicable')
  const [commissionBonusAmount,   setCommissionBonusAmount]   = useState('')
  const [commissionAmountFocused, setCommissionAmountFocused] = useState(false)
  const [hasYearEndBonus,         setHasYearEndBonus]         = useState('')
  const [yearEndBonusQuickSelect, setYearEndBonusQuickSelect] = useState(null)
  const [yearEndBonusCustom,      setYearEndBonusCustom]      = useState('')

  // ── Contact / submit state ────────────────────────────────────────────────
  const [showContactModal,  setShowContactModal]  = useState(false)
  const [showSuccess,       setShowSuccess]       = useState(false)
  const [submitting,        setSubmitting]        = useState(false)
  const [submitError,       setSubmitError]       = useState('')
  const [pageError,         setPageError]         = useState('')
  const [showContractPreview, setShowContractPreview] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const knowledgeArr     = useMemo(() => splitTokens(knowledgeText), [knowledgeText])
  const hardSkillArr     = useMemo(() => splitTokens(hardSkillText), [hardSkillText])
  const softSkillArr     = useMemo(() => splitTokens(softSkillText), [softSkillText])
  const targetCompaniesArr = useMemo(() => splitTokens(targetCompaniesText), [targetCompaniesText])
  const selectedFunction = FUNCTION_OPTIONS.find(f => f.key === functionCode) || null

  const effectiveBonusMonths = useMemo(() => {
    if (hasYearEndBonus !== 'true') return 0
    if (yearEndBonusQuickSelect === 'custom') return Number(yearEndBonusCustom) || 0
    return Number(yearEndBonusQuickSelect) || 0
  }, [hasYearEndBonus, yearEndBonusQuickSelect, yearEndBonusCustom])

  const addOns = { accelerated, backgroundCheck, backgroundCheckCount, personalityReport, personalityReportCount }
  const feeResult = useMemo(() => {
    if (!salaryMin || !salaryMax) return null
    return calculateHeadhuntingFee({
      salaryMin, salaryMax, salaryMonths,
      commissionBonusPeriod, commissionBonusAmount,
      hasYearEndBonus, effectiveBonusMonths,
    }, addOns)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaryMin, salaryMax, salaryMonths, commissionBonusPeriod, commissionBonusAmount, hasYearEndBonus, effectiveBonusMonths, accelerated, backgroundCheck, backgroundCheckCount, personalityReport, personalityReportCount])

  const salaryMinDisplay  = salaryMinFocused ? salaryMin : formatThousand(salaryMin)
  const salaryMaxDisplay  = salaryMaxFocused ? salaryMax : formatThousand(salaryMax)
  const commissionAmountDisplay = commissionAmountFocused ? commissionBonusAmount : formatThousand(commissionBonusAmount)
  const commissionAmountDisabled = commissionBonusPeriod === 'not_applicable'

  // ── Validate ──────────────────────────────────────────────────────────────
  function validateJob() {
    if (!title.trim())        return '请填写岗位名称'
    if (!selectedFunction)    return '请选择岗位板块'
    if (isManagementRole !== 'true' && isManagementRole !== 'false') return '请选择该岗位是否带团队'
    if (isManagementRole === 'true') {
      if (!managementHeadcount.trim()) return '请填写预计团队人数'
      if (!/^\d+$/.test(managementHeadcount.trim())) return '预计团队人数必须为纯数字'
      if (Number(managementHeadcount) <= 0) return '预计团队人数必须大于 0'
    }
    if (!location?.location_code)  return '请选择岗位工作城市'
    if (!location.location_name || !location.location_path || !location.location_type) return '地区数据不完整，请重新选择'
    if (!employmentType)           return '请选择应聘类型'
    if (addressDetail.trim().length > 200) return '详细地址不能超过 200 个字符'
    if (!description.trim())       return '请填写岗位职责'
    if (experienceYears === '')    return '请选择经验要求'
    if (!degreeRequired.trim())    return '请填写最低学历要求'
    if (knowledgeArr.length === 0) return '请填写知识要求'
    if (hardSkillArr.length === 0) return '请填写硬技能要求'
    if (softSkillArr.length === 0) return '请填写软技能要求'
    const sMin = Number(salaryMin); const sMax = Number(salaryMax)
    if (!Number.isFinite(sMin) || !Number.isFinite(sMax) || sMin <= 0 || sMax <= 0) return '请填写有效的薪资区间（数字）'
    if (sMin > sMax) return '最低月薪不能大于最高月薪'
    if (![12, 13, 14].includes(Number(salaryMonths))) return '薪资月数只能是 12 / 13 / 14'
    if (commissionBonusPeriod !== 'not_applicable') {
      if (!commissionBonusAmount.trim()) return '请填写提成/计件奖金预估平均额'
      const ca = Number(commissionBonusAmount)
      if (!Number.isFinite(ca) || ca <= 0) return '预估平均额必须为有效数字'
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

  function validateContact(contact) {
    const name = (contact.name || '').trim()
    const phone = (contact.phone || '').trim()
    const email = (contact.email || '').trim()
    if (!name) return '请填写联系人姓名'
    if (!phone) return '请填写联系人手机'
    if (!email) return '请填写联系人邮箱'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '联系人邮箱格式不正确'
    const digits = phone.replace(/[^\d]/g, '')
    if (!/^[\d+\-\s()]+$/.test(phone) || digits.length < 7 || digits.length > 30) return '联系人手机格式不正确'
    return null
  }

  function handleConfirmPublish() {
    setPageError('')
    setSubmitError('')
    const jobErr = validateJob()
    if (jobErr) { setPageError(jobErr); return }
    if (!feeResult) { setPageError('请填写有效薪资以完成费用试算'); return }
    setShowContactModal(true)
  }

  async function handleContactSubmit(contact) {
    const contactErr = validateContact(contact)
    if (contactErr) { setSubmitError(contactErr); return }

    setSubmitError('')
    setSubmitting(true)

    const sMin = Number(salaryMin); const sMax = Number(salaryMax)
    const yearEndBonusMonthsVal = hasYearEndBonus === 'true'
      ? (yearEndBonusQuickSelect === 'custom' ? Number(yearEndBonusCustom) : yearEndBonusQuickSelect)
      : null

    const payload = {
      service_type: 'personal',
      job: {
        title:                   title.trim(),
        function_code:           selectedFunction.key,
        function_name:           selectedFunction.label,
        business_type:           selectedFunction.label,
        is_management_role:      isManagementRole === 'true',
        management_headcount:    isManagementRole === 'true' ? Number(managementHeadcount) : null,
        employment_type:         employmentType,
        location_code:           location.location_code,
        location_name:           location.location_name,
        location_path:           location.location_path,
        location_type:           location.location_type,
        address:                 addressDetail.trim() || null,
        experience_required:     experienceYears,
        degree_required:         degreeRequired,
        description:             description.trim(),
        knowledge_requirements:  knowledgeArr,
        hard_skill_requirements: hardSkillArr,
        soft_skill_requirements: softSkillArr,
        target_companies:        targetCompaniesArr.length > 0 ? targetCompaniesArr : null,
        salary_min:              sMin,
        salary_max:              sMax,
        salary_months:           Number(salaryMonths),
        commission_bonus_period: commissionBonusPeriod,
        commission_bonus_amount: commissionBonusPeriod !== 'not_applicable' ? Number(commissionBonusAmount) : null,
        has_year_end_bonus:      hasYearEndBonus === 'true',
        year_end_bonus_months:   yearEndBonusMonthsVal,
      },
      terms:    Object.fromEntries(REQUIRED_TERMS.map(t => [t.key, true])),
      add_ons: {
        accelerated,
        background_check:         backgroundCheck,
        background_check_count:   backgroundCheck ? Number(backgroundCheckCount) : 0,
        personality_report:       personalityReport,
        personality_report_count: personalityReport ? Number(personalityReportCount) : 0,
      },
      fee_snapshot: feeResult,
      contact,
    }

    try {
      await headhuntingApi.createRequest(payload)
      setShowContactModal(false)
      setShowSuccess(true)
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || '提交失败，请稍后重试'
      setSubmitError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleNoAddOns(val) {
    setNoAddOns(val)
    if (val) { setAccelerated(false); setBackgroundCheck(false); setPersonalityReport(false) }
  }
  function toggleAddon(setter, val) {
    setter(val)
    if (val) setNoAddOns(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="terminal-mode flex-1 w-full min-w-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid var(--t-border-subtle)' }}
      >
        <div>
          <div style={{ fontFamily: 'var(--t-font-sans)', fontSize: 9, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 3 }}>
            PERSONAL · HEADHUNTING REQUEST
          </div>
          <h1 className="terminal-page-title-safe" style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)', margin: 0 }}>个人猎头服务</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>
            提交后 24h 内联系
          </span>
          <div style={{ width: 1, height: 16, background: 'var(--t-border)' }} />
          <button
            onClick={() => navigate('/employer/dashboard')}
            style={{ height: 30, padding: '0 12px', borderRadius: 4, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-sans)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            取消
          </button>
          <button
            onClick={handleConfirmPublish}
            disabled={submitting}
            style={{ height: 30, display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', borderRadius: 4, border: 'none', background: submitting ? 'var(--t-primary-muted)' : 'var(--t-primary)', color: '#fff', fontFamily: 'var(--t-font-sans)', fontSize: 11, cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.08em', fontWeight: 600, opacity: submitting ? 0.75 : 1 }}
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            {submitting ? '提交中...' : '确认发布'}
            {!submitting && <ChevronRight size={12} />}
          </button>
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────────── */}
      {pageError && (
        <div
          className="flex-shrink-0 flex items-center gap-2 mx-6 mt-2"
          style={{ padding: '7px 12px', background: 'var(--t-danger-muted)', border: '1px solid var(--t-danger)', borderRadius: 4, color: 'var(--t-danger)', fontSize: 12, fontFamily: 'var(--t-font-sans)' }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {pageError}
        </div>
      )}

      {/* ── Three-column layout ────────────────────────────────────────────── */}
      <div
        className="terminal-form-grid-3 terminal-headhunting-form-grid terminal-scrollbar"
      >

        {/* ── Col 1: 服务条款 & 增值服务 ────────────────────────────────────── */}
        <div style={T.card}>
          <SectionHeader icon={FileText} title="重要服务条款" sub="TERMS OF SERVICE" />
          <div className="flex-1 min-h-0 overflow-y-auto terminal-scrollbar" style={{ paddingRight: 2 }}>

            {/* Terms list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {REQUIRED_TERMS.map((term, idx) => (
                <div key={term.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--t-border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0, marginTop: 2, lineHeight: 1, fontFamily: 'var(--t-font-sans)', fontVariantNumeric: 'tabular-nums' }}>{idx + 1}</span>
                  <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', lineHeight: 1.65 }}>{term.text}</span>
                </div>
              ))}
            </div>

            {/* Contract template */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', marginBottom: 12,
              background: 'var(--t-bg-input)',
              border: '1px solid var(--t-border-subtle)',
              borderRadius: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                <FileText size={13} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-sans)', truncate: true }}>
                  《个人猎头服务合同》模板
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowContractPreview(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    height: 24, padding: '0 8px', borderRadius: 3,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border)',
                    color: 'var(--t-text-secondary)',
                    fontSize: 10, fontFamily: 'var(--t-font-sans)',
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.color = 'var(--t-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)' }}
                >
                  预览
                </button>
                <a
                  href="/contracts/personal-headhunting-contract.pdf"
                  download="个人猎头服务合同模板.pdf"
                  title="下载合同"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    height: 24, padding: '0 8px', borderRadius: 3,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border)',
                    color: 'var(--t-text-secondary)',
                    fontSize: 10, fontFamily: 'var(--t-font-sans)',
                    cursor: 'pointer', textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-chart-blue)'; e.currentTarget.style.color = 'var(--t-chart-blue)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)' }}
                >
                  下载
                </a>
              </div>
            </div>

            {/* Add-ons */}
            <div style={T.divider} />
            <AddOnsHeader icon={Zap} title="增值服务" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Accelerated */}
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={accelerated}
                  onChange={e => toggleAddon(setAccelerated, e.target.checked)}
                  style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>⚡ 加速服务</span>
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>
                    1 个月内成功入职 · A 类 28% / B 类 +30%
                  </span>
                </span>
              </label>

              {/* Background check */}
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={backgroundCheck}
                    onChange={e => toggleAddon(setBackgroundCheck, e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>候选人背调</span>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>¥500 / 份</span>
                  </span>
                </label>
                {backgroundCheck && (
                  <div style={{ marginTop: 7, marginLeft: 21, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>数量</span>
                    <input type="number" min={1} max={99}
                      style={{ ...T.input, width: 64, padding: '4px 8px', fontSize: 12 }}
                      value={backgroundCheckCount}
                      onChange={e => setBackgroundCheckCount(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                )}
              </div>

              {/* Personality report */}
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={personalityReport}
                    onChange={e => toggleAddon(setPersonalityReport, e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>性格测试 &amp; 职业报告</span>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>¥100 / 份</span>
                  </span>
                </label>
                {personalityReport && (
                  <div style={{ marginTop: 7, marginLeft: 21, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>数量</span>
                    <input type="number" min={1} max={99}
                      style={{ ...T.input, width: 64, padding: '4px 8px', fontSize: 12 }}
                      value={personalityReportCount}
                      onChange={e => setPersonalityReportCount(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                )}
              </div>

              {/* No add-ons */}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={noAddOns}
                  onChange={e => toggleNoAddOns(e.target.checked)}
                  style={{ flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                <span style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>无需，谢谢</span>
              </label>
            </div>
          </div>
        </div>

        {/* ── Col 2: 岗位信息 ───────────────────────────────────────────────── */}
        <div style={T.card}>
          <SectionHeader icon={UserSearch} title="岗位信息" sub="JOB DETAILS" />
          <div className="flex-1 min-h-0 overflow-y-auto terminal-scrollbar" style={{ paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* 岗位名称 */}
            <div>
              <label style={T.label}>岗位名称 *</label>
              <input style={T.input} placeholder="例：海运操作主管" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            {/* 岗位板块 */}
            <div>
              <label style={T.label}>岗位板块 *</label>
              <TerminalSelect
                value={functionCode}
                onChange={setFunctionCode}
                options={[{ value: '', label: '请选择板块' }, ...FUNCTION_OPTIONS.map(f => ({ value: f.key, label: f.label }))]}
                placeholder="请选择板块"
                hasValue={!!functionCode}
              />
            </div>

            {/* 是否带团队 */}
            <div style={{ display: 'grid', gridTemplateColumns: isManagementRole === 'true' ? '1fr 1fr' : '1fr', gap: 8 }}>
              <div>
                <label style={T.label}>是否带团队 *</label>
                <TerminalSelect
                  value={isManagementRole}
                  onChange={(val) => { setIsManagementRole(val); if (val !== 'true') setManagementHeadcount('') }}
                  options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]}
                  placeholder="请选择"
                  hasValue={isManagementRole === 'true' || isManagementRole === 'false'}
                />
              </div>
              {isManagementRole === 'true' && (
                <div>
                  <label style={T.label}>预计团队人数 *</label>
                  <input style={T.input} inputMode="numeric" pattern="[0-9]*" placeholder="例：5"
                    value={managementHeadcount}
                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*$/.test(v)) setManagementHeadcount(v) }} />
                </div>
              )}
            </div>

            {/* 应聘类型 */}
            <div>
              <label style={T.label}>应聘类型 *</label>
              <TerminalSelect
                value={employmentType}
                onChange={setEmploymentType}
                options={[{ value: '', label: '请选择' }, ...EMPLOYMENT_TYPE_OPTIONS.map(t => ({ value: t, label: t }))]}
                placeholder="请选择"
                hasValue={!!employmentType}
              />
            </div>

            {/* 城市 */}
            <div>
              <label style={T.label}>岗位工作城市 *</label>
              <RegionSelector value={location} onChange={setLocation} terminal placeholder="请选择岗位城市" />
              {location?.location_path && (
                <p style={T.helper}>已选：{location.location_path}{location.business_area_name ? `（${location.business_area_name}）` : ''}</p>
              )}
            </div>

            {/* 详细地址 */}
            <div>
              <label style={T.label}>详细地址</label>
              <input style={T.input} maxLength={200} placeholder="例：杨浦区安联大厦 1108-2"
                value={addressDetail} onChange={e => setAddressDetail(e.target.value)} />
            </div>

            {/* 经验 + 学历 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={T.label}>经验要求 *</label>
                <TerminalSelect
                  value={experienceYears}
                  onChange={setExperienceYears}
                  options={[{ value: '', label: '请选择' }, ...EXPERIENCE_YEAR_OPTIONS.map(y => ({ value: y, label: y }))]}
                  placeholder="请选择"
                  hasValue={!!experienceYears}
                />
              </div>
              <div>
                <label style={T.label}>最低学历 *</label>
                <TerminalSelect
                  value={degreeRequired}
                  onChange={setDegreeRequired}
                  options={[{ value: '', label: '请选择' }, ...DEGREE_REQUIRED_OPTIONS.map(d => ({ value: d, label: d }))]}
                  placeholder="请选择"
                  hasValue={!!degreeRequired}
                />
              </div>
            </div>

            {/* 岗位职责 */}
            <div>
              <label style={T.label}>岗位职责 *</label>
              <textarea ref={descRef} rows={4} style={{ ...T.textarea, overflow: 'hidden' }} placeholder="描述该岗位的主要工作职责..."
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            {/* 技能区 */}
            {[
              { label: '知识要求 *', val: knowledgeText, set: setKnowledgeText, arr: knowledgeArr, ph: '例：国际贸易, HS编码, 危险品分类', taRef: knowledgeRef },
              { label: '硬技能要求 *', val: hardSkillText, set: setHardSkillText, arr: hardSkillArr, ph: 'Cargowise, Excel, SAP', taRef: hardSkillRef },
              { label: '软技能要求 *', val: softSkillText, set: setSoftSkillText, arr: softSkillArr, ph: '英语沟通, 抗压能力, 团队协作', taRef: softSkillRef },
            ].map(sk => (
              <div key={sk.label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ ...T.label, marginBottom: 0 }}>{sk.label}</label>
                  {sk.arr.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--t-chart-blue)', fontFamily: 'var(--t-font-sans)' }}>
                      {sk.arr.length} 项
                    </span>
                  )}
                </div>
                <textarea ref={sk.taRef} rows={2} style={{ ...T.textarea, overflow: 'hidden' }} placeholder={sk.ph}
                  value={sk.val} onChange={e => sk.set(e.target.value)} />
                {sk.arr.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    {sk.arr.slice(0, 8).map(p => <TagPill key={p} text={p} />)}
                    {sk.arr.length > 8 && <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)', alignSelf: 'center' }}>+{sk.arr.length - 8}</span>}
                  </div>
                )}
              </div>
            ))}

            {/* 对标公司 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ ...T.label, marginBottom: 0 }}>对标公司</label>
                {targetCompaniesArr.length > 0 && (
                  <span style={{ fontSize: 10, color: 'var(--t-chart-blue)', fontFamily: 'var(--t-font-sans)' }}>
                    {targetCompaniesArr.length} 家
                  </span>
                )}
              </div>
              <textarea
                ref={targetCoRef}
                rows={2}
                style={{ ...T.textarea, overflow: 'hidden' }}
                placeholder="例：马士基, MSC, 中远海运（逗号分隔）"
                value={targetCompaniesText}
                onChange={e => setTargetCompaniesText(e.target.value)}
              />
              <p style={T.helper}>填写目标候选人的来源公司，帮助顾问精准定向寻访</p>
              {targetCompaniesArr.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {targetCompaniesArr.slice(0, 8).map(p => <TagPill key={p} text={p} />)}
                  {targetCompaniesArr.length > 8 && (
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)', alignSelf: 'center' }}>
                      +{targetCompaniesArr.length - 8}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 薪资区间 */}
            <div style={T.divider} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <label style={T.label}>最低月薪 *</label>
                <input type="text" inputMode="numeric" style={T.input} placeholder="20,000"
                  value={salaryMinDisplay}
                  onFocus={() => setSalaryMinFocused(true)} onBlur={() => setSalaryMinFocused(false)}
                  onChange={e => { const r = e.target.value.replace(/,/g, ''); if (r === '' || /^\d+$/.test(r)) setSalaryMin(r) }} />
              </div>
              <div>
                <label style={T.label}>最高月薪 *</label>
                <input type="text" inputMode="numeric" style={T.input} placeholder="30,000"
                  value={salaryMaxDisplay}
                  onFocus={() => setSalaryMaxFocused(true)} onBlur={() => setSalaryMaxFocused(false)}
                  onChange={e => { const r = e.target.value.replace(/,/g, ''); if (r === '' || /^\d+$/.test(r)) setSalaryMax(r) }} />
              </div>
              <div>
                <label style={T.label}>薪资月数 *</label>
                <TerminalSelect
                  value={String(salaryMonths)}
                  onChange={(val) => setSalaryMonths(Number(val))}
                  options={SALARY_MONTHS_OPTIONS.map(m => ({ value: String(m), label: `${m} 个月` }))}
                  placeholder="请选择"
                  hasValue={true}
                />
              </div>
            </div>

            {/* 提成奖金 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={T.label}>提成 / 计件奖金</label>
                <TerminalSelect
                  value={commissionBonusPeriod}
                  onChange={(val) => { setCommissionBonusPeriod(val); if (val === 'not_applicable') setCommissionBonusAmount('') }}
                  options={COMMISSION_BONUS_PERIODS.map(p => ({ value: p.value, label: p.label }))}
                  placeholder="请选择"
                  hasValue={commissionBonusPeriod !== 'not_applicable'}
                />
              </div>
              <div>
                <label style={T.label}>预估平均额</label>
                <input type="text" inputMode="numeric" style={commissionAmountDisabled ? disabledInput() : T.input}
                  placeholder="例：5,000" value={commissionAmountDisabled ? '' : commissionAmountDisplay}
                  disabled={commissionAmountDisabled}
                  onFocus={() => setCommissionAmountFocused(true)}
                  onBlur={() => setCommissionAmountFocused(false)}
                  onChange={e => {
                    const r = e.target.value.replace(/,/g, '')
                    if (r === '' || /^\d+$/.test(r)) setCommissionBonusAmount(r)
                  }} />
                {commissionAmountDisabled && <p style={T.helper}>请先选择奖金周期</p>}
              </div>
            </div>

            {/* 年终奖 */}
            <div>
              <label style={T.label}>是否有年终奖 *</label>
              <TerminalSelect
                value={hasYearEndBonus}
                onChange={(val) => { setHasYearEndBonus(val); if (val !== 'true') { setYearEndBonusQuickSelect(null); setYearEndBonusCustom('') } }}
                options={[{ value: '', label: '请选择' }, { value: 'true', label: '是' }, { value: 'false', label: '否' }]}
                placeholder="请选择"
                hasValue={hasYearEndBonus === 'true' || hasYearEndBonus === 'false'}
              />
            </div>
            {hasYearEndBonus === 'true' && (
              <div>
                <label style={T.label}>年终奖预估平均额 *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {YEAR_END_BONUS_QUICK.map(opt => (
                    <button key={String(opt.value)} type="button"
                      style={chipStyle(yearEndBonusQuickSelect === opt.value)}
                      onClick={() => { setYearEndBonusQuickSelect(opt.value); if (opt.value !== 'custom') setYearEndBonusCustom('') }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {yearEndBonusQuickSelect === 'custom' && (
                  <div>
                    <input type="number" step="0.1" style={T.input} placeholder="例：2 表示 2 个月基本工资"
                      value={yearEndBonusCustom} onChange={e => setYearEndBonusCustom(e.target.value)} />
                    <p style={T.helper}>0–24 之间，可填小数</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Col 3: 费用试算 ───────────────────────────────────────────── */}
        <div style={T.card}>
          <SectionHeader icon={Calculator} title="费用试算" sub="FEE ESTIMATE" />
          <div className="flex-1 min-h-0 overflow-y-auto terminal-scrollbar" style={{ paddingRight: 2 }}>
            {feeResult ? (
              <>
                {/* Service fee range */}
                <div style={{ marginBottom: 14 }}>
                  <TermLabel>服务费区间</TermLabel>
                  <FeeRow label="服务费（低估）" low={feeResult.feeLow}  high={feeResult.feeLow}  />
                  <FeeRow label="服务费（高估）" low={feeResult.feeHigh} high={feeResult.feeHigh} accent />
                </div>

                {/* Payment split */}
                <div style={{ marginBottom: 14 }}>
                  <TermLabel>付款拆分</TermLabel>
                  <FeeRow label="第一笔（60%）" low={feeResult.firstPayLow}  high={feeResult.firstPayHigh} />
                  <FeeRow label="余款（40%）"   low={feeResult.balanceLow}   high={feeResult.balanceHigh}  />
                </div>

                {/* Classification */}
                <div style={{ marginBottom: 14 }}>
                  <TermLabel>服务分类</TermLabel>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>类型</span>
                    <span style={{ fontSize: 12, color: 'var(--t-text)', fontFamily: 'var(--t-font-sans)', fontWeight: 600 }}>{feeResult.typeLabel} 类</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>保证期</span>
                    <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-sans)' }}>{feeResult.guaranteeLabel}</span>
                  </div>
                </div>

                {/* Add-on fees */}
                {feeResult.addonFee > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <TermLabel>增值服务费（另计）</TermLabel>
                    {backgroundCheck && (
                      <FeeRow label={`背调 × ${backgroundCheckCount}`}
                        low={Number(backgroundCheckCount) * 500} high={Number(backgroundCheckCount) * 500} />
                    )}
                    {personalityReport && (
                      <FeeRow label={`测评报告 × ${personalityReportCount}`}
                        low={Number(personalityReportCount) * 100} high={Number(personalityReportCount) * 100} />
                    )}
                  </div>
                )}

                {/* Total */}
                <div style={{ borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', padding: '12px 12px 10px', marginBottom: 12 }}>
                  <TermLabel style={{ marginBottom: 10 }}>合计预估</TermLabel>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>最低</span>
                    <span style={{ fontSize: 18, color: 'var(--t-chart-amber)', fontFamily: 'var(--t-font-sans)', fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {fmtCNY(feeResult.totalLow)}
                    </span>
                  </div>
                  <div style={{ height: 1, background: 'var(--t-border-subtle)', marginBottom: 6 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>最高</span>
                    <span style={{ fontSize: 18, color: 'var(--t-chart-amber)', fontFamily: 'var(--t-font-sans)', fontWeight: 700, letterSpacing: '-0.01em' }}>
                      {fmtCNY(feeResult.totalHigh)}
                    </span>
                  </div>
                </div>

                {/* Disclaimer */}
                <div style={{ padding: '9px 10px', background: 'var(--t-bg-input)', border: '1px solid var(--t-border-subtle)', borderRadius: 4, marginBottom: 14 }}>
                  <p style={{ fontSize: 10, color: 'var(--t-text-muted)', lineHeight: 1.65, margin: 0, fontFamily: 'var(--t-font-sans)' }}>
                    以上为预估费用，实际服务费以候选人入职时的实际薪酬为准。增值服务费（背调 / 测评）不纳入 60% / 40% 分期，入职后单独结算。
                  </p>
                </div>
              </>
            ) : (
              /* Empty state */
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '55%', gap: 12, color: 'var(--t-text-muted)', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator size={18} style={{ color: 'var(--t-text-muted)' }} />
                </div>
                <div>
                  <p style={{ fontSize: 12, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.06em', color: 'var(--t-text-secondary)', marginBottom: 4 }}>
                    填写薪资后自动试算
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-sans)' }}>
                    最低月薪 + 最高月薪 → 费用区间
                  </p>
                </div>
              </div>
            )}

            {/* Submit hint */}
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 12 }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--t-font-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--t-text-muted)', display: 'block', marginBottom: 4 }}>SUBMIT</span>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.6, margin: 0 }}>
                点击右上角「确认发布」填写联系信息，我们将在 24 小时内与您取得联系。
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Contact modal */}
      {showContactModal && (
        <ContactModal
          user={user}
          onConfirm={handleContactSubmit}
          onCancel={() => { setShowContactModal(false); setSubmitError('') }}
          submitting={submitting}
          error={submitError}
        />
      )}

      {/* Success modal */}
      {showSuccess && (
        <SuccessModal onClose={() => navigate('/employer/dashboard')} />
      )}

      {/* Contract preview modal */}
      {showContractPreview && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }} onClick={() => setShowContractPreview(false)} />
          <div style={{
            position: 'relative', zIndex: 10,
            width: '90vw', height: '90vh',
            background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)',
            borderRadius: 'var(--t-radius-lg)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', borderBottom: '1px solid var(--t-border-subtle)', flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--t-font-sans)', color: 'var(--t-text-secondary)', letterSpacing: '0.04em' }}>
                《个人猎头服务合同》模板
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href="/contracts/personal-headhunting-contract.pdf"
                  download="个人猎头服务合同模板.pdf"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    height: 26, padding: '0 10px', borderRadius: 3,
                    background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
                    color: 'var(--t-text-secondary)', fontSize: 10,
                    fontFamily: 'var(--t-font-sans)', cursor: 'pointer', textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-chart-blue)'; e.currentTarget.style.color = 'var(--t-chart-blue)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)' }}
                >
                  下载
                </a>
                <button
                  onClick={() => setShowContractPreview(false)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 3, background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text-muted)', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-danger)'; e.currentTarget.style.color = 'var(--t-danger)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-muted)' }}
                >
                  <X size={13} />
                </button>
              </div>
            </div>
            <iframe
              src="/contracts/personal-headhunting-contract.pdf"
              style={{ flex: 1, border: 'none', width: '100%' }}
              title="个人猎头服务合同预览"
            />
          </div>
        </div>
      )}
    </div>
  )
}
