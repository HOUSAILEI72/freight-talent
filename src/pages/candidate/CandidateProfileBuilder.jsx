import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Loader2, AlertCircle, CheckCircle, ChevronRight, Plus, Trash2,
  User, Briefcase, GraduationCap, Sparkles, ListChecks,
} from 'lucide-react'
import { candidatesApi } from '../../api/candidates'
import RegionSelector from '../../components/RegionSelector'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

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
  salary_min: '',
  salary_max: '',
  salary_months: '',
  average_bonus_percent: '',
  has_year_end_bonus: false,
  year_end_bonus_months: '',
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
  const numKeys = ['salary_min', 'salary_max', 'salary_months', 'average_bonus_percent', 'year_end_bonus_months']
  for (const k of numKeys) {
    const v = row[k]
    if (v === '' || v == null) continue
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    out[k] = n
  }
  if (typeof row.has_year_end_bonus === 'boolean') {
    out.has_year_end_bonus = row.has_year_end_bonus
  }
  return out
}

// Education experience textarea: each line "学校 | 专业 | 学位 | 起止"
function parseEducationLines(text) {
  if (!text) return []
  return text.split(/\r?\n+/).map(l => l.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s*\|\s*/)
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

/**
 * CandidateProfileBuilder
 *
 * Renders the 5-section profile form against fields that CAND-2A persists.
 * Loads the existing profile (if any), validates locally, then saves via
 * candidatesApi.updateMyCandidateProfile. On success → /candidate/tags so
 * CAND-1 gate auto-releases.
 *
 * Supports terminal=true (deep dark with --t-* tokens) and terminal=false
 * (existing light slate palette) via dual-branched className/style.
 */
export default function CandidateProfileBuilder({ terminal = false }) {
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

  // ── Section 2: 当前任职 ─────────────────────────────────────────────────
  const [currentCompany,        setCurrentCompany]        = useState('')
  const [currentTitle,          setCurrentTitle]          = useState('')
  const [currentResponsibilities, setCurrentResponsibilities] = useState('')
  const [functionCode, setFunctionCode]                 = useState('')
  const [isManagementStr, setIsManagementStr]           = useState('') // '' | 'yes' | 'no'
  const [csMin, setCsMin]                                = useState('')
  const [csMax, setCsMax]                                = useState('')
  const [csMonths, setCsMonths]                          = useState('')
  const [csAvgBonus, setCsAvgBonus]                      = useState('')
  const [csHasYeb, setCsHasYeb]                          = useState(false)
  const [csYebMonths, setCsYebMonths]                    = useState('')

  // ── Section 3: 工作经历 ─────────────────────────────────────────────────
  const [workRows, setWorkRows] = useState([{ ...EMPTY_WORK_EXPERIENCE }])

  // ── Section 4: 能力画像 ─────────────────────────────────────────────────
  const [knowledgeText, setKnowledgeText] = useState('')
  const [hardText,      setHardText]      = useState('')
  const [softText,      setSoftText]      = useState('')

  // ── Section 5: 教育与证书 ──────────────────────────────────────────────
  const [education, setEducation]                 = useState('')
  const [educationLines, setEducationLines]       = useState('')
  const [certificatesText, setCertificatesText]   = useState('')

  // ── Hydrate from server ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    candidatesApi.getMyCandidateProfile()
      .then(res => {
        if (cancelled) return
        const p = res.data?.profile
        if (!p) return
        setFullName(p.full_name || '')
        setPhone(p.phone || '')
        setEmail(p.email || '')
        if (p.location_code) {
          setLocation({
            location_code: p.location_code,
            location_name: p.location_name,
            location_path: p.location_path,
            location_type: p.location_type,
            business_area_code: p.business_area_code,
            business_area_name: p.business_area_name,
          })
        }
        setAvailability(p.availability_status || 'open')

        setCurrentCompany(p.current_company || '')
        setCurrentTitle(p.current_title || '')
        setCurrentResponsibilities(p.current_responsibilities || '')
        setFunctionCode(p.function_code || '')
        setIsManagementStr(
          p.is_management_role === true ? 'yes' :
          p.is_management_role === false ? 'no' : ''
        )
        setCsMin(p.current_salary_min != null ? String(p.current_salary_min) : '')
        setCsMax(p.current_salary_max != null ? String(p.current_salary_max) : '')
        setCsMonths(p.current_salary_months != null ? String(p.current_salary_months) : '')
        setCsAvgBonus(p.current_average_bonus_percent != null ? String(p.current_average_bonus_percent) : '')
        setCsHasYeb(p.current_has_year_end_bonus === true)
        setCsYebMonths(p.current_year_end_bonus_months != null ? String(p.current_year_end_bonus_months) : '')

        if (Array.isArray(p.work_experiences) && p.work_experiences.length > 0) {
          setWorkRows(p.work_experiences.map(w => ({
            ...EMPTY_WORK_EXPERIENCE,
            company_name: w.company_name || w.company || '',
            title: w.title || '',
            start_month: w.start_month || '',
            end_month:   w.end_month   || '',
            responsibilities: w.responsibilities || '',
            achievements:     w.achievements     || '',
            salary_min:    w.salary_min    != null ? String(w.salary_min)    : '',
            salary_max:    w.salary_max    != null ? String(w.salary_max)    : '',
            salary_months: w.salary_months != null ? String(w.salary_months) : '',
            average_bonus_percent: w.average_bonus_percent != null ? String(w.average_bonus_percent) : '',
            has_year_end_bonus:    w.has_year_end_bonus === true,
            year_end_bonus_months: w.year_end_bonus_months != null ? String(w.year_end_bonus_months) : '',
          })))
        }

        setKnowledgeText(tagsToText(p.knowledge_tags))
        setHardText(tagsToText(p.hard_skill_tags))
        setSoftText(tagsToText(p.soft_skill_tags))

        setEducation(p.education || '')
        setEducationLines(educationLinesToText(p.education_experiences))
        setCertificatesText(tagsToText(p.certificates))
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
  }, [])

  // ── Derived ─────────────────────────────────────────────────────────────
  const knowledgeArr = useMemo(() => splitTokens(knowledgeText), [knowledgeText])
  const hardArr      = useMemo(() => splitTokens(hardText),      [hardText])
  const softArr      = useMemo(() => splitTokens(softText),      [softText])
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
    if (!currentCompany.trim())          return '请填写当前公司'
    if (!currentTitle.trim())            return '请填写当前职位'
    if (!currentResponsibilities.trim()) return '请填写岗位职责'
    if (!functionCode)                   return '请选择业务方向'
    if (isManagementStr !== 'yes' && isManagementStr !== 'no') return '请选择是否管理岗位'

    if (csMin !== '' && csMax !== '' && Number(csMin) > Number(csMax)) {
      return '当前薪资 min 不能大于 max'
    }
    if (csMonths !== '' && !['12', '13', '14'].includes(csMonths)) {
      return '当前薪资月数只能是 12 / 13 / 14'
    }
    if (csAvgBonus !== '' && (Number(csAvgBonus) < 0 || Number(csAvgBonus) > 100)) {
      return '平均奖金 % 必须在 0-100 之间'
    }
    if (csHasYeb && csYebMonths !== '' && (Number(csYebMonths) < 0 || Number(csYebMonths) > 24)) {
      return '年终奖月数必须在 0-24 之间'
    }

    if (!Array.isArray(workRows) || workRows.length === 0) return '至少填写一段工作经历'
    for (let i = 0; i < workRows.length; i++) {
      const r = workRows[i]
      if (!r.company_name.trim()) return `工作经历 #${i + 1}：公司名称不能为空`
      if (!r.title.trim())        return `工作经历 #${i + 1}：职位不能为空`
      if (r.salary_min !== '' && r.salary_max !== '' && Number(r.salary_min) > Number(r.salary_max)) {
        return `工作经历 #${i + 1}：薪资 min 不能大于 max`
      }
      if (r.salary_months !== '' && !['12', '13', '14'].includes(String(r.salary_months))) {
        return `工作经历 #${i + 1}：薪资月数只能是 12 / 13 / 14`
      }
      if (r.average_bonus_percent !== '' &&
          (Number(r.average_bonus_percent) < 0 || Number(r.average_bonus_percent) > 100)) {
        return `工作经历 #${i + 1}：平均奖金 % 必须在 0-100 之间`
      }
      if (r.year_end_bonus_months !== '' &&
          (Number(r.year_end_bonus_months) < 0 || Number(r.year_end_bonus_months) > 24)) {
        return `工作经历 #${i + 1}：年终奖月数必须在 0-24 之间`
      }
    }

    if (knowledgeArr.length === 0) return '请至少填写 1 个知识标签'
    if (hardArr.length === 0)      return '请至少填写 1 个硬技能标签'
    if (softArr.length === 0)      return '请至少填写 1 个软技能标签'

    return ''
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
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

      knowledge_tags: knowledgeArr,
      hard_skill_tags: hardArr,
      soft_skill_tags: softArr,
      skill_tags: mergeUnique(knowledgeArr, hardArr, softArr),

      ...(csMin       !== '' ? { current_salary_min:    Number(csMin) } : {}),
      ...(csMax       !== '' ? { current_salary_max:    Number(csMax) } : {}),
      ...(csMonths    !== '' ? { current_salary_months: Number(csMonths) } : {}),
      ...(csAvgBonus  !== '' ? { current_average_bonus_percent: Number(csAvgBonus) } : {}),
      current_has_year_end_bonus: csHasYeb,
      ...(csHasYeb && csYebMonths !== '' ? { current_year_end_bonus_months: Number(csYebMonths) } : {}),

      work_experiences: workRows.map(workExperienceToPayload),

      education: education.trim() || null,
      education_experiences: parseEducationLines(educationLines),
      certificates: certsArr,

      availability_status: availability,
      confirm_latest: false,
    }

    setSaving(true)
    try {
      await candidatesApi.updateMyCandidateProfile(payload)
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

  async function handleConfirmLatest() {
    setConfirmingLatest(true)
    setSaveErr('')
    try {
      await candidatesApi.confirmLatestResume()
      navigate('/candidate/tags')
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

  const helperClass = terminal ? 'mt-1 text-xs' : 'mt-1 text-xs text-slate-400'
  const helperStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  const inputClass = terminal
    ? 'w-full px-3 py-2 rounded-lg border text-sm focus:outline-none'
    : 'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined

  const textareaClass = inputClass + ' resize-none'

  const cardClass = terminal
    ? 'p-6 space-y-4 rounded-[var(--t-radius-lg)] border'
    : 'card p-6 space-y-4'
  const cardStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    : undefined

  const sectionTitleClass = terminal
    ? 'flex items-center gap-2 text-sm font-semibold mb-3'
    : 'flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3'
  const sectionTitleStyle = terminal ? { color: 'var(--t-text)' } : undefined

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

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={
        terminal
          ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-8'
          : 'max-w-3xl mx-auto px-6 py-12'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
    >
      <div className={terminal ? 'mx-auto w-full max-w-3xl' : ''}>
        {/* Header */}
        <div className="mb-6">
          <div
            className="flex items-center gap-2 mb-1"
            style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}
          >
            <ListChecks size={14} />
            <span className="text-[11px] tracking-[0.2em] uppercase">PROFILE · BUILDER</span>
          </div>
          <h1
            className={terminal ? 'text-2xl font-semibold' : 'text-2xl font-semibold text-slate-800'}
            style={terminal ? { color: 'var(--t-text)' } : undefined}
          >
            完善候选人档案
          </h1>
          <p
            className={terminal ? 'text-sm mt-1' : 'text-sm text-slate-500 mt-1'}
            style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
          >
            完成档案后，你才能订阅个性化推荐和投递岗位。
          </p>
        </div>

        {saveError && (
          <div
            className={
              terminal
                ? 'flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg border text-sm'
                : 'flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm'
            }
            style={
              terminal
                ? { background: 'var(--t-danger-muted)', borderColor: 'var(--t-danger)', color: 'var(--t-danger)' }
                : undefined
            }
          >
            <AlertCircle size={15} /><span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Section 1: 基础信息 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <User size={14} />基础信息
            </h2>
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
                <select className={inputClass} style={inputStyle}
                  value={availability} onChange={e => setAvailability(e.target.value)}>
                  <option value="open">开放机会</option>
                  <option value="passive">被动寻找</option>
                  <option value="closed">暂不考虑</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>所在地区 *</label>
              <RegionSelector
                value={location}
                onChange={setLocation}
                terminal={terminal}
                placeholder="请选择所在地区（中国大陆 / 香港 / 台湾 / 海外 / Global / Remote）"
              />
              {location?.location_path && (
                <p className={helperClass} style={helperStyle}>
                  已选：{location.location_path}
                  {location.business_area_name ? `（业务区域 ${location.business_area_name}）` : ''}
                </p>
              )}
            </div>
          </div>

          {/* ── Section 2: 当前任职 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <Briefcase size={14} />当前任职
            </h2>
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
                <select className={inputClass} style={inputStyle}
                  value={functionCode} onChange={e => setFunctionCode(e.target.value)}>
                  <option value="">请选择</option>
                  {FUNCTION_OPTIONS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>是否管理岗位 *</label>
                <select className={inputClass} style={inputStyle}
                  value={isManagementStr} onChange={e => setIsManagementStr(e.target.value)}>
                  <option value="">请选择</option>
                  <option value="yes">是</option>
                  <option value="no">否</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>岗位职责 *</label>
              <textarea rows={3} className={textareaClass} style={inputStyle}
                value={currentResponsibilities}
                onChange={e => setCurrentResponsibilities(e.target.value)}
                placeholder="主要职责、负责的业务范围..." />
            </div>

            <div>
              <p className={labelClass} style={labelStyle}>当前薪资结构</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={helperClass} style={helperStyle}>min（元/月）</label>
                  <input className={inputClass} style={inputStyle} type="number" min="0"
                    value={csMin} onChange={e => setCsMin(e.target.value)} placeholder="如 18000" />
                </div>
                <div>
                  <label className={helperClass} style={helperStyle}>max（元/月）</label>
                  <input className={inputClass} style={inputStyle} type="number" min="0"
                    value={csMax} onChange={e => setCsMax(e.target.value)} placeholder="如 25000" />
                </div>
                <div>
                  <label className={helperClass} style={helperStyle}>薪资月数</label>
                  <select className={inputClass} style={inputStyle}
                    value={csMonths} onChange={e => setCsMonths(e.target.value)}>
                    <option value="">未填</option>
                    <option value="12">12</option>
                    <option value="13">13</option>
                    <option value="14">14</option>
                  </select>
                </div>
                <div>
                  <label className={helperClass} style={helperStyle}>平均奖金 %</label>
                  <input className={inputClass} style={inputStyle} type="number" min="0" max="100"
                    value={csAvgBonus} onChange={e => setCsAvgBonus(e.target.value)} placeholder="0-100" />
                </div>
                <div className="flex items-end">
                  <label
                    className="inline-flex items-center gap-2 text-sm select-none cursor-pointer"
                    style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}
                  >
                    <input type="checkbox" checked={csHasYeb}
                      onChange={e => setCsHasYeb(e.target.checked)} />
                    <span>有年终奖</span>
                  </label>
                </div>
                <div>
                  <label className={helperClass} style={helperStyle}>年终奖月数 (0-24)</label>
                  <input
                    className={inputClass} style={inputStyle} type="number" min="0" max="24" step="0.1"
                    value={csYebMonths}
                    onChange={e => setCsYebMonths(e.target.value)}
                    disabled={!csHasYeb}
                    placeholder={csHasYeb ? '如 1.5' : '勾选有年终奖后填写'}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: 工作经历 ── */}
          <div className={cardClass} style={cardStyle}>
            <div className="flex items-center justify-between mb-1">
              <h2 className={sectionTitleClass + ' mb-0'} style={sectionTitleStyle}>
                <Briefcase size={14} />工作经历（至少 1 段）
              </h2>
              <button type="button" onClick={addWorkRow}
                className={
                  terminal
                    ? 'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border'
                    : 'inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50'
                }
                style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' } : undefined}
              >
                <Plus size={12} /> 新增一段
              </button>
            </div>
            <div className="space-y-4">
              {workRows.map((r, i) => (
                <div
                  key={i}
                  className={
                    terminal
                      ? 'rounded-lg border p-4 space-y-3'
                      : 'rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-3'
                  }
                  style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' } : undefined}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-xs font-semibold tracking-wider"
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
                  <div className="grid grid-cols-2 gap-3">
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
                      <label className={helperClass} style={helperStyle}>起始（YYYY-MM）</label>
                      <input className={inputClass} style={inputStyle}
                        value={r.start_month}
                        onChange={e => updateWorkRow(i, { start_month: e.target.value })}
                        placeholder="2020-01" />
                    </div>
                    <div>
                      <label className={helperClass} style={helperStyle}>结束（YYYY-MM 或留空表示至今）</label>
                      <input className={inputClass} style={inputStyle}
                        value={r.end_month}
                        onChange={e => updateWorkRow(i, { end_month: e.target.value })}
                        placeholder="2024-06" />
                    </div>
                  </div>
                  <div>
                    <label className={helperClass} style={helperStyle}>职责</label>
                    <textarea rows={2} className={textareaClass} style={inputStyle}
                      value={r.responsibilities}
                      onChange={e => updateWorkRow(i, { responsibilities: e.target.value })} />
                  </div>
                  <div>
                    <label className={helperClass} style={helperStyle}>成就</label>
                    <textarea rows={2} className={textareaClass} style={inputStyle}
                      value={r.achievements}
                      onChange={e => updateWorkRow(i, { achievements: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={helperClass} style={helperStyle}>薪资 min</label>
                      <input className={inputClass} style={inputStyle} type="number" min="0"
                        value={r.salary_min}
                        onChange={e => updateWorkRow(i, { salary_min: e.target.value })} />
                    </div>
                    <div>
                      <label className={helperClass} style={helperStyle}>薪资 max</label>
                      <input className={inputClass} style={inputStyle} type="number" min="0"
                        value={r.salary_max}
                        onChange={e => updateWorkRow(i, { salary_max: e.target.value })} />
                    </div>
                    <div>
                      <label className={helperClass} style={helperStyle}>薪资月数</label>
                      <select className={inputClass} style={inputStyle}
                        value={r.salary_months}
                        onChange={e => updateWorkRow(i, { salary_months: e.target.value })}>
                        <option value="">未填</option>
                        <option value="12">12</option>
                        <option value="13">13</option>
                        <option value="14">14</option>
                      </select>
                    </div>
                    <div>
                      <label className={helperClass} style={helperStyle}>平均奖金 %</label>
                      <input className={inputClass} style={inputStyle} type="number" min="0" max="100"
                        value={r.average_bonus_percent}
                        onChange={e => updateWorkRow(i, { average_bonus_percent: e.target.value })} />
                    </div>
                    <div className="flex items-end">
                      <label
                        className="inline-flex items-center gap-2 text-sm select-none cursor-pointer"
                        style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}
                      >
                        <input type="checkbox"
                          checked={r.has_year_end_bonus === true}
                          onChange={e => updateWorkRow(i, { has_year_end_bonus: e.target.checked })} />
                        <span>有年终奖</span>
                      </label>
                    </div>
                    <div>
                      <label className={helperClass} style={helperStyle}>年终奖月数 (0-24)</label>
                      <input className={inputClass} style={inputStyle} type="number" min="0" max="24" step="0.1"
                        value={r.year_end_bonus_months}
                        onChange={e => updateWorkRow(i, { year_end_bonus_months: e.target.value })}
                        disabled={!r.has_year_end_bonus} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 4: 能力画像 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <Sparkles size={14} />能力画像
            </h2>
            <p className={helperClass} style={helperStyle}>
              用逗号、顿号或换行分隔多个标签，每个维度至少填 1 项。
            </p>
            <div>
              <label className={labelClass} style={labelStyle}>知识 * （{knowledgeArr.length}）</label>
              <textarea rows={2} className={textareaClass} style={inputStyle}
                value={knowledgeText} onChange={e => setKnowledgeText(e.target.value)}
                placeholder="如：国际贸易术语、海运报关流程、HS 编码体系" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>硬技能 * （{hardArr.length}）</label>
              <textarea rows={2} className={textareaClass} style={inputStyle}
                value={hardText} onChange={e => setHardText(e.target.value)}
                placeholder="如：Cargowise、Excel、SAP、Python" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>软技能 * （{softArr.length}）</label>
              <textarea rows={2} className={textareaClass} style={inputStyle}
                value={softText} onChange={e => setSoftText(e.target.value)}
                placeholder="如：跨部门沟通、抗压、团队管理" />
            </div>
          </div>

          {/* ── Section 5: 教育与证书 ── */}
          <div className={cardClass} style={cardStyle}>
            <h2 className={sectionTitleClass} style={sectionTitleStyle}>
              <GraduationCap size={14} />教育与证书
            </h2>
            <div>
              <label className={labelClass} style={labelStyle}>学历摘要</label>
              <input className={inputClass} style={inputStyle}
                value={education} onChange={e => setEducation(e.target.value)}
                placeholder="如：本科 · 国际贸易" />
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>详细教育经历</label>
              <textarea rows={3} className={textareaClass} style={inputStyle}
                value={educationLines}
                onChange={e => setEducationLines(e.target.value)}
                placeholder={'每行一条，使用 "|" 分隔字段：学校 | 专业 | 学位 | 起止\n如：上海海事大学 | 国际贸易 | 本科 | 2014-2018'}
              />
              <p className={helperClass} style={helperStyle}>每行一段，4 个字段用「|」分隔。</p>
            </div>
            <div>
              <label className={labelClass} style={labelStyle}>资格证书（{certsArr.length}）</label>
              <textarea rows={2} className={textareaClass} style={inputStyle}
                value={certificatesText} onChange={e => setCertificatesText(e.target.value)}
                placeholder="如：报关员证、国际货代证、CET-6" />
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button"
              onClick={() => navigate('/candidate/tags')}
              className={
                terminal
                  ? 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm'
                  : 'inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm'
              }
              style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' } : undefined}
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

        {showLatestPrompt && (
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
        )}
      </div>
    </div>
  )
}
