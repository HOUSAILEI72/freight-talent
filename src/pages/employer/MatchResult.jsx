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

function Toast({ name, onDone, terminal = false }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div
      className={
        terminal
          ? 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 text-white rounded-xl border'
          : 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl'
      }
      style={
        terminal
          ? {
              background: 'var(--t-bg-elevated)',
              borderColor: 'var(--t-border)',
              color: 'var(--t-text)',
              boxShadow: 'var(--t-shadow-elevated)',
            }
          : undefined
      }
    >
      <CheckCircle
        size={16}
        className={terminal ? 'flex-shrink-0' : 'text-emerald-400 flex-shrink-0'}
        style={terminal ? { color: 'var(--t-success)' } : undefined}
      />
      <span className="text-sm font-medium">已向 <strong>{name}</strong> 发出邀约</span>
    </div>
  )
}

// ─── Freshness badge ──────────────────────────────────────────────────────────

function FreshBadge({ days, terminal = false }) {
  if (days == null) return null
  if (days <= 3) {
    if (terminal) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border"
          style={{
            background: 'var(--t-success-muted)',
            color: 'var(--t-success)',
            borderColor: 'var(--t-success)',
          }}
        >
          <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--t-success)' }} />
          {days <= 1 ? '今日更新' : `${days}天内更新`}
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
        {days <= 1 ? '今日更新' : `${days}天内更新`}
      </span>
    )
  }
  if (days <= 7) return <Badge color="blue">{days}天内更新</Badge>
  return null
}

// ─── Fit Bar (双边匹配进度条) ──────────────────────────────────────────────────

function FitBar({ label, value, color, terminal = false }) {
  const percentage = Math.min(Math.max(value || 0, 0), 100)

  return (
    <div className="flex items-center gap-3">
      <span
        className={terminal ? 'text-xs font-medium w-20 text-right' : 'text-xs font-medium text-slate-600 w-20 text-right'}
        style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
      >
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: terminal ? 'var(--t-bg-elevated)' : '#e2e8f0' }}>
        <div
          className="h-full transition-all duration-500 rounded-full"
          style={{
            width: `${percentage}%`,
            background: color,
          }}
        />
      </div>
      <span
        className={terminal ? 'text-xs font-bold w-8' : 'text-xs font-bold text-slate-700 w-8'}
        style={terminal ? { color: 'var(--t-text)' } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

// ─── Breakdown Chips (得分维度展示) ────────────────────────────────────────────

const BREAKDOWN_LABELS = {
  // employer_fit
  function_match: '业务方向',
  location_match: '地区',
  experience_match: '经验',
  degree_certificate_match: '学历/证书',
  knowledge_match: '知识',
  hard_skill_match: '硬技能',
  soft_skill_match: '软技能',
  management_match: '管理岗位',
  freshness: '档案鲜度',
  responsibilities_overlap: '职责匹配',
  // candidate_fit
  salary_match: '薪资',
  salary_months_match: '薪资月数',
  bonus_match: '奖金',
  location_preference: '地点偏好',
  function_preference: '职能偏好',
  management_preference: '管理偏好',
  job_description_quality: 'JD完整度',
  relationship_signal: '互动信号',
}

function BreakdownChips({ breakdown, terminal = false }) {
  if (!breakdown || typeof breakdown !== 'object') return null

  // 从 employer_fit 和 candidate_fit 各取前 2 个非零项
  const empFit = breakdown.employer_fit || {}
  const candFit = breakdown.candidate_fit || {}

  const empItems = Object.entries(empFit)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  const candItems = Object.entries(candFit)
    .filter(([_, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)

  const topItems = [...empItems, ...candItems]

  if (topItems.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {topItems.map(([key, value]) => (
        <span
          key={key}
          className={terminal ? 'px-2 py-1 rounded text-xs border' : 'px-2 py-1 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200'}
          style={terminal ? { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' } : undefined}
        >
          {BREAKDOWN_LABELS[key] || key}: <strong>{value}</strong>
        </span>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MatchResult({ messagesBasePath = '/messages', terminal = false }) {
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
        console.error('Failed to load match results:', {
          jobId,
          status: err.response?.status,
          data: err.response?.data,
          code: err.code,
          message: err.message,
        })
        const errMsg = err.response?.data?.message || err.response?.data?.error || err.response?.data?.detail || '加载匹配数据失败，请刷新重试'
        setError(errMsg)
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
      <div
        className={
          terminal
            ? 'terminal-mode flex flex-1 w-full min-w-0 h-full min-h-0 flex-col items-center justify-center gap-3'
            : 'flex flex-col items-center justify-center gap-3 text-slate-400'
        }
        style={
          terminal
            ? { background: 'var(--t-bg)', color: 'var(--t-text-muted)' }
            : { minHeight: 'calc(100vh - 64px)' }
        }
      >
        <Loader2
          size={28}
          className="animate-spin"
          style={terminal ? { color: 'var(--t-chart-blue)' } : { color: '#60a5fa' }}
        />
        <p className="text-sm">正在计算匹配结果...</p>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div
        className={
          terminal
            ? 'terminal-mode flex flex-1 w-full min-w-0 h-full min-h-0 flex-col items-center justify-center px-6 text-center'
            : 'max-w-lg mx-auto px-6 text-center'
        }
        style={
          terminal
            ? { background: 'var(--t-bg)', color: 'var(--t-text)' }
            : { minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }
        }
      >
        <p className={terminal ? 'mb-4' : 'text-slate-500 mb-4'} style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}>{error}</p>
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
          terminal={terminal}
        />
      )}
      {toast && <Toast name={toast} onDone={() => setToast(null)} terminal={terminal} />}

      <div
        className={
          terminal
            ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-8'
            : 'max-w-6xl mx-auto px-6 py-10'
        }
        style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
      >
        <div className={terminal ? 'mx-auto w-full max-w-6xl' : ''}>
        <button
          onClick={() => navigate(-1)}
          className={
            terminal
              ? 'flex items-center gap-1.5 text-sm transition-colors mb-6'
              : 'flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6'
          }
          style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
          onMouseEnter={(e) => { if (terminal) e.currentTarget.style.color = 'var(--t-text)' }}
          onMouseLeave={(e) => { if (terminal) e.currentTarget.style.color = 'var(--t-text-secondary)' }}
        >
          <ChevronLeft size={16} /> 返回
        </button>

        {/* ── 岗位摘要（真实数据）── */}
        <div
          className={terminal ? 'p-6 mb-6 rounded-[var(--t-radius-lg)] border' : 'card p-6 mb-6'}
          style={terminal ? { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' } : undefined}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div
                className={
                  terminal
                    ? 'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg'
                    : 'w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg'
                }
                style={terminal ? { background: 'var(--t-primary)' } : undefined}
              >
                {(job?.company_name ?? job?.title ?? '?')[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1
                    className={terminal ? 'text-xl font-bold' : 'text-xl font-bold text-slate-800'}
                    style={terminal ? { color: 'var(--t-text)' } : undefined}
                  >
                    {job?.title}
                  </h1>
                  <StatusBadge status={job?.status} />
                </div>
                <p
                  className={terminal ? 'text-sm mt-0.5' : 'text-sm text-slate-500 mt-0.5'}
                  style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
                >
                  {job?.company_name ?? '—'} · {job?.city} · {salaryText}
                </p>
              </div>
            </div>

            {/* 统计数字（真实） */}
            <div className="flex items-center gap-5">
              <div className="text-center">
                <p
                  className={terminal ? 'text-2xl font-bold' : 'text-2xl font-bold text-blue-600'}
                  style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
                >
                  {matches.length}
                </p>
                <p
                  className={terminal ? 'text-xs' : 'text-xs text-slate-400'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                >
                  匹配人选
                </p>
              </div>
              <div
                className={terminal ? 'w-px h-8' : 'w-px h-8 bg-slate-100'}
                style={terminal ? { background: 'var(--t-border-subtle)' } : undefined}
              />
              <div className="text-center">
                <p
                  className={terminal ? 'text-2xl font-bold' : 'text-2xl font-bold text-emerald-600'}
                  style={terminal ? { color: 'var(--t-success)' } : undefined}
                >
                  {highMatchCount}
                </p>
                <p
                  className={terminal ? 'text-xs' : 'text-xs text-slate-400'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                >
                  高匹配（≥70）
                </p>
              </div>
              <div
                className={terminal ? 'w-px h-8' : 'w-px h-8 bg-slate-100'}
                style={terminal ? { background: 'var(--t-border-subtle)' } : undefined}
              />
              <div className="text-center">
                <p
                  className={
                    terminal
                      ? 'text-2xl font-bold tabular-nums transition-colors duration-300'
                      : `text-2xl font-bold tabular-nums transition-colors duration-300 ${invitedCount > 0 ? 'text-emerald-600' : 'text-slate-300'}`
                  }
                  style={
                    terminal
                      ? { color: invitedCount > 0 ? 'var(--t-success)' : 'var(--t-text-muted)' }
                      : undefined
                  }
                >
                  {invitedCount}
                </p>
                <p
                  className={terminal ? 'text-xs' : 'text-xs text-slate-400'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                >
                  已邀约
                </p>
              </div>
              <div
                className={terminal ? 'w-px h-8' : 'w-px h-8 bg-slate-100'}
                style={terminal ? { background: 'var(--t-border-subtle)' } : undefined}
              />
              <div className="text-center">
                <p
                  className={terminal ? 'text-2xl font-bold' : 'text-2xl font-bold text-purple-500'}
                  style={terminal ? { color: 'var(--t-chart-purple)' } : undefined}
                >
                  {activeCount}
                </p>
                <p
                  className={terminal ? 'text-xs' : 'text-xs text-slate-400'}
                  style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                >
                  近30天活跃
                </p>
              </div>
            </div>
          </div>

          {jobTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              <span
                className={terminal ? 'text-xs mr-1' : 'text-xs text-slate-400 mr-1'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                岗位标签：
              </span>
              <TagList tags={jobTags} max={10} />
            </div>
          )}
        </div>

        {/* ── 过滤栏 ── */}
        <div className="flex items-center gap-3 mb-5">
          <span
            className={terminal ? 'text-sm font-medium' : 'text-sm font-medium text-slate-700'}
            style={terminal ? { color: 'var(--t-text)' } : undefined}
          >
            共 {matches.length} 位匹配候选人
          </span>
          {invitedCount > 0 && (
            <span
              className={
                terminal
                  ? 'text-xs font-medium px-2.5 py-1 rounded-full border'
                  : 'text-xs text-emerald-600 font-medium bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200'
              }
              style={
                terminal
                  ? {
                      background: 'var(--t-success-muted)',
                      color: 'var(--t-success)',
                      borderColor: 'var(--t-success)',
                    }
                  : undefined
              }
            >
              {invitedCount} 人已邀约
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              className={
                terminal
                  ? 'px-3 py-1.5 rounded-lg text-xs font-medium text-white'
                  : 'px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white'
              }
              style={terminal ? { background: 'var(--t-primary)' } : undefined}
            >
              综合排序
            </button>
            <button
              className={
                terminal
                  ? 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors'
                  : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
              }
              style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
              onMouseEnter={(e) => { if (terminal) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={(e) => { if (terminal) e.currentTarget.style.background = 'transparent' }}
            >
              近期更新
            </button>
            <button
              className={
                terminal
                  ? 'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors'
                  : 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100'
              }
              style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
              onMouseEnter={(e) => { if (terminal) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={(e) => { if (terminal) e.currentTarget.style.background = 'transparent' }}
            >
              匹配分
            </button>
          </div>
        </div>

        {/* ── Empty state ── */}
        {matches.length === 0 && (
          <div
            className={terminal ? 'flex flex-col items-center justify-center py-20' : 'flex flex-col items-center justify-center py-20 text-slate-400'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            <FolderOpen
              size={36}
              className={terminal ? 'mb-3' : 'mb-3 text-slate-300'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            />
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

            const cardClass = terminal
              ? 'p-6 rounded-[var(--t-radius-lg)] border transition-all duration-300'
              : `card p-6 transition-all duration-300 ${
                  isInvited ? 'border-emerald-200 bg-emerald-50/30' : 'hover:border-blue-200'
                }`
            const cardStyle = terminal
              ? {
                  background: isInvited ? 'rgba(34, 197, 94, 0.06)' : 'var(--t-bg-panel)',
                  borderColor: isInvited ? 'var(--t-success)' : 'var(--t-border)',
                }
              : undefined

            // Rank pill
            const rankClass = terminal
              ? 'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border'
              : `text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                  idx === 1 ? 'bg-slate-100 text-slate-600' :
                              'bg-slate-50 text-slate-500'
                }`
            const rankStyle = terminal
              ? idx === 0
                ? { background: 'var(--t-warning-muted)', color: 'var(--t-warning)', borderColor: 'var(--t-warning)' }
                : { background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)', borderColor: 'var(--t-border)' }
              : undefined

            return (
              <div key={c.id} className={cardClass} style={cardStyle}>
                <div className="flex items-start gap-5">
                  {/* 排名 + 头像 */}
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <span className={rankClass} style={rankStyle}>#{idx + 1}</span>
                    <div
                      className={
                        terminal
                          ? 'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg'
                          : `w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                              isInvited
                                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
                                : 'bg-gradient-to-br from-blue-400 to-blue-600'
                            }`
                      }
                      style={
                        terminal
                          ? { background: isInvited ? 'var(--t-success)' : 'var(--t-primary)' }
                          : undefined
                      }
                    >
                      {isInvited ? <CheckCircle size={22} /> : (c.full_name?.[0] ?? '?')}
                    </div>
                  </div>

                  {/* 主体信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className={terminal ? 'font-bold text-lg' : 'font-bold text-slate-800 text-lg'}
                            style={terminal ? { color: 'var(--t-text)' } : undefined}
                          >
                            {c.full_name}
                          </h3>
                          {isInvited && (
                            <span
                              className={
                                terminal
                                  ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium'
                                  : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium'
                              }
                              style={
                                terminal
                                  ? {
                                      background: 'var(--t-success-muted)',
                                      color: 'var(--t-success)',
                                      borderColor: 'var(--t-success)',
                                    }
                                  : undefined
                              }
                            >
                              <CheckCircle size={10} /> 邀约已发出
                            </span>
                          )}
                          {!isInvited && <FreshBadge days={freshDays} terminal={terminal} />}
                        </div>
                        <p
                          className={terminal ? 'text-sm mt-0.5' : 'text-sm text-slate-500 mt-0.5'}
                          style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
                        >
                          {c.current_title}
                          {c.current_company ? ` · ${c.current_company}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <MatchScore score={match.score} />
                          {/* 双边匹配小分数 */}
                          {(match.employer_fit_score != null || match.candidate_fit_score != null) && (
                            <div className="flex items-center gap-2 mt-1.5">
                              {match.employer_fit_score != null && (
                                <span
                                  className={terminal ? 'text-[10px] px-1.5 py-0.5 rounded border' : 'text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200'}
                                  style={terminal ? { background: 'rgba(96, 165, 250, 0.1)', color: 'var(--t-chart-blue)', borderColor: 'var(--t-chart-blue)' } : undefined}
                                >
                                  企业 {match.employer_fit_score}
                                </span>
                              )}
                              {match.candidate_fit_score != null && (
                                <span
                                  className={terminal ? 'text-[10px] px-1.5 py-0.5 rounded border' : 'text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200'}
                                  style={terminal ? { background: 'var(--t-success-muted)', color: 'var(--t-success)', borderColor: 'var(--t-success)' } : undefined}
                                >
                                  候选人 {match.candidate_fit_score}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p
                            className={terminal ? 'font-bold' : 'font-bold text-blue-600'}
                            style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
                          >
                            {c.expected_salary_label ?? '面议'}
                          </p>
                          <p
                            className={terminal ? 'text-xs' : 'text-xs text-slate-400'}
                            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                          >
                            {c.experience_years ?? '—'}年经验
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 元信息 */}
                    <div
                      className={terminal ? 'flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs' : 'flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400'}
                      style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                    >
                      {c.current_city && <span className="flex items-center gap-1"><MapPin size={11} />{c.current_city}</span>}
                      {c.experience_years != null && <span className="flex items-center gap-1"><Briefcase size={11} />{c.experience_years}年</span>}
                      <span className="flex items-center gap-1"><Clock size={11} />{updatedAt} 更新档案</span>
                    </div>

                    {/* 推荐理由（真实计算） */}
                    {match.reason_list?.length > 0 && (
                      <div
                        className={
                          terminal
                            ? 'mt-3 p-3 rounded-xl border flex items-start gap-2'
                            : `mt-3 p-3 rounded-xl border flex items-start gap-2 ${
                                isInvited ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'
                              }`
                        }
                        style={
                          terminal
                            ? isInvited
                              ? { background: 'var(--t-success-muted)', borderColor: 'var(--t-success)' }
                              : { background: 'rgba(96, 165, 250, 0.08)', borderColor: 'var(--t-border)' }
                            : undefined
                        }
                      >
                        <Star
                          size={13}
                          className={
                            terminal
                              ? 'mt-0.5 flex-shrink-0'
                              : `mt-0.5 flex-shrink-0 ${isInvited ? 'text-emerald-400' : 'text-blue-400'}`
                          }
                          style={
                            terminal
                              ? { color: isInvited ? 'var(--t-success)' : 'var(--t-chart-blue)' }
                              : undefined
                          }
                        />
                        <p
                          className={
                            terminal
                              ? 'text-xs leading-relaxed'
                              : `text-xs leading-relaxed ${isInvited ? 'text-emerald-800' : 'text-blue-800'}`
                          }
                          style={
                            terminal
                              ? { color: isInvited ? 'var(--t-success)' : 'var(--t-chart-blue)' }
                              : undefined
                          }
                        >
                          {match.reason_list.join('；')}
                        </p>
                      </div>
                    )}

                    {/* 双边匹配进度条 */}
                    {(match.employer_fit_score != null || match.candidate_fit_score != null) && (
                      <div
                        className={terminal ? 'mt-3 p-3 rounded-xl border space-y-2' : 'mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2'}
                        style={terminal ? { background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' } : undefined}
                      >
                        {match.employer_fit_score != null && (
                          <FitBar
                            label="企业需求"
                            value={match.employer_fit_score}
                            color={terminal ? 'var(--t-chart-blue)' : '#3b82f6'}
                            terminal={terminal}
                          />
                        )}
                        {match.candidate_fit_score != null && (
                          <FitBar
                            label="候选人期望"
                            value={match.candidate_fit_score}
                            color={terminal ? 'var(--t-success)' : '#10b981'}
                            terminal={terminal}
                          />
                        )}
                      </div>
                    )}

                    {/* 得分维度 */}
                    {match.score_breakdown && (
                      <div className="mt-3">
                        <BreakdownChips breakdown={match.score_breakdown} terminal={terminal} />
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
                        <span
                          className={
                            terminal
                              ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm border font-medium'
                              : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium'
                          }
                          style={
                            terminal
                              ? {
                                  background: 'var(--t-success-muted)',
                                  color: 'var(--t-success)',
                                  borderColor: 'var(--t-success)',
                                }
                              : undefined
                          }
                        >
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
                          onClick={() => navigate(`${messagesBasePath}/${invited[c.id]}`)}
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
      </div>
    </>
  )
}