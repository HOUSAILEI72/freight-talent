import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Clock, Briefcase, MapPin, Star, CheckCircle, Loader2, FolderOpen, MessageSquare, Send } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { MatchScore } from '../../components/ui/MatchScore'
import { StatusBadge } from '../../components/ui/Badge'
import { InviteModal } from '../../components/ui/InviteModal'
import { matchesApi } from '../../api/matches'

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ name, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl">
      <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
      <span className="text-sm font-medium">已向 <strong>{name}</strong> 发出邀约</span>
    </div>
  )
}

// ─── Freshness badge ──────────────────────────────────────────────────────────

function FreshBadge({ days }) {
  if (days == null) return null
  if (days <= 3) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
      {days <= 1 ? '今日更新' : `${days}天内更新`}
    </span>
  )
  if (days <= 7) return <Badge color="blue">{days}天内更新</Badge>
  return null
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MatchResult() {
  const { jobId } = useParams()
  const navigate = useNavigate()

  const [job, setJob]         = useState(null)
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [invited, setInvited] = useState({})  // { [candidateId]: threadId | true }
  const [modal, setModal]     = useState(null)
  const [toast, setToast]     = useState(null)

  // 拉真实匹配数据
  useEffect(() => {
    if (!jobId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    matchesApi.getJobMatches(jobId)
      .then(res => {
        setJob(res.data.job)
        setMatches(res.data.matches)
      })
      .catch(err => {
        setError(err.response?.data?.message ?? '加载匹配数据失败，请刷新重试')
      })
      .finally(() => setLoading(false))
  }, [jobId])

  const invitedCount  = Object.keys(invited).length
  const highMatchCount = matches.filter(m => m.score >= 70).length
  const activeCount   = matches.filter(m => (m.candidate?.freshness_days ?? 999) <= 30).length

  const handleConfirm = useCallback((threadId) => {
    setInvited(prev => ({ ...prev, [modal.id]: threadId ?? true }))
    setToast(modal.full_name)
    setModal(null)
  }, [modal])

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 text-slate-400" style={{ minHeight: 'calc(100vh - 64px)' }}>
        <Loader2 size={28} className="animate-spin text-blue-400" />
        <p className="text-sm">正在计算匹配结果...</p>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="max-w-lg mx-auto px-6 text-center" style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p className="text-slate-500 mb-4">{error}</p>
        <Button variant="secondary" onClick={() => navigate(-1)}>返回</Button>
      </div>
    )
  }

  // 岗位摘要显示用的字段
  const jobTags = [...(job?.route_tags ?? []), ...(job?.skill_tags ?? [])]
  const salaryText = job?.salary_label ?? '面议'

  return (
    <>
      {modal && (
        <InviteModal
          candidate={modal}
          job={job}
          matchScore={modal.matchScore}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {toast && <Toast name={toast} onDone={() => setToast(null)} />}

      <div className="max-w-6xl mx-auto px-6 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <ChevronLeft size={16} /> 返回
        </button>

        {/* ── 岗位摘要（真实数据）── */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                {(job?.company_name ?? job?.title ?? '?')[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-800">{job?.title}</h1>
                  <StatusBadge status={job?.status} />
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {job?.company_name ?? '—'} · {job?.city} · {salaryText}
                </p>
              </div>
            </div>

            {/* 统计数字（真实） */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{matches.length}</p>
                <p className="text-xs text-slate-400">匹配人选</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-600">{highMatchCount}</p>
                <p className="text-xs text-slate-400">高匹配（≥70）</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="text-center">
                <p className={`text-2xl font-bold tabular-nums transition-colors duration-300 ${invitedCount > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {invitedCount}
                </p>
                <p className="text-xs text-slate-400">已邀约</p>
              </div>
              <div className="w-px h-8 bg-slate-100" />
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-500">{activeCount}</p>
                <p className="text-xs text-slate-400">近30天活跃</p>
              </div>
            </div>
          </div>

          {jobTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span className="text-xs text-slate-400 mr-1">岗位标签：</span>
              <TagList tags={jobTags} max={10} />
            </div>
          )}
        </div>

        {/* ── 过滤栏 ── */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm font-medium text-slate-700">共 {matches.length} 位匹配候选人</span>
          {invitedCount > 0 && (
            <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              {invitedCount} 人已邀约
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white">综合排序</button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100">近期更新</button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100">匹配分</button>
          </div>
        </div>

        {/* ── Empty state ── */}
        {matches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <FolderOpen size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无匹配候选人</p>
            <p className="text-sm mt-1">候选人需先上传档案，且 availability_status 为开放状态</p>
          </div>
        )}

        {/* ── 候选人卡片列表（真实数据）── */}
        <div className="space-y-4">
          {matches.map((match, idx) => {
            const c = match.candidate   // 公开档案字段
            const isInvited = !!invited[c.id]
            const allTags = [...(c.route_tags ?? []), ...(c.skill_tags ?? [])]
            const updatedAt = c.updated_at?.slice(0, 10) ?? '—'
            const freshDays = c.freshness_days

            // 把展示用字段挂到 candidate 对象上，方便传给 InviteModal
            const modalCandidate = { ...c, matchScore: match.score }

            return (
              <div
                key={c.id}
                className={`card p-6 transition-all duration-300 ${
                  isInvited ? 'border-emerald-200 bg-emerald-50/30' : 'hover:border-blue-200'
                }`}
              >
                <div className="flex items-start gap-5">
                  {/* 排名 + 头像 */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-slate-100 text-slate-600' :
                                  'bg-slate-50 text-slate-500'
                    }`}>#{idx + 1}</span>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                      isInvited
                        ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                        : 'bg-gradient-to-br from-blue-400 to-blue-600'
                    }`}>
                      {isInvited ? <CheckCircle size={22} /> : (c.full_name?.[0] ?? '?')}
                    </div>
                  </div>

                  {/* 主体信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-800 text-lg">{c.full_name}</h3>
                          {isInvited && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
                              <CheckCircle size={10} /> 邀约已发出
                            </span>
                          )}
                          {!isInvited && <FreshBadge days={freshDays} />}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {c.current_title}
                          {c.current_company ? ` · ${c.current_company}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <MatchScore score={match.score} />
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{c.expected_salary_label ?? '面议'}</p>
                          <p className="text-xs text-slate-400">{c.experience_years ?? '—'}年经验</p>
                        </div>
                      </div>
                    </div>

                    {/* 元信息 */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                      {c.current_city && <span className="flex items-center gap-1"><MapPin size={11} />{c.current_city}</span>}
                      {c.experience_years != null && <span className="flex items-center gap-1"><Briefcase size={11} />{c.experience_years}年</span>}
                      <span className="flex items-center gap-1"><Clock size={11} />{updatedAt} 更新档案</span>
                    </div>

                    {/* 推荐理由（真实计算） */}
                    {match.reason_list?.length > 0 && (
                      <div className={`mt-3 p-3 rounded-xl border flex items-start gap-2 ${
                        isInvited ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
                      }`}>
                        <Star size={13} className={`mt-0.5 flex-shrink-0 ${isInvited ? 'text-emerald-400' : 'text-blue-400'}`} />
                        <p className={`text-xs leading-relaxed ${isInvited ? 'text-emerald-800' : 'text-blue-800'}`}>
                          {match.reason_list.join('；')}
                        </p>
                      </div>
                    )}

                    {/* 命中标签 */}
                    {allTags.length > 0 && (
                      <div className="mt-3">
                        <TagList tags={allTags} max={5} />
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2 mt-4">
                      {isInvited ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
                          <CheckCircle size={14} /> 已发出邀约
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => setModal(modalCandidate)}>
                          <Send size={13} /> 发起邀约
                        </Button>
                      )}
                      {isInvited && typeof invited[c.id] === 'number' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/messages/${invited[c.id]}`)}
                        >
                          <MessageSquare size={13} /> 进入沟通
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigate(`/candidate/profile/${c.id}`)}
                      >
                        查看完整档案 <ChevronRight size={13} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}