import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Briefcase, GraduationCap, Clock, Star, Send, ChevronLeft, CheckCircle, Edit, Loader2, AlertCircle, Mail, Phone, Home, MessageSquare } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { MatchScore } from '../../components/ui/MatchScore'
import { TagNoteModal } from '../../components/ui/TagNoteModal'
import { useAuth } from '../../context/AuthContext'
import { candidatesApi } from '../../api/candidates'
import { invitationsApi } from '../../api/invitations'
import { getTags } from '../../api/tagsV2'

function FreshnessIndicator({ days }) {
  const color = days <= 3 ? 'emerald' : days <= 7 ? 'blue' : 'gray'
  const label = days <= 1 ? '今日更新' : `${days}天内更新`
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
      color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
      color === 'blue' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
      'bg-slate-100 text-slate-500'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        color === 'emerald' ? 'bg-emerald-500 animate-pulse' :
        color === 'blue' ? 'bg-blue-500' : 'bg-slate-400'
      }`} />
      {label}
    </span>
  )
}

// viewMode="self" 由 /candidate/profile/me 路由传入
export default function CandidateProfile({ viewMode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)

  // 标签描述弹窗
  const [noteTag, setNoteTag] = useState(null)   // { id, name, category } | null
  const [allTagObjects, setAllTagObjects] = useState([]) // active 标签完整对象（含 id）

  // viewMode="self" → 候选人从 /candidate/profile/me 进入，直接调 /candidates/me
  // 数字 id 路由 → 调公开档案接口，后端会对候选人本人豁免角色限制
  const isOwnProfile = viewMode === 'self'

  useEffect(() => {
    setLoadError('')
    if (isOwnProfile) {
      candidatesApi.getMyCandidateProfile()
        .then(res => {
          const p = res.data.profile ?? null
          setProfile(p)
        })
        .catch(() => {
          setLoadError('加载档案失败，请刷新重试')
        })
        .finally(() => setLoading(false))
    } else {
      // employer / admin 看候选人公开档案（只接受数字 id）
      const isNumericId = /^\d+$/.test(String(id))
      if (!isNumericId) {
        setLoadError('无效的候选人 ID')
        setLoading(false)
        return
      }
      candidatesApi.getCandidatePublicProfile(id)
        .then(res => {
          setProfile(res.data.candidate)
        })
        .catch(err => {
          const msg = err.response?.data?.message ?? '加载档案失败，请刷新重试'
          setLoadError(msg)
        })
        .finally(() => setLoading(false))
    }
  }, [id, isOwnProfile, viewMode])

  // 加载 active 标签完整对象（用于 note 弹窗）
  useEffect(() => {
    getTags().then(data => setAllTagObjects(data.tags || [])).catch(() => {})
  }, [])

  // 发起邀约（企业端：需要先选岗位，此处简化为提示去候选人池选岗位后发邀）
  async function handleInvite() {
    setInviteError('')
    setInviting(true)
    try {
      // 调用邀约 API —— 实际需要 job_id，此处跳转到候选人池让用户选岗位
      navigate('/employer/candidates')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-slate-400">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">加载档案...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-slate-400">
        <AlertCircle size={32} className="mb-3 text-red-300" />
        <p className="text-sm text-red-500">{loadError}</p>
        <Button size="sm" variant="secondary" className="mt-4" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
    )
  }

  // 候选人自己但还没有档案
  if (isOwnProfile && !profile) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <Edit size={28} className="text-blue-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">还没有档案</h2>
        <p className="text-slate-500 mb-6">上传简历后系统将为你生成结构化候选人档案</p>
        <Button onClick={() => navigate('/candidate/upload')}>
          立即上传简历
        </Button>
      </div>
    )
  }

  // 统一从真实 profile 字段提取展示字段
  const display = {
    name: profile.full_name,
    title: profile.current_title,
    city: profile.current_city,
    experience: profile.experience_years,
    education: profile.education,
    salary: profile.expected_salary_label,
    summary: profile.summary,
    tags: profile.all_tags || [],
    freshness: profile.freshness_days,
    available: profile.availability_status === 'open',
    score: null,
    updatedAt: profile.updated_at?.slice(0, 10) ?? '—',
  }

  // CAND-8A: gate the new richer sections on "owner OR employer that the
  // backend has unlocked". Front-end never tries to compute the unlock — we
  // trust profile.private_visible from /api/candidates/<id>. /me always
  // returns private_visible=true.
  const unlockedDetails = isOwnProfile || !!profile.private_visible

  // Terminal mode is enabled only for the candidate viewing their own profile
  // (`viewMode="self"`). Employer / admin viewing /candidate/profile/:id stays
  // in the original light layout.
  const terminal = isOwnProfile

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
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ChevronLeft size={16} />
        返回
      </button>

      {/* 真实数据提示条 */}
      <div className="mb-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
        <CheckCircle size={14} className="text-emerald-600 flex-shrink-0" />
        <span className="text-xs text-emerald-700">
          {isOwnProfile
            ? `正在显示你的真实档案 · 最近确认于 ${profile.profile_confirmed_at?.slice(0, 10) ?? '—'}`
            : `真实候选人档案 · 最近更新于 ${profile.updated_at?.slice(0, 10) ?? '—'}`
          }
        </span>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Profile card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-3xl mx-auto mb-4">
              {display.name?.[0] ?? '?'}
            </div>
            <h1 className="text-xl font-bold text-slate-800">{display.name}</h1>
            <p className="text-slate-500 text-sm mt-1">{display.title}</p>

            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {display.freshness != null && (
                <FreshnessIndicator days={display.freshness} />
              )}
              {display.available ? (
                <Badge color="green">开放机会</Badge>
              ) : (
                <Badge color="gray">暂不考虑</Badge>
              )}
            </div>

            {display.score != null && (
              <div className="mt-6 flex justify-center">
                <MatchScore score={display.score} size="lg" />
              </div>
            )}
            {display.score != null && (
              <p className="text-xs text-slate-400 mt-2">综合匹配评分</p>
            )}

            <div className="mt-6 space-y-2 text-sm text-left">
              {display.city && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                  {display.city}
                </div>
              )}
              {display.experience != null && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Briefcase size={14} className="text-slate-400 flex-shrink-0" />
                  {display.experience} 年从业经验
                </div>
              )}
              {display.education && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <GraduationCap size={14} className="text-slate-400 flex-shrink-0" />
                  {display.education}
                </div>
              )}
              {display.updatedAt && (
                <div className="flex items-center gap-2.5 text-slate-600">
                  <Clock size={14} className="text-slate-400 flex-shrink-0" />
                  简历更新于 {display.updatedAt}
                </div>
              )}
            </div>

            {display.salary && (
              <div className="mt-6 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">期望薪资</p>
                <p className="text-xl font-bold text-blue-600">{display.salary}</p>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {!isOwnProfile && user?.role === 'employer' && (
                <>
                  {inviteError && (
                    <p className="text-xs text-red-500">{inviteError}</p>
                  )}
                  {inviteSuccess ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium w-full justify-center">
                      <CheckCircle size={14} />已发出邀约
                    </span>
                  ) : (
                    <Button className="w-full" onClick={handleInvite} disabled={inviting}>
                      {inviting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {inviting ? '处理中...' : '发起邀约'}
                    </Button>
                  )}
                </>
              )}
              {isOwnProfile && (
                <Button variant="secondary" className="w-full" onClick={() => navigate('/candidate/upload')}>
                  <Edit size={14} />
                  更新简历
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Details */}
        <div className="lg:col-span-2 space-y-4">
          {display.summary && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-3">个人简介</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{display.summary}</p>
            </div>
          )}

          {display.tags?.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Star size={16} className="text-blue-500" />
                <h2 className="font-semibold text-slate-800">技能标签</h2>
                <span className="text-xs text-slate-400">· 真实档案标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {display.tags.map((tagName, i) => {
                  const tagObj = allTagObjects.find(t => t.name === tagName)
                  const colors = ['blue', 'purple', 'green', 'orange']
                  const color = colors[i % colors.length]
                  const colorClasses = {
                    blue: 'bg-blue-50 text-blue-700 border-blue-100',
                    purple: 'bg-purple-50 text-purple-700 border-purple-100',
                    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    orange: 'bg-orange-50 text-orange-700 border-orange-100',
                  }
                  return (
                    <div key={tagName} className="flex items-center gap-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses[color]}`}>
                        {tagName}
                      </span>
                      {tagObj && (
                        <button
                          type="button"
                          title="为此标签写描述"
                          onClick={() => setNoteTag(tagObj)}
                          className="text-slate-300 hover:text-blue-400 transition-colors"
                        >
                          <MessageSquare size={12} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 真实档案：显示简历文件信息 */}
          {profile.resume_file_name && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-3">简历文件</h2>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                  {profile.resume_file_name?.split('.').pop().toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{profile.resume_file_name}</p>
                  <p className="text-xs text-slate-400">
                    上传于 {profile.resume_uploaded_at?.slice(0, 10) ?? '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CAND-8A: 当前任职（self 永远显示；employer 仅 private_visible 时显示）*/}
          {unlockedDetails && (
            profile.current_company ||
            profile.current_responsibilities ||
            profile.current_salary_min != null ||
            profile.current_salary_max != null ||
            profile.current_salary_months != null ||
            profile.current_average_bonus_percent != null ||
            profile.current_has_year_end_bonus != null
          ) && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-4">当前任职</h2>
              {(profile.current_company || profile.current_title) && (
                <p className="text-sm text-slate-700 mb-2">
                  {profile.current_company || '—'}
                  {profile.current_title ? ` · ${profile.current_title}` : ''}
                </p>
              )}
              {profile.current_responsibilities && (
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line mb-3">
                  <span className="text-xs text-slate-400 mr-1">职责：</span>
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
                        ? (profile.current_year_end_bonus_months != null
                            ? `${profile.current_year_end_bonus_months} 月`
                            : '有')
                        : (profile.current_has_year_end_bonus === false ? '无' : '—'),
                    },
                  ].map(item => (
                    <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] text-slate-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-slate-700">{item.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CAND-8A: 工作经历（self 永远显示；employer 仅 private_visible 时显示）*/}
          {unlockedDetails && Array.isArray(profile.work_experiences) && profile.work_experiences.length > 0 && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-4">工作经历</h2>
              <div className="space-y-4">
                {profile.work_experiences.map((w, i) => {
                  const company = w.company_name || w.company || '—'
                  const period = w.period
                    || (w.start_month || w.end_month
                      ? `${w.start_month || '?'} – ${w.end_month || '至今'}`
                      : '—')
                  const salaryRange = (w.salary_min != null || w.salary_max != null)
                    ? `${w.salary_min ?? '—'} ~ ${w.salary_max ?? '—'}`
                    : null
                  const yebText = w.has_year_end_bonus
                    ? (w.year_end_bonus_months != null ? `${w.year_end_bonus_months} 月` : '有')
                    : (w.has_year_end_bonus === false ? '无' : null)
                  return (
                    <div key={i} className="border-l-2 border-blue-200 pl-3 py-1">
                      <p className="text-sm font-medium text-slate-800">
                        {w.title || '—'} · {company}
                      </p>
                      <p className="text-xs text-slate-500">{period}</p>
                      {w.responsibilities && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                          <span className="mr-1 text-slate-400">职责：</span>{w.responsibilities}
                        </p>
                      )}
                      {w.achievements && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                          <span className="mr-1 text-slate-400">成就：</span>{w.achievements}
                        </p>
                      )}
                      {(salaryRange || w.salary_months != null || w.average_bonus_percent != null || yebText != null) && (
                        <p className="text-xs text-slate-500 mt-1">
                          {salaryRange && <span className="mr-2">薪资 {salaryRange}</span>}
                          {w.salary_months != null && <span className="mr-2">{w.salary_months} 月</span>}
                          {w.average_bonus_percent != null && <span className="mr-2">奖金 {w.average_bonus_percent}%</span>}
                          {yebText && <span>年终奖 {yebText}</span>}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {profile.education && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-4">教育背景</h2>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <GraduationCap size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{display.education}</p>
                </div>
              </div>
            </div>
          )}

          {/* 联系信息 — 自己只读展示；编辑统一进入个人简历页。
              企业 / admin：仅在 private_visible 时展示 */}
          {isOwnProfile && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">联系信息</h2>
                <Button size="sm" variant="secondary" onClick={() => navigate('/candidate/profile/builder')}>
                  <Edit size={12} />编辑个人简历
                </Button>
              </div>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                联系方式将在你接受企业邀约或主动投递后，对相关企业可见。其它企业仍然看不到你的电话和邮箱。
              </p>
              <div className="space-y-2 text-sm">
                {profile.email ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{profile.email}</span>
                  </div>
                ) : null}
                {profile.phone ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                ) : null}
                {profile.address ? (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Home size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{profile.address}</span>
                  </div>
                ) : null}
                {!profile.email && !profile.phone && !profile.address && (
                  <p className="text-sm text-slate-400">暂无联系信息，请在个人简历中补充。</p>
                )}
              </div>
            </div>
          )}

          {/* 企业 / admin 查看候选人时，只有 private_visible 才展示联系信息 */}
          {!isOwnProfile && profile.private_visible && (profile.email || profile.phone || profile.address) && (
            <div className="card p-6">
              <h2 className="font-semibold text-slate-800 mb-4">联系信息</h2>
              <div className="space-y-2 text-sm">
                {profile.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={14} className="text-slate-400 flex-shrink-0" />
                    <a href={`mailto:${profile.email}`} className="hover:text-blue-600">{profile.email}</a>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="text-slate-400 flex-shrink-0" />
                    <a href={`tel:${profile.phone}`} className="hover:text-blue-600">{profile.phone}</a>
                  </div>
                )}
                {profile.address && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Home size={14} className="text-slate-400 flex-shrink-0" />
                    {profile.address}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 标签描述弹窗 */}
      {noteTag && (
        <TagNoteModal tag={noteTag} onClose={() => setNoteTag(null)} />
      )}
    </div>
    </div>
  )
}
