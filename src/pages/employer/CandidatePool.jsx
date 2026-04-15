import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, Search, X, Loader2, FolderOpen,
  AlertCircle, GraduationCap, ChevronRight, Send, CheckCircle, MessageSquare,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { InviteModal } from '../../components/ui/InviteModal'
import { candidatesApi } from '../../api/candidates'
import { jobsApi } from '../../api/jobs'
import { invitationsApi } from '../../api/invitations'

// ── 筛选选项 ─────────────────────────────────────────────────────────────────
const CITY_OPTIONS     = ['上海', '深圳', '广州', '北京', '宁波', '天津', '青岛', '成都']
const BUSINESS_OPTIONS = ['海运', '空运', '报关', '仓储', '陆运', '综合物流']
const JOB_TYPE_OPTIONS = ['操作', '销售', '单证', '客服', '管理', '财务']
const AVAIL_OPTIONS    = [
  { value: 'open',    label: '开放机会' },
  { value: 'passive', label: '被动寻找' },
  { value: 'all',     label: '全部' },
]

// ── 鲜度标签 ─────────────────────────────────────────────────────────────────
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

// ── 求职状态徽章 ─────────────────────────────────────────────────────────────
function AvailBadge({ status }) {
  if (status === 'open')    return <Badge color="green">开放机会</Badge>
  if (status === 'passive') return <Badge color="blue">被动寻找</Badge>
  return <Badge color="gray">暂不考虑</Badge>
}

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── 候选人卡片 ────────────────────────────────────────────────────────────────
function CandidateCard({ candidate, onInvite, invited, threadId }) {
  const navigate = useNavigate()
  const allTags = candidate.all_tags ?? []

  return (
    <div className={`card p-5 transition-all duration-200 ${invited ? 'border-emerald-200 bg-emerald-50/20' : 'hover:border-blue-200'}`}>
      <div className="flex items-start gap-4">
        {/* 头像 */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${
          invited
            ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
            : 'bg-gradient-to-br from-blue-400 to-blue-600'
        }`}>
          {invited ? <CheckCircle size={22} /> : (candidate.full_name?.[0] ?? '?')}
        </div>

        <div className="flex-1 min-w-0">
          {/* 姓名行 */}
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800">{candidate.full_name}</h3>
                {invited && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
                    <CheckCircle size={10} />邀约已发出
                  </span>
                )}
                <FreshBadge days={candidate.freshness_days} />
                <AvailBadge status={candidate.availability_status} />
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {candidate.current_title}
                {candidate.current_company ? ` · ${candidate.current_company}` : ''}
              </p>
            </div>
            <p className="font-bold text-blue-600 flex-shrink-0">
              {candidate.expected_salary_label ?? '面议'}
            </p>
          </div>

          {/* 元信息 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
            {candidate.current_city && (
              <span className="flex items-center gap-1"><MapPin size={11} />{candidate.current_city}</span>
            )}
            {candidate.experience_years != null && (
              <span className="flex items-center gap-1"><Briefcase size={11} />{candidate.experience_years}年经验</span>
            )}
            {candidate.education && (
              <span className="flex items-center gap-1"><GraduationCap size={11} />{candidate.education}</span>
            )}
          </div>

          {/* 标签 */}
          {allTags.length > 0 && (
            <div className="mt-3">
              <TagList tags={allTags} max={5} />
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 mt-4">
            {invited ? (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-emerald-100 text-emerald-700 border border-emerald-300 font-medium">
                <CheckCircle size={14} />已发出邀约
              </span>
            ) : (
              <Button size="sm" onClick={() => onInvite(candidate)}>
                <Send size={13} />发起邀约
              </Button>
            )}
            {invited && threadId && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate(`/messages/${threadId}`)}
              >
                <MessageSquare size={13} />进入沟通
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/candidate/profile/${candidate.id}`)}
            >
              查看档案 <ChevronRight size={13} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function CandidatePool() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')

  // 邀约状态（本地）：key 为 `${jobId}_${candidateId}`，值为 threadId | true
  const [invited, setInvited]   = useState({})
  const [modal, setModal]       = useState(null)  // candidate object
  const [toast, setToast]       = useState(null)  // name string
  // 发邀约时需要选一个岗位；拉取企业自己的岗位供选择
  const [myJobs, setMyJobs]     = useState([])
  const [selectedJob, setSelectedJob] = useState(null)

  // 筛选
  const [q, setQ]                       = useState('')
  const [city, setCity]                 = useState('')
  const [businessType, setBusinessType] = useState('')
  const [jobType, setJobType]           = useState('')
  const [avail, setAvail]               = useState('open')

  function fetchCandidates(filters) {
    setLoading(true)
    setError('')
    candidatesApi.getCandidates(filters)
      .then(res => setCandidates(res.data.candidates))
      .catch(err => setError(err.response?.data?.message ?? '加载失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCandidates({ availability_status: 'open' })
    Promise.all([
      jobsApi.getMyJobs(),
      invitationsApi.getSentInvitations(),
    ]).then(([jobsRes, sentRes]) => {
      const published = (jobsRes.data.jobs ?? []).filter(j => j.status === 'published')
      setMyJobs(published)
      if (published.length > 0) setSelectedJob(published[0])

      // 把已发出邀约的 (job_id, candidate_id) 组合存入 invited（pending/accepted 才算"已邀"）
      const sentMap = {}
      for (const inv of (sentRes.data.invitations ?? [])) {
        if (inv.status !== 'declined') {
          const key = `${inv.job_id}_${inv.candidate_id}`
          sentMap[key] = inv.thread_id ?? true
        }
      }
      setInvited(sentMap)
    }).catch(() => {})
  }, [])

  function handleSearch(e) {
    e.preventDefault()
    fetchCandidates({ q, city, business_type: businessType, job_type: jobType, availability_status: avail })
  }

  function handleReset() {
    setQ(''); setCity(''); setBusinessType(''); setJobType(''); setAvail('open')
    fetchCandidates({ availability_status: 'open' })
  }

  const handleConfirm = useCallback((threadId) => {
    const key = `${selectedJob?.id}_${modal.id}`
    setInvited(prev => ({ ...prev, [key]: threadId ?? true }))
    setToast(modal.full_name)
    setModal(null)
  }, [modal, selectedJob])

  const hasFilter = q || city || businessType || jobType || avail !== 'open'

  // 统计
  const openCount    = candidates.filter(c => c.availability_status === 'open').length
  const activeCount  = candidates.filter(c => (c.freshness_days ?? 999) <= 7).length

  return (
    <>
      {modal && selectedJob && (
        <InviteModal
          candidate={modal}
          job={selectedJob}
          onConfirm={handleConfirm}
          onCancel={() => setModal(null)}
        />
      )}
      {toast && <Toast name={toast} onDone={() => setToast(null)} />}

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* 标题区 */}
        <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">候选人池</h1>
            <p className="text-slate-500 mt-1">浏览货代行业候选人，主动发出邀约</p>
          </div>
          {/* 岗位选择器（发邀约时用） */}
          {myJobs.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">邀约关联岗位：</span>
              <select
                value={selectedJob?.id ?? ''}
                onChange={e => setSelectedJob(myJobs.find(j => j.id === Number(e.target.value)) ?? null)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-700 bg-white"
              >
                {myJobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          )}
          {myJobs.length === 0 && !loading && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              请先发布岗位，才能向候选人发起邀约
            </p>
          )}
        </div>

        {/* 统计条 */}
        {!loading && !error && (
          <div className="flex items-center gap-4 mb-5 text-sm">
            <span className="text-slate-500">共 <strong className="text-slate-800">{candidates.length}</strong> 位候选人</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500"><strong className="text-emerald-600">{openCount}</strong> 人开放机会</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500"><strong className="text-blue-600">{activeCount}</strong> 人近7天活跃</span>
            {Object.keys(invited).length > 0 && (
              <>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500"><strong className="text-emerald-600">{Object.keys(invited).length}</strong> 人已邀约</span>
              </>
            )}
          </div>
        )}

        {/* 筛选栏 */}
        <form onSubmit={handleSearch} className="card p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-44">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索姓名、职位或城市..."
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <select value={city} onChange={e => setCity(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white">
              <option value="">全部城市</option>
              {CITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={businessType} onChange={e => setBusinessType(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white">
              <option value="">全部业务</option>
              {BUSINESS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={jobType} onChange={e => setJobType(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white">
              <option value="">全部类型</option>
              {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={avail} onChange={e => setAvail(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white">
              {AVAIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <Button type="submit" size="sm"><Search size={13} />搜索</Button>
            {hasFilter && (
              <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
                <X size={13} />重置
              </Button>
            )}
          </div>
        </form>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-400" style={{ minHeight: 320 }}>
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">加载候选人中...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <AlertCircle size={32} className="mb-3 text-red-300" />
            <p className="text-sm text-red-500">{error}</p>
            <Button size="sm" variant="secondary" className="mt-4"
              onClick={() => fetchCandidates({ q, city, business_type: businessType, job_type: jobType, availability_status: avail })}>
              重试
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && candidates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <FolderOpen size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无匹配候选人</p>
            <p className="text-sm mt-1">调整筛选条件，或等待更多候选人入库</p>
            {hasFilter && (
              <Button size="sm" variant="secondary" className="mt-4" onClick={handleReset}>清空筛选</Button>
            )}
          </div>
        )}

        {/* 候选人列表 */}
        {!loading && !error && candidates.length > 0 && (
          <div className="space-y-4">
        {candidates.map(c => {
              const invKey = `${selectedJob?.id}_${c.id}`
              return (
              <CandidateCard
                key={c.id}
                candidate={c}
                onInvite={setModal}
                invited={!!invited[invKey]}
                threadId={typeof invited[invKey] === 'number' ? invited[invKey] : null}
              />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}