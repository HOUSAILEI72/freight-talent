import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, ChevronRight, Sparkles, X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { candidatesApi } from '../../api/candidates'

const SUGGESTED_TAGS = [
  '海运操作', '空运操作', '报关员', '单证制作', '货代销售',
  'FBA发货', 'Cargowise', '整柜', '拼箱', '英语口语',
  '大客户开发', '海外客服', '投诉处理', '信用证', 'HS编码',
  '美线', '欧线', '团队管理', '危险品', '亚线',
]

const SALARY_OPTIONS = ['5k-8k', '8k-12k', '12k-18k', '18k-25k', '25k-35k', '35k-50k', '面议']
const CITY_OPTIONS = ['上海', '广州', '深圳', '宁波', '青岛', '北京', '厦门', '天津']
const STEPS = ['上传简历', 'AI 解析', '确认档案', '发布上线']

function inferTagTypes(tags) {
  const routeKeywords = ['美线', '欧线', '亚线', '中东线', '拉美线']
  return {
    route_tags: tags.filter(t => routeKeywords.includes(t)),
    skill_tags: tags.filter(t => !routeKeywords.includes(t)),
  }
}

export default function UploadResume() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step, setStep] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)   // 文件上传中
  const [saving, setSaving] = useState(false)          // 档案保存中
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState('')

  // 已上传的简历文件元信息
  const [uploadedFile, setUploadedFile] = useState(null)  // { name, uploaded_at }

  // 表单数据（Step 1 可编辑）
  const [form, setForm] = useState({
    full_name: '',
    current_title: '',
    current_company: '',
    current_city: '',
    expected_city: '',
    expected_salary_label: '',
    experience_years: '',
    education: '',
    summary: '',
  })
  const [selectedTags, setSelectedTags] = useState([])
  const [existingProfile, setExistingProfile] = useState(null)

  // 页面加载：拉取已有档案
  useEffect(() => {
    candidatesApi.getMyCandidateProfile()
      .then(res => {
        const p = res.data.profile
        if (!p) return
        setExistingProfile(p)
        setForm({
          full_name: p.full_name || '',
          current_title: p.current_title || '',
          current_company: p.current_company || '',
          current_city: p.current_city || '',
          expected_city: p.expected_city || '',
          expected_salary_label: p.expected_salary_label || '',
          experience_years: p.experience_years != null ? String(p.experience_years) : '',
          education: p.education || '',
          summary: p.summary || '',
        })
        setSelectedTags(p.all_tags || [])
        if (p.resume_file_name) {
          setUploadedFile({
            name: p.resume_file_name,
            uploaded_at: p.resume_uploaded_at,
          })
        }
      })
      .catch(() => {
        // 获取失败静默处理，用空白表单
      })
  }, [])

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  async function handleFile(file) {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      setError('仅支持 PDF、DOC、DOCX 格式')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('文件大小不能超过 10MB')
      return
    }

    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await candidatesApi.uploadResumeFile(file, setUploadProgress)
      setUploadedFile({
        name: res.data.file_name,
        uploaded_at: res.data.uploaded_at,
      })
      // 如果后端返回了新建的 profile，同步一下姓名
      if (res.data.profile && !form.full_name) {
        setField('full_name', res.data.profile.full_name || '')
      }
      // 上传成功，进入 Step 1
      setTimeout(() => {
        setUploading(false)
        setStep(1)
      }, 800)
    } catch (err) {
      setUploading(false)
      setError(err.response?.data?.message ?? '上传失败，请重试')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function validateForm() {
    if (!form.full_name.trim()) return '请填写姓名'
    if (!form.current_title.trim()) return '请填写当前职位'
    if (!form.current_city) return '请选择所在城市'
    if (form.experience_years && (isNaN(Number(form.experience_years)) || Number(form.experience_years) < 0)) {
      return '工作年限请填写正整数'
    }
    return ''
  }

  async function handleConfirmPublish() {
    const msg = validateForm()
    if (msg) { setError(msg); return }
    setError('')
    setSaving(true)
    try {
      const { route_tags, skill_tags } = inferTagTypes(selectedTags)
      await candidatesApi.updateMyCandidateProfile({
        ...form,
        experience_years: form.experience_years ? Number(form.experience_years) : null,
        route_tags,
        skill_tags,
        availability_status: 'open',
      })
      setStep(3)
      // 跳转到本人 profile（使用 /me 路由，不依赖 user.id）
      setTimeout(() => navigate('/candidate/profile/me'), 1800)
    } catch (err) {
      setError(err.response?.data?.message ?? '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 已有档案时，可以跳过上传直接到 Step 1 编辑
  function goDirectToEdit() {
    setError('')
    setStep(1)
  }

  // ── 渲染 ──
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-10">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold ${
              i < step ? 'bg-emerald-500 text-white' :
              i === step ? 'bg-blue-600 text-white' :
              'bg-slate-100 text-slate-400'
            }`}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-semibold text-slate-800' : 'text-slate-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="text-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Step 0：上传简历 ── */}
      {step === 0 && (
        <div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">上传你的简历</h1>
          <p className="text-slate-500 mb-6">支持 PDF、Word 格式，系统将自动解析并生成结构化档案</p>

          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 已有简历提示 */}
          {existingProfile?.resume_file_name && (
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-emerald-800">已有简历：{existingProfile.resume_file_name}</p>
                  <p className="text-xs text-emerald-600">
                    上传于 {existingProfile.resume_uploaded_at?.slice(0, 10) ?? '—'}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="secondary" onClick={goDirectToEdit}>
                直接编辑档案
              </Button>
            </div>
          )}

          {/* 上传区域 */}
          <div
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-pointer ${
              dragging ? 'border-blue-400 bg-blue-50' :
              uploading ? 'border-blue-300 bg-blue-50/50' :
              'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            }`}
            onDragOver={e => { e.preventDefault(); if (!uploading) setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={uploading ? undefined : handleDrop}
            onClick={() => !uploading && document.getElementById('file-input').click()}
          >
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
            />

            {uploading ? (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <Sparkles size={24} className="text-blue-500 animate-pulse" />
                </div>
                <p className="font-semibold text-slate-800 mb-2">AI 正在解析简历...</p>
                <p className="text-sm text-slate-500 mb-4">提取工作经历、技能标签、行业背景中</p>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden w-48 mx-auto">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">{uploadProgress}%</p>
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <Upload size={24} className="text-slate-400" />
                </div>
                <p className="font-semibold text-slate-800 mb-1">拖拽简历文件到此处</p>
                <p className="text-sm text-slate-400 mb-4">或点击选择文件</p>
                <Badge color="gray">PDF / Word · 最大 10MB</Badge>
              </div>
            )}
          </div>

          <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-1">解析后系统将自动：</p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>· 提取工作经历与教育背景</li>
              <li>· 生成货代行业专属技能标签</li>
              <li>· 计算简历鲜度与活跃度评分</li>
              <li>· 向匹配的招聘企业推送档案</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Step 1：确认 / 编辑档案信息 ── */}
      {step === 1 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={20} className="text-emerald-500" />
            <h1 className="text-2xl font-bold text-slate-800">
              {uploadedFile ? '解析完成，请确认信息' : '编辑档案信息'}
            </h1>
          </div>
          <p className="text-slate-500 mb-6">请核对并补充以下信息，完成后发布档案</p>

          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* 基本信息表单 */}
          <div className="card p-6 mb-5 space-y-4">
            <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">基本信息</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">姓名 *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  value={form.full_name}
                  onChange={e => setField('full_name', e.target.value)}
                  placeholder="真实姓名"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">当前职位 *</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  value={form.current_title}
                  onChange={e => setField('current_title', e.target.value)}
                  placeholder="如：海运操作主管"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">当前公司</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  value={form.current_company}
                  onChange={e => setField('current_company', e.target.value)}
                  placeholder="公司名称（可选）"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">工作年限</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  value={form.experience_years}
                  onChange={e => setField('experience_years', e.target.value)}
                  placeholder="年"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">学历</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  value={form.education}
                  onChange={e => setField('education', e.target.value)}
                  placeholder="如：本科 · 国际贸易"
                />
              </div>
            </div>

            {/* 所在城市 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">所在城市 *</label>
              <div className="flex flex-wrap gap-2">
                {CITY_OPTIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setField('current_city', c)}
                    className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                      form.current_city === c
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* 期望薪资 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">期望薪资</label>
              <div className="flex flex-wrap gap-2">
                {SALARY_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setField('expected_salary_label', s)}
                    className={`px-3 py-1 rounded-lg text-sm border transition-colors ${
                      form.expected_salary_label === s
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-slate-200 text-slate-600 hover:border-blue-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 个人简介 */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">个人简介</label>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                value={form.summary}
                onChange={e => setField('summary', e.target.value)}
                placeholder="简要介绍你的从业经历和核心优势..."
              />
            </div>
          </div>

          {/* 上传文件状态 */}
          {uploadedFile && (
            <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <FileText size={16} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">{uploadedFile.name}</p>
                <p className="text-xs text-emerald-600">
                  上传于 {uploadedFile.uploaded_at?.slice(0, 10) ?? '—'}
                </p>
              </div>
            </div>
          )}

          {/* 标签 */}
          <div className="card p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-blue-500" />
              <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">技能标签</h2>
              <span className="text-xs text-slate-400">· 可手动增删</span>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {selectedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-blue-600 text-white"
                >
                  {tag} <X size={12} />
                </button>
              ))}
              {selectedTags.length === 0 && (
                <p className="text-sm text-slate-400">暂无标签，从下方添加</p>
              )}
            </div>

            <p className="text-xs text-slate-400 mb-2">点击添加更多标签：</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.filter(t => !selectedTags.includes(t)).map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => { setStep(0); setError('') }}>
              返回
            </Button>
            <Button className="flex-1" onClick={handleConfirmPublish} disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? '正在保存...' : '确认发布档案'}
              {!saving && <ChevronRight size={16} />}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3：发布成功 ── */}
      {step === 3 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">档案已发布！</h2>
          <p className="text-slate-500">正在跳转到你的候选人档案页...</p>
        </div>
      )}
    </div>
  )
}