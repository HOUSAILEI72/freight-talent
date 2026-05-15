import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Briefcase, Clock, Search, X,
  Loader2, FolderOpen, AlertCircle,
  GraduationCap, Users, Zap, PlusCircle,
  UserSearch, UsersRound, FileText,
} from 'lucide-react'
import { jobsApi } from '../../api/jobs'
import { applicationsApi } from '../../api/applications'
import { headhuntingApi } from '../../api/headhunting'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'
import RegionSelector from '../../components/RegionSelector'
import Pagination from '../../components/ui/Pagination'
import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { JobsRail } from './JobsRail'

const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')


// ── helpers ──────────────────────────────────────────────────────────────────
const COMMISSION_BONUS_PERIODS = [
  { value: 'not_applicable', label: '不适用' },
  { value: 'monthly',        label: '月度' },
  { value: 'quarterly',      label: '季度' },
  { value: 'semi_annual',    label: '半年度' },
]
function splitTokens(str) {
  if (!str) return []
  // Handle arrays directly (e.g. knowledge_requirements from backend)
  if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean)
  const parts = String(str).split(/[,，、\n\r;；]+/).map(s => s.trim()).filter(Boolean)
  const seen = new Set(); const out = []
  for (const p of parts) { if (!seen.has(p)) { seen.add(p); out.push(p) } }
  return out
}
function formatThousand(val) {
  if (!val) return ''
  const n = parseInt(String(val).replace(/,/g, ''), 10)
  return Number.isNaN(n) ? String(val) : n.toLocaleString('en-US')
}

// ── read-only field sub-components ───────────────────────────────────────────
const LABEL_STYLE = { color: 'var(--t-text-secondary)', fontSize: 11, fontWeight: 500, display: 'block', marginBottom: 3 }
const BOX_STYLE = {
  background: 'var(--t-bg-input)',
  border: '1px solid var(--t-border)',
  color: 'var(--t-text)',
  borderRadius: 'var(--t-radius)',
  padding: '6px 10px',
  fontSize: 13,
  lineHeight: 1.45,
  minHeight: 30,
}

function ReadField({ label, value, empty = '—' }) {
  const display = (value === null || value === undefined || value === '') ? empty : value
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div style={{ ...BOX_STYLE, color: display === empty ? 'var(--t-text-muted)' : 'var(--t-text)' }}>
        {display}
      </div>
    </div>
  )
}

function ReadChips({ label, value, empty = '—' }) {
  const tokens = Array.isArray(value)
    ? value.map(s => String(s).trim()).filter(Boolean)
    : splitTokens(value)
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      {tokens.length === 0 ? (
        <div style={{ ...BOX_STYLE, color: 'var(--t-text-muted)' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingTop: 2 }}>
          {tokens.map((t, i) => (
            <span
              key={i}
              style={{
                padding: '3px 9px', fontSize: 11, borderRadius: 'var(--t-radius-sm)',
                background: 'var(--t-bg-elevated)',
                border: '1px solid var(--t-border)',
                color: 'var(--t-text-secondary)',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function ReadTextarea({ label, value, empty = '—' }) {
  const display = (value === null || value === undefined || value === '') ? empty : value
  return (
    <div>
      <span style={LABEL_STYLE}>{label}</span>
      <div
        style={{
          ...BOX_STYLE,
          whiteSpace: 'pre-line',
          minHeight: 140,
          color: display === empty ? 'var(--t-text-muted)' : 'var(--t-text)',
        }}
      >
        {display}
      </div>
    </div>
  )
}

// ── headhunting read-only detail panels ──────────────────────────────────────

function fmtCNY(n) {
  if (!n && n !== 0) return '—'
  return `¥${Number(n).toLocaleString('zh-CN')}`
}

function StatusBadge({ status }) {
  const label = status === 'submitted' ? '已提交' : status === 'in_progress' ? '处理中' : status === 'completed' ? '已完成' : status ?? '—'
  const color = status === 'submitted' ? 'var(--t-chart-blue)'
    : status === 'in_progress' ? 'var(--t-chart-yellow)'
    : status === 'completed' ? 'var(--t-success)'
    : 'var(--t-text-muted)'
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 'var(--t-radius-sm)',
      border: `1px solid ${color}`, color, background: 'transparent',
    }}>
      {label}
    </span>
  )
}

function PersonalHdDetail({ req }) {
  if (!req) return null
  const job = req.job_payload || {}
  const addOns = req.add_ons_payload || {}
  const fee = req.fee_snapshot || {}

  const cardClass = 'p-4 space-y-3 rounded-[var(--t-radius-lg)] border flex flex-col min-h-0'
  const cardStyle = { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
  const secTitleClass = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] mb-1 flex-shrink-0'
  const secTitleStyle = { color: 'var(--t-text-muted)' }

  return (
    <div
      className="terminal-mode flex-1 min-h-0 overflow-y-auto terminal-scrollbar flex flex-col px-6 py-5"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <UserSearch size={14} style={{ color: 'var(--t-primary)', flexShrink: 0 }} />
            <h1 className="text-base font-semibold truncate" style={{ color: 'var(--t-text)' }}>
              个人猎头服务
            </h1>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            {job.title ? `岗位：${job.title}` : '—'}
            {req.created_at ? ` · 提交于 ${req.created_at.slice(0, 10)}` : ''}
          </p>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="terminal-form-grid-3 flex-1 min-h-0">

        {/* Col 1: 岗位基础信息 + 薪酬 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 岗位信息</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <ReadField label="岗位名称" value={job.title} />
            <ReadField label="岗位板块" value={job.function_name || job.function_code} />
            <ReadField label="岗位城市" value={job.location_path || job.location_name || job.location_code} />
            <ReadField label="详细地址" value={job.address} />
            <ReadField label="应聘类型" value={job.employment_type} />
            <ReadField label="经验要求" value={job.experience_required} />
            <ReadField label="学历要求" value={job.degree_required} />
            {job.is_management_role && (
              <ReadField label="管理人数" value={job.management_headcount ? `${job.management_headcount} 人` : '管理岗'} />
            )}
            <div className="grid grid-cols-2 gap-3">
              <ReadField label="最低月薪" value={job.salary_min ? `¥${Number(job.salary_min).toLocaleString()}` : null} />
              <ReadField label="最高月薪" value={job.salary_max ? `¥${Number(job.salary_max).toLocaleString()}` : null} />
            </div>
            <ReadField label="薪资月数" value={job.salary_months ? `${job.salary_months} 个月` : null} />
            {job.commission_bonus_period && job.commission_bonus_period !== 'not_applicable' && (
              <ReadField
                label="佣金奖金周期"
                value={COMMISSION_BONUS_PERIODS.find(o => o.value === job.commission_bonus_period)?.label ?? job.commission_bonus_period}
              />
            )}
            {job.commission_bonus_amount > 0 && (
              <ReadField label="佣金奖金金额" value={`¥${Number(job.commission_bonus_amount).toLocaleString()}`} />
            )}
            {job.has_year_end_bonus && (
              <ReadField label="年终奖" value={job.year_end_bonus_months ? `${job.year_end_bonus_months} 个月` : '有'} />
            )}
          </div>
        </div>

        {/* Col 2: 岗位职责 + 技能要求 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><FileText size={11} /> 职责 &amp; 技能</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <ReadTextarea label="岗位职责" value={job.description} />
            <ReadChips label="知识要求" value={splitTokens(job.knowledge_requirements)} />
            <ReadChips label="硬技能要求" value={splitTokens(job.hard_skill_requirements)} />
            <ReadChips label="软技能要求" value={splitTokens(job.soft_skill_requirements)} />
            {job.target_companies && job.target_companies.length > 0 && (
              <ReadChips label="目标公司" value={Array.isArray(job.target_companies) ? job.target_companies : splitTokens(job.target_companies)} />
            )}
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 10 }}>
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--t-text-muted)' }}>增值服务</div>
              <div className="space-y-1">
                {addOns.accelerated && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 加速通道（+5% 服务费）</div>}
                {addOns.background_check && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 背景调查 × {addOns.background_check_count ?? 1}（¥3,500/人）</div>}
                {addOns.personality_report && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 性格测评 × {addOns.personality_report_count ?? 1}（¥800/人）</div>}
                {!addOns.accelerated && !addOns.background_check && !addOns.personality_report && (
                  <div className="text-xs" style={{ color: 'var(--t-text-muted)' }}>无增值服务</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Col 3: 费用快照 + 联系方式 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 费用快照 &amp; 联系人</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            {(fee.feeLow != null || fee.minFee != null) ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <ReadField label="服务费（低估）" value={fmtCNY(fee.feeLow ?? fee.minFee)} />
                  <ReadField label="服务费（高估）" value={fmtCNY(fee.feeHigh ?? fee.maxFee)} />
                </div>
                {(fee.addonFee ?? 0) > 0 && <ReadField label="增值服务费" value={fmtCNY(fee.addonFee)} />}
                <div className="grid grid-cols-2 gap-3">
                  <ReadField label="合计（低）" value={fmtCNY(fee.totalLow ?? fee.totalMin ?? fee.feeLow ?? fee.minFee)} />
                  <ReadField label="合计（高）" value={fmtCNY(fee.totalHigh ?? fee.totalMax ?? fee.feeHigh ?? fee.maxFee)} />
                </div>
                {fee.typeLabel && <ReadField label="服务类型" value={`${fee.typeLabel} 类`} />}
                {fee.guaranteeLabel && <ReadField label="保证期" value={fee.guaranteeLabel} />}
              </>
            ) : (
              <div className="text-xs" style={{ color: 'var(--t-text-muted)' }}>费用快照不可用</div>
            )}
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 10 }} />
            <ReadField label="联系人" value={req.contact_name} />
            <ReadField label="手机" value={req.contact_phone} />
            <ReadField label="邮箱" value={req.contact_email} />
            {req.contact_wechat && <ReadField label="微信" value={req.contact_wechat} />}
          </div>
        </div>

      </div>
    </div>
  )
}

function TeamHdDetail({ req }) {
  if (!req) return null
  const team = req.job_payload || {}
  const addOns = req.add_ons_payload || {}
  const fee = req.fee_snapshot || {}

  const cardClass = 'p-4 space-y-3 rounded-[var(--t-radius-lg)] border flex flex-col min-h-0'
  const cardStyle = { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
  const secTitleClass = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] mb-1 flex-shrink-0'
  const secTitleStyle = { color: 'var(--t-text-muted)' }

  const preferredCities = Array.isArray(team.preferred_cities) ? team.preferred_cities : []
  const businessFocus = Array.isArray(team.business_focus) ? team.business_focus : splitTokens(team.business_focus)

  return (
    <div
      className="terminal-mode flex-1 min-h-0 overflow-y-auto terminal-scrollbar flex flex-col px-6 py-5"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <UsersRound size={14} style={{ color: 'var(--t-primary)', flexShrink: 0 }} />
            <h1 className="text-base font-semibold truncate" style={{ color: 'var(--t-text)' }}>
              团队猎头服务
            </h1>
            <StatusBadge status={req.status} />
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
            {team.summary ? `需求：${String(team.summary).slice(0, 40)}…` : '—'}
            {req.created_at ? ` · 提交于 ${req.created_at.slice(0, 10)}` : ''}
          </p>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="terminal-form-grid-3 flex-1 min-h-0">

        {/* Col 1: 需求简述 + 城市偏向 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><UsersRound size={11} /> 团队需求</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <ReadTextarea label="需求简述" value={team.summary} />
            <div>
              <span style={LABEL_STYLE}>所在城市偏向</span>
              {preferredCities.length === 0 ? (
                <div style={{ ...BOX_STYLE, color: 'var(--t-text-muted)' }}>—</div>
              ) : (
                <div className="space-y-1.5">
                  {preferredCities.map((c, i) => {
                    const loc = typeof c === 'object' ? (c.location_path || c.location_name || c.location_code) : String(c)
                    const addr = typeof c === 'object' ? c.address : null
                    return (
                      <div key={i} style={{ ...BOX_STYLE, fontSize: 12 }}>
                        {loc || '—'}{addr ? ` · ${addr}` : ''}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Col 2: 业务侧重 + 其他偏好 + 增值服务 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 偏好 &amp; 增值服务</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            <ReadChips label="业务侧重" value={businessFocus} />
            <ReadField label="希望到岗时间" value={team.expected_onboard_time} />
            <ReadField label="团队规模" value={team.team_size} />
            <ReadField label="年龄偏好" value={team.age_preference} />
            <ReadTextarea label="背景偏好" value={team.background_preference} />
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 10 }}>
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--t-text-muted)' }}>增值服务</div>
              <div className="space-y-1">
                {addOns.accelerated && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 加速通道</div>}
                {addOns.leader_background_check && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 领导层背景调查 × {addOns.leader_background_check_count ?? 1}（¥3,500/人）</div>}
                {addOns.member_background_check && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 成员背景调查 × {addOns.member_background_check_count ?? 1}（¥1,800/人）</div>}
                {addOns.member_personality_report && <div className="text-xs" style={{ color: 'var(--t-text)' }}>✓ 成员性格测评 × {addOns.member_personality_report_count ?? 1}（¥800/人）</div>}
                {!addOns.accelerated && !addOns.leader_background_check && !addOns.member_background_check && !addOns.member_personality_report && (
                  <div className="text-xs" style={{ color: 'var(--t-text-muted)' }}>无增值服务</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Col 3: 费用快照 + 联系方式 */}
        <div className={cardClass} style={cardStyle}>
          <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 费用快照 &amp; 联系人</div>
          <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
            {fee.baseTotal != null && (
              <>
                <ReadField label="服务费总额" value={fmtCNY(fee.baseTotal)} />
                <ReadField label="月付金额" value={fmtCNY(fee.monthlyFee)} />
                <ReadField label="支付周期" value={fee.months ? `${fee.months} 个月` : null} />
                {fee.addonFee > 0 && <ReadField label="增值服务费" value={fmtCNY(fee.addonFee)} />}
                {fee.total != null && <ReadField label="合计" value={fmtCNY(fee.total)} />}
              </>
            )}
            {fee.baseTotal == null && <div className="text-xs" style={{ color: 'var(--t-text-muted)' }}>费用快照不可用</div>}
            <div style={{ borderTop: '1px solid var(--t-border-subtle)', paddingTop: 10 }} />
            <ReadField label="联系人" value={req.contact_name} />
            <ReadField label="手机" value={req.contact_phone} />
            <ReadField label="邮箱" value={req.contact_email} />
            {req.contact_wechat && <ReadField label="微信" value={req.contact_wechat} />}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── headhunting request list item ─────────────────────────────────────────────
function HdRequestRow({ req, selected, onSelect, serviceType }) {
  const isPersonal = serviceType === 'personal_headhunt'
  const job = req.job_payload || {}
  const title = isPersonal ? (job.title || '未命名岗位') : (String(job.summary || '').slice(0, 30) || '团队需求')
  const isSelected = selected?.id === req.id

  return (
    <div
      onClick={() => onSelect(req)}
      style={{
        padding: '12px 16px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--t-border-subtle)',
        borderLeft: `4px solid ${isSelected ? 'var(--t-primary)' : 'transparent'}`,
        background: isSelected ? 'var(--t-bg-active)' : 'transparent',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{ fontFamily: 'var(--t-font-sans)', fontSize: 12, fontWeight: 600, color: 'var(--t-text)', marginBottom: 3 }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <StatusBadge status={req.status} />
        {req.created_at && (
          <span style={{ fontSize: 10, color: 'var(--t-text-muted)' }}>{req.created_at.slice(0, 10)}</span>
        )}
      </div>
    </div>
  )
}


function JobDetailPanel({ job, terminal = false, canManage = false, onStatusChange }) {
  const tagsByCat = job.tags_by_category || {}
  const baseLocation =
    job.location_path ||
    [job.province, job.city_name, job.district].filter(Boolean).join(' · ') ||
    job.location_name ||
    job.city ||
    '—'
  const fullLocation = job.address ? `${baseLocation} · ${job.address}` : baseLocation

  if (terminal) {
    const commissionLabel = COMMISSION_BONUS_PERIODS.find(p => p.value === job.commission_bonus_period)?.label ?? job.commission_bonus_period ?? '—'
    const tagsByCat = job.tags_by_category || {}
    const allTags = Object.values(tagsByCat).flat()
    const isClosed = job.status === 'closed'

    // PostJob-matching style tokens
    const cardClass = 'p-4 space-y-3 rounded-[var(--t-radius-lg)] border flex flex-col min-h-0'
    const cardStyle = { background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }
    const secTitleClass = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.04em] mb-1 flex-shrink-0'
    const secTitleStyle = { color: 'var(--t-text-muted)' }

    return (
      <div
        className="terminal-mode flex-1 min-h-0 overflow-y-auto terminal-scrollbar flex flex-col px-6 py-5"
        style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
      >
        {/* Header row */}
        <div className="flex items-start justify-between mb-3 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold truncate" style={{ color: 'var(--t-text)' }}>{job.title}</h1>
              {isClosed && (
                <span style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  padding: '2px 7px', borderRadius: 'var(--t-radius-sm)',
                  background: 'var(--t-danger-muted)', color: 'var(--t-danger)',
                  border: '1px solid var(--t-danger)', textTransform: 'uppercase',
                }}>
                  CLOSED
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--t-text-muted)' }}>
              {job.company_name ?? '—'}
              {job.created_at ? ` · 发布于 ${job.created_at.slice(0, 10)}` : ''}
            </p>
            {(job.salary_min || job.salary_max) && (
              <p className="text-xs mt-1 font-semibold" style={{ color: 'var(--t-primary)' }}>
                ¥ {formatThousand(job.salary_min) || '?'} – {formatThousand(job.salary_max) || '?'} / 月
                {job.salary_months ? `  ·  ${job.salary_months} 个月` : ''}
              </p>
            )}
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => onStatusChange?.(job, isClosed ? 'published' : 'closed')}
              style={{
                flexShrink: 0, marginLeft: 12,
                padding: '5px 14px', fontSize: 12, fontWeight: 600,
                borderRadius: 'var(--t-radius-sm)', cursor: 'pointer',
                border: isClosed
                  ? '1px solid var(--t-success)'
                  : '1px solid var(--t-danger)',
                color: isClosed ? 'var(--t-success)' : 'var(--t-danger)',
                background: isClosed ? 'var(--t-success-muted)' : 'var(--t-danger-muted)',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.opacity = '0.8'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              {isClosed ? '重新发布' : '关闭岗位'}
            </button>
          )}
        </div>

        {/* 3-column grid — same proportions as PostJob */}
        <div className="terminal-form-grid-3 flex-1 min-h-0">

          {/* ── Col 1: 基本信息 ── */}
          <div className={cardClass} style={cardStyle}>
            <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 基本信息</div>
            <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
              <ReadField label="岗位名称" value={job.title} />
              <ReadField label="岗位板块" value={job.function_name ?? job.business_type} />
              <ReadField label="经验要求" value={job.experience_required} />
              <ReadField label="最低学历要求" value={job.degree_required} />
              <ReadField label="是否带团队" value={job.is_management_role == null ? null : job.is_management_role ? '是' : '否'} />
              {job.is_management_role && (
                <ReadField label="预计团队人数" value={job.management_headcount ? String(job.management_headcount) : null} />
              )}
              <ReadField label="应聘类型" value={job.employment_type} />
              <ReadField label="岗位工作城市" value={
                job.location_path ||
                [job.province, job.city_name, job.district].filter(Boolean).join(' · ') ||
                job.location_name || job.city
              } />
              <ReadField label="详细地址" value={job.address} />
              {allTags.length > 0 && (
                <ReadChips label="标签" value={allTags} />
              )}
            </div>
          </div>

          {/* ── Col 2: 岗位描述 ── */}
          <div className={cardClass} style={cardStyle}>
            <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 岗位描述</div>
            <div className="flex flex-col flex-1 min-h-0 space-y-3 overflow-y-auto terminal-scrollbar pr-1">
              <ReadTextarea label="岗位职责" value={job.description} />
              <ReadChips label="知识" value={job.knowledge_requirements} />
              <ReadChips label="硬技能" value={job.hard_skill_requirements} />
              <ReadChips label="软技能" value={job.soft_skill_requirements} />
            </div>
          </div>

          {/* ── Col 3: 薪酬福利 ── */}
          <div className={cardClass} style={cardStyle}>
            <div className={secTitleClass} style={secTitleStyle}><Briefcase size={11} /> 薪酬福利</div>
            <div className="overflow-y-auto terminal-scrollbar flex-1 min-h-0 space-y-3 pr-1">
              {/* Salary: 3 cells in one row — same as PostJob fieldSalaryRange */}
              <div className="grid grid-cols-3 gap-3">
                <ReadField label="最低月薪" value={formatThousand(job.salary_min)} />
                <ReadField label="最高月薪" value={formatThousand(job.salary_max)} />
                <ReadField label="薪资月数" value={job.salary_months ? `${job.salary_months} 个月` : null} />
              </div>
              {/* Commission: 2 cells in one row — same as PostJob fieldCommission */}
              <div className="grid grid-cols-2 gap-3">
                <ReadField label="提成/计件奖金" value={commissionLabel} />
                <ReadField label="预估平均额" value={
                  job.commission_bonus_period === 'not_applicable' ? '—'
                  : job.commission_bonus_amount ? `${formatThousand(job.commission_bonus_amount)}` : null
                } />
              </div>
              <ReadField
                label="是否有年终奖"
                value={job.has_year_end_bonus == null ? null : job.has_year_end_bonus ? '是' : '否'}
              />
              {job.has_year_end_bonus && (
                <ReadField
                  label="年终奖预估平均额"
                  value={job.year_end_bonus_months ? `${job.year_end_bonus_months} 个月` : null}
                />
              )}
            </div>
          </div>

        </div>
      </div>
    )
  }

  // ── non-terminal (light) branch ───────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
          {(job.company_name ?? job.title ?? '?')[0]}
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">{job.title}</h2>
          <p className="text-sm text-slate-500 mt-0.5">{job.company_name ?? '—'} · {fullLocation}</p>
          <p className="text-base font-bold text-blue-600 mt-1">{job.salary_label ?? '面议'}</p>
        </div>
      </div>

      {/* 基本信息格 */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: MapPin,        label: '工作地点', value: fullLocation },
          { icon: Briefcase,     label: '薪资范围', value: job.salary_label ?? '面议' },
          { icon: Clock,         label: '经验要求', value: job.experience_required ?? '不限' },
          { icon: GraduationCap, label: '最低学历', value: job.degree_required ?? '不限' },
          { icon: Users, label: '管理属性', value: job.is_management_role ? `管理岗${job.management_headcount ? ` · ${job.management_headcount} 人` : ''}` : '非管理岗' },
          { icon: Users, label: '招聘人数', value: job.headcount ? `${job.headcount} 人` : '—' },
          { icon: Zap,   label: '紧急程度', value: job.urgency_level === 1 ? '紧急' : job.urgency_level === 3 ? '不急' : '正常' },
          { icon: Briefcase, label: '应聘类型', value: job.employment_type ?? '—' },
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

      {/* 标签 */}
      {Object.keys(tagsByCat).length > 0 && (
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-2">标签</p>
          <div className="space-y-2">
            {Object.entries(tagsByCat).map(([cat, names]) => (
              <div key={cat}>
                <p className="text-xs text-slate-400 mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <span key={i} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full">{n}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
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

      <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
        发布于 {job.created_at?.slice(0, 10) ?? '—'}
      </p>
    </div>
  )
}


// ── 主页面 ────────────────────────────────────────────────────────────────────
export default function JobMarketplace({ terminal = false, showNewJobButton = false, canApply = false }) {
  const navigate = useNavigate()
  const [jobs, setJobs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState(null)

  const [q, setQ]                 = useState('')
  const [location, setLocation]   = useState(null)  // RegionSelector value
  const [functionCode, setFunctionCode] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [savedFilter, setSavedFilter] = useState('all')
  const [appliedFilter, setAppliedFilter] = useState('all')

  // Jobs rail tab (terminal + employer only)
  const [jobsTab, setJobsTab] = useState('all')
  const [hdRequests, setHdRequests] = useState([])
  const [hdLoading, setHdLoading] = useState(false)
  const [selectedHd, setSelectedHd] = useState(null)

  // CAND-4 — Maps of jobId → applicationId (only used when canApply=true).
  // Using Map instead of Set so we can call the withdraw endpoint by app id.
  const [appliedJobMap, setAppliedJobMap] = useState(new Map()) // jobId → appId
  const [savedJobMap,   setSavedJobMap]   = useState(new Map()) // jobId → appId
  const [applyingJobId, setApplyingJobId] = useState(null)
  const [savingJobId,   setSavingJobId]   = useState(null)
  const [applyError,    setApplyError]    = useState('')
  const [page, setPage]                   = useState(1)
  const [totalPages, setTotalPages]       = useState(1)
  const [total, setTotal]                 = useState(0)
  const lastFiltersRef                    = useRef({})

  // Derived sets for quick membership checks (used in render)
  const appliedJobIds = useMemo(() => new Set(appliedJobMap.keys()), [appliedJobMap])
  const savedJobIds   = useMemo(() => new Set(savedJobMap.keys()),   [savedJobMap])

  function handleStatusChange(job, newStatus) {
    jobsApi.updateStatus(job.id, newStatus)
      .then(res => {
        const updated = res.data.job
        setJobs(prev => prev.map(j => j.id === updated.id ? { ...j, status: updated.status } : j))
        setSelected(prev => prev?.id === updated.id ? { ...prev, status: updated.status } : prev)
      })
      .catch(() => {})
  }

  function fetchJobs(filters, targetPage = 1) {
    setLoading(true)
    setError('')
    jobsApi.getPublicJobs({ ...filters, page: targetPage, page_size: 20 })
      .then(res => {
        const list = res.data.jobs
        setJobs(list)
        setPage(res.data.page ?? targetPage)
        setTotalPages(res.data.total_pages ?? 1)
        setTotal(res.data.total ?? 0)
        if (list.length > 0 && !selected) setSelected(list[0])
      })
      .catch(err => setError(err.response?.data?.message ?? '加载岗位失败，请刷新重试'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchJobs({}, 1) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch headhunting requests when in headhunting tabs (terminal + employer only)
  useEffect(() => {
    if (!terminal || !showNewJobButton) return
    if (jobsTab !== 'personal_headhunt' && jobsTab !== 'team_headhunt') return
    const svcType = jobsTab === 'personal_headhunt' ? 'personal' : 'team'
    let alive = true
    setHdLoading(true)
    setSelectedHd(null)
    headhuntingApi.getMyRequests(svcType)
      .then(res => {
        if (!alive) return
        const list = res.data.requests ?? []
        setHdRequests(list)
        if (list.length > 0) setSelectedHd(list[0])
      })
      .catch(() => { if (alive) setHdRequests([]) })
      .finally(() => { if (alive) setHdLoading(false) })
    return () => { alive = false }
  }, [terminal, showNewJobButton, jobsTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // CAND-4: hydrate jobId→appId maps on mount so button state survives refresh.
  useEffect(() => {
    if (!canApply) return
    let cancelled = false
    applicationsApi.getMyApplications()
      .then(res => {
        if (cancelled) return
        const applied = new Map()
        const saved   = new Map()
        for (const a of (res.data?.applications ?? [])) {
          if (!a) continue
          if (a.status === 'saved') {
            saved.set(a.job_id, a.id)
          } else if (!['withdrawn'].includes(a.status)) {
            applied.set(a.job_id, a.id)
          }
        }
        setAppliedJobMap(applied)
        setSavedJobMap(saved)
      })
      .catch(() => { /* silent */ })
    return () => { cancelled = true }
  }, [canApply])

  const visibleJobs = useMemo(() => {
    if (!canApply) return jobs
    return jobs.filter(job => {
      const isSaved = savedJobIds.has(job.id)
      const isApplied = appliedJobIds.has(job.id)
      if (savedFilter === 'saved' && !isSaved) return false
      if (savedFilter === 'unsaved' && isSaved) return false
      if (appliedFilter === 'applied' && !isApplied) return false
      if (appliedFilter === 'unapplied' && isApplied) return false
      return true
    })
  }, [appliedFilter, appliedJobIds, canApply, jobs, savedFilter, savedJobIds])

  useEffect(() => {
    if (loading || error) return
    if (visibleJobs.length === 0) {
      if (selected) setSelected(null)
      return
    }
    if (!selected || !visibleJobs.some(job => job.id === selected.id)) {
      setSelected(visibleJobs[0])
    }
  }, [error, loading, selected, visibleJobs])

  async function handleApply(job) {
    if (!job || !canApply) return
    setApplyError('')

    // Toggle: already applied → withdraw
    if (appliedJobIds.has(job.id)) {
      const appId = appliedJobMap.get(job.id)
      if (!appId || applyingJobId === job.id) return
      setApplyingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setAppliedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      } catch (err) {
        setApplyError(err.response?.data?.message ?? '撤回失败，请重试')
      } finally {
        setApplyingJobId(null)
      }
      return
    }

    if (applyingJobId === job.id) return
    setApplyingJobId(job.id)
    try {
      const res = await applicationsApi.applyToJob(job.id)
      const a = res.data?.application
      if (a && a.status !== 'withdrawn') {
        setAppliedJobMap(prev => { const next = new Map(prev); next.set(job.id, a.id); return next })
        setSavedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      }
    } catch (err) {
      const code   = err.response?.data?.error_code
      const status = err.response?.status
      if (status === 422 && code === 'profile_incomplete') {
        navigate('/candidate/tags')
        return
      }
      setApplyError(err.response?.data?.message ?? '投递失败，请重试')
    } finally {
      setApplyingJobId(null)
    }
  }

  async function handleSave(job) {
    if (!job || !canApply) return
    setApplyError('')

    // Toggle: already saved → withdraw (cancel save)
    if (savedJobIds.has(job.id)) {
      const appId = savedJobMap.get(job.id)
      if (!appId || savingJobId === job.id) return
      setSavingJobId(job.id)
      try {
        await applicationsApi.updateApplicationStatus(appId, 'withdrawn')
        setSavedJobMap(prev => { const next = new Map(prev); next.delete(job.id); return next })
      } catch (err) {
        setApplyError(err.response?.data?.message ?? '取消收藏失败，请重试')
      } finally {
        setSavingJobId(null)
      }
      return
    }

    if (savingJobId === job.id) return
    setSavingJobId(job.id)
    try {
      const res = await applicationsApi.saveJob(job.id)
      const a = res.data?.application
      if (a?.status === 'saved') {
        setSavedJobMap(prev => { const next = new Map(prev); next.set(job.id, a.id); return next })
      } else if (a && a.status !== 'withdrawn') {
        setAppliedJobMap(prev => { const next = new Map(prev); next.set(job.id, a.id); return next })
      }
    } catch (err) {
      const code    = err.response?.data?.error_code
      const status  = err.response?.status
      const missing = err.response?.data?.missing ?? []
      if (status === 422 && code === 'profile_incomplete') {
        navigate(missing.includes('profile') ? '/candidate/profile/builder' : '/candidate/tags')
        return
      }
      setApplyError(err.response?.data?.message ?? '收藏失败，请重试')
    } finally {
      setSavingJobId(null)
    }
  }

  function buildFilters(nextLocation = location, nextQ = q, nextFn = functionCode, nextEt = employmentType) {
    return {
      ...(nextQ ? { q: nextQ } : {}),
      ...(nextLocation?.location_code ? { location_code: nextLocation.location_code } : {}),
      ...(nextFn ? { function_code: nextFn } : {}),
      ...(nextEt ? { employment_type: nextEt } : {}),
    }
  }

  function handleSearch(e) {
    e.preventDefault()
    setSelected(null)
    const f = buildFilters()
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handleReset() {
    setQ(''); setLocation(null); setFunctionCode(''); setEmploymentType(''); setSavedFilter('all'); setAppliedFilter('all')
    setSelected(null)
    lastFiltersRef.current = {}
    fetchJobs({}, 1)
  }

  function handleLocationChange(loc) {
    setLocation(loc)
    setSelected(null)
    const f = buildFilters(loc, q, functionCode)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handleFunctionChange(code) {
    setFunctionCode(code)
    setSelected(null)
    const f = buildFilters(location, q, code, employmentType)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handleEmploymentTypeChange(et) {
    setEmploymentType(et)
    setSelected(null)
    const f = buildFilters(location, q, functionCode, et)
    lastFiltersRef.current = f
    fetchJobs(f, 1)
  }

  function handlePageChange(p) {
    setSelected(null)
    fetchJobs(lastFiltersRef.current, p)
  }

  const hasStatusFilter = canApply && (savedFilter !== 'all' || appliedFilter !== 'all')
  const hasFilter = q || !!location?.location_code || !!functionCode || !!employmentType || hasStatusFilter

  // ── headhunting tab render ───────────────────────────────────────────────────
  const isHdTab = terminal && showNewJobButton && (jobsTab === 'personal_headhunt' || jobsTab === 'team_headhunt')

  const hdInner = isHdTab && (
    <>
      {/* Left: request list */}
      <div
        style={{
          width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)',
        }}
      >
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--t-border-subtle)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--t-font-sans)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--t-text-muted)', lineHeight: 1.4 }}>
              {jobsTab === 'personal_headhunt' ? '个人猎头服务' : '团队猎头服务'}
            </div>
            <button
              type="button"
              onClick={() => navigate(jobsTab === 'personal_headhunt' ? '/employer/headhunting/personal' : '/employer/headhunting/team')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                height: 22, padding: '0 8px', borderRadius: 'var(--t-radius-sm)',
                border: '1px solid var(--t-primary)', background: 'var(--t-primary)',
                color: '#fff', fontFamily: 'var(--t-font-sans)', fontSize: 10,
                fontWeight: 600, cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              <PlusCircle size={10} />
              提交需求
            </button>
          </div>
          <div style={{ fontFamily: 'var(--t-font-sans)', fontSize: 10, color: 'var(--t-text-muted)', lineHeight: 1.4 }}>
            {hdLoading ? '加载中…' : `共 ${hdRequests.length} 条需求`}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }} className="terminal-scrollbar">
          {hdLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '32px 16px', color: 'var(--t-text-muted)' }}>
              <Loader2 size={14} className="animate-spin" />
              <span style={{ fontSize: 12 }}>加载中…</span>
            </div>
          )}
          {!hdLoading && hdRequests.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', color: 'var(--t-text-muted)' }}>
              <FolderOpen size={24} style={{ marginBottom: 8 }} />
              <span style={{ fontSize: 12 }}>暂无提交记录</span>
              <button
                type="button"
                onClick={() => navigate(jobsTab === 'personal_headhunt' ? '/employer/headhunting/personal' : '/employer/headhunting/team')}
                style={{
                  marginTop: 12, fontSize: 11, fontWeight: 600, padding: '5px 12px',
                  borderRadius: 'var(--t-radius-sm)', cursor: 'pointer',
                  border: '1px solid var(--t-primary)', color: 'var(--t-primary)', background: 'transparent',
                }}
              >
                立即提交需求
              </button>
            </div>
          )}
          {!hdLoading && hdRequests.map(req => (
            <HdRequestRow
              key={req.id}
              req={req}
              selected={selectedHd}
              onSelect={setSelectedHd}
              serviceType={jobsTab}
            />
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--t-bg)' }}>
        {selectedHd ? (
          jobsTab === 'personal_headhunt'
            ? <PersonalHdDetail req={selectedHd} />
            : <TeamHdDetail req={selectedHd} />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t-text-muted)' }}>
            <div style={{ textAlign: 'center' }}>
              <FolderOpen size={40} style={{ margin: '0 auto 12px', color: 'var(--t-text-muted)' }} />
              <p style={{ fontSize: 13 }}>点击左侧记录查看详情</p>
            </div>
          </div>
        )}
      </div>
    </>
  )

  const inner = (
    <>
      {/* ── 左栏 ── */}
      <div
        className={
          terminal
            ? 'terminal-split-sidebar flex flex-col overflow-hidden'
            : 'w-80 flex-shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden'
        }
        style={terminal ? { background: 'var(--t-bg-panel)', borderRight: '1px solid var(--t-border)' } : undefined}
      >
        <div
          className={terminal ? 'p-4' : 'p-4 border-b border-slate-100'}
          style={terminal ? { borderBottom: '1px solid var(--t-border-subtle)' } : undefined}
        >
          <div className="flex items-center justify-between mb-3">
            <h1
              className={terminal ? 'text-base font-semibold' : 'text-base font-semibold text-slate-800'}
              style={terminal ? { color: 'var(--t-text)' } : undefined}
            >
              岗位广场
            </h1>
            {terminal && showNewJobButton && (
              <button
                type="button"
                onClick={() => navigate('/employer/jobs/new')}
                title="发布岗位"
                className="inline-flex items-center gap-1 rounded-[var(--t-radius)] border px-2 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: 'var(--t-primary)',
                  borderColor: 'var(--t-primary)',
                  color: '#fff',
                }}
              >
                <PlusCircle size={12} />
                <span className="font-[var(--t-font-sans)]">New Job</span>
              </button>
            )}
          </div>
          <form onSubmit={handleSearch} className="space-y-2">
            <div className="relative">
              <Search
                size={13}
                className={terminal ? 'absolute left-3 top-1/2 -translate-y-1/2' : 'absolute left-3 top-1/2 -translate-y-1/2 text-slate-400'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="搜索职位或城市..."
                className={
                  terminal
                    ? 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none'
                    : 'w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400'
                }
                style={
                  terminal
                    ? {
                        background: 'var(--t-bg-input)',
                        border: '1px solid var(--t-border)',
                        color: 'var(--t-text)',
                      }
                    : undefined
                }
              />
            </div>
            <RegionSelector
              value={location}
              onChange={handleLocationChange}
              terminal={terminal}
              placeholder="按地区筛选（省 / 市 / 区 / 海外国家）"
            />
            <select
              value={functionCode}
              onChange={(e) => handleFunctionChange(e.target.value)}
              className={
                terminal
                  ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                  : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
              }
              style={
                terminal
                  ? {
                      background: 'var(--t-bg-input)',
                      borderColor: 'var(--t-border)',
                      color: functionCode ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }
                  : undefined
              }
            >
              <option value="">按业务方向筛选（全部）</option>
              {FUNCTION_OPTIONS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <select
              value={employmentType}
              onChange={(e) => handleEmploymentTypeChange(e.target.value)}
              className={
                terminal
                  ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                  : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
              }
              style={
                terminal
                  ? {
                      background: 'var(--t-bg-input)',
                      borderColor: 'var(--t-border)',
                      color: employmentType ? 'var(--t-text)' : 'var(--t-text-muted)',
                    }
                  : undefined
              }
            >
              <option value="">应聘类型（全部）</option>
              <option value="全职">全职</option>
              <option value="兼职">兼职</option>
              <option value="实习生">实习生</option>
            </select>
            {canApply && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={savedFilter}
                  onChange={(e) => setSavedFilter(e.target.value)}
                  className={
                    terminal
                      ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                      : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          borderColor: 'var(--t-border)',
                          color: savedFilter === 'all' ? 'var(--t-text-muted)' : 'var(--t-text)',
                        }
                      : undefined
                  }
                  title="按收藏状态筛选"
                >
                  <option value="all">收藏：全部</option>
                  <option value="saved">已收藏</option>
                  <option value="unsaved">未收藏</option>
                </select>
                <select
                  value={appliedFilter}
                  onChange={(e) => setAppliedFilter(e.target.value)}
                  className={
                    terminal
                      ? 'w-full px-2 py-1.5 text-xs rounded-lg border'
                      : 'w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 bg-white'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-input)',
                          borderColor: 'var(--t-border)',
                          color: appliedFilter === 'all' ? 'var(--t-text-muted)' : 'var(--t-text)',
                        }
                      : undefined
                  }
                  title="按投递状态筛选"
                >
                  <option value="all">投递：全部</option>
                  <option value="applied">已投递</option>
                  <option value="unapplied">未投递</option>
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                className={
                  terminal
                    ? 'flex-1 py-1.5 text-xs text-white rounded-lg transition-colors'
                    : 'flex-1 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                }
                style={terminal ? { background: 'var(--t-primary)' } : undefined}
              >
                搜索
              </button>
              {hasFilter && (
                <button
                  type="button"
                  onClick={handleReset}
                  className={
                    terminal
                      ? 'px-2 py-1.5 text-xs rounded-lg border transition-colors'
                      : 'px-2 py-1.5 text-xs text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50'
                  }
                  style={
                    terminal
                      ? {
                          background: 'var(--t-bg-elevated)',
                          borderColor: 'var(--t-border)',
                          color: 'var(--t-text-secondary)',
                        }
                      : undefined
                  }
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </form>
          {!loading && !error && (
            <p
              className={terminal ? 'text-xs mt-2' : 'text-xs text-slate-400 mt-2'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              共 {total} 个岗位{hasFilter ? '（已筛选）' : ''}
            </p>
          )}
        </div>

        <div className={terminal ? 'flex-1 overflow-y-auto terminal-scrollbar' : 'flex-1 overflow-y-auto'}>
          {loading && (
            <div
              className={terminal ? 'flex items-center justify-center gap-2 py-16' : 'flex items-center justify-center gap-2 py-16 text-slate-400'}
              style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
            >
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <AlertCircle
                size={24}
                className={terminal ? 'mb-2' : 'text-red-300 mb-2'}
                style={terminal ? { color: 'var(--t-danger)' } : undefined}
              />
              <p
                className={terminal ? 'text-xs text-center' : 'text-xs text-red-500 text-center'}
                style={terminal ? { color: 'var(--t-danger)' } : undefined}
              >
                {error}
              </p>
            </div>
          )}
          {!loading && !error && visibleJobs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FolderOpen
                size={28}
                className={terminal ? 'mb-2' : 'text-slate-300 mb-2'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              />
              <p
                className={terminal ? 'text-xs text-center' : 'text-xs text-slate-400 text-center'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              >
                暂无匹配岗位
              </p>
            </div>
          )}
          {!loading && !error && visibleJobs.map(job => {
            const isSelected = selected?.id === job.id
            const isUrgent = job.urgency_level === 1
            const cityShort = job.city_name || job.city || '—'
            const isApplied = appliedJobIds.has(job.id)
            const isSaved = savedJobIds.has(job.id)

            // Selected / hover styles per mode
            const rowClass = terminal
              ? `p-4 cursor-pointer transition-all border-l-4 ${isSelected ? '' : 'border-l-transparent'}`
              : `p-4 cursor-pointer border-b border-slate-100 transition-all ${
                  isSelected
                    ? 'border-l-4 border-l-blue-500 bg-blue-50'
                    : 'border-l-4 border-l-transparent hover:bg-slate-50'
                }`
            const rowStyle = terminal
              ? {
                  borderBottom: '1px solid var(--t-border-subtle)',
                  background: isSelected ? 'var(--t-bg-active)' : 'transparent',
                  borderLeftColor: isSelected ? 'var(--t-primary)' : 'transparent',
                }
              : undefined

            return (
              <div
                key={job.id}
                onClick={() => setSelected(job)}
                className={rowClass}
                style={{ ...rowStyle, position: 'relative' }}
                onMouseEnter={(e) => {
                  if (terminal && !isSelected) e.currentTarget.style.background = 'var(--t-bg-hover)'
                }}
                onMouseLeave={(e) => {
                  if (terminal && !isSelected) e.currentTarget.style.background = 'transparent'
                }}
              >
                {terminal && job.status === 'closed' && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '2px 5px', borderRadius: 'var(--t-radius-sm)',
                    background: 'var(--t-danger-muted)', color: 'var(--t-danger)',
                    border: '1px solid var(--t-danger)', textTransform: 'uppercase',
                    pointerEvents: 'none', lineHeight: 1.4,
                  }}>
                    CLOSED
                  </span>
                )}
                <div className="flex items-center gap-3">
                  {/* 公司头像 */}
                  <div
                    className={
                      terminal
                        ? 'w-9 h-9 rounded flex items-center justify-center font-bold text-sm flex-shrink-0'
                        : 'w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-blue-500'
                    }
                    style={terminal ? { background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', color: 'var(--t-text)' } : undefined}
                  >
                    {(job.company_name ?? job.title ?? '?')[0]}
                  </div>
                  {/* 信息区 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={terminal ? 'font-medium text-sm truncate' : 'font-medium text-sm text-slate-800 truncate'}
                        style={terminal ? { color: 'var(--t-text)' } : undefined}
                      >
                        {job.title}
                      </p>
                      {isUrgent && (
                        <span
                          className={
                            terminal
                              ? 'flex-shrink-0 text-[10px] px-1 py-0.5 border rounded font-medium'
                              : 'flex-shrink-0 text-[10px] px-1 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded font-medium'
                          }
                          style={terminal ? { background: 'var(--t-danger-muted)', color: 'var(--t-danger)', borderColor: 'var(--t-danger)' } : undefined}
                        >
                          急
                        </span>
                      )}
                    </div>
                    <p
                      className={terminal ? 'text-xs truncate mt-0.5' : 'text-xs text-slate-500 truncate mt-0.5'}
                      style={terminal ? { color: 'var(--t-text-secondary)' } : undefined}
                    >
                      {job.company_name ?? '—'}
                    </p>
                    <div
                      className={terminal ? 'flex items-center gap-2 text-xs mt-0.5 flex-wrap' : 'flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap'}
                      style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
                    >
                      {cityShort !== '—' && (
                        <span className="flex items-center gap-0.5"><MapPin size={9} />{cityShort}</span>
                      )}
                      {job.salary_label && (
                        <span
                          className={terminal ? 'font-semibold' : 'font-semibold text-blue-600'}
                          style={terminal ? { color: 'var(--t-chart-blue)' } : undefined}
                        >
                          {job.salary_label}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* 右侧操作按钮 */}
                  {canApply && (
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0" style={{ width: '3.5rem' }}>
                      {/* 收藏 / 取消收藏 toggle */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (savingJobId !== job.id) handleSave(job) }}
                        disabled={savingJobId === job.id}
                        className={terminal
                          ? 'text-xs py-0.5 rounded w-full text-center'
                          : `text-xs py-0.5 rounded border w-full text-center transition-colors ${
                              isSaved
                                ? 'border-emerald-300 text-emerald-600 bg-emerald-50 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                                : 'border-slate-200 text-slate-500 bg-white hover:border-slate-300 hover:text-slate-700'
                            }`
                        }
                        style={terminal ? {
                          border: isSaved ? '1px solid var(--t-success)' : '1px solid var(--t-text-muted)',
                          color: isSaved ? 'var(--t-success)' : 'var(--t-text-secondary)',
                          background: isSaved ? 'var(--t-success-muted)' : 'transparent',
                          borderRadius: 'var(--t-radius-sm)',
                          opacity: savingJobId === job.id ? 0.5 : 1,
                          cursor: savingJobId === job.id ? 'default' : 'pointer',
                          width: '100%',
                          textAlign: 'center',
                        } : undefined}
                        onMouseEnter={(e) => {
                          if (!terminal || savingJobId === job.id) return
                          if (isSaved) {
                            e.currentTarget.style.borderColor = 'var(--t-danger)'
                            e.currentTarget.style.color = 'var(--t-danger)'
                            e.currentTarget.style.background = 'var(--t-danger-muted)'
                          } else {
                            e.currentTarget.style.borderColor = 'var(--t-text)'
                            e.currentTarget.style.color = 'var(--t-text)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!terminal || savingJobId === job.id) return
                          e.currentTarget.style.borderColor = isSaved ? 'var(--t-success)' : 'var(--t-text-muted)'
                          e.currentTarget.style.color = isSaved ? 'var(--t-success)' : 'var(--t-text-secondary)'
                          e.currentTarget.style.background = isSaved ? 'var(--t-success-muted)' : 'transparent'
                        }}
                      >
                        {savingJobId === job.id ? '…' : isSaved ? '已收藏' : '收藏'}
                      </button>
                      {/* 投递 / 撤回投递 toggle */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (applyingJobId !== job.id) handleApply(job) }}
                        disabled={applyingJobId === job.id}
                        className={terminal
                          ? 'text-xs py-0.5 rounded w-full text-center'
                          : `text-xs py-0.5 rounded border w-full text-center transition-colors ${
                              isApplied
                                ? 'border-blue-300 text-blue-600 bg-blue-50 hover:border-red-300 hover:text-red-500 hover:bg-red-50'
                                : 'border-slate-200 text-slate-500 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50'
                            }`
                        }
                        style={terminal ? {
                          border: isApplied ? '1px solid var(--t-primary)' : '1px solid var(--t-text-muted)',
                          color: isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)',
                          background: isApplied ? 'var(--t-primary-muted)' : 'transparent',
                          opacity: applyingJobId === job.id ? 0.5 : 1,
                          cursor: applyingJobId === job.id ? 'default' : 'pointer',
                          borderRadius: 'var(--t-radius-sm)',
                          width: '100%',
                          textAlign: 'center',
                        } : undefined}
                        onMouseEnter={(e) => {
                          if (!terminal || applyingJobId === job.id) return
                          if (isApplied) {
                            e.currentTarget.style.borderColor = 'var(--t-danger)'
                            e.currentTarget.style.color = 'var(--t-danger)'
                            e.currentTarget.style.background = 'var(--t-danger-muted)'
                          } else {
                            e.currentTarget.style.borderColor = 'var(--t-primary)'
                            e.currentTarget.style.color = 'var(--t-primary)'
                            e.currentTarget.style.background = 'var(--t-primary-muted)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!terminal || applyingJobId === job.id) return
                          e.currentTarget.style.borderColor = isApplied ? 'var(--t-primary)' : 'var(--t-text-muted)'
                          e.currentTarget.style.color = isApplied ? 'var(--t-primary)' : 'var(--t-text-secondary)'
                          e.currentTarget.style.background = isApplied ? 'var(--t-primary-muted)' : 'transparent'
                        }}
                      >
                        {applyingJobId === job.id ? '…' : isApplied ? '已投递' : '投递'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          terminal={terminal}
        />
      </div>

      {/* ── 右栏详情 ── */}
      <div
        className={terminal ? 'flex-1 min-h-0 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto'}
        style={terminal ? { background: 'var(--t-bg)' } : undefined}
      >
        {selected ? (
          <div className={terminal ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'contents'}>
            {canApply && applyError && (
              <div
                className={
                  terminal
                    ? 'shrink-0 mx-6 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm'
                    : 'mx-6 mt-4 flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm'
                }
                style={
                  terminal
                    ? { background: 'var(--t-danger-muted)', borderColor: 'var(--t-danger)', color: 'var(--t-danger)' }
                    : undefined
                }
              >
                <AlertCircle size={14} /><span>{applyError}</span>
              </div>
            )}
            <JobDetailPanel
              job={selected}
              terminal={terminal}
              canManage={showNewJobButton}
              onStatusChange={handleStatusChange}
            />
          </div>
        ) : (
          <div
            className={terminal ? 'h-full flex items-center justify-center' : 'h-full flex items-center justify-center text-slate-400'}
            style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
          >
            <div className="text-center">
              <FolderOpen
                size={40}
                className={terminal ? 'mx-auto mb-3' : 'mx-auto mb-3 text-slate-300'}
                style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
              />
              <p className="text-sm">点击左侧岗位查看详情</p>
            </div>
          </div>
        )}
      </div>
    </>
  )

  if (terminal) {
    return (
      <TerminalPageSurface split>
        {terminal && showNewJobButton && (
          <JobsRail
            value={jobsTab}
            onChange={setJobsTab}
            counts={{
              personal_headhunt: undefined,
              team_headhunt: undefined,
            }}
          />
        )}
        {isHdTab ? hdInner : inner}
      </TerminalPageSurface>
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
      {inner}
    </div>
  )
}
