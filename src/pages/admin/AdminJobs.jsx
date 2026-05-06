import { useState, useEffect } from 'react'
import {
  MapPin, Briefcase, Clock, Search, X,
  Loader2, FolderOpen, AlertCircle, Building2,
  GraduationCap, Users, Zap,
} from 'lucide-react'
import { TagList } from '../../components/ui/TagList'
import { jobsApi } from '../../api/jobs'
import { getTags } from '../../api/tagsV2'

function useTagOptionsByCategory() {
  const [optMap, setOptMap] = useState({})
  useEffect(() => {
    getTags()
      .then(data => {
        const map = {}
        for (const t of data.tags || []) {
          if (!map[t.category]) map[t.category] = []
          map[t.category].push(t.name)
        }
        setOptMap(map)
      })
      .catch(() => {})
  }, [])
  return optMap
}

function JobDetailPanel({ job }) {
  const allTags = [...(job.route_tags ?? []), ...(job.skill_tags ?? [])]
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {(job.company_name ?? job.title ?? '?')[0]}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{job.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {job.company_name ?? '—'} · {job.city}
          </p>
          <p className="text-base font-bold text-blue-600 mt-1">{job.salary_label ?? '面议'}</p>
          {job.status && job.status !== 'published' && (
            <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {job.status === 'draft' ? '草稿' : job.status === 'closed' ? '已关闭' : job.status}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: MapPin,        label: '工作城市', value: job.city ?? '—' },
          { icon: Briefcase,     label: '薪资范围', value: job.salary_label ?? '面议' },
          { icon: Clock,         label: '经验要求', value: job.experience_required ?? '不限' },
          { icon: GraduationCap, label: '学历要求', value: job.degree_required ?? '不限' },
          { icon: Users,         label: '招聘人数', value: job.headcount ? `${job.headcount} 人` : '—' },
          { icon: Zap,           label: '紧急程度', value: job.urgency_level === 1 ? '紧急' : job.urgency_level === 3 ? '不急' : '正常' },
        ].map(item => (
          <div key={item.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <item.icon size={12} className="text-slate-400" />
              <p className="text-[10px] text-slate-400">{item.label}</p>
            </div>
            <p className="text-sm font-semibold text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {job.business_type && <span className="px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-full border border-blue-100">{job.business_type}</span>}
        {job.job_type      && <span className="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 rounded-full border border-purple-100">{job.job_type}</span>}
      </div>

      {allTags.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2">岗位标签</p>
          <TagList tags={allTags} max={20} />
        </div>
      )}

      {job.description && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">岗位职责</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.description}</p>
        </div>
      )}

      {job.requirements && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">任职要求</p>
          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.requirements}</p>
        </div>
      )}

      <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        发布于 {job.created_at?.slice(0, 10) ?? '—'} · 发布人 ID: {job.employer_id ?? '—'}
      </p>
    </div>
  )
}

export default function AdminJobs() {
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)
  const tagOptions = useTagOptionsByCategory()

  const [q, setQ]                       = useState('')
  const [city, setCity]                 = useState('')
  const [businessType, setBusinessType] = useState('')
  const [jobType, setJobType]           = useState('')

  function fetchJobs(filters) {
    setLoading(true)
    setError('')
    jobsApi.getPublicJobs(filters)
      .then(res => {
        const list = res.data.jobs
        setJobs(list)
        if (list.length > 0) setSelected(prev => prev ?? list[0])
      })
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchJobs({}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    fetchJobs({ q, city, business_type: businessType, job_type: jobType })
  }

  function handleReset() {
    setQ(''); setCity(''); setBusinessType(''); setJobType('')
    setSelected(null)
    fetchJobs({})
  }

  const hasFilter = q || city || businessType || jobType

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      {/* ── 左栏 ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-base font-semibold text-slate-800 mb-3">全量岗位</h1>
          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="搜索职位或城市..."
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <select value={city} onChange={e => setCity(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="">全部城市</option>
                {(tagOptions['城市'] || []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={businessType} onChange={e => setBusinessType(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="">全部业务</option>
                {(tagOptions['业务类型'] || []).map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <select value={jobType} onChange={e => setJobType(e.target.value)}
                className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white">
                <option value="">全部类型</option>
                {(tagOptions['岗位类型'] || []).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="submit"
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                搜索
              </button>
              {hasFilter && (
                <button type="button" onClick={handleReset}
                  className="px-2 py-1.5 text-xs text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50">
                  <X size={12} />
                </button>
              )}
            </div>
          </form>
          {!loading && !error && (
            <p className="text-xs text-slate-400 mt-2">
              共 {jobs.length} 个岗位{hasFilter ? '（已筛选）' : ''}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <AlertCircle size={24} className="text-red-300 mb-2" />
              <p className="text-xs text-red-500 text-center">{error}</p>
            </div>
          )}
          {!loading && !error && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FolderOpen size={28} className="text-slate-300 mb-2" />
              <p className="text-xs text-slate-400 text-center">暂无匹配岗位</p>
            </div>
          )}
          {!loading && !error && jobs.map(job => {
            const isSelected = selected?.id === job.id
            const isUrgent = job.urgency_level === 1
            const allTags = [...(job.route_tags ?? []), ...(job.skill_tags ?? [])]
            return (
              <div
                key={job.id}
                onClick={() => setSelected(job)}
                className={`p-4 cursor-pointer border-b border-slate-100 transition-all ${
                  isSelected
                    ? 'border-l-4 border-l-blue-500 bg-blue-50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm text-slate-800 truncate">{job.title}</p>
                      {isUrgent && (
                        <span className="flex-shrink-0 text-[10px] px-1 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded font-medium">急</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span className="flex items-center gap-0.5"><Building2 size={10} />{job.company_name ?? '—'}</span>
                      <span className="flex items-center gap-0.5"><MapPin size={10} />{job.city}</span>
                    </div>
                    {allTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {allTags.slice(0, 3).map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-bold text-blue-600 flex-shrink-0">{job.salary_label ?? '面议'}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 右栏详情 ── */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <JobDetailPanel job={selected} />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm">点击左侧岗位查看详情</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
