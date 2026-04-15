import { useState, useEffect, useRef } from 'react'
import {
  MapPin, Briefcase, Clock, Search, X, ChevronRight,
  Loader2, FolderOpen, AlertCircle, Building2,
  GraduationCap, Users, Zap,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { TagList } from '../../components/ui/TagList'
import { jobsApi } from '../../api/jobs'

// ── 筛选选项 ─────────────────────────────────────────────────────────────────
const CITY_OPTIONS       = ['上海', '深圳', '广州', '北京', '宁波', '天津', '青岛', '成都']
const BUSINESS_OPTIONS   = ['海运', '空运', '报关', '仓储', '陆运', '综合物流']
const JOB_TYPE_OPTIONS   = ['操作', '销售', '单证', '客服', '管理', '财务']

// ── 详情弹层 ──────────────────────────────────────────────────────────────────
function JobDetailModal({ job, onClose }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose()
  }

  const allTags = [...(job.route_tags ?? []), ...(job.skill_tags ?? [])]

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {(job.company_name ?? job.title ?? '?')[0]}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{job.title}</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {job.company_name ?? '—'} · {job.city}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* 关键信息格 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: MapPin,        label: '工作城市', value: job.city ?? '—' },
              { icon: Briefcase,     label: '薪资',     value: job.salary_label ?? '面议' },
              { icon: Clock,         label: '经验要求', value: job.experience_required ?? '不限' },
              { icon: GraduationCap, label: '学历要求', value: job.degree_required ?? '不限' },
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

          {/* 附加信息 */}
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            {job.business_type && <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">{job.business_type}</span>}
            {job.job_type      && <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100">{job.job_type}</span>}
            {job.headcount     && <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full"><Users size={11} />招 {job.headcount} 人</span>}
            {job.urgency_level === 1 && <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-full border border-red-100"><Zap size={11} />紧急招聘</span>}
          </div>

          {/* 标签 */}
          {allTags.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">岗位标签</p>
              <TagList tags={allTags} max={20} />
            </div>
          )}

          {/* 岗位职责 */}
          {job.description && (
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">岗位职责</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.description}</p>
            </div>
          )}

          {/* 任职要求 */}
          {job.requirements && (
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">任职要求</p>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{job.requirements}</p>
            </div>
          )}

          {/* 发布时间 */}
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
            发布于 {job.created_at?.slice(0, 10) ?? '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── 岗位卡片 ──────────────────────────────────────────────────────────────────
function JobCard({ job, onDetail }) {
  const allTags = [...(job.route_tags ?? []), ...(job.skill_tags ?? [])]
  const isUrgent = job.urgency_level === 1

  return (
    <div className="card p-5 hover:border-blue-200 transition-all">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {(job.company_name ?? job.title ?? '?')[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-800">{job.title}</h3>
                {isUrgent && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 border border-red-100">
                    <Zap size={9} />急
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                <span className="flex items-center gap-1"><Building2 size={11} />{job.company_name ?? '—'}</span>
                <span className="flex items-center gap-1"><MapPin size={11} />{job.city}</span>
                {job.experience_required && (
                  <span className="flex items-center gap-1"><Briefcase size={11} />{job.experience_required}</span>
                )}
                <span className="flex items-center gap-1"><Clock size={11} />{job.created_at?.slice(0, 10) ?? '—'}</span>
              </div>
            </div>
            <p className="font-bold text-blue-600 flex-shrink-0">{job.salary_label ?? '面议'}</p>
          </div>

          {allTags.length > 0 && (
            <div className="mt-3">
              <TagList tags={allTags} max={5} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <Button size="sm" variant="secondary" onClick={() => onDetail(job)}>
          查看详情 <ChevronRight size={13} />
        </Button>
      </div>
    </div>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function JobMarketplace() {
  const [jobs, setJobs]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [detailJob, setDetailJob] = useState(null)

  // 筛选状态
  const [q, setQ]                       = useState('')
  const [city, setCity]                 = useState('')
  const [businessType, setBusinessType] = useState('')
  const [jobType, setJobType]           = useState('')

  function fetchJobs(filters) {
    setLoading(true)
    setError('')
    jobsApi.getPublicJobs(filters)
      .then(res => setJobs(res.data.jobs))
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  // 首次加载
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchJobs({}) }, [])

  function handleSearch(e) {
    e.preventDefault()
    fetchJobs({ q, city, business_type: businessType, job_type: jobType })
  }

  function handleReset() {
    setQ(''); setCity(''); setBusinessType(''); setJobType('')
    fetchJobs({})
  }

  const hasFilter = q || city || businessType || jobType

  return (
    <>
      {detailJob && (
        <JobDetailModal job={detailJob} onClose={() => setDetailJob(null)} />
      )}

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* 标题区 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-800">岗位广场</h1>
          <p className="text-slate-500 mt-1">货代行业在招岗位，实时更新</p>
        </div>

        {/* 筛选栏 */}
        <form onSubmit={handleSearch} className="card p-4 mb-6">
          <div className="flex flex-wrap gap-3">
            {/* 关键词 */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="搜索职位名称或城市..."
                value={q}
                onChange={e => setQ(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>

            {/* 城市 */}
            <select
              value={city}
              onChange={e => setCity(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white"
            >
              <option value="">全部城市</option>
              {CITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* 业务类型 */}
            <select
              value={businessType}
              onChange={e => setBusinessType(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white"
            >
              <option value="">全部业务</option>
              {BUSINESS_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* 岗位类型 */}
            <select
              value={jobType}
              onChange={e => setJobType(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-600 bg-white"
            >
              <option value="">全部类型</option>
              {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <Button type="submit" size="sm">
              <Search size={13} />搜索
            </Button>
            {hasFilter && (
              <Button type="button" size="sm" variant="ghost" onClick={handleReset}>
                <X size={13} />重置
              </Button>
            )}
          </div>
        </form>

        {/* 结果计数 */}
        {!loading && !error && (
          <p className="text-sm text-slate-400 mb-4">
            共 <span className="font-semibold text-slate-700">{jobs.length}</span> 个在招岗位
            {hasFilter && <span className="ml-1">（已筛选）</span>}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-32 text-slate-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">加载岗位中...</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <AlertCircle size={32} className="mb-3 text-red-300" />
            <p className="text-sm text-red-500">{error}</p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => fetchJobs({ q, city, business_type: businessType, job_type: jobType })}>
              重试
            </Button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <FolderOpen size={36} className="mb-3 text-slate-300" />
            <p className="text-base font-medium">暂无匹配岗位</p>
            <p className="text-sm mt-1">试试调整筛选条件</p>
            {hasFilter && (
              <Button size="sm" variant="secondary" className="mt-4" onClick={handleReset}>
                清空筛选
              </Button>
            )}
          </div>
        )}

        {/* 岗位列表 */}
        {!loading && !error && jobs.length > 0 && (
          <div className="space-y-4">
            {jobs.map(job => (
              <JobCard key={job.id} job={job} onDetail={setDetailJob} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}