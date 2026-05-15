import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, GraduationCap, Clock, Star, Send,
  CheckCircle, Edit, Loader2, AlertCircle, Mail, Phone,
  Home, MessageSquare, Languages, Target, Award, Navigation,
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

function AvailBadge({ status, terminal = false }) {
  if (status === 'open')    return <Badge color="green"  terminal={terminal}>开放机会</Badge>
  if (status === 'passive') return <Badge color="yellow" terminal={terminal}>被动求职</Badge>
  return <Badge color="gray" terminal={terminal}>暂不考虑</Badge>
}

// 合并所有能力标签，按组分类展示
function buildTagGroups(profile) {
  const groups = []
  if (profile.knowledge_tags?.length)   groups.push({ label: '知识领域', tags: profile.knowledge_tags,  color: 'blue' })
  if (profile.hard_skill_tags?.length)  groups.push({ label: '硬技能',   tags: profile.hard_skill_tags, color: 'purple' })
  if (profile.soft_skill_tags?.length)  groups.push({ label: '软技能',   tags: profile.soft_skill_tags, color: 'green' })
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

  // 地区显示：优先 location_path，回退 current_city
  const locationDisplay = profile.location_path || profile.location_name || profile.current_city

  return (
    <div
      className={
        terminal
          ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-8'
          : 'max-w-5xl mx-auto px-6 py-10'
      }
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
    >
      <div className={terminal ? 'mx-auto w-full max-w-5xl' : ''}>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* ── 左栏 ── */}
        <div className="lg:col-span-1 space-y-4">
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

            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {profile.freshness_days != null && <FreshnessIndicator days={profile.freshness_days} terminal={terminal} />}
              <AvailBadge status={profile.availability_status} terminal={terminal} />
            </div>

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
              {isOwnProfile && (
                <Button terminal={terminal} variant="secondary" className="w-full" onClick={() => navigate('/candidate/upload')}>
                  <Edit size={14} />
                  更新简历文件
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── 右栏 ── */}
        <div className="lg:col-span-2 space-y-4">

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
      </div>

      {noteTag && <TagNoteModal tag={noteTag} onClose={() => setNoteTag(null)} />}
      </div>
    </div>
  )
}
