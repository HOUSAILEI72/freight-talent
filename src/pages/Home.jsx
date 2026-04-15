import { useNavigate } from 'react-router-dom'
import { ArrowRight, Zap, Shield, Clock, Users, Briefcase, TrendingUp, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/Button'

const ROLE_CATEGORIES = [
  { label: '海运操作', color: 'bg-blue-500' },
  { label: '空运销售', color: 'bg-purple-500' },
  { label: '报关员', color: 'bg-emerald-500' },
  { label: '单证专员', color: 'bg-orange-500' },
  { label: '海外客服', color: 'bg-pink-500' },
  { label: '物流销售', color: 'bg-cyan-500' },
]

const FEATURES = [
  {
    icon: Zap,
    title: '精准标签匹配',
    desc: '基于货代行业专属标签体系，从岗位JD自动提取关键技能，与候选人标签精准对应，匹配准确率达 91%。',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Clock,
    title: '简历鲜度优先',
    desc: '近 30 天内确认或更新的简历优先展示。候选人越活跃，推荐排名越靠前，降低无效触达。',
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: Shield,
    title: '行业经验验证',
    desc: '通过货代从业背景核验体系，过滤非行业候选人，确保每位推荐人选具备真实的货代从业经历。',
    color: 'text-purple-600 bg-purple-50',
  },
  {
    icon: TrendingUp,
    title: '快速邀约流程',
    desc: '企业可在匹配结果页直接发起邀约，候选人收到通知后 24 小时内响应，平均到面周期仅 6.2 天。',
    color: 'text-orange-600 bg-orange-50',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden relative">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-16 left-1/4 w-64 h-64 bg-blue-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-blue-600 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              货代行业垂直人才撮合平台
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              找到下一个
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400"> 精准匹配 </span>
              的货代人才
            </h1>

            <p className="text-slate-300 text-lg md:text-xl leading-relaxed mb-10 max-w-2xl">
              专为货代、物流行业设计的人才匹配系统。精准标签 · 简历鲜度优先 · 行业经验验证，平均 6.2 天完成入职。
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-14">
              <Button
                size="xl"
                onClick={() => navigate('/employer/post-job')}
                className="bg-blue-500 hover:bg-blue-400 shadow-lg shadow-blue-900/40"
              >
                发布招聘岗位
                <ArrowRight size={18} />
              </Button>
              <Button
                size="xl"
                variant="ghost"
                onClick={() => navigate('/candidate/upload')}
                className="text-white border border-white/20 hover:bg-white/10 hover:text-white"
              >
                上传我的简历
              </Button>
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {[
                { label: '货代行业专属', value: '垂直平台' },
                { label: '简历鲜度优先', value: '精准匹配' },
                { label: '行业经验验证', value: '质量保障' },
                { label: '平均入职周期', value: '快速高效' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-2xl font-bold text-white">{s.value}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Role categories */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">热门岗位方向</h2>
            <p className="text-sm text-slate-500 mt-1">按货代行业岗位类型快速筛选匹配人才</p>
          </div>
          <button
            onClick={() => navigate('/employer/dashboard')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            查看全部 <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLE_CATEGORIES.map((role) => (
            <button
              key={role.label}
              onClick={() => navigate('/employer/candidates')}
              className="card p-4 text-left hover:border-blue-200 transition-all group"
            >
              <div className={`w-2 h-2 rounded-full ${role.color} mb-3`} />
              <p className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{role.label}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-14">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800">为什么选择 FreightTalent</h2>
            <p className="text-slate-500 mt-2">专为货代行业设计，不是通用招聘平台的简单复制</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-slate-100 bg-slate-50">
                <div className={`w-10 h-10 rounded-xl ${f.color} flex items-center justify-center mb-4`}>
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured candidates */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">精选候选人</h2>
            <p className="text-sm text-slate-500 mt-1">近期活跃 · 简历已更新 · 开放机会</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/employer/candidates')}>
            浏览候选人池
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 真实候选人数据由登录后的候选人池页展示，首页引导注册 */}
          <div className="card p-8 text-center text-slate-400 col-span-full">
            <p className="font-medium text-slate-600 mb-2">注册后查看完整候选人档案</p>
            <p className="text-sm">基于货代行业专属标签体系，精准匹配候选人</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-10 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">准备好开始了吗？</h2>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            无论你是正在寻找下一份机会的货代从业者，还是急需优质人才的货代企业，FreightTalent 都能帮你快速找到匹配。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => navigate('/candidate/upload')} className="bg-blue-500 text-white hover:bg-blue-400 border border-blue-400">
              <Users size={16} />
              我是求职者
            </Button>
            <Button size="lg" onClick={() => navigate('/employer/post-job')} className="bg-blue-500 text-white hover:bg-blue-400 border border-blue-400">
              <Briefcase size={16} />
              我要招人
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}