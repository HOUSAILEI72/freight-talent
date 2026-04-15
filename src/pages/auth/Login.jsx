import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ship, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'

const TABS = [
  { key: 'employer', label: '企业' },
  { key: 'candidate', label: '候选人' },
]

const REDIRECT = {
  employer: '/employer/dashboard',
  candidate: '/candidate/upload',
  admin: '/admin/overview',
}

// 登录页只支持 employer / candidate 注册；admin 通过 CLI seed

export default function Login() {
  const navigate = useNavigate()
  const { login, register } = useAuth()

  const [tab, setTab] = useState('employer')
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '', company_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateField(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function validate() {
    if (!form.email || !form.email.includes('@')) return '请输入有效的邮箱地址'
    if (form.password.length < 6) return '密码至少 6 位'
    if (mode === 'register') {
      if (!form.name.trim()) return '请输入姓名'
      if (tab === 'employer' && !form.company_name.trim()) return '企业用户请填写公司名称'
    }
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const msg = validate()
    if (msg) { setError(msg); return }

    setLoading(true)
    try {
      let user
      if (mode === 'login') {
        user = await login({ email: form.email, password: form.password })
      } else {
        user = await register({
          email: form.email,
          password: form.password,
          name: form.name.trim(),
          role: tab,
          company_name: tab === 'employer' ? form.company_name.trim() : undefined,
        })
      }
      navigate(REDIRECT[user.role] ?? '/')
    } catch (err) {
      setError(err.response?.data?.message ?? '网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-center px-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-700/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
              <Ship size={20} className="text-white" />
            </div>
            <span className="text-white text-xl font-bold">FreightTalent</span>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">货代行业<br />精准人才撮合平台</h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            连接 1,284 位货代从业者与 43 家头部货代企业，平均 6.2 天完成入职。
          </p>
          <div className="space-y-3">
            {['精准标签匹配，告别无效投递', '简历鲜度优先，找到真正活跃的候选人', '行业经验验证，保障人选质量'].map(t => (
              <div key={t} className="flex items-center gap-2.5 text-slate-300 text-sm">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full flex-shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            选择你的账号类型{mode === 'login' ? '登录' : '注册'}
          </p>

          {/* Tab switcher：仅 login 时显示管理员 tab（允许管理员登录但不允许注册） */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            {(mode === 'login'
              ? [...TABS, { key: 'admin', label: '管理员' }]
              : TABS
            ).map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">姓名</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="请输入真实姓名"
                  value={form.name}
                  onChange={updateField('name')}
                />
              </div>
            )}

            {mode === 'register' && tab === 'employer' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">公司名称</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="请输入公司全称"
                  value={form.company_name}
                  onChange={updateField('company_name')}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                {tab === 'candidate' ? '手机号 / 邮箱' : '邮箱'}
              </label>
              <input
                type="email"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder={tab === 'employer' ? 'example@company.com' : 'your@email.com'}
                value={form.email}
                onChange={updateField('email')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">密码</label>
              <input
                type="password"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder="至少 6 位"
                value={form.password}
                onChange={updateField('password')}
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? '请稍候...' : (mode === 'login' ? '登录' : '注册')}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            {' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              className="text-blue-600 hover:underline font-medium"
            >
              {mode === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}