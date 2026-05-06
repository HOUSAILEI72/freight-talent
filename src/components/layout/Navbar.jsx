import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Ship, Bell, Menu, X, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { conversationsApi } from '../../api/conversations'

const NAV_BY_ROLE = {
  employer: [
    { label: '控制台', href: '/employer/dashboard' },
    { label: '候选人动态', href: '/employer/home' },
    { label: '发布岗位', href: '/employer/jobs/new' },
    { label: '候选人池', href: '/candidates' },
    { label: '岗位广场', href: '/jobs' },
    { label: '标签申请', href: '/tags' },
    { label: '消息', href: '/messages' },
  ],
  candidate: [
    { label: '岗位动态', href: '/candidate/home' },
    { label: '岗位广场', href: '/candidate/jobs' },
    { label: '我的简历', href: '/candidate/upload' },
    { label: '我的邀约', href: '/candidate/invitations' },
    { label: '个人订阅', href: '/candidate/tags' },
    { label: '消息', href: '/candidate/messages' },
  ],
  admin: [
    { label: '管理后台', href: '/admin/overview' },
    { label: '导入管理', href: '/admin/import' },
    { label: '审批中心', href: '/admin/approvals' },
    { label: '数据图表', href: '/admin/charts' },
    { label: '候选人池', href: '/admin/candidates' },
    { label: '岗位广场', href: '/admin/jobs' },
    { label: '消息', href: '/messages' },
  ],
}

const DEFAULT_NAV = [
  { label: '候选人', href: '/candidate/upload' },
  { label: '企业招聘', href: '/employer/dashboard' },
  { label: '岗位广场', href: '/employer/jobs/new' },
]

// 角色对应的头像首字
function avatarChar(user) {
  return (user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()
}

const ROLE_LABEL = { employer: '企业', candidate: '候选人', admin: '管理员' }

export function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const navItems = user ? (NAV_BY_ROLE[user.role] ?? DEFAULT_NAV) : DEFAULT_NAV

  // Poll total unread every 15s when logged in
  useEffect(() => {
    if (!user || !['employer', 'candidate', 'admin'].includes(user.role)) return
    function fetchUnread() {
      conversationsApi.getMyConversations()
        .then(res => setTotalUnread(res.data.total_unread ?? 0))
        .catch(() => {})
    }
    fetchUnread()
    const timer = setInterval(fetchUnread, 30000)
    return () => clearInterval(timer)
  }, [user])

  // Clear badge immediately when entering messages page
  useEffect(() => {
    if (location.pathname.startsWith('/messages')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTotalUnread(0)
    }
  }, [location.pathname])

  async function handleLogout() {
    setShowUserMenu(false)
    await logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Ship size={16} className="text-white" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-slate-800 text-sm">ACE-Talent</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide">货代精准招聘平台</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.href)
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                {item.label}
                {item.href === '/messages' && totalUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors relative">
                  <Bell size={16} />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
                </button>

                {/* 用户菜单 */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu((v) => !v)}
                    className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                  >
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-[10px] font-bold">{avatarChar(user)}</span>
                    </div>
                    <span className="text-sm font-medium text-slate-700 max-w-[90px] truncate">
                      {user.company_name ?? user.name}
                    </span>
                    <span className="text-[10px] text-slate-400 border border-slate-200 rounded px-1">
                      {ROLE_LABEL[user.role]}
                    </span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-medium text-slate-700 truncate">{user.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={14} />
                        退出登录
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                登录 / 注册
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={() => { setMobileOpen(false); handleLogout() }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
            >
              退出登录
            </button>
          ) : (
            <Link
              to="/login"
              className="block px-3 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"
              onClick={() => setMobileOpen(false)}
            >
              登录 / 注册
            </Link>
          )}
        </div>
      )}
    </header>
  )
}
