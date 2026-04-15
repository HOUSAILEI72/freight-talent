import { useState, useEffect } from 'react'
import { Users, Briefcase, Zap, CheckCircle, TrendingUp, Clock, Activity, Send, Loader2, XCircle, Hourglass } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { Badge } from '../../components/ui/Badge'
import { adminApi } from '../../api/admin'

const ICON_MAP = {
  upload:    '📄',
  send:      '✉️',
  briefcase: '💼',
  zap:       '⚡',
  check:     '✅',
}

function timeAgo(isoString) {
  if (!isoString) return '—'
  // 后端统一输出带 Z 的 ISO 8601，直接解析
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60)  return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

export default function Overview() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    adminApi.getOverview()
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.message ?? '加载统计数据失败，请刷新重试'))
      .finally(() => setLoading(false))
  }, [])

  const s        = data?.stats ?? {}
  const activity = data?.activity ?? []
  const trend    = data?.trend_7d ?? []
  const fetchedAt = data?.fetched_at

  // 柱状图用最大值
  const maxBar = trend.length
    ? Math.max(...trend.map(d => Math.max(d.candidates, d.jobs * 3, d.invitations)), 1)
    : 1

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-sm">加载运营数据...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle size={36} className="mx-auto mb-3 text-red-300" />
          <p className="text-slate-500 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Admin top bar */}
      <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
            <Activity size={12} className="text-white" />
          </div>
          <span className="text-white text-sm font-medium">FreightTalent 运营后台</span>
          <Badge color="blue">管理员</Badge>
        </div>
        <span className="text-slate-400 text-xs">
          数据截至 {fetchedAt ? new Date(fetchedAt).toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-') : '—'}
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">运营概览</h1>
          <p className="text-slate-500 text-sm mt-1">平台实时运营数据（真实）</p>
        </div>

        {/* 顶部 4 个核心 StatCard */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="注册候选人"
            value={String(s.total_candidates ?? 0)}
            sub={`近7天新增 ${s.new_candidates_7d ?? 0} 人`}
            icon={Users}
            color="blue"
          />
          <StatCard
            label="在招岗位"
            value={String(s.published_jobs ?? 0)}
            sub={`共 ${s.total_jobs ?? 0} 个岗位`}
            icon={Briefcase}
            color="purple"
          />
          <StatCard
            label="邀约总数"
            value={String(s.total_invitations ?? 0)}
            sub={`已回复 ${(s.accepted_invitations ?? 0) + (s.declined_invitations ?? 0)} 条`}
            icon={Send}
            color="green"
          />
          <StatCard
            label="合作企业"
            value={String(s.total_employers ?? 0)}
            sub={`近7天新增用户 ${s.new_users_7d ?? 0} 人`}
            icon={CheckCircle}
            color="orange"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 近7日趋势柱状图（真实数据） */}
          <div className="lg:col-span-2 card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-slate-800">近7日平台活跃度</h2>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />新增简历</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-400 inline-block" />新增岗位</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />新增邀约</span>
              </div>
            </div>

            {trend.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-slate-400 text-sm">暂无数据</div>
            ) : (
              <div className="flex items-end justify-between gap-2 h-36">
                {trend.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-0.5 h-28">
                      <div
                        className="flex-1 bg-blue-400 rounded-t"
                        style={{ height: `${Math.max((d.candidates / maxBar) * 100, d.candidates > 0 ? 4 : 0)}%` }}
                        title={`新增简历: ${d.candidates}`}
                      />
                      <div
                        className="flex-1 bg-purple-400 rounded-t"
                        style={{ height: `${Math.max((d.jobs * 3 / maxBar) * 100, d.jobs > 0 ? 4 : 0)}%` }}
                        title={`新增岗位: ${d.jobs}`}
                      />
                      <div
                        className="flex-1 bg-emerald-500 rounded-t"
                        style={{ height: `${Math.max((d.invitations / maxBar) * 100, d.invitations > 0 ? 4 : 0)}%` }}
                        title={`新增邀约: ${d.invitations}`}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{d.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 右列：核心指标 + 实时动态 */}
          <div className="space-y-4">
            {/* 核心指标（真实） */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">核心指标</h3>
              <div className="space-y-3">
                {[
                  {
                    label: '待回复邀约',
                    value: `${s.pending_invitations ?? 0} 条`,
                    icon: Hourglass,
                    color: 'text-blue-600',
                  },
                  {
                    label: '已接受邀约',
                    value: `${s.accepted_invitations ?? 0} 条`,
                    icon: CheckCircle,
                    color: 'text-emerald-600',
                  },
                  {
                    label: '累计匹配结果',
                    value: `${s.total_match_results ?? 0} 条`,
                    icon: Zap,
                    color: 'text-purple-600',
                  },
                  {
                    label: '近7天新增岗位',
                    value: `${s.new_jobs_7d ?? 0} 个`,
                    icon: TrendingUp,
                    color: 'text-orange-600',
                  },
                  {
                    label: '近7天新增邀约',
                    value: `${s.new_invitations_7d ?? 0} 条`,
                    icon: Clock,
                    color: 'text-slate-600',
                  },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <m.icon size={14} className={m.color} />
                      <span className="text-sm text-slate-600">{m.label}</span>
                    </div>
                    <span className="font-bold text-slate-800">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 实时动态（真实） */}
            <div className="card p-5">
              <h3 className="font-semibold text-slate-800 mb-4">实时动态</h3>
              {activity.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">暂无动态</p>
              ) : (
                <div className="space-y-3">
                  {activity.map((a, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="text-base flex-shrink-0 mt-0.5">{ICON_MAP[a.icon] ?? '•'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 leading-relaxed">{a.text}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(a.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 邀约状态分布（真实） */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            {
              label: '待回复',
              value: s.pending_invitations ?? 0,
              icon: Hourglass,
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: '已接受',
              value: s.accepted_invitations ?? 0,
              icon: CheckCircle,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              label: '已婉拒',
              value: s.declined_invitations ?? 0,
              icon: XCircle,
              color: 'text-slate-500',
              bg: 'bg-slate-50',
            },
          ].map(item => (
            <div key={item.label} className={`card p-4 ${item.bg}`}>
              <div className="flex items-center gap-2 mb-2">
                <item.icon size={16} className={item.color} />
                <p className="font-medium text-slate-800">{item.label}邀约</p>
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-slate-400 mt-1">
                占总数 {s.total_invitations ? Math.round((item.value / s.total_invitations) * 100) : 0}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}