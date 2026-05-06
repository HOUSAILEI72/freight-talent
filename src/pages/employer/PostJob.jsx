import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2, ChevronRight, Briefcase } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { jobsApi } from '../../api/jobs'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import RegionSelector from '../../components/RegionSelector'

// ─── Helpers ─────────────────────────────────────────────────────────────────
//
// Function options (Phase B FunctionRail) — drop the synthetic "ALL" entry,
// since no real job is "any business line".
const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

const SALARY_MONTHS_OPTIONS = [12, 13, 14]

/** Split a comma / 顿号 / newline / whitespace string into a deduped array
 *  of trimmed non-empty strings. */
function splitTokens(str) {
  if (!str) return []
  const parts = String(str)
    .split(/[,，、\n\r;；]+/)
    .map(s => s.trim())
    .filter(Boolean)
  // dedupe preserving order
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

/** Merge multiple string arrays into a single deduped array (skill_tags
 *  feeds the existing matching engine; we feed it the union of skill +
 *  knowledge + hard skill + soft skill). */
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

// ─── Page ────────────────────────────────────────────────────────────────────
//
// Phase D rewrite — single-page form, no AI tagging step. Submits directly to
// POST /api/jobs with the Phase C standard payload (location_code +
// business_area_code is computed server-side). Falls back to a "published"
// success card and redirects to /employer/jobs after 2s.

const STEP_FORM    = 0
const STEP_SUCCESS = 2

export default function PostJob({ terminal = false }) {
  const navigate = useNavigate()
  const [step, setStep]                 = useState(STEP_FORM)
  const [submitting, setSubmitting]     = useState(false)
  const [submitError, setSubmitError]   = useState('')
  const [, setCreatedJobId]             = useState(null)

  // ── Form state ──────────────────────────────────────────────────────────
  const [title, setTitle]                       = useState('')
  const [experienceRequired, setExperienceRequired] = useState('')
  const [degreeRequired,     setDegreeRequired]     = useState('')

  const [skillsText, setSkillsText]             = useState('')

  const [functionCode, setFunctionCode]         = useState('')

  const [isManagementRole, setIsManagementRole] = useState('') // '' | 'true' | 'false'

  const [location, setLocation]                 = useState(null)

  const [knowledgeText, setKnowledgeText]       = useState('')
  const [hardSkillText, setHardSkillText]       = useState('')
  const [softSkillText, setSoftSkillText]       = useState('')

  const [salaryMin,    setSalaryMin]            = useState('')
  const [salaryMax,    setSalaryMax]            = useState('')
  const [salaryMonths, setSalaryMonths]         = useState(13)

  const [averageBonusPercent, setAverageBonusPercent] = useState('')
  const [hasYearEndBonus,     setHasYearEndBonus]     = useState('') // '' | 'true' | 'false'
  const [yearEndBonusMonths,  setYearEndBonusMonths]  = useState('')

  const [description,  setDescription]  = useState('')
  const [requirements, setRequirements] = useState('')

  // ── Derived ─────────────────────────────────────────────────────────────
  const skillTagsArr   = useMemo(() => splitTokens(skillsText),    [skillsText])
  const knowledgeArr   = useMemo(() => splitTokens(knowledgeText), [knowledgeText])
  const hardSkillArr   = useMemo(() => splitTokens(hardSkillText), [hardSkillText])
  const softSkillArr   = useMemo(() => splitTokens(softSkillText), [softSkillText])

  const selectedFunction = FUNCTION_OPTIONS.find(f => f.key === functionCode) || null

  // ── Validation ──────────────────────────────────────────────────────────
  function validate() {
    if (!title.trim())                return '请填写岗位名称'
    if (!experienceRequired.trim())   return '请填写经验要求'
    if (!degreeRequired.trim())       return '请填写学历要求'
    if (skillTagsArr.length === 0)    return '请至少填写一个技能（可用逗号、顿号或换行分隔）'
    if (!selectedFunction)            return '请选择板块'
    if (isManagementRole !== 'true' && isManagementRole !== 'false') return '请选择是否为管理人员'
    if (!location || !location.location_code) return '请选择地区'
    if (!location.location_name || !location.location_path || !location.location_type) {
      return '地区数据不完整，请重新选择'
    }
    if (knowledgeArr.length === 0) return '请填写知识要求'
    if (hardSkillArr.length === 0) return '请填写硬技能要求'
    if (softSkillArr.length === 0) return '请填写软技能要求'

    const sMin = Number(salaryMin)
    const sMax = Number(salaryMax)
    if (!Number.isFinite(sMin) || !Number.isFinite(sMax) || sMin <= 0 || sMax <= 0) {
      return '请填写有效的薪资区间（数字）'
    }
    if (sMin > sMax) return '薪资最小值不能大于最大值'

    const sm = Number(salaryMonths)
    if (![12, 13, 14].includes(sm)) return 'salary_months 只能是 12 / 13 / 14'

    if (averageBonusPercent !== '' && averageBonusPercent !== null) {
      const ab = Number(averageBonusPercent)
      if (!Number.isFinite(ab) || ab < 0 || ab > 100) return '平均奖金必须在 0-100 之间'
    }

    if (hasYearEndBonus !== 'true' && hasYearEndBonus !== 'false') return '请选择是否有年终奖'
    if (hasYearEndBonus === 'true') {
      const yb = Number(yearEndBonusMonths)
      if (!Number.isFinite(yb) || yb < 0 || yb > 24) return '年终奖月数必须在 0-24 之间'
    }

    return null
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function handlePublish() {
    setSubmitError('')
    const err = validate()
    if (err) { setSubmitError(err); return }

    const sMin = Number(salaryMin)
    const sMax = Number(salaryMax)
    const sm   = Number(salaryMonths)

    const payload = {
      // Basic
      title: title.trim(),
      experience_required: experienceRequired.trim(),
      degree_required:     degreeRequired.trim(),

      // Function (Phase B FunctionRail constants)
      function_code: selectedFunction.key,
      function_name: selectedFunction.label,
      // Legacy back-compat (back-end already mirrors these from function_name
      // when missing, but be explicit).
      business_type: selectedFunction.label,

      // Management
      is_management_role: isManagementRole === 'true',
      job_type: isManagementRole === 'true' ? '管理' : '非管理',

      // Standard location (RegionSelector). DO NOT send business_area_code —
      // the back-end recomputes it via validate_location_payload.
      location_code: location.location_code,
      location_name: location.location_name,
      location_path: location.location_path,
      location_type: location.location_type,

      // Skills — feed the matching engine the union of all four lists.
      skill_tags: mergeUnique(skillTagsArr, knowledgeArr, hardSkillArr, softSkillArr),
      knowledge_requirements:  knowledgeArr,
      hard_skill_requirements: hardSkillArr,
      soft_skill_requirements: softSkillArr,

      // Salary
      salary_min: sMin,
      salary_max: sMax,
      salary_months: sm,
      salary_label: `${sMin}-${sMax} × ${sm}`,

      // Bonus
      average_bonus_percent:
        averageBonusPercent === '' ? null : Number(averageBonusPercent),
      has_year_end_bonus: hasYearEndBonus === 'true',
      year_end_bonus_months:
        hasYearEndBonus === 'true' ? Number(yearEndBonusMonths) : null,

      // Optional free text
      description:  description.trim(),
      requirements: requirements.trim() || null,

      status: 'published',
    }

    setSubmitting(true)
    try {
      const res = await jobsApi.createJob(payload)
      const job = res?.data?.job
      setCreatedJobId(job?.id ?? null)
      setStep(STEP_SUCCESS)
      setTimeout(() => navigate('/employer/jobs'), 2000)
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

  // ── Style helpers (terminal vs light) ───────────────────────────────────
  // Hard-coded twins — Phase D doesn't add any new scoped CSS.

  const labelClass = terminal
    ? 'block text-sm font-medium mb-1.5'
    : 'block text-sm font-medium text-slate-700 mb-1.5'
  const labelStyle = terminal ? { color: 'var(--t-text-secondary)' } : undefined

  const helperClass = terminal ? 'mt-1 text-xs' : 'mt-1 text-xs text-slate-400'
  const helperStyle = terminal ? { color: 'var(--t-text-muted)' } : undefined

  const inputClass = terminal
    ? 'w-full px-4 py-2.5 rounded-lg border text-sm focus:outline-none'
    : 'w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
  const inputStyle = terminal
    ? { background: 'var(--t-bg-input)', borderColor: 'var(--t-border)', color: 'var(--t-text)' }
    : undefined

  const textareaClass = inputClass + ' resize-none'
  const textareaStyle = inputStyle

  const cardClass = terminal
    ? 'p-6 space-y-5 rounded-[var(--t-radius-lg)] border'
    : 'card p-6 space-y-5'
  const cardStyle = terminal
    ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    : undefined

  const sectionTitleClass = terminal
    ? 'flex items-center gap-2 text-sm font-semibold mb-3'
    : 'flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3'
  const sectionTitleStyle = terminal ? { color: 'var(--t-text)' } : undefined

  // ── Success screen ──────────────────────────────────────────────────────
  if (step === STEP_SUCCESS) {
    return (
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
          <p
            className={terminal ? 'text-sm' : 'text-sm text-slate-400'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            即将跳转到岗位列表
          </p>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
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

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="mb-6">
          <h1
            className={terminal ? 'text-2xl font-bold' : 'text-2xl font-bold text-slate-800'}
            style={terminal ? { color: 'var(--t-text)' } : undefined}
          >
            发布招聘岗位
          </h1>
          <p
            className={terminal ? 'mt-1 text-sm' : 'mt-1 text-sm text-slate-500'}
            style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
          >
            填写完整后即可立即发布并启动候选人匹配
          </p>
        </div>

        {/* ── Error banner ─────────────────────────────────────────── */}
        {submitError && (
          <div
            className={
              terminal
                ? 'mb-5 flex items-center gap-2 px-3 py-2.5 border rounded-lg text-sm'
                : 'mb-5 flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm'
            }
            style={
              terminal
                ? { background: 'var(--t-danger-muted)', borderColor: 'var(--t-danger)', color: 'var(--t-danger)' }
                : undefined
            }
          >
            <AlertCircle size={15} className="flex-shrink-0" />
            {submitError}
          </div>
        )}

        <div className="space-y-5">
          {/* ── Section 1: 基本信息 ─────────────────────────────────── */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              <Briefcase size={14} /> 基本信息
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>岗位名称 *</label>
              <input
                className={inputClass}
                style={inputStyle}
                placeholder="例：海运操作主管"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>经验要求 *</label>
                <input
                  className={inputClass}
                  style={inputStyle}
                  placeholder="例：3年以上"
                  value={experienceRequired}
                  onChange={(e) => setExperienceRequired(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>学历要求 *</label>
                <input
                  className={inputClass}
                  style={inputStyle}
                  placeholder="例：本科及以上"
                  value={degreeRequired}
                  onChange={(e) => setDegreeRequired(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>技能 *</label>
              <textarea
                rows={2}
                className={textareaClass}
                style={textareaStyle}
                placeholder="例：海运操作, 单证, Cargowise"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
              />
              <p className={helperClass} style={helperStyle}>
                逗号、顿号或换行分隔；当前已识别 {skillTagsArr.length} 项
              </p>
            </div>
          </div>

          {/* ── Section 2: 地区与板块 ───────────────────────────────── */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              地区与板块
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>地区 *</label>
              <RegionSelector
                value={location}
                onChange={setLocation}
                terminal={terminal}
                placeholder="请选择岗位地区"
              />
              <p className={helperClass} style={helperStyle}>
                {location?.location_path
                  ? `已选：${location.location_path}（业务区域 ${location.business_area_name ?? ''}）`
                  : '中国大陆 / Hong Kong / Taiwan / Overseas / Global / Remote'}
              </p>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>板块 *</label>
              <div className="flex flex-wrap gap-2">
                {FUNCTION_OPTIONS.map((f) => {
                  const active = f.key === functionCode
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFunctionCode(f.key)}
                      className={
                        terminal
                          ? 'px-3 py-1.5 rounded-lg text-sm border transition-colors'
                          : `px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                              active
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-slate-200 text-slate-600 hover:border-blue-300'
                            }`
                      }
                      style={
                        terminal
                          ? active
                            ? { background: 'var(--t-primary)', color: '#fff', borderColor: 'var(--t-primary)' }
                            : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' }
                          : undefined
                      }
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>是否为管理人员 *</label>
              <select
                className={inputClass}
                style={inputStyle}
                value={isManagementRole}
                onChange={(e) => setIsManagementRole(e.target.value)}
              >
                <option value="">请选择</option>
                <option value="true">是</option>
                <option value="false">否</option>
              </select>
            </div>
          </div>

          {/* ── Section 3: 能力要求 ─────────────────────────────────── */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              能力要求
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>知识 *</label>
              <textarea
                rows={2}
                className={textareaClass}
                style={textareaStyle}
                placeholder="例：国际贸易, HS编码, 危险品分类"
                value={knowledgeText}
                onChange={(e) => setKnowledgeText(e.target.value)}
              />
              <p className={helperClass} style={helperStyle}>当前已识别 {knowledgeArr.length} 项</p>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>硬技能 *</label>
              <textarea
                rows={2}
                className={textareaClass}
                style={textareaStyle}
                placeholder="例：Cargowise, Excel, SAP"
                value={hardSkillText}
                onChange={(e) => setHardSkillText(e.target.value)}
              />
              <p className={helperClass} style={helperStyle}>当前已识别 {hardSkillArr.length} 项</p>
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>软技能 *</label>
              <textarea
                rows={2}
                className={textareaClass}
                style={textareaStyle}
                placeholder="例：英语沟通, 抗压能力, 团队协作"
                value={softSkillText}
                onChange={(e) => setSoftSkillText(e.target.value)}
              />
              <p className={helperClass} style={helperStyle}>当前已识别 {softSkillArr.length} 项</p>
            </div>
          </div>

          {/* ── Section 4: 薪酬结构 ─────────────────────────────────── */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              薪酬结构
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>月薪最小值 *</label>
                <input
                  type="number"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="20000"
                  value={salaryMin}
                  onChange={(e) => setSalaryMin(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>月薪最大值 *</label>
                <input
                  type="number"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="30000"
                  value={salaryMax}
                  onChange={(e) => setSalaryMax(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>薪资月数 *</label>
                <select
                  className={inputClass}
                  style={inputStyle}
                  value={salaryMonths}
                  onChange={(e) => setSalaryMonths(Number(e.target.value))}
                >
                  {SALARY_MONTHS_OPTIONS.map((m) => (
                    <option key={m} value={m}>{m} 个月</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass} style={labelStyle}>平均奖金（%）</label>
                <input
                  type="number"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="例：10 表示 10%"
                  value={averageBonusPercent}
                  onChange={(e) => setAverageBonusPercent(e.target.value)}
                />
                <p className={helperClass} style={helperStyle}>0-100，可留空</p>
              </div>
              <div>
                <label className={labelClass} style={labelStyle}>是否有年终奖 *</label>
                <select
                  className={inputClass}
                  style={inputStyle}
                  value={hasYearEndBonus}
                  onChange={(e) => setHasYearEndBonus(e.target.value)}
                >
                  <option value="">请选择</option>
                  <option value="true">是</option>
                  <option value="false">否</option>
                </select>
              </div>
            </div>

            {hasYearEndBonus === 'true' && (
              <div>
                <label className={labelClass} style={labelStyle}>年终奖月数 *</label>
                <input
                  type="number"
                  step="0.1"
                  className={inputClass}
                  style={inputStyle}
                  placeholder="例：2 表示 2 个月基本工资"
                  value={yearEndBonusMonths}
                  onChange={(e) => setYearEndBonusMonths(e.target.value)}
                />
                <p className={helperClass} style={helperStyle}>0-24 之间，可填小数</p>
              </div>
            )}
          </div>

          {/* ── Section 5: 补充说明 ─────────────────────────────────── */}
          <div className={cardClass} style={cardStyle}>
            <div className={sectionTitleClass} style={sectionTitleStyle}>
              补充说明（可选）
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>岗位职责</label>
              <textarea
                rows={3}
                className={textareaClass}
                style={textareaStyle}
                placeholder="补充说明岗位的主要职责（可选）"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} style={labelStyle}>任职要求</label>
              <textarea
                rows={3}
                className={textareaClass}
                style={textareaStyle}
                placeholder="补充任职要求（可选）"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
              />
            </div>
          </div>

          {/* ── Submit ───────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate('/employer/jobs')}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              onClick={handlePublish}
              disabled={submitting}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? '正在发布...' : '确认发布'}
              {!submitting && <ChevronRight size={16} />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
