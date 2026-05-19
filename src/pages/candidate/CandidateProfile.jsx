import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, GraduationCap, Clock, Star, Send,
  CheckCircle, Edit, Loader2, AlertCircle, Mail, Phone,
  Home, MessageSquare, Languages, Target, Award, Navigation,
  FileText, Plus, ChevronRight, Eye, EyeOff, ShieldAlert,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TagNoteModal } from '../../components/ui/TagNoteModal'
import { useAuth } from '../../context/AuthContext'
import { candidatesApi } from '../../api/candidates'
import { getTags } from '../../api/tagsV2'
import { subscriptionsApi } from '../../api/subscriptions'

function FreshnessIndicator({ days, terminal }) {
  const color = days <= 3 ? 'emerald' : days <= 7 ? 'blue' : 'gray'
  const label = days <= 1 ? '今日更新' : `${days} 天内更新`

  if (terminal) {
    const dotColor =
      color === 'emerald' ? 'var(--t-success)' :
      color === 'blue'    ? 'var(--t-chart-blue)' : 'var(--t-text-muted)'
    const textColor =
      color === 'emerald' ? 'var(--t-success)' :
      color === 'blue'    ? 'var(--t-chart-blue)' : 'var(--t-text-muted)'
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 500,
        background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
        color: textColor,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: dotColor,
          animation: color === 'emerald' ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : undefined,
        }} />
        {label}
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
      color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
      color === 'blue'    ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === 'emerald' ? 'bg-emerald-500 animate-pulse' :
        color === 'blue'    ? 'bg-blue-500' : 'bg-slate-400'
      }`} />
      {label}
    </span>
  )
}

// 合并所有能力标签，按组分类展示
function buildTagGroups(profile) {
  const groups = []
  if (profile.knowledge_tags?.length)   groups.push({ label: '知识领域', tags: profile.knowledge_tags,  color: 'blue' })
  if (profile.hard_skill_tags?.length)  groups.push({ label: '硬技能',   tags: profile.hard_skill_tags, color: 'purple' })
  if (profile.soft_skill_tags?.length)  groups.push({ label: '岗位所需软技能',   tags: profile.soft_skill_tags, color: 'green' })
  // 如果新三组都为空，回退到旧 all_tags
  if (groups.length === 0 && profile.all_tags?.length) {
    groups.push({ label: '技能标签', tags: profile.all_tags, color: 'blue' })
  }
  return groups
}

const TAG_COLORS = {
  blue:   'bg-blue-50 text-blue-700 border-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
}

const TAG_STYLES_TERMINAL = {
  blue:   { background: 'rgba(96,165,250,0.12)',  color: 'var(--t-chart-blue)',   border: '1px solid rgba(96,165,250,0.25)' },
  purple: { background: 'rgba(167,139,250,0.12)', color: 'var(--t-chart-purple)', border: '1px solid rgba(167,139,250,0.25)' },
  green:  { background: 'rgba(74,222,128,0.12)',  color: 'var(--t-chart-green)',  border: '1px solid rgba(74,222,128,0.25)' },
  orange: { background: 'rgba(251,191,36,0.12)',  color: 'var(--t-chart-amber)',  border: '1px solid rgba(251,191,36,0.25)' },
}

// Section header: mono uppercase label in terminal, semibold h2 in light
function SectionTitle({ icon: Icon, iconColor, children, terminal, action, mb }) {
  if (terminal) {
    return (
      <div className="flex items-center justify-between pb-2.5 mb-3" style={{ borderBottom: '1px solid var(--t-border-subtle)' }}>
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={12} style={{ color: 'var(--t-text-muted)' }} />}
          <span className="font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em]" style={{ color: 'var(--t-text-muted)' }}>
            {children}
          </span>
        </div>
        {action}
      </div>
    )
  }
  const defaultMb = (Icon || action) ? 4 : 3
  const mbClass = (mb ?? defaultMb) === 4 ? 'mb-4' : 'mb-3'
  if (Icon) {
    return (
      <div className={`flex items-center gap-2 ${mbClass}`}>
        <Icon size={16} style={{ color: iconColor }} />
        <h2 className="font-semibold" style={{ color: '#1e293b' }}>{children}</h2>
        {action}
      </div>
    )
  }
  return (
    <div className={`flex items-center justify-between ${mbClass}`}>
      <h2 className="font-semibold" style={{ color: '#1e293b' }}>{children}</h2>
      {action}
    </div>
  )
}

export default function CandidateProfile({ viewMode, onEdit, terminal = false }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const [noteTag, setNoteTag] = useState(null)
  const [allTagObjects, setAllTagObjects] = useState([])
  const [hasSubscription, setHasSubscription] = useState(null)

  // ── 简历诊断（DeepSeek） ───────────────────────────────────────────────────
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosisResult, setDiagnosisResult] = useState(null) // DiagnoseResponse | null
  const [diagnosisError, setDiagnosisError] = useState('')

  // ── AI 解析简历 ───────────────────────────────────────────────────────────
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [applyingParse, setApplyingParse] = useState(false)
  const [applySuccess, setApplySuccess] = useState(false)

  async function handleAIParse() {
    setParsing(true); setParseError(''); setParsedData(null); setApplySuccess(false)
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/v2/candidates/me/resume/ai-parse', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setParseError(json.detail || `解析失败 (${res.status})`); return }
      setParsedData(json.data)
    } catch {
      setParseError('网络错误，请重试')
    } finally {
      setParsing(false)
    }
  }

  async function handleApplyParsed() {
    if (!parsedData) return
    setApplyingParse(true)
    try {
      const token = localStorage.getItem('token') || ''
      const payload = {}
      const strFields = ['full_name', 'education', 'english_level', 'expected_city',
        'desired_position', 'expected_salary_period', 'summary']
      strFields.forEach(k => { if (parsedData[k] != null) payload[k] = parsedData[k] })
      const numFields = ['age', 'experience_years', 'expected_salary_min', 'expected_salary_max']
      numFields.forEach(k => { if (parsedData[k] != null) payload[k] = parsedData[k] })
      const arrFields = ['work_experiences', 'education_experiences', 'project_experiences',
        'certificates', 'hard_skill_tags', 'soft_skill_tags']
      arrFields.forEach(k => { if (Array.isArray(parsedData[k]) && parsedData[k].length) payload[k] = parsedData[k] })
      const res = await fetch('/api/candidates/profile', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setParseError(err.message || '保存失败，请重试'); return
      }
      const updated = await res.json()
      setProfile(p => ({ ...p, ...updated.profile }))
      setApplySuccess(true)
      setTimeout(() => { setParsedData(null); setApplySuccess(false) }, 1500)
    } catch {
      setParseError('保存失败，请重试')
    } finally {
      setApplyingParse(false)
    }
  }

  // ── 屏蔽公司 ─────────────────────────────────────────────────────────────
  const [blockedCompanies, setBlockedCompanies] = useState([]) // [{id, name}]
  const [blockSearchQ, setBlockSearchQ] = useState('')
  const [blockSuggestions, setBlockSuggestions] = useState([])
  const [blockSearching, setBlockSearching] = useState(false)
  const [blockSaving, setBlockSaving] = useState(false)

  async function handleDiagnose() {
    setDiagnosing(true); setDiagnosisError(''); setDiagnosisResult(null)
    try {
      const token = localStorage.getItem('token') || ''
      const res = await fetch('/api/v2/ai/diagnose-resume', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setDiagnosisError(err.detail || `AI 诊断失败 (${res.status})`)
        return
      }
      const data = await res.json()
      setDiagnosisResult(data)
    } catch {
      setDiagnosisError('网络错误，请重试')
    } finally {
      setDiagnosing(false)
    }
  }

  const isOwnProfile = viewMode === 'self'

  useEffect(() => {
    setLoadError('')
    if (isOwnProfile) {
      candidatesApi.getMyCandidateProfile()
        .then(res => setProfile(res.data.profile ?? null))
        .catch(() => setLoadError('加载档案失败，请刷新重试'))
        .finally(() => setLoading(false))
    } else {
      const isNumericId = /^\d+$/.test(String(id))
      if (!isNumericId) { setLoadError('无效的候选人 ID'); setLoading(false); return }
      candidatesApi.getCandidatePublicProfile(id)
        .then(res => setProfile(res.data.candidate))
        .catch(err => setLoadError(err.response?.data?.message ?? '加载档案失败，请刷新重试'))
        .finally(() => setLoading(false))
    }
  }, [id, isOwnProfile, viewMode])

  useEffect(() => {
    getTags().then(data => setAllTagObjects(data.tags || [])).catch(() => {})
  }, [])

  // Fetch subscription status for employer gating
  useEffect(() => {
    if (user?.role === 'employer') {
      subscriptionsApi.getMySubscription()
        .then(res => setHasSubscription(res.data.has_active))
        .catch(() => setHasSubscription(false))
    }
  }, [user?.role])

  // Load blocked companies for own profile
  useEffect(() => {
    if (!isOwnProfile) return
    const token = localStorage.getItem('token') || ''
    fetch('/api/candidates/me/blocked-companies', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.success) setBlockedCompanies(d.companies || []) })
      .catch(() => {})
  }, [isOwnProfile])

  async function searchCompanies(q) {
    if (!q.trim()) { setBlockSuggestions([]); return }
    setBlockSearching(true)
    try {
      const token = localStorage.getItem('token') || ''
      const r = await fetch(`/api/companies?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json()
      const already = new Set(blockedCompanies.map(c => c.id))
      setBlockSuggestions((d.companies || []).filter(c => !already.has(c.id)).slice(0, 6))
    } catch { setBlockSuggestions([]) }
    finally { setBlockSearching(false) }
  }

  async function addBlockedCompany(company) {
    const updated = [...blockedCompanies, company]
    setBlockedCompanies(updated)
    setBlockSearchQ('')
    setBlockSuggestions([])
    setBlockSaving(true)
    try {
      const token = localStorage.getItem('token') || ''
      await fetch('/api/candidates/me/blocked-companies', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: updated.map(c => c.id) }),
      })
    } catch { /* silent */ }
    finally { setBlockSaving(false) }
  }

  async function removeBlockedCompany(companyId) {
    const updated = blockedCompanies.filter(c => c.id !== companyId)
    setBlockedCompanies(updated)
    setBlockSaving(true)
    try {
      const token = localStorage.getItem('token') || ''
      await fetch('/api/candidates/me/blocked-companies', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_ids: updated.map(c => c.id) }),
      })
    } catch { /* silent */ }
    finally { setBlockSaving(false) }
  }

  async function handleInvite() {
    if (user?.role === 'employer' && !hasSubscription) {
      navigate('/employer/pricing')
      return
    }
    setInviting(true)
    try { navigate('/employer/candidates') }
    finally { setInviting(false) }
  }

  if (loading) {
    return (
      <div
        className={terminal ? 'terminal-mode flex-1 w-full min-w-0 flex items-center justify-center gap-2 py-32' : 'flex items-center justify-center gap-2 py-32 text-slate-400'}
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text-muted)' } : undefined}
      >
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">加载档案...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div
        className={terminal ? 'terminal-mode flex-1 w-full min-w-0 flex flex-col items-center justify-center py-32' : 'flex flex-col items-center justify-center py-32 text-slate-400'}
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text-muted)' } : undefined}
      >
        <AlertCircle size={32} className="mb-3" style={terminal ? { color: 'var(--t-danger)' } : { color: '#fca5a5' }} />
        <p className="text-sm" style={terminal ? { color: 'var(--t-danger)' } : { color: '#ef4444' }}>{loadError}</p>
      </div>
    )
  }

  if (isOwnProfile && !profile) {
    return (
      <div
        className={terminal ? 'terminal-mode flex-1 w-full min-w-0 flex flex-col items-center justify-center px-6 py-24 text-center' : 'max-w-lg mx-auto px-6 py-24 text-center'}
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={terminal ? { background: 'var(--t-primary-muted)' } : { background: '#eff6ff' }}
        >
          <Edit size={28} style={terminal ? { color: 'var(--t-primary)' } : { color: '#3b82f6' }} />
        </div>
        <h2 className="text-2xl font-bold mb-2" style={terminal ? { color: 'var(--t-text)' } : { color: '#1e293b' }}>还没有档案</h2>
        <p className="mb-6" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#64748b' }}>上传简历后系统将为你生成结构化候选人档案</p>
        <Button terminal={terminal} onClick={() => navigate('/candidate/upload')}>立即上传简历</Button>
      </div>
    )
  }

  const unlockedDetails = isOwnProfile || !!profile.private_visible
  const tagGroups = buildTagGroups(profile)
  const locationDisplay = profile.location_path || profile.location_name || profile.current_city


  return (
    <div
      className={
        terminal
          ? `terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar py-8 ${isOwnProfile ? 'pl-6' : 'px-6'}`
          : 'max-w-5xl mx-auto px-6 py-10'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
    >
      <div className={terminal ? (isOwnProfile ? 'w-full' : 'mx-auto w-full max-w-5xl') : ''}>

      <div className={terminal ? 'flex gap-4 items-start' : 'grid lg:grid-cols-3 gap-6'}>

        {/* ── 左栏：简介卡 ── */}
        <div className={terminal ? '' : 'lg:col-span-1 space-y-4'} style={terminal ? { width: 248, flexShrink: 0 } : undefined}>
          <div
            className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border text-center' : 'card p-6 text-center'}
            style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-bold text-3xl mx-auto mb-4"
              style={terminal
                ? { background: 'var(--t-primary-muted)', color: 'var(--t-primary)', border: '1px solid var(--t-border)', fontFamily: 'var(--t-font-sans)' }
                : { background: 'linear-gradient(135deg, #60a5fa, #2563eb)', color: '#fff' }
              }
            >
              {profile.full_name?.[0] ?? '?'}
            </div>
            <h1
              className="text-xl font-bold"
              style={terminal
                ? { color: 'var(--t-text)', fontFamily: 'var(--t-font-sans)', letterSpacing: '0.02em' }
                : { color: '#1e293b' }
              }
            >
              {profile.full_name}
            </h1>
            <p
              className="text-sm mt-1"
              style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#64748b' }}
            >
              {profile.current_title}
            </p>

            {profile.freshness_days != null && (
              <div className="flex items-center justify-center mt-3">
                <FreshnessIndicator days={profile.freshness_days} terminal={terminal} />
              </div>
            )}

            {/* 核心属性列表 */}
            <div className="mt-6 space-y-2 text-sm text-left">
              {locationDisplay && (
                <div className="flex items-start gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <MapPin size={14} className="flex-shrink-0 mt-0.5" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  <span className="leading-snug">{locationDisplay}</span>
                </div>
              )}
              {profile.expected_city && profile.expected_city !== profile.current_city && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Navigation size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  期望城市：{profile.expected_city}
                </div>
              )}
              {profile.business_area_name && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Target size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  {profile.business_area_name}
                </div>
              )}
              {profile.experience_years != null && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Briefcase size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  {profile.experience_years} 年从业经验
                </div>
              )}
              {(profile.birth_year != null) && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Clock size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  {profile.birth_year} 年{profile.birth_month != null ? `${profile.birth_month} 月` : ''}
                  {profile.age != null && <span className="ml-1">（{profile.age} 岁）</span>}
                </div>
              )}
              {profile.birth_year == null && profile.age != null && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Clock size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  {profile.age} 岁
                </div>
              )}
              {profile.education && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <GraduationCap size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  {profile.education}
                </div>
              )}
              {profile.english_level && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Languages size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  英语：{profile.english_level}
                </div>
              )}
              {(profile.function_name || profile.business_type) && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                  <Star size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  {profile.function_name || profile.business_type}
                  {profile.is_management_role != null && (
                    <span className="ml-1 text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>
                      · {profile.is_management_role ? '带团队' : '执行岗'}
                    </span>
                  )}
                </div>
              )}
              {profile.updated_at && (
                <div className="flex items-center gap-2.5" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#64748b' }}>
                  <Clock size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                  更新于 {profile.updated_at.slice(0, 10)}
                </div>
              )}
            </div>

            {profile.expected_salary_label && (
              <div
                className="mt-6 pt-4"
                style={terminal ? { borderTop: '1px solid var(--t-border)' } : { borderTop: '1px solid #f1f5f9' }}
              >
                <p className="text-xs mb-1" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>期望薪资</p>
                <p className="text-xl font-bold" style={terminal ? { color: 'var(--t-primary)' } : { color: '#2563eb' }}>{profile.expected_salary_label}</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {!isOwnProfile && user?.role === 'employer' && (
                inviteSuccess ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium w-full justify-center border"
                    style={terminal ? { background: 'var(--t-success-muted)', color: 'var(--t-success)', borderColor: 'var(--t-success)' } : { background: '#ecfdf5', color: '#047857', borderColor: '#6ee7b7' }}
                  >
                    <CheckCircle size={14} />已发出邀约
                  </span>
                ) : (
                  <Button terminal={terminal} className="w-full" onClick={handleInvite} disabled={inviting}>
                    {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {inviting ? '处理中...' : '发起邀约'}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>

        {/* ── 中栏：主内容 ── */}
        <div className={terminal ? '' : 'lg:col-span-2 space-y-4'} style={terminal ? { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 } : undefined}>

          {/* 个人简介 */}
          {profile.summary && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal} mb={3}>个人简介</SectionTitle>
              <p
                className="text-sm leading-relaxed"
                style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}
              >
                {profile.summary}
              </p>
            </div>
          )}

          {/* 能力标签（知识 / 硬技能 / 软技能 分组） */}
          {tagGroups.length > 0 && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal} icon={Star} iconColor="#3b82f6">能力标签</SectionTitle>
              <div className="space-y-3">
                {tagGroups.map(group => (
                  <div key={group.label}>
                    <p className="text-xs mb-1.5" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map(tagName => {
                        const tagObj = allTagObjects.find(t => t.name === tagName)
                        return (
                          <div key={tagName} className="flex items-center gap-0.5">
                            {terminal ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '2px 10px', borderRadius: 9999,
                                fontSize: 11, fontWeight: 500,
                                ...TAG_STYLES_TERMINAL[group.color],
                              }}>
                                {tagName}
                              </span>
                            ) : (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${TAG_COLORS[group.color]}`}>
                                {tagName}
                              </span>
                            )}
                            {tagObj && isOwnProfile && (
                              <button
                                type="button"
                                title="为此标签写描述"
                                onClick={() => setNoteTag(tagObj)}
                                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                                className={terminal ? 'transition-colors' : 'text-slate-300 hover:text-blue-400 transition-colors'}
                                onMouseEnter={terminal ? e => { e.currentTarget.style.color = 'var(--t-primary)' } : undefined}
                                onMouseLeave={terminal ? e => { e.currentTarget.style.color = 'var(--t-text-muted)' } : undefined}
                              >
                                <MessageSquare size={11} />
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 简历文件 */}
          {profile.resume_file_name && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal} mb={3}>简历文件</SectionTitle>
              <div
                className="flex items-center gap-3 p-3 rounded-lg"
                style={terminal ? { background: 'var(--t-bg-elevated)' } : { background: '#f8fafc' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={terminal ? { background: 'var(--t-primary-muted)', color: 'var(--t-primary)' } : { background: '#dbeafe', color: '#2563eb' }}
                >
                  {profile.resume_file_name.split('.').pop().toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium" style={terminal ? { color: 'var(--t-text)' } : { color: '#334155' }}>{profile.resume_file_name}</p>
                  <p className="text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>上传于 {profile.resume_uploaded_at?.slice(0, 10) ?? '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* 当前任职 */}
          {unlockedDetails && (
            profile.current_company ||
            profile.current_responsibilities ||
            profile.current_salary_min != null ||
            profile.current_salary_max != null ||
            profile.current_salary_months != null ||
            profile.current_average_bonus_percent != null ||
            profile.current_has_year_end_bonus != null
          ) && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal}>当前任职</SectionTitle>
              {(profile.current_company || profile.current_title) && (
                <p
                  className="text-sm mb-2"
                  style={terminal ? { color: 'var(--t-text)' } : { color: '#334155' }}
                >
                  {profile.current_company || '—'}
                  {profile.current_title ? ` · ${profile.current_title}` : ''}
                </p>
              )}
              {profile.current_responsibilities && (
                <p
                  className="text-sm leading-relaxed whitespace-pre-line mb-3"
                  style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}
                >
                  <span className="text-xs mr-1" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>职责：</span>
                  {profile.current_responsibilities}
                </p>
              )}
              {(profile.current_salary_min != null ||
                profile.current_salary_max != null ||
                profile.current_salary_months != null ||
                profile.current_average_bonus_percent != null ||
                profile.current_has_year_end_bonus != null) && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      label: '当前月薪',
                      value: (profile.current_salary_min != null || profile.current_salary_max != null)
                        ? `${profile.current_salary_min ?? '—'} ~ ${profile.current_salary_max ?? '—'}`
                        : '—',
                    },
                    {
                      label: '薪资月数',
                      value: profile.current_salary_months != null ? `${profile.current_salary_months} 月` : '—',
                    },
                    {
                      label: '平均奖金',
                      value: profile.current_average_bonus_percent != null ? `${profile.current_average_bonus_percent}%` : '—',
                    },
                    {
                      label: '年终奖',
                      value: profile.current_has_year_end_bonus
                        ? (profile.current_year_end_bonus_months != null ? `${profile.current_year_end_bonus_months} 月` : '有')
                        : (profile.current_has_year_end_bonus === false ? '无' : '—'),
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="rounded-xl px-3 py-2.5"
                      style={terminal ? { background: 'var(--t-bg-elevated)' } : { background: '#f8fafc' }}
                    >
                      <p className="text-[10px] mb-0.5" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>{item.label}</p>
                      <p className="text-sm font-semibold" style={terminal ? { color: 'var(--t-text)' } : { color: '#334155' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 工作经历 */}
          {unlockedDetails && Array.isArray(profile.work_experiences) && profile.work_experiences.length > 0 && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-5'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal} icon={Briefcase} iconColor="#6366f1">工作经历</SectionTitle>
              <div className="space-y-4">
                {profile.work_experiences.map((w, i) => {
                  const company = w.company_name || w.company || '—'
                  const period = w.period || (w.start_month || w.end_month
                    ? `${w.start_month || '?'} – ${w.end_month || '至今'}`
                    : '—')
                  const salaryFixed = w.salary_min != null ? Number(w.salary_min).toLocaleString('en-US') : (w.salary_max != null ? Number(w.salary_max).toLocaleString('en-US') : null)
                  const yebText = w.has_year_end_bonus
                    ? (w.year_end_bonus_months != null ? `${w.year_end_bonus_months} 月年终` : '有年终')
                    : (w.has_year_end_bonus === false ? '无年终' : null)

                  const borderColor = terminal ? 'var(--t-border)' : '#bfdbfe'
                  const mutedColor = terminal ? 'var(--t-text-muted)' : '#94a3b8'
                  const secondaryColor = terminal ? 'var(--t-text-secondary)' : '#64748b'
                  const textColor = terminal ? 'var(--t-text)' : '#1e293b'

                  return (
                    <div
                      key={i}
                      className="pl-3 py-1"
                      style={{ borderLeft: `2px solid ${borderColor}` }}
                    >
                      {/* Row 1: title · company + period (right-aligned) */}
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="text-sm font-medium truncate"
                          style={{ color: textColor }}
                        >
                          {w.title || '—'} <span style={{ color: secondaryColor }}>·</span> {company}
                        </span>
                        <span
                          className="text-xs flex-shrink-0"
                          style={{ color: mutedColor }}
                        >
                          {period}
                        </span>
                      </div>

                      {/* Row 2: Responsibilities */}
                      {w.responsibilities && (
                        <p
                          className="text-xs mt-1 leading-relaxed whitespace-pre-line"
                          style={{ color: secondaryColor }}
                        >
                          <span style={{ color: mutedColor }}>职责：</span>{w.responsibilities}
                        </p>
                      )}

                      {/* Row 3: Achievements */}
                      {w.achievements && (
                        <p
                          className="text-xs mt-1 leading-relaxed whitespace-pre-line"
                          style={{ color: secondaryColor }}
                        >
                          <span style={{ color: mutedColor }}>成就：</span>{w.achievements}
                        </p>
                      )}

                      {/* Row 4: Salary info — compact inline */}
                      {(salaryFixed || w.salary_months != null || w.average_bonus_percent != null || yebText != null) && (
                        <p className="text-xs mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5" style={{ color: mutedColor }}>
                          {salaryFixed && (
                            <span style={{ color: secondaryColor }}>{salaryFixed}</span>
                          )}
                          {w.salary_months != null && (
                            <>
                              {salaryFixed && <span style={{ color: mutedColor }}>·</span>}
                              <span style={{ color: secondaryColor }}>{w.salary_months} 月</span>
                            </>
                          )}
                          {w.average_bonus_percent != null && (
                            <>
                              <span style={{ color: mutedColor }}>·</span>
                              <span style={{ color: secondaryColor }}>奖金 {w.average_bonus_percent}%</span>
                            </>
                          )}
                          {yebText != null && (
                            <>
                              <span style={{ color: mutedColor }}>·</span>
                              <span style={{ color: secondaryColor }}>{yebText}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 教育背景 */}
          {(profile.education ||
            (Array.isArray(profile.education_experiences) && profile.education_experiences.length > 0) ||
            (Array.isArray(profile.certificates) && profile.certificates.length > 0)) && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal} icon={GraduationCap} iconColor="#10b981">教育与证书</SectionTitle>

              {/* 学历摘要 */}
              {profile.education && (
                <p
                  className="text-sm font-medium mb-3"
                  style={terminal ? { color: 'var(--t-text)' } : { color: '#334155' }}
                >
                  {profile.education}
                </p>
              )}

              {/* 详细教育经历 */}
              {Array.isArray(profile.education_experiences) && profile.education_experiences.length > 0 && (
                <div className="space-y-2 mb-3">
                  {profile.education_experiences.map((e, i) => (
                    <div
                      key={i}
                      className="pl-3 py-0.5"
                      style={{ borderLeft: `2px solid ${terminal ? 'var(--t-success-muted)' : '#a7f3d0'}` }}
                    >
                      <p className="text-sm" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#334155' }}>
                        {e.school || '—'}
                        {e.major ? ` · ${e.major}` : ''}
                        {e.degree ? ` · ${e.degree}` : ''}
                      </p>
                      {e.period && <p className="text-xs" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>{e.period}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* 资格证书 */}
              {Array.isArray(profile.certificates) && profile.certificates.length > 0 && (
                <div>
                  <p className="text-xs mb-1.5" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>资格证书</p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.certificates.map(cert => (
                      terminal ? (
                        <span key={cert} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 10px', borderRadius: 9999,
                          fontSize: 11, fontWeight: 500,
                          background: 'rgba(251,191,36,0.12)', color: 'var(--t-chart-amber)',
                          border: '1px solid rgba(251,191,36,0.25)',
                        }}>
                          <Award size={10} />
                          {cert}
                        </span>
                      ) : (
                        <span key={cert} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-100">
                          <Award size={10} />
                          {cert}
                        </span>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 联系信息（自己查看） */}
          {isOwnProfile && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle
                terminal={terminal}
                action={
                  <Button terminal={terminal} size="sm" variant="secondary" onClick={onEdit ?? (() => navigate('/candidate/profile/builder'))}>
                    <Edit size={12} />编辑档案
                  </Button>
                }
              >
                联系信息
              </SectionTitle>
              <p
                className="text-xs mb-4 leading-relaxed"
                style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#64748b' }}
              >
                联系方式在订阅覆盖该候选人后对企业可见。
              </p>
              <div className="space-y-2 text-sm">
                {profile.email
                  ? <div className="flex items-center gap-2" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}><Mail size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />{profile.email}</div>
                  : null}
                {profile.phone
                  ? <div className="flex items-center gap-2" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}><Phone size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />{profile.phone}</div>
                  : null}
                {profile.address
                  ? <div className="flex items-center gap-2" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}><Home size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />{profile.address}</div>
                  : null}
                {!profile.email && !profile.phone && !profile.address && (
                  <p className="text-sm" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }}>暂无联系信息，请在档案编辑中补充。</p>
                )}
              </div>
            </div>
          )}

          {/* 联系信息（企业/admin 查看，private_visible 时） */}
          {!isOwnProfile && profile.private_visible && (profile.email || profile.phone || profile.address) && (
            <div
              className={terminal ? 'p-5 rounded-[var(--t-radius-lg)] border' : 'card p-6'}
              style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
            >
              <SectionTitle terminal={terminal}>联系信息</SectionTitle>
              <div className="space-y-2 text-sm">
                {profile.email && (
                  <div className="flex items-center gap-2" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                    <Mail size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                    <a href={`mailto:${profile.email}`} style={terminal ? { color: 'var(--t-primary)' } : { color: '#2563eb' }}>{profile.email}</a>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                    <Phone size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                    <a href={`tel:${profile.phone}`} style={terminal ? { color: 'var(--t-primary)' } : { color: '#2563eb' }}>{profile.phone}</a>
                  </div>
                )}
                {profile.address && (
                  <div className="flex items-center gap-2" style={terminal ? { color: 'var(--t-text-secondary)' } : { color: '#475569' }}>
                    <Home size={14} className="flex-shrink-0" style={terminal ? { color: 'var(--t-text-muted)' } : { color: '#94a3b8' }} />
                    {profile.address}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ── 右侧管理面板（terminal + 自己查看） ── */}
        {terminal && isOwnProfile && (
          <div style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* ── 附件管理 ── */}
            <div style={{ background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-lg)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)' }}>附件管理</span>
                <button type="button" onClick={() => navigate('/candidate/upload')}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, border: '1px solid var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', cursor: 'pointer' }}>
                  <Plus size={14} />
                </button>
              </div>
              {profile.resume_file_name ? (
                <>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 8 }}>文件（1/1）</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', marginBottom: 10 }}>
                    <div style={{ width: 38, height: 46, borderRadius: 6, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>PDF</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.resume_file_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>
                        更新于 {profile.resume_uploaded_at ? profile.resume_uploaded_at.slice(0, 10).replace(/-/g, '.') : '—'}
                      </p>
                    </div>
                  </div>
                  {/* AI 解析按钮 */}
                  <button type="button" onClick={handleAIParse} disabled={parsing}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', borderRadius: 6, border: '1px solid var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)', fontSize: 12, fontWeight: 500, cursor: parsing ? 'not-allowed' : 'pointer', opacity: parsing ? 0.7 : 1 }}>
                    {parsing ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                    {parsing ? 'AI 解析中...' : 'AI 解析档案'}
                  </button>
                  {parseError && <p style={{ fontSize: 11, color: 'var(--t-danger)', marginTop: 6 }}>{parseError}</p>}
                </>
              ) : (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 8 }}>暂未上传简历附件</p>
                  <button type="button" onClick={() => navigate('/candidate/upload')}
                    style={{ fontSize: 12, color: 'var(--t-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    立即上传 →
                  </button>
                </div>
              )}
            </div>

            {/* ── 简历诊断（DeepSeek） ── */}
            <div style={{ background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-lg)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)' }}>简历诊断</p>
                <button type="button" onClick={handleDiagnose} disabled={diagnosing}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--t-primary)', background: 'var(--t-primary-muted)', color: 'var(--t-primary)', cursor: diagnosing ? 'not-allowed' : 'pointer', opacity: diagnosing ? 0.7 : 1, whiteSpace: 'nowrap' }}>
                  {diagnosing ? <Loader2 size={10} className="animate-spin" /> : <ShieldAlert size={10} />}
                  {diagnosing ? '分析中...' : 'AI 诊断'}
                </button>
              </div>

              {/* 初始空态 */}
              {!diagnosing && !diagnosisResult && !diagnosisError && (
                <div style={{ padding: '12px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 6, lineHeight: 1.6 }}>点击「AI 诊断」，DeepSeek 将分析你的档案并给出改进建议</p>
                </div>
              )}

              {/* 加载中 */}
              {diagnosing && (
                <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--t-primary)' }} />
                  <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>DeepSeek 正在分析档案...</p>
                </div>
              )}

              {/* 错误 */}
              {diagnosisError && (
                <div style={{ fontSize: 12, color: 'var(--t-danger)', padding: '8px 0' }}>{diagnosisError}</div>
              )}

              {/* 结果 */}
              {diagnosisResult && (
                <div style={{ background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', borderRadius: 8, padding: '14px 16px' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--t-text-secondary)', marginBottom: 6 }}>完善简历内容</p>
                  <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--t-chart-amber)', lineHeight: 1, marginBottom: 2 }}>{diagnosisResult.items.length}</p>
                  <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 14 }}>项待优化</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {diagnosisResult.items.map((item, idx) => (
                      <div key={idx} style={{ paddingLeft: 10, borderLeft: `3px solid ${item.priority === 'high' ? 'var(--t-danger)' : 'var(--t-primary)'}` }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)', marginBottom: 3 }}>{item.title}</p>
                        <p style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.6 }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── 隐私设置 ── */}
            <div style={{ background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-lg)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)' }}>隐私设置</span>
                <button type="button" onClick={() => navigate('/candidate/settings')}
                  style={{ fontSize: 12, color: 'var(--t-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}>
                  设置
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>简历设置</span>
                <span style={{ fontSize: 12, color: 'var(--t-text-secondary)' }}>
                  {profile.contact_visible ? '对外开放' : '仅自己可见'}
                </span>
              </div>
            </div>

            {/* ── 屏蔽公司 ── */}
            <div style={{ background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)', borderRadius: 'var(--t-radius-lg)', padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)' }}>屏蔽公司</span>
                {blockSaving && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--t-text-muted)' }} />}
              </div>

              {/* Search input */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  type="text"
                  value={blockSearchQ}
                  placeholder="搜索并添加..."
                  onChange={e => {
                    setBlockSearchQ(e.target.value)
                    searchCompanies(e.target.value)
                  }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '5px 8px', fontSize: 12, borderRadius: 6,
                    border: '1px solid var(--t-border)', outline: 'none',
                    background: 'var(--t-bg-input)', color: 'var(--t-text)',
                  }}
                />
                {blockSearching && (
                  <Loader2 size={11} className="animate-spin"
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--t-text-muted)' }} />
                )}
                {blockSuggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)',
                    borderRadius: 6, marginTop: 2, overflow: 'hidden',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  }}>
                    {blockSuggestions.map(c => (
                      <button key={c.id} type="button"
                        onClick={() => addBlockedCompany(c)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '7px 10px', fontSize: 12, color: 'var(--t-text)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderBottom: '1px solid var(--t-border-subtle)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--t-bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                      >{c.name}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Blocked list */}
              {blockedCompanies.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--t-text-muted)', textAlign: 'center', padding: '8px 0' }}>
                  暂未屏蔽任何公司
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {blockedCompanies.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 8px', borderRadius: 6,
                      background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border-subtle)',
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--t-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <button type="button" onClick={() => removeBlockedCompany(c.id)}
                        style={{ flexShrink: 0, marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--t-text-muted)', display: 'flex', alignItems: 'center' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--t-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--t-text-muted)'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {noteTag && <TagNoteModal tag={noteTag} onClose={() => setNoteTag(null)} />}

      {/* ── AI 解析确认弹窗 ── */}
      {parsedData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9500, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setParsedData(null) }}>
          <div style={{ width: '100%', maxWidth: 540, maxHeight: '85vh', display: 'flex', flexDirection: 'column', borderRadius: 'var(--t-radius-lg)', border: '1px solid var(--t-border)', background: 'var(--t-bg-panel)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--t-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={15} style={{ color: 'var(--t-primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)' }}>AI 解析结果</span>
              </div>
              <button type="button" onClick={() => setParsedData(null)} style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', color: 'var(--t-text-muted)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: 'var(--t-text-muted)', marginBottom: 4 }}>以下字段将覆盖写入你的档案，请确认无误后点击「应用到档案」。</p>
              {[
                ['姓名', parsedData.full_name],
                ['年龄', parsedData.age],
                ['工作年限', parsedData.experience_years != null ? `${parsedData.experience_years} 年` : null],
                ['学历', parsedData.education],
                ['英语水平', parsedData.english_level],
                ['期望城市', parsedData.expected_city],
                ['期望岗位', parsedData.desired_position],
                ['期望薪资', parsedData.expected_salary_min != null
                  ? `${parsedData.expected_salary_min?.toLocaleString()}—${parsedData.expected_salary_max?.toLocaleString()} /${parsedData.expected_salary_period === 'year' ? '年' : '月'}`
                  : null],
              ].filter(([, v]) => v != null).map(([label, value]) => (
                <div key={label} style={{ display: 'flex', gap: 12, padding: '7px 10px', borderRadius: 6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border-subtle)' }}>
                  <span style={{ fontSize: 11, color: 'var(--t-text-muted)', width: 64, flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 12, color: 'var(--t-text)', fontWeight: 500 }}>{String(value)}</span>
                </div>
              ))}
              {parsedData.summary && (
                <div style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border-subtle)' }}>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>个人优势</p>
                  <p style={{ fontSize: 12, color: 'var(--t-text)', lineHeight: 1.7 }}>{parsedData.summary.slice(0, 200)}{parsedData.summary.length > 200 ? '…' : ''}</p>
                </div>
              )}
              {parsedData.work_experiences?.length > 0 && (
                <div style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border-subtle)' }}>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 6 }}>工作经历（{parsedData.work_experiences.length} 条）</p>
                  {parsedData.work_experiences.slice(0, 3).map((w, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--t-text)', marginBottom: 2 }}>{w.company_name} · {w.title}　{w.start_month}—{w.end_month}</p>
                  ))}
                  {parsedData.work_experiences.length > 3 && <p style={{ fontSize: 11, color: 'var(--t-text-muted)' }}>……共 {parsedData.work_experiences.length} 条</p>}
                </div>
              )}
              {parsedData.education_experiences?.length > 0 && (
                <div style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border-subtle)' }}>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 6 }}>教育经历（{parsedData.education_experiences.length} 条）</p>
                  {parsedData.education_experiences.map((e, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--t-text)', marginBottom: 2 }}>{e.school} · {e.major} · {e.degree}</p>
                  ))}
                </div>
              )}
              {parsedData.certificates?.length > 0 && (
                <div style={{ padding: '7px 10px', borderRadius: 6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border-subtle)' }}>
                  <p style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 4 }}>证书</p>
                  <p style={{ fontSize: 12, color: 'var(--t-text)' }}>{parsedData.certificates.join('、')}</p>
                </div>
              )}
              {parseError && <p style={{ fontSize: 12, color: 'var(--t-danger)' }}>{parseError}</p>}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--t-border)', display: 'flex', gap: 10, flexShrink: 0 }}>
              <button type="button" onClick={() => setParsedData(null)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: '1px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-secondary)', fontSize: 13, cursor: 'pointer' }}>
                取消
              </button>
              <button type="button" onClick={handleApplyParsed} disabled={applyingParse || applySuccess}
                style={{ flex: 2, padding: '8px 0', borderRadius: 6, border: 'none', background: applySuccess ? 'var(--t-success)' : 'var(--t-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: applyingParse ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {applyingParse ? <Loader2 size={13} className="animate-spin" /> : null}
                {applySuccess ? '已应用 ✓' : applyingParse ? '保存中...' : '应用到档案'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
