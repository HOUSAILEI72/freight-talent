import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronRight, Users, Zap, MessageSquare, Send, Loader2, FolderOpen } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { StatusBadge } from '../../components/ui/Badge'
import { StatCard } from '../../components/ui/StatCard'
import { TagList } from '../../components/ui/TagList'
import { useAuth } from '../../context/AuthContext'
import { jobsApi } from '../../api/jobs'
import { invitationsApi } from '../../api/invitations'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [inviteSummary, setInviteSummary] = useState(null)

  useEffect(() => {
    jobsApi.getMyJobs()
      .then(res => setJobs(res.data.jobs))
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败'))
      .finally(() => setLoading(false))
    invitationsApi.getCompanySummary()
      .then(res => setInviteSummary(res.data))
      .catch(() => {})
  }, [])

  // 统计（基于真实数据）
  const publishedCount = jobs.filter(j => j.status === 'published').length
  const companyName = user?.company_name ?? '企业控制台'

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">企业控制台</h1>
          <p className="text-slate-500 mt-1">{companyName}</p>
        </div>
        <Button onClick={() => navigate('/employer/post-job')}>
          <Plus size={16} />
          发布新岗位
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="在招岗位"
          value={loading ? '—' : String(publishedCount)}
          sub={loading ? '' : `共 ${jobs.length} 个岗位`}
          icon={Zap}
          color="blue"
        />
        <StatCard
          label="匹配人选"
          value={inviteSummary ? String(inviteSummary.accepted) : '—'}
          sub={inviteSummary ? `已接受邀约 ${inviteSummary.accepted} 人` : ''}
          icon={Users}
          color="green"
        />
        <StatCard
          label="已回复"
          value={inviteSummary ? String(inviteSummary.replied) : '—'}
          sub={inviteSummary ? `接受 ${inviteSummary.accepted ?? 0} · 婉拒 ${inviteSummary.declined ?? 0}` : ''}
          icon={MessageSquare}
          color="purple"
        />
        <StatCard
          label="邀约发出"
          value={inviteSummary ? String(inviteSummary.total) : '—'}
          sub={inviteSummary ? `${inviteSummary.replied}人已回复` : ''}
          icon={Send}
          color="orange"
        />
      </div>

      {/* Job list */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">岗位列表</h2>
          {!loading && (
            <span className="text-xs text-slate-400">{jobs.length} 个岗位</span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-32 text-slate-400" style={{ minHeight: 240 }}>
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">加载中...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-10 text-center text-sm text-red-500">{error}</div>
        )}

        {/* Empty state */}
        {!loading && !error && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FolderOpen size={36} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium">还没有发布任何岗位</p>
            <p className="text-xs mt-1 mb-4">点击「发布新岗位」开始招聘</p>
            <Button size="sm" onClick={() => navigate('/employer/post-job')}>
              <Plus size={14} />
              发布岗位
            </Button>
          </div>
        )}

        {/* Job rows */}
        {!loading && !error && jobs.length > 0 && (
          <div className="divide-y divide-slate-50">
            {jobs.map((job) => {
              const allTags = [...(job.route_tags || []), ...(job.skill_tags || [])]
              const salaryText = job.salary_label ?? (
                job.salary_min && job.salary_max
                  ? `${job.salary_min / 1000}k-${job.salary_max / 1000}k`
                  : '面议'
              )
              const createdDate = job.created_at
                ? job.created_at.slice(0, 10)
                : ''

              return (
                <div key={job.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
                    {job.title[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-800">{job.title}</p>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {job.city} · {salaryText} · 发布于 {createdDate}
                    </p>
                  </div>

                  <div className="hidden md:flex items-center gap-1.5">
                    <TagList tags={allTags} max={3} />
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="text-base font-bold text-blue-600">—</p>
                      <p className="text-[11px] text-slate-400">匹配</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-base font-bold text-emerald-600">—</p>
                      <p className="text-[11px] text-slate-400">邀约</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/employer/match/${job.id}`)}
                      disabled={job.status === 'closed'}
                    >
                      查看匹配
                      <ChevronRight size={13} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-sm font-medium text-blue-800 mb-2">提升匹配效果的建议</p>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>· 岗位标签越精准，候选人匹配质量越高</li>
          <li>· 近 30 天内更新简历的候选人优先推荐</li>
          <li>· 发起邀约后候选人通常在 24 小时内响应</li>
        </ul>
      </div>
    </div>
  )
}