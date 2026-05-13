import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { getRoleHome } from '../../router/roleHome'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'

const TABS = [
  { key: 'employer', label: '企业' },
  { key: 'candidate', label: '候选人' },
]

// Login post-success navigation now uses `getRoleHome(role)` (see import
// above). Keep this file's role list in sync with `src/router/roleHome.js`
// when adding new roles.

// 登录页只支持 employer / candidate 注册；admin 通过 CLI seed

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, register: authRegister } = useAuth()

  const [tab, setTab] = useState('employer')
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '', company_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Verification code state
  const [codeSent, setCodeSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [code, setCode] = useState('')
  const [sendingCode, setSendingCode] = useState(false)
  const countdownRef = useRef(null)

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current)
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(countdownRef.current)
  }, [countdown > 0 ? 1 : 0])

  function updateField(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  function validate() {
    if (!form.email || !form.email.includes('@')) return '请输入有效的邮箱地址'
    if (form.password.length < 6) return '密码至少 6 位'
    if (mode === 'register') {
      if (!form.name.trim()) return '请输入姓名'
      if (tab === 'employer' && !form.company_name.trim()) return '企业用户请填写公司名称'
      if (!codeSent) return '请先获取邮箱验证码'
      if (code.length < 6) return '请输入 6 位验证码'
    }
    return ''
  }

  async function handleSendCode() {
    if (!form.email || !form.email.includes('@')) {
      setError('请先输入有效的邮箱地址')
      return
    }
    setError('')
    setSendingCode(true)
    try {
      const res = await authApi.sendCode({ email: form.email.trim().toLowerCase(), role: tab })
      setCodeSent(true)
      setCountdown(60)
      // Development mode only: auto-fill code if returned (never in production)
      if (import.meta.env.DEV && res.data?.code) {
        setCode(res.data.code)
      }
    } catch (err) {
      setError(err.response?.data?.message ?? '发送验证码失败，请稍后重试')
    } finally {
      setSendingCode(false)
    }
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
        user = await login({ email: form.email, password: form.password, role: tab })
      } else {
        // Use authApi directly because AuthContext.register drops extra fields like `code`
        const payload = {
          email: form.email.trim().toLowerCase(),
          password: form.password,
          name: form.name.trim(),
          role: tab,
          company_name: tab === 'employer' ? form.company_name.trim() : undefined,
          code,
        }
        const res = await authApi.register(payload)
        const { access_token: token, refresh_token, user: userData } = res.data
        localStorage.setItem('token', token)
        if (refresh_token) localStorage.setItem('refresh_token', refresh_token)
        user = userData
      }

      // 登录成功后回跳到 next 参数指定的页面（allowlist 防 open redirect）
      const ALLOWED_NEXT_PATHS = [
        '/jobs', '/candidates', '/messages', '/tags',
        '/employer/dashboard', '/employer/jobs', '/employer/candidates',
        '/employer/messages', '/employer/tags', '/employer/jobs/new',
        '/employer/pricing', '/employer/settings',
        '/candidate/home', '/candidate/jobs', '/candidate/messages',
        '/candidate/tags', '/candidate/invitations', '/candidate/settings',
        '/candidate/profile/me', '/candidate/applications',
        '/admin/overview', '/admin/import', '/admin/approvals',
      ]
      const next = searchParams.get('next')
      if (next && ALLOWED_NEXT_PATHS.some((p) => next === p || next.startsWith(p + '/'))) {
        const roleHome = getRoleHome(user.role)
        if (next.startsWith(`/${user.role}/`) || next === roleHome || next.startsWith('/admin/')) {
          navigate(next)
          return
        }
      }
      // 默认跳转到角色首页
      navigate(getRoleHome(user.role))
    } catch (err) {
      setError(err.response?.data?.message ?? '网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex-col justify-center px-16 relative overflow-hidden cursor-pointer"
        role="link"
        tabIndex={0}
        aria-label="返回首页"
        onClick={() => navigate('/')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate('/')
          }
        }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-700/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <img src="/logo-white.svg" alt="ACE-Talent" className="h-14 w-auto" />
            <div className="flex flex-col gap-0.5">
              <span className="text-white text-2xl font-bold tracking-tight leading-none">ACE-Talent</span>
              <span className="text-sm text-slate-400 font-medium leading-none">Access Career Everywhere</span>
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">货代行业<br />精准人才撮合平台</h2>
          <p className="text-slate-400 leading-relaxed mb-8">
            连接众多货代从业者与头部货代企业，快速完成精准入职。
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
                onClick={() => {
                  setTab(t.key)
                  setError('')
                  setCodeSent(false)
                  setCode('')
                  setCountdown(0)
                }}
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
                邮箱
              </label>
              <input
                type="email"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                placeholder={tab === 'employer' ? 'example@company.com' : 'your@email.com'}
                value={form.email}
                onChange={updateField('email')}
              />
            </div>

            {/* Verification code section — register mode only */}
            {mode === 'register' && (
              <div>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode || countdown > 0}
                  className={`text-sm font-medium ${
                    sendingCode || countdown > 0
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-blue-600 hover:text-blue-700'
                  }`}
                >
                  {sendingCode ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 size={12} className="animate-spin" /> 发送中...
                    </span>
                  ) : countdown > 0 ? (
                    `${countdown}s 后重发`
                  ) : codeSent ? (
                    '重新发送验证码'
                  ) : (
                    '发送验证码'
                  )}
                </button>
              </div>
            )}

            {mode === 'register' && codeSent && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">验证码</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 tracking-[0.3em] text-center text-lg"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
                {code.length === 6 && (
                  <p className="text-xs text-emerald-600 mt-1">
                    ✓ 验证码已填写
                  </p>
                )}
              </div>
            )}

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
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
                setCodeSent(false)
                setCode('')
                setCountdown(0)
              }}
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
