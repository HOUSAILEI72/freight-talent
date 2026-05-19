import '../styles/home.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Globe, Search, Layers, Building2,
  CheckCircle2, BarChart3, Shield, Zap, Briefcase,
  Users, UserCheck, ChevronRight,
} from 'lucide-react'
import { Button } from '../components/ui/Button'
import MarketTicker from '../components/home/MarketTicker'
import TalentIndexCard from '../components/home/TalentIndexCard'
import { publicMarketApi } from '../api/publicMarket'

/* ─────────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────────── */

/** Soft radial glow that lazily follows the cursor */
function CursorGlow() {
  const targetRef = useRef({ x: -999, y: -999 })
  const currentRef = useRef({ x: -999, y: -999 })
  const domRef = useRef(null)
  const rafRef = useRef(null)

  useEffect(() => {
    const onMove = (e) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('mousemove', onMove, { passive: true })

    function tick() {
      const t = targetRef.current
      const c = currentRef.current
      c.x += (t.x - c.x) * 0.07
      c.y += (t.y - c.y) * 0.07
      if (domRef.current) {
        domRef.current.style.left = `${c.x - 350}px`
        domRef.current.style.top  = `${c.y - 350}px`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
      <div
        ref={domRef}
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, rgba(59,130,246,0.03) 40%, transparent 70%)',
          pointerEvents: 'none',
          willChange: 'left, top',
        }}
      />
    </div>
  )
}

/** iOS-style 3D perspective tilt card with specular highlight */
function TiltCard({ children, className = '', style = {}, intensity = 9, onClick }) {
  const ref = useRef(null)
  const rafRef = useRef(null)
  const [state, setState] = useState({ rx: 0, ry: 0, px: 50, py: 50, active: false })

  const onMove = useCallback((e) => {
    if (!ref.current) return
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      const r = ref.current.getBoundingClientRect()
      const cx = (e.clientX - r.left) / r.width
      const cy = (e.clientY - r.top)  / r.height
      setState({
        rx: (cy - 0.5) * -intensity,
        ry: (cx - 0.5) *  intensity,
        px: cx * 100,
        py: cy * 100,
        active: true,
      })
    })
  }, [intensity])

  const onLeave = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setState({ rx: 0, ry: 0, px: 50, py: 50, active: false })
  }, [])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      className={`tilt-card ${className}`}
      style={{
        ...style,
        transform: `perspective(900px) rotateX(${state.rx}deg) rotateY(${state.ry}deg) scale(${state.active ? 1.025 : 1})`,
        transition: state.active
          ? 'transform 0.08s ease-out'
          : 'transform 0.55s cubic-bezier(0.22,1,0.36,1)',
      }}
    >
      {/* Specular glint that follows the cursor inside the card */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: `radial-gradient(circle at ${state.px}% ${state.py}%, rgba(255,255,255,0.18) 0%, transparent 55%)`,
          pointerEvents: 'none',
          opacity: state.active ? 1 : 0,
          transition: 'opacity 0.25s',
          zIndex: 10,
        }}
      />
      {children}
    </div>
  )
}

/** Wraps children and triggers scroll-reveal on each .reveal-item inside */
function RevealGroup({ children, className = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const items = el.querySelectorAll('.reveal-item')
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible')
            obs.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -60px 0px', threshold: 0.12 }
    )
    items.forEach((item) => obs.observe(item))
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className={`reveal-group ${className}`}>
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
   Data
───────────────────────────────────────────────────────────────── */

const ROLE_CATEGORIES = [
  { label: '货代销售',   color: 'bg-blue-500' },
  { label: '海运操作',   color: 'bg-purple-500' },
  { label: '空运操作',   color: 'bg-emerald-500' },
  { label: '报关 / 单证', color: 'bg-orange-500' },
  { label: '客服运营',   color: 'bg-pink-500' },
  { label: '供应链管理', color: 'bg-cyan-500' },
]

const BUSINESS_LINES = [
  {
    icon: Zap,
    tag: '自主招聘',
    title: '线上自主招聘',
    desc: '企业一键发岗，精准人才自主投递，高效轻量化招人。行业专属标签匹配，简历鲜度优先推荐，告别繁琐低效。',
    accent: '#3b82f6',
    tagBg: 'bg-blue-50 text-blue-600',
    iconBg: 'text-blue-600 bg-blue-50',
  },
  {
    icon: Search,
    tag: '高端猎头',
    title: '高端个人猎头',
    desc: '深耕行业精准寻访，稀缺核心岗位全流程专属交付。资深顾问一对一服务，确保高管及关键岗位精准落地。',
    accent: '#8b5cf6',
    tagBg: 'bg-purple-50 text-purple-600',
    iconBg: 'text-purple-600 bg-purple-50',
  },
  {
    icon: Layers,
    tag: '团队猎头',
    title: '整建制团队猎头',
    desc: '定制批量用人方案，一站式完成项目团队整体搭建。快速响应大规模用人需求，批量交付有保障。',
    accent: '#10b981',
    tagBg: 'bg-emerald-50 text-emerald-600',
    iconBg: 'text-emerald-600 bg-emerald-50',
  },
  {
    icon: Globe,
    tag: '跨境人才',
    title: '全球跨境人才服务',
    desc: '打通海内外人才通道，适配跨境出海全球化用人。连通海内外行业精英，助力人才全球流动、企业全域布局。',
    accent: '#f59e0b',
    tagBg: 'bg-amber-50 text-amber-600',
    iconBg: 'text-amber-600 bg-amber-50',
  },
]

const CORE_ADVANTAGES = [
  { icon: BarChart3,    title: '垂直深耕',     desc: '吃透国际物流全行业用人逻辑，超越通用招聘平台的简单复制', color: 'text-blue-600' },
  { icon: UserCheck,   title: '专属人才库',    desc: '剔除无效简历，行业背景严格核验，匹配更精准', color: 'text-purple-600' },
  { icon: Shield,      title: '行业能力测评',  desc: '严控人才真实专业素养，候选人质量有保障', color: 'text-emerald-600' },
  { icon: Zap,         title: 'AI 智能匹配',   desc: '大幅缩短招聘寻访周期，从发岗到入职全程加速', color: 'text-orange-600' },
  { icon: Briefcase,   title: '全业态覆盖',    desc: '满足企业大小各类招聘需求，自主招聘到猎头全线提供', color: 'text-pink-600' },
  { icon: CheckCircle2, title: '系统线上闭环', desc: '流程透明，交付可追溯，全程线上化管理无断点', color: 'text-cyan-600' },
]

const HERO_STATS = [
  { value: '垂直平台', label: '国际物流专注' },
  { value: '四大业态', label: '自主·猎头·团队·跨境' },
  { value: 'AI 匹配',  label: '智能精准推荐' },
  { value: '全球网络', label: '海内外人才通道' },
]

/* ─────────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────────── */

export default function Home() {
  const navigate = useNavigate()
  const [marketData, setMarketData] = useState(null)

  /* Parallax orb position for hero (mouse-driven) */
  const mouseTarget = useRef({ x: 0, y: 0 })
  const mouseSmooth = useRef({ x: 0, y: 0 })
  const orbRaf = useRef(null)
  const [orbPos, setOrbPos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e) => {
      mouseTarget.current = {
        x: (e.clientX / window.innerWidth  - 0.5),
        y: (e.clientY / window.innerHeight - 0.5),
      }
    }
    window.addEventListener('mousemove', onMove, { passive: true })

    function tick() {
      const t = mouseTarget.current
      const s = mouseSmooth.current
      s.x += (t.x - s.x) * 0.04
      s.y += (t.y - s.y) * 0.04
      setOrbPos({ x: s.x, y: s.y })
      orbRaf.current = requestAnimationFrame(tick)
    }
    orbRaf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(orbRaf.current)
    }
  }, [])

  useEffect(() => {
    publicMarketApi.getSnapshot()
      .then(data => { if (data?.success) setMarketData(data) })
      .catch(() => {})
  }, [])

  const tickerItems = marketData?.ticker ?? []
  const totals      = marketData?.totals ?? { candidates: 0, jobs: 0 }
  const trend       = marketData?.trend  ?? []

  return (
    <div className="relative">
      <CursorGlow />
      <MarketTicker items={tickerItems.length > 0 ? tickerItems : undefined} />

      {/* ══ Hero ════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white overflow-hidden relative grain">

        {/* Parallax orbs — move subtly with mouse */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div
            className="orb-a absolute rounded-full bg-blue-500/20 blur-3xl"
            style={{
              width: 520, height: 520,
              top: '5%', left: '18%',
              transform: `translate(${orbPos.x * 48}px, ${orbPos.y * 32}px)`,
              willChange: 'transform',
            }}
          />
          <div
            className="orb-b absolute rounded-full bg-indigo-500/15 blur-3xl"
            style={{
              width: 420, height: 420,
              bottom: '-5%', right: '20%',
              transform: `translate(${orbPos.x * -36}px, ${orbPos.y * -28}px)`,
              willChange: 'transform',
            }}
          />
          <div
            className="orb-c absolute rounded-full bg-emerald-400/10 blur-3xl"
            style={{
              width: 280, height: 280,
              top: '35%', right: '32%',
              transform: `translate(${orbPos.x * 22}px, ${orbPos.y * 20}px)`,
              willChange: 'transform',
            }}
          />
          {/* Grid dot pattern */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 md:py-32">
          <div className="flex flex-col lg:flex-row items-start gap-12">

            {/* Left — copy */}
            <div className="flex-1 max-w-2xl">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full glass mb-7">
                <span className="ping-slow w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                <span className="text-blue-200 text-xs font-medium tracking-wide">
                  专筑全球物流人才池 · 一站式数字化招聘交付平台
                </span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-[54px] font-bold leading-[1.1] tracking-[-0.015em] mb-6">
                物流垂直精准招才
                <br />
                <span className="grad-text">自主直聘&nbsp;+&nbsp;高端猎聘</span>
                <br className="hidden sm:block" />
                双线赋能
              </h1>

              <p className="text-slate-300/90 text-lg leading-[1.75] mb-10 max-w-xl">
                深耕国际物流垂直赛道，集线上自主招聘、高端个人猎头、整建制团队猎聘、全球跨境人才调配于一体——依托行业专属人才模型与智能匹配系统，一站式解决物流企业全场景用人难题。
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 mb-14">
                <button
                  onClick={() => navigate('/employer/jobs/new')}
                  className="group relative inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-white overflow-hidden"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(99,102,241,0.45)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <span className="relative z-10">入驻发岗，坐拥专业人才</span>
                  <ArrowRight size={16} className="relative z-10 group-hover:translate-x-1 transition-transform" />
                  <span className="absolute inset-0 shimmer-wrap pointer-events-none rounded-xl" />
                </button>

                <button
                  onClick={() => navigate('/candidate/home')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-semibold text-slate-200 glass transition-all"
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.color = '#fff' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.color = '' }}
                >
                  投递优质名企岗位
                </button>
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {HERO_STATS.map(s => (
                  <div key={s.label}>
                    <p className="text-xl font-bold text-white">{s.value}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — floating card */}
            <div className="w-full lg:w-auto flex justify-center lg:justify-end lg:flex-shrink-0">
              <div
                className="float-anim"
                style={{
                  filter: 'drop-shadow(0 24px 48px rgba(99,102,241,0.25))',
                  transform: `translate(${orbPos.x * -14}px, ${orbPos.y * -10}px)`,
                  willChange: 'transform',
                  transition: 'transform 0.1s ease-out',
                }}
              >
                <TalentIndexCard totals={totals} trend={trend} />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══ About banner ════════════════════════════════════════ */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
            <div className="flex items-center gap-2 flex-shrink-0">
              <Building2 size={14} className="text-blue-600" />
              <span className="text-sm font-semibold text-slate-700">智锦汇人力资源（上海）有限公司</span>
              <span className="text-slate-200 select-none mx-1">|</span>
              <span className="text-sm font-bold text-blue-600 tracking-wide">ACE-Talent</span>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              深耕国际物流垂直赛道，集线上自主招聘、高端个人猎头、整建制团队猎聘、全球跨境人才调配于一体，依托行业专属人才模型与智能匹配系统，线上标准化全流程交付，一站式解决物流企业全场景用人难题，连通海内外行业精英，助力人才全球流动、企业全域布局。
            </p>
          </div>
        </div>
      </section>

      {/* ══ Hot categories ══════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">热门岗位方向</h2>
            <p className="text-sm text-slate-500 mt-1">按货代行业岗位类型快速筛选匹配人才</p>
          </div>
          <button
            onClick={() => navigate('/employer/dashboard')}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 transition-colors"
          >
            查看全部 <ChevronRight size={14} />
          </button>
        </div>

        <RevealGroup className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {ROLE_CATEGORIES.map((role) => (
            <button
              key={role.label}
              onClick={() => navigate('/employer/candidates')}
              className="reveal-item card p-4 text-left hover:border-blue-200 transition-all group"
            >
              <div className={`w-2 h-2 rounded-full ${role.color} mb-3`} />
              <p className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{role.label}</p>
            </button>
          ))}
        </RevealGroup>
      </section>

      {/* ══ Four business lines ═════════════════════════════════ */}
      <section
        className="border-y border-slate-100 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #f8faff 0%, #f0f4ff 40%, #f8fbff 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-6 py-16">
          <RevealGroup>
            <div className="text-center mb-12 reveal-item">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-semibold mb-3">
                四大业务全覆盖
              </div>
              <h2 className="text-2xl font-bold text-slate-800">
                立足国内引英才，链接全球聚物流行业中坚力量
              </h2>
              <p className="text-slate-500 mt-2 max-w-2xl mx-auto text-sm">
                行业深耕强专业，系统提效稳交付——无论自主招聘还是高端猎聘，ACE-Talent 均可全程闭环交付
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {BUSINESS_LINES.map((bl) => (
                <TiltCard
                  key={bl.title}
                  className="reveal-item glass-light glow-hover shimmer-wrap rounded-2xl p-6 cursor-default relative"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-11 h-11 rounded-xl ${bl.iconBg} flex items-center justify-center flex-shrink-0`}>
                      <bl.icon size={20} />
                    </div>
                    <span className={`tag-pill ${bl.tagBg}`}>{bl.tag}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2.5 text-[15px]">{bl.title}</h3>
                  <p className="text-sm text-slate-500 leading-[1.7]">{bl.desc}</p>
                  {/* Bottom accent line */}
                  <div
                    className="absolute bottom-0 left-6 right-6 h-px rounded-full opacity-30"
                    style={{ background: `linear-gradient(90deg, transparent, ${bl.accent}, transparent)` }}
                  />
                </TiltCard>
              ))}
            </div>
          </RevealGroup>
        </div>
      </section>

      {/* ══ Core advantages ═════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="flex flex-col lg:flex-row gap-12 items-start">

          {/* Left description */}
          <RevealGroup className="lg:w-72 flex-shrink-0">
            <div className="reveal-item">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold mb-3">
                核心优势
              </div>
              <h2 className="text-2xl font-bold text-slate-800 leading-tight mb-4">
                为什么选择<br />
                <span className="text-blue-600">ACE-Talent</span>
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                专为国际物流行业设计，不是通用招聘平台的简单复制。从精准匹配到全流程交付，每一环节都深度贴合行业需求。
              </p>
              <button
                onClick={() => navigate('/employer/jobs/new')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#2563eb,#4f46e5)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(79,70,229,0.4)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                立即体验 <ArrowRight size={14} />
              </button>
            </div>
          </RevealGroup>

          {/* Right 6-grid */}
          <RevealGroup className="flex-1 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CORE_ADVANTAGES.map((adv, i) => (
              <TiltCard
                key={adv.title}
                intensity={6}
                className="reveal-item glass-light p-5 rounded-xl group relative overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-3">
                  <adv.icon size={15} className={adv.color} />
                  <span className="text-[10px] font-bold text-slate-300 tabular-nums">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-800 mb-1.5 text-sm">{adv.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{adv.desc}</p>
              </TiltCard>
            ))}
          </RevealGroup>

        </div>
      </section>

      {/* ══ Featured candidates placeholder ════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 pb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">精选候选人</h2>
            <p className="text-sm text-slate-500 mt-1">近期活跃 · 简历已更新 · 开放机会</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/employer/candidates')}>
            浏览候选人池
          </Button>
        </div>
        <div className="card p-8 text-center text-slate-400">
          <p className="font-medium text-slate-600 mb-2">注册后查看完整候选人档案</p>
          <p className="text-sm">
            无论你是正在寻找机会的货代从业者，还是急需优质人才的物流企业，ACE-Talent 都能精准匹配。
          </p>
        </div>
      </section>

      {/* ══ Dual CTA ════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <RevealGroup className="rounded-2xl overflow-hidden grid lg:grid-cols-2 reveal-item">

          {/* Employer */}
          <div
            className="shimmer-wrap grain relative p-10 text-white"
            style={{ background: 'linear-gradient(135deg,#1d4ed8 0%,#4f46e5 60%,#6d28d9 100%)' }}
          >
            <div
              className="w-11 h-11 rounded-xl glass flex items-center justify-center mb-5"
              style={{ backdropFilter: 'blur(12px)' }}
            >
              <Briefcase size={20} className="text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">企业招聘</h3>
            <p className="text-blue-100/90 text-sm leading-relaxed mb-6">
              入驻发岗，坐拥海量物流专业人才。自主直聘省时高效，高端猎聘专属交付，整建制团队批量搭建。
            </p>
            <div className="space-y-2.5 mb-8">
              {[
                '精准标签匹配，告别无效投递',
                '简历鲜度优先，触达真实活跃候选人',
                '四大招聘业态，覆盖全场景用人需求',
              ].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm text-blue-100">
                  <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/employer/jobs/new')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-blue-700 bg-white transition-all"
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              立即发布岗位 <ArrowRight size={15} />
            </button>
          </div>

          {/* Talent */}
          <div
            className="shimmer-wrap grain relative p-10 text-white"
            style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%)' }}
          >
            <div
              className="w-11 h-11 rounded-xl glass flex items-center justify-center mb-5"
              style={{ backdropFilter: 'blur(12px)' }}
            >
              <Users size={20} className="text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">人才求职</h3>
            <p className="text-slate-300/90 text-sm leading-relaxed mb-6">
              投递优质名企岗位，畅享跨境职业机遇。连接海内外顶级物流企业，助力职业跨越式发展。
            </p>
            <div className="space-y-2.5 mb-8">
              {[
                '货代行业垂直岗位，精准匹配你的专业背景',
                '跨境出海机遇，拓展全球职业版图',
                '企业直接接洽，缩短入职周期',
              ].map(t => (
                <div key={t} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                  {t}
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/candidate/home')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              进入求职平台 <ArrowRight size={15} />
            </button>
          </div>

        </RevealGroup>
      </section>
    </div>
  )
}
