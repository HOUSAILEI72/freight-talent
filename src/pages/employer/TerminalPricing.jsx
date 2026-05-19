import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2, Puzzle, Building2, AlertCircle, CheckCircle, Info } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { subscriptionsApi } from '../../api/subscriptions'

// ─── Data ─────────────────────────────────────────────────────────────────────

const REGIONS = [
  { code: 'GREAT_CHINA',    label: '中国大区',  hint: '华东·华北·华南·华西·华中·港澳台' },
  { code: 'SOUTHEAST_ASIA', label: '东南亚',    hint: 'Southeast Asia' },
  { code: 'MIDDLE_EAST',    label: '中东',      hint: 'Middle East' },
  { code: 'EUROPE',         label: '欧洲',      hint: 'Europe' },
  { code: 'AMERICAS',       label: '美洲',      hint: 'Americas' },
]

const FUNCTIONS = [
  { code: 'Sea',               label: '海运板块' },
  { code: 'Air',               label: '空运板块' },
  { code: 'CrossBorder',       label: '跨境电商物流' },
  { code: 'Railway',           label: '铁路/中欧班列' },
  { code: 'Road',              label: '陆路运输' },
  { code: 'ContractLogistics', label: '合同物流/3PL' },
  { code: 'Warehousing',       label: '仓储/海外仓' },
  { code: 'Customs',           label: '关务/合规' },
]

const ANNUAL_MONTHS_BILLED = 10

const PLANS = [
  {
    id: 'china_function',
    icon: Puzzle,
    name: '单职能方案',
    nameEn: 'SINGLE FUNCTION',
    monthlyPrice: 650,
    annualPrice: 650 * ANNUAL_MONTHS_BILLED,
    needsFunction: true,
    features: [
      { title: '指定区域覆盖', desc: '在所选大区内访问全部匹配候选人档案' },
      { title: '1 个职能方向', desc: '聚焦单一领域：海运、空运、跨境电商物流、铁路/中欧班列、陆路运输、合同物流/3PL、仓储/海外仓或关务/合规' },
      { title: '完整简历查看', desc: '每订阅期 50 份候选人完整档案及联系方式' },
      { title: '主动沟通权限', desc: '每订阅期 30 位候选人；候选人主动联系不计入额度' },
      { title: '岗位发布 & AI 匹配', desc: '即时发布岗位并启动智能候选人匹配' },
      { title: '邀约 & 消息', desc: '与候选人一对一直接沟通' },
    ],
  },
  {
    id: 'china_all_functions',
    icon: Building2,
    name: '全职能方案',
    nameEn: 'ALL FUNCTIONS',
    monthlyPrice: 850,
    annualPrice: 850 * ANNUAL_MONTHS_BILLED,
    highlighted: true,
    badge: '推荐',
    needsFunction: false,
    features: [
      { title: '包含单职能方案全部功能', desc: null },
      { title: '全部职能方向', desc: '海运·空运·跨境电商物流·铁路/中欧班列·陆路运输·合同物流/3PL·仓储/海外仓·关务/合规，无需逐一选择' },
      { title: '完整简历查看', desc: '每订阅期 50 份候选人完整档案及联系方式' },
      { title: '主动沟通权限', desc: '每订阅期 30 位候选人；候选人主动联系不计入额度' },
      { title: '高级筛选过滤', desc: '多维度精准筛选，快速锁定理想候选人' },
      { title: '数据看板', desc: '实时掌握人才市场动态与职位表现数据' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n) {
  return '¥' + n.toLocaleString()
}

function isPlanCurrent(plan, sub) {
  return !!(sub?.is_active && sub.tier === plan.id)
}

// ─── BillingToggle — pill style matching reference image ──────────────────────
function BillingToggle({ annual, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: 'var(--t-bg-elevated)',
      border: '1px solid var(--t-border)',
      borderRadius: 9999, padding: 3,
    }}>
      {[
        { value: false, label: '月度' },
        { value: true,  label: '年度' },
      ].map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            height: 26, padding: '0 14px',
            borderRadius: 9999, border: 'none',
            fontFamily: 'var(--t-font-sans)', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.02em',
            background: opt.value === annual ? 'var(--t-bg-hover)' : 'transparent',
            color: opt.value === annual ? 'var(--t-text)' : 'var(--t-text-muted)',
            cursor: 'pointer',
            transition: 'background 150ms, color 150ms',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ─── RegionSelector ───────────────────────────────────────────────────────────
function RegionSelector({ value, onChange }) {
  const [hovered, setHovered] = useState(null)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {REGIONS.map(r => {
        const active = r.code === value
        const isHov = hovered === r.code
        return (
          <button
            key={r.code}
            type="button"
            onClick={() => onChange(r.code)}
            onMouseEnter={() => setHovered(r.code)}
            onMouseLeave={() => setHovered(null)}
            style={{
              height: 28, padding: '0 12px',
              display: 'flex', alignItems: 'center', gap: 5,
              borderRadius: 9999,
              border: `1px solid ${active ? 'var(--t-primary)' : isHov ? 'var(--t-border-focus)' : 'var(--t-border)'}`,
              background: active
                ? 'rgba(37,99,235,0.15)'
                : isHov ? 'var(--t-bg-hover)' : 'transparent',
              color: active ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)',
              fontFamily: 'var(--t-font-sans)', fontSize: 11, fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'border-color 120ms, background 120ms, color 120ms',
            }}
          >
            {r.label}
            {active && (
              <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{r.hint}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── FunctionDropdown ─────────────────────────────────────────────────────────
function FunctionDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const selected = FUNCTIONS.find(f => f.code === value)

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        onMouseEnter={() => !disabled && setHover(true)}
        onMouseLeave={() => !disabled && setHover(false)}
        style={{
          width: '100%', height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px',
          background: disabled ? 'transparent' : (hover || open ? 'rgba(37,99,235,0.08)' : 'var(--t-bg-input)'),
          border: `1px solid ${open ? 'var(--t-primary)' : hover ? 'var(--t-border-focus)' : 'var(--t-border)'}`,
          borderRadius: 'var(--t-radius-sm)',
          color: disabled ? 'var(--t-text-muted)' : 'var(--t-text)',
          fontFamily: 'var(--t-font-sans)', fontSize: 12,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'border-color 120ms, background 120ms',
        }}
      >
        <span>{selected ? selected.label : '选择职能方向...'}</span>
        <span style={{ fontSize: 10, color: 'var(--t-text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', display: 'inline-block' }}>▼</span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
            background: 'var(--t-bg-panel)', border: '1px solid var(--t-border)',
            borderRadius: 'var(--t-radius)', overflow: 'hidden',
          }}>
            {FUNCTIONS.map(f => (
              <div
                key={f.code}
                onClick={() => { onChange(f.code); setOpen(false) }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,99,235,0.1)' }}
                onMouseLeave={e => { e.currentTarget.style.background = f.code === value ? 'rgba(37,99,235,0.06)' : 'transparent' }}
                style={{
                  padding: '8px 12px', fontFamily: 'var(--t-font-sans)', fontSize: 12,
                  color: f.code === value ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--t-border-subtle)',
                  background: f.code === value ? 'rgba(37,99,235,0.06)' : 'transparent',
                }}
              >
                {f.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── FeatureItem ──────────────────────────────────────────────────────────────
function FeatureItem({ title, desc, highlight }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <CheckCircle2
        size={14}
        style={{ color: 'var(--t-success)', flexShrink: 0, marginTop: 2 }}
      />
      <div>
        <p style={{
          fontFamily: 'var(--t-font-sans)',
          fontSize: 12, fontWeight: 600,
          color: highlight ? 'var(--t-chart-blue)' : 'var(--t-text)',
          lineHeight: 1.4,
        }}>
          {title}
        </p>
        {desc && (
          <p style={{
            fontSize: 11, color: 'var(--t-text-muted)',
            lineHeight: 1.5, marginTop: 1,
          }}>
            {desc}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, annual, selectedFunction, onSelectFunction, onActivate, activating, subscription }) {
  const [hover, setHover] = useState(false)
  const [ctaHover, setCtaHover] = useState(false)
  const Icon = plan.icon
  const isCurrent = isPlanCurrent(plan, subscription)
  const isHL = !!plan.highlighted
  const canActivate = plan.needsFunction ? !!selectedFunction : true

  const price = annual ? plan.annualPrice : plan.monthlyPrice
  const saving = plan.monthlyPrice * 2

  const borderColor = isCurrent
    ? 'var(--t-success)'
    : isHL
    ? (hover ? 'var(--t-primary)' : 'rgba(37,99,235,0.5)')
    : (hover ? 'var(--t-border-focus)' : 'var(--t-border)')

  let ctaLabel = '立即订阅'
  if (isCurrent) ctaLabel = '当前方案'
  else if (plan.needsFunction && !selectedFunction) ctaLabel = '请先选择职能'

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, minWidth: 260, maxWidth: 520,
        background: isHL ? 'rgba(37,99,235,0.04)' : 'var(--t-bg-panel)',
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: '16px 18px 14px',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 150ms',
        position: 'relative',
      }}
    >
      {/* Badge */}
      {plan.badge && !isCurrent && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 10, fontFamily: 'var(--t-font-sans)', fontWeight: 700,
          color: '#fff', background: 'rgba(37,99,235,0.85)',
          borderRadius: 9999, padding: '2px 10px',
          letterSpacing: '0.04em',
        }}>
          {plan.badge}
        </div>
      )}
      {isCurrent && (
        <div style={{
          position: 'absolute', top: 14, right: 14,
          fontSize: 10, fontFamily: 'var(--t-font-sans)', fontWeight: 700,
          color: 'var(--t-success)', background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.35)',
          borderRadius: 9999, padding: '2px 10px',
          letterSpacing: '0.04em',
        }}>
          已订阅
        </div>
      )}

      {/* Plan name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <Icon size={13} style={{ color: isHL ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)' }} />
        <span style={{
          fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
          color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {plan.nameEn}
        </span>
      </div>
      <p style={{
        fontFamily: 'var(--t-font-sans)', fontSize: 18, fontWeight: 700,
        color: 'var(--t-text)', marginBottom: 10,
      }}>
        {plan.name}
      </p>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
        <span style={{
          fontFamily: 'var(--t-font-sans)', fontSize: 34, fontWeight: 800,
          color: 'var(--t-text)', lineHeight: 1,
        }}>
          {fmtPrice(price)}
        </span>
        <span style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
          {annual ? '/ 年' : '/ 月'}
        </span>
      </div>
      <p style={{
        fontSize: 11, color: annual ? 'var(--t-success)' : 'var(--t-text-muted)',
        marginBottom: 12, fontFamily: 'var(--t-font-sans)',
      }}>
        {annual
          ? `年度付款仅需 ${fmtPrice(plan.annualPrice)} · 节省 ${fmtPrice(saving)}（送 2 个月）`
          : `年度付款仅需 ${fmtPrice(plan.annualPrice)} · 节省 ${fmtPrice(saving)}`
        }
      </p>

      {/* Function selector for single-function plan */}
      {plan.needsFunction && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 4, fontFamily: 'var(--t-font-sans)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            选择职能方向
          </p>
          <FunctionDropdown
            value={selectedFunction}
            onChange={onSelectFunction}
            disabled={isCurrent || !!activating}
          />
        </div>
      )}

      {/* CTA */}
      {isCurrent ? (
        <div style={{
          height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 7, border: '1px solid var(--t-success)',
          background: 'rgba(34,197,94,0.08)',
          color: 'var(--t-success)', fontFamily: 'var(--t-font-sans)',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          marginBottom: 14,
        }}>
          <CheckCircle size={13} style={{ marginRight: 5 }} /> 当前方案
        </div>
      ) : (
        <button
          type="button"
          disabled={!!activating || !canActivate}
          onClick={() => canActivate && onActivate(plan)}
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={{
            height: 36, width: '100%', marginBottom: 14,
            borderRadius: 7, border: 'none',
            background: isHL
              ? (ctaHover ? '#1472e0' : 'var(--t-primary)')
              : (ctaHover ? 'rgba(37,99,235,0.12)' : 'var(--t-bg-elevated)'),
            color: isHL ? '#fff' : (ctaHover ? 'var(--t-chart-blue)' : 'var(--t-text-secondary)'),
            fontFamily: 'var(--t-font-sans)', fontSize: 12, fontWeight: 700,
            cursor: (activating || !canActivate) ? 'not-allowed' : 'pointer',
            opacity: activating && activating !== plan.id ? 0.4 : (!canActivate ? 0.5 : 1),
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'background 120ms, color 120ms',
          }}
        >
          {activating === plan.id && <Loader2 size={13} className="animate-spin" />}
          {ctaLabel}
        </button>
      )}

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--t-border-subtle)', marginBottom: 12 }} />

      {/* Feature list */}
      <p style={{
        fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700,
        color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
        marginBottom: 8,
      }}>
        包含功能：
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plan.features.map((f, i) => (
          <FeatureItem key={i} title={f.title} desc={f.desc} highlight={isHL && i === 0} />
        ))}
      </div>

      {/* Demo note */}
      <p style={{
        marginTop: 12, fontSize: 10, color: 'var(--t-text-muted)',
        fontFamily: 'var(--t-font-sans)', textAlign: 'center',
      }}>
        演示模式 · 即时激活
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TerminalPricing() {
  const navigate = useNavigate()

  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [activating, setActivating]     = useState(null)
  const [toast, setToast]               = useState(null)
  const [annual, setAnnual]             = useState(false)
  const [selectedFunction, setSelectedFunction] = useState('Sea')
  const [selectedRegion, setSelectedRegion]     = useState('GREAT_CHINA')

  useEffect(() => {
    subscriptionsApi.getMySubscription()
      .then(res => setSubscription(res.data.subscription))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleActivate(plan) {
    setActivating(plan.id)
    setToast(null)

    const payload = {
      plan_id: plan.id,
      billing_cycle: annual ? 'annual' : 'monthly',
      area_code: selectedRegion,
    }
    if (plan.needsFunction) {
      payload.function_codes = [selectedFunction]
    }

    try {
      const res = await subscriptionsApi.devActivate(payload)
      setSubscription(res.data.subscription)
      const regionLabel = REGIONS.find(r => r.code === selectedRegion)?.label ?? selectedRegion
      setToast({
        type: 'ok',
        text: `${plan.name} · ${regionLabel} ${annual ? '年度' : '月度'}订阅已激活（演示模式）`,
      })
    } catch (e) {
      setToast({ type: 'err', text: e.response?.data?.message ?? '激活失败，请重试' })
    } finally {
      setActivating(null)
    }
  }

  const hasActive = subscription?.is_active ?? false
  const currentTier = subscription?.tier ?? null
  const currentRegion = subscription?.business_area_codes?.[0] ?? null

  return (
    <TerminalLayout title="订阅方案" activeIconId="">
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>

        {/* Slim top strip */}
        <div style={{
          height: 40, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--t-border-subtle)',
          padding: '0 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {hasActive && (
              <span style={{
                fontSize: 10, fontFamily: 'var(--t-font-sans)', fontWeight: 700,
                color: 'var(--t-success)', background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 9999, padding: '1px 10px',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                已订阅 · {currentTier === 'china_function' ? '单职能' : '全职能'}
                {currentRegion && ` · ${REGIONS.find(r => r.code === currentRegion)?.label ?? currentRegion}`}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              fontFamily: 'var(--t-font-sans)', fontSize: 10,
              color: 'var(--t-text-muted)', background: 'none',
              border: '1px solid var(--t-border)',
              borderRadius: 'var(--t-radius-sm)', padding: '3px 10px', cursor: 'pointer',
              letterSpacing: '0.04em', textTransform: 'uppercase',
            }}
          >
            ← 返回
          </button>
        </div>

        {/* Scrollable body */}
        <div className="terminal-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── Page title row ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 12, marginBottom: 14,
          }}>
            <div>
              <h1 style={{
                fontFamily: 'var(--t-font-sans)', fontSize: 22, fontWeight: 700,
                color: 'var(--t-text)', marginBottom: 4, letterSpacing: '-0.01em',
              }}>
                订阅方案 & 价格
              </h1>
              <p style={{ fontSize: 12, color: 'var(--t-text-muted)' }}>
                每个账号须独立订阅，不可共享 · 超出额度可在辅助工具包中追购
              </p>
            </div>
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>

          {/* ── Toast ── */}
          {toast && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12, padding: '8px 14px',
              borderRadius: 8, fontSize: 12,
              background: toast.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              color: toast.type === 'ok' ? 'var(--t-success)' : 'var(--t-danger)',
            }}>
              {toast.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              {toast.text}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--t-text-muted)', fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" />加载中…
            </div>
          ) : (
            <>
              {/* ── Region selector ── */}
              <div style={{ marginBottom: 14 }}>
                <p style={{
                  fontFamily: 'var(--t-font-sans)', fontSize: 11, fontWeight: 700,
                  color: 'var(--t-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  选择覆盖区域
                </p>
                <RegionSelector value={selectedRegion} onChange={setSelectedRegion} />
              </div>

              {/* ── Plan cards ── */}
              <div style={{
                display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start',
                marginBottom: 14,
              }}>
                {PLANS.map(plan => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    annual={annual}
                    selectedFunction={selectedFunction}
                    onSelectFunction={setSelectedFunction}
                    onActivate={handleActivate}
                    activating={activating}
                    subscription={subscription}
                  />
                ))}
              </div>

              {/* ── Per-account note ── */}
              <div style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(245,158,11,0.25)',
                background: 'rgba(245,158,11,0.05)',
                display: 'flex', alignItems: 'flex-start', gap: 8,
                maxWidth: 860,
              }}>
                <Info size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 11, color: 'var(--t-text-secondary)', lineHeight: 1.6 }}>
                  <strong style={{ color: 'var(--t-text)' }}>配额说明：</strong>
                  每订阅期支持查看 50 份完整候选人档案及 30 位候选人主动沟通（候选人发起联系不计入）。
                  超出后可前往 <span style={{ color: '#f59e0b' }}>辅助工具包</span> 追购额度。
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </TerminalLayout>
  )
}
