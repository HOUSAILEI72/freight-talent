import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle, Loader2, ChevronRight, Users, CheckCircle,
  FileText, Calculator, Zap, Shield, Brain, X, ClipboardList, Plus,
} from 'lucide-react'
import { headhuntingApi } from '../../api/headhunting'
import { useAuth } from '../../context/AuthContext'
import RegionSelector from '../../components/RegionSelector'

// ─── Constants ──────────────────────────────────────────────────────────────

const TEAM_REQUIRED_TERMS = [
  { key: 'team_fixed_fee',         text: '团队猎头服务费为固定服务费用 180,000 元，分 12 个月支付完毕，每月支付，即每月固定服务费 15,000 元' },
  { key: 'team_departure_clause',  text: '若出现团队整体离职的（无论主动或被动），离职的次月起至 12 个月剩余固定服务费将无需继续履行支付' },
  { key: 'team_invoice',           text: '服务费发票将于团队负责人入职之日开具，后续月固定服务费于每月 10 日开具，服务费以人民币支付；若薪酬以其他货币计算，服务费根据 www.xe.com 发票日当日汇率折算成人民币' },
]

// ─── Fee calculation ─────────────────────────────────────────────────────────

function calculateTeamHeadhuntingFee(addOns) {
  const baseTotal   = addOns.accelerated ? 210000 : 180000
  const monthlyFee  = addOns.accelerated ? 17500  : 15000
  const leaderBgFee = addOns.leaderBackgroundCheck
    ? (addOns.leaderBackgroundCheckCount || 1) * 500 : 0
  const memberBgFee = addOns.memberBackgroundCheck
    ? (addOns.memberBackgroundCheckCount || 1) * 500 : 0
  const reportFee   = addOns.memberPersonalityReport
    ? (addOns.memberPersonalityReportCount || 1) * 100 : 0
  const addonFee    = leaderBgFee + memberBgFee + reportFee

  return {
    baseTotal,
    monthlyFee,
    months: 12,
    addonFee,
    total: baseTotal + addonFee,
    leaderBgFee,
    memberBgFee,
    reportFee,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Design tokens ───────────────────────────────────────────────────────────

const T = {
  label:    { display: 'block', fontSize: 11, color: 'var(--t-text-secondary)', marginBottom: 4, fontFamily: 'var(--t-font-mono)', letterSpacing: '0.05em' },
  helper:   { fontSize: 10, color: 'var(--t-text-muted)', marginTop: 3, fontFamily: 'var(--t-font-mono)' },
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
          <div style={{ fontSize: 9, fontFamily: 'var(--t-font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginTop: 2 }}>{sub}</div>
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

function TermLabel({ children, style }) {
  return (
    <div style={{
      fontFamily: 'var(--t-font-mono)', fontSize: 9, letterSpacing: '0.18em',
      textTransform: 'uppercase', color: 'var(--t-text-muted)',
      borderBottom: '1px solid var(--t-border-subtle)', paddingBottom: 5, marginBottom: 8,
      ...style,
    }}>
      {children}
    </div>
  )
}

function FeeRow({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: accent ? 'var(--t-chart-amber)' : 'var(--t-text-secondary)', fontFamily: 'var(--t-font-mono)', fontWeight: accent ? 600 : 400 }}>
        {fmtCNY(value)}
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
      fontFamily: 'var(--t-font-mono)', letterSpacing: '0.04em',
    }}>
      {text}
    </span>
  )
}

// ─── TokenTextArea: comma/newline-separated tag input ────────────────────────

function TokenTextArea({ label, value, onChange, placeholder, required }) {
  const tokens = useMemo(() => splitTokens(value), [value])
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <label style={{ ...T.label, marginBottom: 0 }}>{label}{required ? ' *' : ''}</label>
        {tokens.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--t-chart-blue)', fontFamily: 'var(--t-font-mono)' }}>
            已识别 {tokens.length} 项
          </span>
        )}
      </div>
      <textarea
        rows={2}
        style={T.textarea}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {tokens.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          {tokens.slice(0, 8).map(t => <TagPill key={t} text={t} />)}
          {tokens.length > 8 && (
            <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', alignSelf: 'center' }}>
              +{tokens.length - 8}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CityPickerSection: multi-city selector with per-city address ────────────
// cities: [{id, location, address}]

let _cityId = 0
function newCityEntry(location = null) {
  return { id: ++_cityId, location, address: '' }
}

function CityPickerSection({ cities, onChange }) {
  function addCity() {
    onChange([...cities, newCityEntry()])
  }
  function removeCity(id) {
    onChange(cities.filter(c => c.id !== id))
  }
  function updateLocation(id, location) {
    onChange(cities.map(c => c.id === id ? { ...c, location } : c))
  }
  function updateAddress(id, address) {
    onChange(cities.map(c => c.id === id ? { ...c, address } : c))
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label style={{ ...T.label, marginBottom: 0 }}>所在城市偏向 *</label>
        {cities.length > 0 && (
          <span style={{ fontSize: 10, color: 'var(--t-chart-blue)', fontFamily: 'var(--t-font-mono)' }}>
            已添加 {cities.length} 个
          </span>
        )}
      </div>

      {/* Existing city entries */}
      {cities.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
          {cities.map((entry, idx) => (
            <div key={entry.id} style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontFamily: 'var(--t-font-mono)', letterSpacing: '0.12em', color: 'var(--t-text-muted)', textTransform: 'uppercase', flexShrink: 0 }}>
                  城市 {idx + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <RegionSelector
                    terminal
                    value={entry.location}
                    onChange={loc => updateLocation(entry.id, loc)}
                    placeholder="选择省市区"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCity(entry.id)}
                  style={{ flexShrink: 0, padding: 4, background: 'transparent', border: 'none', color: 'var(--t-text-muted)', cursor: 'pointer', lineHeight: 1 }}
                >
                  <X size={13} />
                </button>
              </div>
              {entry.location && (
                <input
                  style={{ ...T.input, fontSize: 12 }}
                  placeholder="详细地址（选填）"
                  value={entry.address}
                  onChange={e => updateAddress(entry.id, e.target.value)}
                />
              )}
              {entry.location?.location_path && (
                <p style={{ ...T.helper, marginTop: 4 }}>
                  {entry.location.location_path}
                  {entry.location.business_area_name ? `（${entry.location.business_area_name}）` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      <button
        type="button"
        onClick={addCity}
        style={{ display: 'flex', alignItems: 'center', gap: 5, height: 32, padding: '0 12px', borderRadius: 4, border: '1px dashed var(--t-border)', background: 'transparent', color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em', width: '100%', justifyContent: 'center' }}
      >
        <Plus size={12} />
        添加城市
      </button>
    </div>
  )
}

// ─── Contact Modal ────────────────────────────────────────────────────────────

function ContactModal({ user, onConfirm, onCancel, submitting, error }) {
  const [name,   setName]   = useState(user?.name  || '')
  const [phone,  setPhone]  = useState(user?.phone || user?.mobile || '')
  const [email,  setEmail]  = useState(user?.email || '')
  const [wechat, setWechat] = useState('')

  const labelStyle = { display: 'block', fontSize: 11, fontFamily: 'var(--t-font-mono)', letterSpacing: '0.1em', color: 'var(--t-text-muted)', marginBottom: 4 }

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
            <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 4 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'var(--t-danger-muted)', border: '1px solid var(--t-danger)', borderRadius: 4, color: 'var(--t-danger)', fontSize: 12, fontFamily: 'var(--t-font-mono)', marginBottom: 14 }}>
            <AlertCircle size={13} style={{ flexShrink: 0 }} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} disabled={submitting}
            style={{ flex: 1, height: 34, borderRadius: 4, fontSize: 12, cursor: submitting ? 'not-allowed' : 'pointer', background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-mono)', letterSpacing: '0.05em' }}>
            返回修改
          </button>
          <button onClick={() => onConfirm({ name, phone, email, wechat })} disabled={submitting}
            style={{ flex: 2, height: 34, borderRadius: 4, fontSize: 12, cursor: submitting ? 'not-allowed' : 'pointer', background: submitting ? 'var(--t-primary-muted)' : 'var(--t-primary)', border: 'none', color: '#fff', fontFamily: 'var(--t-font-mono)', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {submitting && <Loader2 size={13} className="animate-spin" />}
            {submitting ? '提交中...' : '确认并提交'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Success Modal ────────────────────────────────────────────────────────────

function SuccessModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{
        position: 'relative', zIndex: 10, width: '100%', maxWidth: 400,
        background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)',
        borderRadius: 'var(--t-radius-lg)', padding: '36px 28px 28px',
        color: 'var(--t-text)', textAlign: 'center', boxShadow: 'var(--t-shadow-elevated)',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', margin: '0 auto 18px', background: 'var(--t-success-muted)', border: '1px solid var(--t-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={24} style={{ color: 'var(--t-success)' }} />
        </div>
        <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 10 }}>
          REQUEST SUBMITTED
        </div>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text)', marginBottom: 10 }}>需求已提交</h3>
        <p style={{ fontSize: 13, color: 'var(--t-text-secondary)', lineHeight: 1.7, marginBottom: 24 }}>
          您的需求我们已收到，专业顾问将于 <span style={{ color: 'var(--t-text)', fontWeight: 600 }}>24 小时</span>内与您取得联系，谢谢！
        </p>
        <button onClick={onClose} style={{ width: '100%', height: 36, borderRadius: 4, background: 'var(--t-primary)', border: 'none', color: '#fff', fontFamily: 'var(--t-font-mono)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
          我知道了
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TeamHeadhunting() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Add-ons ───────────────────────────────────────────────────────────────
  const [accelerated,                  setAccelerated]                  = useState(false)
  const [leaderBackgroundCheck,        setLeaderBackgroundCheck]        = useState(false)
  const [leaderBackgroundCheckCount,   setLeaderBackgroundCheckCount]   = useState(1)
  const [memberBackgroundCheck,        setMemberBackgroundCheck]        = useState(false)
  const [memberBackgroundCheckCount,   setMemberBackgroundCheckCount]   = useState(1)
  const [memberPersonalityReport,      setMemberPersonalityReport]      = useState(false)
  const [memberPersonalityReportCount, setMemberPersonalityReportCount] = useState(1)
  const [noAddOns,                     setNoAddOns]                     = useState(false)

  // ── Team requirement fields ───────────────────────────────────────────────
  const [summary,                    setSummary]                    = useState('')
  const [preferredCities,            setPreferredCities]            = useState([])
  const [businessFocusText,          setBusinessFocusText]          = useState('')
  const [customerFocusText,          setCustomerFocusText]          = useState('')
  const [supplyResourceFocusText,    setSupplyResourceFocusText]    = useState('')
  const [memberStructureFocusText,   setMemberStructureFocusText]   = useState('')
  const [commissionModelText,        setCommissionModelText]        = useState('')
  const [assessmentModelText,        setAssessmentModelText]        = useState('')
  const [expectedOnboardTime,        setExpectedOnboardTime]        = useState('')
  const [benchmarkCompanies,         setBenchmarkCompanies]         = useState('')

  // ── Modal / submit ────────────────────────────────────────────────────────
  const [showContactModal,    setShowContactModal]    = useState(false)
  const [showSuccess,         setShowSuccess]         = useState(false)
  const [submitting,          setSubmitting]          = useState(false)
  const [submitError,         setSubmitError]         = useState('')
  const [pageError,           setPageError]           = useState('')
  const [showContractPreview, setShowContractPreview] = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const addOns = {
    accelerated,
    leaderBackgroundCheck, leaderBackgroundCheckCount,
    memberBackgroundCheck, memberBackgroundCheckCount,
    memberPersonalityReport, memberPersonalityReportCount,
  }
  const feeResult = useMemo(() => calculateTeamHeadhuntingFee(addOns),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accelerated, leaderBackgroundCheck, leaderBackgroundCheckCount, memberBackgroundCheck, memberBackgroundCheckCount, memberPersonalityReport, memberPersonalityReportCount]
  )

  // ── Validate ──────────────────────────────────────────────────────────────
  function validate() {
    if (!summary.trim()) return '请填写需求简述'
    if (preferredCities.filter(c => c.location).length === 0) return '所在城市偏向至少添加 1 个城市'
    if (splitTokens(businessFocusText).length === 0) return '业务侧重至少填写 1 项'
    if (!expectedOnboardTime.trim()) return '请填写希望到岗时间'
    return null
  }

  function handleConfirmSubmit() {
    setPageError('')
    const err = validate()
    if (err) { setPageError(err); return }
    setShowContactModal(true)
  }

  async function handleContactSubmit(contact) {
    setSubmitError('')
    setSubmitting(true)

    const payload = {
      service_type: 'team',
      team_requirement: {
        summary:                     summary.trim(),
        preferred_cities:            preferredCities
                                       .filter(c => c.location)
                                       .map(c => ({
                                         location_code: c.location.location_code,
                                         location_name: c.location.location_name,
                                         location_path: c.location.location_path,
                                         location_type: c.location.location_type,
                                         business_area_code: c.location.business_area_code,
                                         business_area_name: c.location.business_area_name,
                                         address: c.address.trim() || null,
                                       })),
        business_focus:              splitTokens(businessFocusText),
        customer_focus:              splitTokens(customerFocusText),
        supply_resource_focus:       splitTokens(supplyResourceFocusText),
        member_structure_focus:      splitTokens(memberStructureFocusText),
        commission_model_preference: splitTokens(commissionModelText),
        assessment_model_preference: splitTokens(assessmentModelText),
        expected_onboard_time:       expectedOnboardTime.trim(),
        benchmark_companies:         benchmarkCompanies.trim() || null,
      },
      terms: Object.fromEntries(TEAM_REQUIRED_TERMS.map(t => [t.key, true])),
      add_ons: {
        accelerated,
        leader_background_check:        leaderBackgroundCheck,
        leader_background_check_count:  leaderBackgroundCheck ? leaderBackgroundCheckCount : 0,
        member_background_check:        memberBackgroundCheck,
        member_background_check_count:  memberBackgroundCheck ? memberBackgroundCheckCount : 0,
        member_personality_report:      memberPersonalityReport,
        member_personality_report_count: memberPersonalityReport ? memberPersonalityReportCount : 0,
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
    if (val) {
      setAccelerated(false)
      setLeaderBackgroundCheck(false)
      setMemberBackgroundCheck(false)
      setMemberPersonalityReport(false)
    }
  }
  function toggleAddon(setter, val) {
    setter(val)
    if (val) setNoAddOns(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="terminal-mode flex-1 w-full min-w-0 flex flex-col overflow-hidden"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid var(--t-border-subtle)' }}
      >
        <div>
          <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--t-text-muted)', marginBottom: 3 }}>
            TEAM · HEADHUNTING REQUEST
          </div>
          <h1 className="terminal-page-title-safe" style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)', margin: 0 }}>团队猎头服务</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>
            提交后 24h 内联系
          </span>
          <div style={{ width: 1, height: 16, background: 'var(--t-border)' }} />
          <button
            onClick={() => navigate('/employer/dashboard')}
            style={{ height: 30, padding: '0 12px', borderRadius: 4, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            取消
          </button>
          <button
            onClick={handleConfirmSubmit}
            style={{ height: 30, display: 'flex', alignItems: 'center', gap: 5, padding: '0 14px', borderRadius: 4, border: 'none', background: 'var(--t-primary)', color: '#fff', fontFamily: 'var(--t-font-mono)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.08em', fontWeight: 600 }}
          >
            确认提交 <ChevronRight size={12} />
          </button>
        </div>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {pageError && (
        <div
          className="flex-shrink-0 flex items-center gap-2 mx-6 mt-2"
          style={{ padding: '7px 12px', background: 'var(--t-danger-muted)', border: '1px solid var(--t-danger)', borderRadius: 4, color: 'var(--t-danger)', fontSize: 12, fontFamily: 'var(--t-font-mono)' }}
        >
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          {pageError}
        </div>
      )}

      {/* ── Three-column layout ─────────────────────────────────────────── */}
      <div
        className="terminal-form-grid-3 terminal-headhunting-form-grid terminal-scrollbar"
      >

        {/* ── Col 1: 服务条款 & 增值服务 ─────────────────────────────────── */}
        <div style={T.card}>
          <SectionHeader icon={FileText} title="服务条款" sub="TERMS OF SERVICE" />
          <div className="flex-1 min-h-0 overflow-y-auto terminal-scrollbar" style={{ paddingRight: 2 }}>

            {/* Terms list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {TEAM_REQUIRED_TERMS.map(term => (
                <div key={term.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px', borderRadius: 4, border: '1px solid var(--t-border-subtle)' }}>
                  <span style={{ fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0, marginTop: 2, lineHeight: 1 }}>·</span>
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
                <span style={{ fontSize: 11, color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-mono)' }}>
                  《团队猎头服务合同》模板
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
                    fontSize: 10, fontFamily: 'var(--t-font-mono)',
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.color = 'var(--t-primary)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--t-border)'; e.currentTarget.style.color = 'var(--t-text-secondary)' }}
                >
                  预览
                </button>
                <a
                  href="/contracts/team-headhunting-contract.pdf"
                  download="团队猎头服务合同模板.pdf"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    height: 24, padding: '0 8px', borderRadius: 3,
                    background: 'var(--t-bg-elevated)',
                    border: '1px solid var(--t-border)',
                    color: 'var(--t-text-secondary)',
                    fontSize: 10, fontFamily: 'var(--t-font-mono)',
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
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>
                    1 个月内负责人接受 Offer · 总费 210,000 / 月付 17,500
                  </span>
                </span>
              </label>

              {/* Leader background check */}
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={leaderBackgroundCheck}
                    onChange={e => toggleAddon(setLeaderBackgroundCheck, e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>团队负责人背调</span>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>¥500 / 份</span>
                  </span>
                </label>
                {leaderBackgroundCheck && (
                  <div style={{ marginTop: 7, marginLeft: 21, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>数量</span>
                    <input type="number" min={1} max={99}
                      style={{ ...T.input, width: 64, padding: '4px 8px', fontSize: 12 }}
                      value={leaderBackgroundCheckCount}
                      onChange={e => setLeaderBackgroundCheckCount(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                )}
              </div>

              {/* Member background check */}
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={memberBackgroundCheck}
                    onChange={e => toggleAddon(setMemberBackgroundCheck, e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>团队成员背调</span>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>¥500 / 份</span>
                  </span>
                </label>
                {memberBackgroundCheck && (
                  <div style={{ marginTop: 7, marginLeft: 21, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>数量</span>
                    <input type="number" min={1} max={99}
                      style={{ ...T.input, width: 64, padding: '4px 8px', fontSize: 12 }}
                      value={memberBackgroundCheckCount}
                      onChange={e => setMemberBackgroundCheckCount(Math.max(1, Number(e.target.value) || 1))} />
                  </div>
                )}
              </div>

              {/* Member personality report */}
              <div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={memberPersonalityReport}
                    onChange={e => toggleAddon(setMemberPersonalityReport, e.target.checked)}
                    style={{ marginTop: 3, flexShrink: 0, accentColor: 'var(--t-primary)', width: 13, height: 13 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>团队成员测评报告</span>
                    <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>¥100 / 份</span>
                  </span>
                </label>
                {memberPersonalityReport && (
                  <div style={{ marginTop: 7, marginLeft: 21, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>数量</span>
                    <input type="number" min={1} max={99}
                      style={{ ...T.input, width: 64, padding: '4px 8px', fontSize: 12 }}
                      value={memberPersonalityReportCount}
                      onChange={e => setMemberPersonalityReportCount(Math.max(1, Number(e.target.value) || 1))} />
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

        {/* ── Col 2: 团队需求信息 ──────────────────────────────────────────── */}
        <div style={T.card}>
          <SectionHeader icon={ClipboardList} title="团队需求信息" sub="TEAM REQUIREMENTS" />
          <div className="flex-1 min-h-0 overflow-y-auto terminal-scrollbar" style={{ paddingRight: 2, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* 需求简述 */}
            <div>
              <label style={T.label}>需求简述 *</label>
              <textarea rows={4} style={T.textarea}
                placeholder="描述您的团队组建需求，包括团队规模、核心职能、期望经验背景等..."
                value={summary} onChange={e => setSummary(e.target.value)} />
            </div>

            <CityPickerSection
              cities={preferredCities}
              onChange={setPreferredCities}
            />
            <TokenTextArea
              label="业务侧重" required
              value={businessFocusText} onChange={setBusinessFocusText}
              placeholder="海运、空运、跨境电商、合同物流"
            />
            <TokenTextArea
              label="客户侧重"
              value={customerFocusText} onChange={setCustomerFocusText}
              placeholder="欧美线客户、制造业客户、跨境电商卖家"
            />
            <TokenTextArea
              label="供给资源侧重"
              value={supplyResourceFocusText} onChange={setSupplyResourceFocusText}
              placeholder="船司资源、海外代理、拖车仓储、报关资源"
            />
            <TokenTextArea
              label="成员架构侧重"
              value={memberStructureFocusText} onChange={setMemberStructureFocusText}
              placeholder="销售负责人、操作、客服、商务"
            />
            <TokenTextArea
              label="提成模式偏向"
              value={commissionModelText} onChange={setCommissionModelText}
              placeholder="团队提成、个人提成、利润分成"
            />
            <TokenTextArea
              label="考核模式偏向"
              value={assessmentModelText} onChange={setAssessmentModelText}
              placeholder="利润额、毛利率、新客户数、回款周期"
            />

            {/* 希望到岗时间 */}
            <div>
              <label style={T.label}>希望到岗时间 *</label>
              <input style={T.input} placeholder="例：2026 年 Q3 / 3 个月内"
                value={expectedOnboardTime} onChange={e => setExpectedOnboardTime(e.target.value)} />
            </div>

            {/* 对标公司 */}
            <div>
              <label style={T.label}>对标公司</label>
              <input style={T.input} placeholder="例：德迅货运、泛亚班拿、海华融泰（建议填写，便于精准推荐）"
                value={benchmarkCompanies} onChange={e => setBenchmarkCompanies(e.target.value)} />
              <p style={T.helper}>非必填，但有助于顾问精准寻源</p>
            </div>
          </div>
        </div>

        {/* ── Col 3: 费用试算 ──────────────────────────────────────────────── */}
        <div style={T.card}>
          <SectionHeader icon={Calculator} title="费用试算" sub="FEE ESTIMATE" />
          <div className="flex-1 min-h-0 overflow-y-auto terminal-scrollbar" style={{ paddingRight: 2 }}>

            {/* Fixed fee section */}
            <div style={{ marginBottom: 14 }}>
              <TermLabel>{accelerated ? '加速服务 · 固定服务费' : '普通服务 · 固定服务费'}</TermLabel>
              <FeeRow label="总固定服务费" value={feeResult.baseTotal} accent />
              <FeeRow label="月固定服务费" value={feeResult.monthlyFee} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)' }}>支付周期</span>
                <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-mono)' }}>12 个月</span>
              </div>
            </div>

            {/* Add-on fees */}
            {feeResult.addonFee > 0 && (
              <div style={{ marginBottom: 14 }}>
                <TermLabel>增值服务费（另计）</TermLabel>
                {leaderBackgroundCheck && (
                  <FeeRow label={`负责人背调 × ${leaderBackgroundCheckCount}`}
                    value={feeResult.leaderBgFee} />
                )}
                {memberBackgroundCheck && (
                  <FeeRow label={`成员背调 × ${memberBackgroundCheckCount}`}
                    value={feeResult.memberBgFee} />
                )}
                {memberPersonalityReport && (
                  <FeeRow label={`成员测评报告 × ${memberPersonalityReportCount}`}
                    value={feeResult.reportFee} />
                )}
              </div>
            )}

            {/* Total */}
            <div style={{ borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', padding: '12px 12px 10px', marginBottom: 12 }}>
              <TermLabel style={{ marginBottom: 10 }}>合计预估</TermLabel>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', letterSpacing: '0.08em' }}>固定服务费</span>
                <span style={{ fontSize: 16, color: 'var(--t-chart-amber)', fontFamily: 'var(--t-font-mono)', fontWeight: 700 }}>
                  {fmtCNY(feeResult.baseTotal)}
                </span>
              </div>
              {feeResult.addonFee > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--t-border-subtle)', marginBottom: 6 }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', letterSpacing: '0.08em' }}>增值服务费</span>
                    <span style={{ fontSize: 14, color: 'var(--t-text-secondary)', fontFamily: 'var(--t-font-mono)', fontWeight: 600 }}>
                      {fmtCNY(feeResult.addonFee)}
                    </span>
                  </div>
                </>
              )}
              <div style={{ height: 1, background: 'var(--t-border-subtle)', marginBottom: 6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 10, color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', letterSpacing: '0.08em' }}>总计</span>
                <span style={{ fontSize: 18, color: 'var(--t-chart-amber)', fontFamily: 'var(--t-font-mono)', fontWeight: 700, letterSpacing: '-0.01em' }}>
                  {fmtCNY(feeResult.total)}
                </span>
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ padding: '9px 10px', background: 'var(--t-bg-input)', border: '1px solid var(--t-border-subtle)', borderRadius: 4 }}>
              <p style={{ fontSize: 10, color: 'var(--t-text-muted)', lineHeight: 1.65, margin: 0, fontFamily: 'var(--t-font-mono)' }}>
                若团队整体离职，则自离职次月起剩余固定服务费不再继续支付，实际应付以服务进度为准。增值服务费不摊入 12 个月固定服务费，入职后单独结算。
              </p>
            </div>

            {/* Contact quick-info */}
            <div style={{ ...T.divider, marginTop: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 9, fontFamily: 'var(--t-font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--t-text-muted)' }}>
                SUBMIT
              </span>
              <p style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.6, margin: 0 }}>
                点击右上角「确认提交」填写联系信息，我们将在 24 小时内与您取得联系。
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
              <span style={{ fontSize: 11, fontFamily: 'var(--t-font-mono)', color: 'var(--t-text-secondary)', letterSpacing: '0.04em' }}>
                《团队猎头服务合同》模板
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <a
                  href="/contracts/team-headhunting-contract.pdf"
                  download="团队猎头服务合同模板.pdf"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    height: 26, padding: '0 10px', borderRadius: 3,
                    background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
                    color: 'var(--t-text-secondary)', fontSize: 10,
                    fontFamily: 'var(--t-font-mono)', cursor: 'pointer', textDecoration: 'none',
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
              src="/contracts/team-headhunting-contract.pdf"
              style={{ flex: 1, border: 'none', width: '100%' }}
              title="团队猎头服务合同预览"
            />
          </div>
        </div>
      )}
    </div>
  )
}
