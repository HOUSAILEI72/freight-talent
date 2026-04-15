import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Briefcase, GraduationCap, Clock, Star, Send, ChevronLeft, CheckCircle, Edit, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { MatchScore } from '../../components/ui/MatchScore'
import { useAuth } from '../../context/AuthContext'
import { candidatesApi } from '../../api/candidates'
import { invitationsApi } from '../../api/invitations'

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

  // viewMode="self" 或候选人用 user.id 看自己
  const isOwnProfile = viewMode === 'self' || (user?.role === 'candidate' && String(user.id) === String(id))

  useEffect(() => {
    setLoadError('')
    if (isOwnProfile) {
      candidatesApi.getMyCandidateProfile()
        .then(res => {
          setProfile(res.data.profile ?? null)
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
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
              <TagList tags={display.tags} max={20} />
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
        </div>
      </div>
    </div>
  )
}