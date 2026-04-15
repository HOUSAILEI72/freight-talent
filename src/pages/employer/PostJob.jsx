import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X, ChevronRight, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { jobsApi } from '../../api/jobs'

const TAG_SUGGESTIONS = [
  '海运操作', '空运操作', '整柜', '拼箱', '报关', '单证', '销售',
  'FBA', 'Cargowise', '英语', '大客户', '团队管理', '跨境电商',
  'HS编码', '信用证', '危险品', '海外客服', '美线', '欧线',
]

const SALARY_OPTIONS = ['8k-12k', '12k-18k', '18k-25k', '25k-35k', '35k-50k', '面议']
const CITY_OPTIONS = ['上海', '广州', '深圳', '宁波', '青岛', '北京', '厦门', '天津']

// 根据标签简单推断业务类型和岗位类型
function inferTypes(tags) {
  const tagStr = tags.join(' ')
  const business = tagStr.includes('空运') ? '空运'
    : tagStr.includes('报关') ? '报关'
    : tagStr.includes('单证') ? '单证'
    : '海运'
  const jobType = tagStr.includes('销售') ? '销售'
    : tagStr.includes('客服') ? '客服'
    : tagStr.includes('管理') ? '管理'
    : '操作'
  // 路线标签
  const routeKeywords = ['美线', '欧线', '亚线', '中东线', '拉美线']
  const routeTags = tags.filter(t => routeKeywords.includes(t))
  const skillTags = tags.filter(t => !routeKeywords.includes(t))
  return { business, jobType, routeTags, skillTags }
}

export default function PostJob() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdJobId, setCreatedJobId] = useState(null)

  const [form, setForm] = useState({
    title: '',
    city: '',
    salary: '',
    description: '',
    requirements: '',
  })
  const [tags, setTags] = useState([])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // Step 0 校验
  function validateStep0() {
    if (!form.title.trim()) return '请填写岗位名称'
    if (!form.city) return '请选择工作城市'
    if (!form.description.trim()) return '请填写岗位职责'
    return ''
  }

  function handleGenerate() {
    const msg = validateStep0()
    if (msg) { setSubmitError(msg); return }
    setSubmitError('')
    // 不再预填固定标签，让用户从空白开始手动选择行业标签
    setTags([])
    setStep(1)
  }

  function toggleTag(t) {
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handlePublish() {
    setSubmitError('')
    setSubmitting(true)
    try {
      const { business, jobType, routeTags, skillTags } = inferTypes(tags)
      const payload = {
        title: form.title.trim(),
        city: form.city,
        salary_label: form.salary || null,
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        business_type: business,
        job_type: jobType,
        route_tags: routeTags,
        skill_tags: skillTags,
        status: 'published',
      }
      const res = await jobsApi.createJob(payload)
      setCreatedJobId(res.data.job.id)
      setStep(2)
      // 2秒后跳到控制台
      setTimeout(() => navigate('/employer/dashboard'), 2000)
    } catch (err) {
      setSubmitError(err.response?.data?.message ?? '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 成功状态
  if (step === 2) {
    return (
      <div className="max-w-lg mx-auto px-6 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">岗位已发布！</h2>
        <p className="text-slate-500 mb-1">系统正在为你匹配候选人...</p>
        <p className="text-sm text-slate-400">即将跳转到企业控制台</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">发布招聘岗位</h1>
        <p className="text-slate-500 mt-1">填写岗位信息，系统将自动生成匹配标签并推荐候选人</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {['填写岗位信息', 'AI 生成标签', '确认发布'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              i < step ? 'bg-emerald-500 text-white' :
              i === step ? 'bg-blue-600 text-white' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{s}</span>
            {i < 2 && <ChevronRight size={14} className="text-slate-300 ml-1" />}
          </div>
        ))}
      </div>

      {/* Step 0：填写岗位信息 */}
      {step === 0 && (
        <div className="space-y-5">
          {submitError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={15} className="flex-shrink-0" />
              {submitError}
            </div>
          )}

          <div className="card p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">岗位名称 *</label>
              <input
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="例：海运操作主管、空运销售经理"
                value={form.title}
                onChange={e => set('title', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">工作城市 *</label>
                <div className="flex flex-wrap gap-2">
                  {CITY_OPTIONS.slice(0, 5).map(c => (
                    <button
                      key={c}
                      onClick={() => set('city', c)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                        form.city === c ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">薪资范围</label>
                <div className="flex flex-wrap gap-2">
                  {SALARY_OPTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => set('salary', s)}
                      className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                        form.salary === s ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:border-blue-300'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">岗位职责 *</label>
              <textarea
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                placeholder="描述该岗位的主要职责和日常工作内容..."
                value={form.description}
                onChange={e => set('description', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">任职要求</label>
              <textarea
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                placeholder="学历、工作年限、技能要求等..."
                value={form.requirements}
                onChange={e => set('requirements', e.target.value)}
              />
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
            <Sparkles size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">提交后 AI 将自动从 JD 中提取货代行业专属标签，并立即开始匹配候选人。</p>
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={handleGenerate}
          >
            <Sparkles size={16} />
            下一步：确认标签并发布
          </Button>
        </div>
      )}

      {/* Step 1：AI 标签确认 */}
      {step === 1 && (
        <div className="space-y-5">
          {submitError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={15} className="flex-shrink-0" />
              {submitError}
            </div>
          )}

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{form.title}</p>
                <p className="text-xs text-slate-500">
                  {form.city}
                  {form.salary ? ` · ${form.salary}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-blue-500" />
              <h3 className="font-semibold text-slate-800">AI 生成的岗位标签</h3>
              <span className="text-xs text-slate-400">· 可手动增删</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {tags.map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-blue-600 text-white">
                  {t} <X size={12} />
                </button>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-slate-400">暂无标签，请从下方添加</p>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-2">添加更多标签：</p>
            <div className="flex flex-wrap gap-2">
              {TAG_SUGGESTIONS.filter(t => !tags.includes(t)).map(t => (
                <button key={t} onClick={() => toggleTag(t)}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  + {t}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-700">
              发布后系统将立即开始匹配候选人，匹配结果可在企业控制台查看。
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setStep(0); setSubmitError('') }}>
              返回修改
            </Button>
            <Button className="flex-1" onClick={handlePublish} disabled={submitting}>
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {submitting ? '正在发布...' : '确认发布 · 立即匹配'}
              {!submitting && <ChevronRight size={16} />}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}