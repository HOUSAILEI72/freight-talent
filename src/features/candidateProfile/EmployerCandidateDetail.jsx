import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { candidatesApi } from '../../api/candidates'
import { subscriptionsApi } from '../../api/subscriptions'
import { invitationsApi } from '../../api/invitations'
import TerminalPageSurface from '../../components/terminal/TerminalPageSurface'

// ─── tag styles ──────────────────────────────────────────────────────────────
const TAG_STYLES = {
  blue:   { background: 'rgba(96,165,250,0.12)',  color: 'var(--t-chart-blue)',   border: '1px solid rgba(96,165,250,0.25)' },
  purple: { background: 'rgba(167,139,250,0.12)', color: 'var(--t-chart-purple)', border: '1px solid rgba(167,139,250,0.25)' },
  green:  { background: 'rgba(74,222,128,0.12)',  color: 'var(--t-chart-green)',  border: '1px solid rgba(74,222,128,0.25)' },
  orange: { background: 'rgba(251,191,36,0.12)',  color: 'var(--t-chart-amber)',  border: '1px solid rgba(251,191,36,0.25)' },
}

function buildTagGroups(profile) {
  const groups = []
  if (profile.knowledge_tags?.length)  groups.push({ label: '知识领域', tags: profile.knowledge_tags,  color: 'blue' })
  if (profile.hard_skill_tags?.length) groups.push({ label: '硬技能',   tags: profile.hard_skill_tags, color: 'purple' })
  if (profile.soft_skill_tags?.length) groups.push({ label: '软技能',   tags: profile.soft_skill_tags, color: 'green' })
  if (groups.length === 0 && profile.all_tags?.length) {
    groups.push({ label: '技能标签', tags: profile.all_tags, color: 'blue' })
  }
  return groups
}

// ─── small primitives ─────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: 'var(--t-font-mono)',
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: 'var(--t-text-muted)',
      borderBottom: '1px solid var(--t-border-subtle)',
      paddingBottom: 6,
      marginBottom: 10,
    }}>
      {children}
    </div>
  )
}

function Tag({ label, color = 'blue' }) {
  return (
    <span style={{
      ...TAG_STYLES[color],
      fontFamily: 'var(--t-font-mono)',
      fontSize: 11,
      padding: '2px 8px',
      borderRadius: 3,
      display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

function Dot({ color }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: color,
      flexShrink: 0,
    }} />
  )
}

function FreshnessChip({ days }) {
  if (days == null) return null
  const fresh = days <= 30
  const color = fresh ? 'var(--t-success)' : 'var(--t-text-muted)'
  const label = days === 0 ? '今日更新' : `${days}天前更新`
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color, fontFamily: 'var(--t-font-mono)', fontSize: 11 }}>
      <Dot color={color} />
      {label}
    </span>
  )
}

function AvailChip({ status }) {
  if (!status) return null
  const map = {
    open:    { label: '求职中',   color: 'var(--t-success)' },
    passive: { label: '被动求职', color: 'var(--t-chart-amber)' },
    closed:  { label: '暂不考虑', color: 'var(--t-text-muted)' },
  }
  const cfg = map[status] || map.closed
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: cfg.color, fontFamily: 'var(--t-font-mono)', fontSize: 11 }}>
      <Dot color={cfg.color} />
      {cfg.label}
    </span>
  )
}

function MetaRow({ label, value }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
      <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--t-text-muted)', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function Panel({ children, style }) {
  return (
    <div style={{
      background: 'var(--t-bg-panel)',
      border: '1px solid var(--t-border)',
      borderRadius: 'var(--t-radius-lg)',
      padding: '14px 16px',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── fake placeholder rows (never real data) ─────────────────────────────────
const FAKE_WORK = [
  { title: '高级操作主管', company: '某大型国际货代公司', period: '2021.03 – 至今', salary: '28–36k × 14薪' },
  { title: '客户经理', company: '跨国物流集团华东区', period: '2018.06 – 2021.02', salary: '20–26k × 13薪' },
  { title: '操作专员', company: '区域性货运代理企业', period: '2015.09 – 2018.05', salary: '12–16k × 12薪' },
]
const FAKE_EDU = [
  { school: '上海海事大学', major: '国际航运管理', degree: '本科', period: '2011 – 2015' },
]
const FAKE_CERTS = ['FIATA 国际货运代理证书', 'AEO 认证操作员', '报关员资格证']
const FAKE_CONTACT = { email: 'c●●●●@example.com', phone: '+86 138 ●●●● ●●●●', address: '上海市浦东新区●●●路●●号' }

// ─── locked premium profile preview ──────────────────────────────────────────
function LockedProfilePreview({ onViewPricing }) {
  return (
    <div style={{ position: 'relative', borderRadius: 'var(--t-radius-lg)', overflow: 'hidden' }}>

      {/* ── blurred fake content layer ── */}
      <div style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* fake work history */}
        <Panel>
          <SectionLabel>工作经历</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FAKE_WORK.map((w, i) => (
              <div key={i} style={{ paddingLeft: 12, borderLeft: '2px solid var(--t-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>{w.title}</span>
                  <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0 }}>{w.period}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginBottom: 4 }}>{w.company}</div>
                <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, color: 'var(--t-chart-amber)' }}>{w.salary}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* fake education & certs */}
        <Panel>
          <SectionLabel>教育 &amp; 证书</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {FAKE_EDU.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--t-text)' }}>{e.school}</span>
                  <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginLeft: 8 }}>{e.major}</span>
                  <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, color: 'var(--t-chart-blue)', marginLeft: 8 }}>{e.degree}</span>
                </div>
                <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0 }}>{e.period}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {FAKE_CERTS.map((c, i) => <Tag key={i} label={c} color="orange" />)}
          </div>
        </Panel>

        {/* fake contact */}
        <Panel>
          <SectionLabel>联系方式</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <MetaRow label="邮箱" value={FAKE_CONTACT.email} />
            <MetaRow label="电话" value={FAKE_CONTACT.phone} />
            <MetaRow label="地址" value={FAKE_CONTACT.address} />
          </div>
        </Panel>

      </div>

      {/* ── overlay CTA ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'rgba(8,10,16,0.72)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
      }}>
        {/* lock icon (CSS, no emoji) */}
        <div style={{
          width: 40,
          height: 40,
          border: '2px solid var(--t-border)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--t-text-muted)',
          fontSize: 18,
          fontFamily: 'var(--t-font-mono)',
          letterSpacing: 0,
        }}>
          ⊘
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--t-font-mono)',
            fontSize: 11,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--t-text-muted)',
            marginBottom: 6,
          }}>
            PREMIUM PROFILE
          </div>
          <div style={{
            fontSize: 13,
            color: 'var(--t-text-secondary)',
            maxWidth: 280,
            lineHeight: 1.6,
          }}>
            订阅后可查看完整工作经历、教育证书、薪资结构及联系方式
          </div>
        </div>

        <button
          onClick={onViewPricing}
          style={{
            background: 'var(--t-primary)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontFamily: 'var(--t-font-mono)',
            fontSize: 12,
            letterSpacing: '0.14em',
            padding: '9px 28px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          VIEW PRICING
        </button>

        <div style={{
          fontFamily: 'var(--t-font-mono)',
          fontSize: 10,
          color: 'var(--t-text-muted)',
          letterSpacing: '0.1em',
        }}>
          以上预览为示意数据，非真实信息
        </div>
      </div>

    </div>
  )
}

// ─── salary helper ────────────────────────────────────────────────────────────
function fmtSalary(min, max, months) {
  if (!min && !max) return null
  const range = min && max ? `${min}–${max}k` : `${min || max}k`
  return months ? `${range} × ${months}薪` : range
}

// ─── main component ───────────────────────────────────────────────────────────
export default function EmployerCandidateDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [profile, setProfile] = useState(null)
  const [hasSub, setHasSub] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [profRes, subRes] = await Promise.all([
          candidatesApi.getCandidatePublicProfile(id),
          subscriptionsApi.getMySubscription().catch(() => ({ data: { has_active: false } })),
        ])
        if (!cancelled) {
          setProfile(profRes.data.candidate)
          setHasSub(subRes.data.has_active)
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  async function handleInvite() {
    setInviting(true)
    setInviteMsg(null)
    try {
      await invitationsApi.createInvitation(null, id, '')
      setInviteMsg({ ok: true, text: '邀请已发送' })
    } catch (e) {
      setInviteMsg({ ok: false, text: e?.response?.data?.message || '邀请失败' })
    } finally {
      setInviting(false)
    }
  }

  // ── loading / error states ──────────────────────────────────────────────────
  if (loading) {
    return (
      <TerminalPageSurface>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--t-text-muted)', fontFamily: 'var(--t-font-mono)', fontSize: 13 }}>
          LOADING...
        </div>
      </TerminalPageSurface>
    )
  }

  if (error || !profile) {
    return (
      <TerminalPageSurface>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--t-danger)', fontFamily: 'var(--t-font-mono)', fontSize: 13 }}>
          <span>{error || '候选人不存在'}</span>
          <button onClick={() => navigate(-1)} style={{ color: 'var(--t-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>← 返回</button>
        </div>
      </TerminalPageSurface>
    )
  }

  const unlocked = !!profile.private_visible
  const tagGroups = buildTagGroups(profile)
  const currentSalary = fmtSalary(profile.current_salary_min, profile.current_salary_max, profile.current_salary_months)
  const displayName = profile.full_name || '—'
  const initials = displayName.slice(0, 2).toUpperCase()

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <TerminalPageSurface>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '0 20px 40px' }}>

        {/* ── top header bar ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 0 10px',
          borderBottom: '1px solid var(--t-border)',
          marginBottom: 16,
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'var(--t-bg-elevated)',
              border: '1px solid var(--t-border)',
              borderRadius: 4,
              color: 'var(--t-text-secondary)',
              fontFamily: 'var(--t-font-mono)',
              fontSize: 11,
              padding: '4px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            ← BACK
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--t-text)' }}>{displayName}</span>
              {profile.current_title && (
                <span style={{ fontSize: 13, color: 'var(--t-text-secondary)' }}>{profile.current_title}</span>
              )}
              {profile.current_city && (
                <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, color: 'var(--t-text-muted)' }}>
                  @ {profile.current_city}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <FreshnessChip days={profile.freshness_days} />
            <AvailChip status={profile.availability_status} />
          </div>

          {/* action buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {inviteMsg && (
              <span style={{
                fontFamily: 'var(--t-font-mono)',
                fontSize: 11,
                color: inviteMsg.ok ? 'var(--t-success)' : 'var(--t-danger)',
                alignSelf: 'center',
              }}>
                {inviteMsg.text}
              </span>
            )}
            <button
              onClick={handleInvite}
              disabled={inviting}
              style={{
                background: 'var(--t-primary)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                fontFamily: 'var(--t-font-mono)',
                fontSize: 11,
                padding: '5px 14px',
                cursor: inviting ? 'not-allowed' : 'pointer',
                opacity: inviting ? 0.6 : 1,
              }}
            >
              {inviting ? '发送中...' : '+ 邀请'}
            </button>
          </div>
        </div>

        {/* ── main body: left rail + right content ── */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>

          {/* ── left sticky rail 320px ── */}
          <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* block 1: candidate signal */}
            <Panel>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: '1px solid var(--t-border-subtle)', marginBottom: 12 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--t-bg-elevated)',
                  border: '1px solid var(--t-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--t-font-mono)',
                  fontSize: 17,
                  color: 'var(--t-text-secondary)',
                  letterSpacing: 1,
                  flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t-text)' }}>{displayName}</div>
                  {profile.current_title && (
                    <div style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginTop: 3 }}>{profile.current_title}</div>
                  )}
                  {profile.current_city && (
                    <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, color: 'var(--t-text-muted)', marginTop: 2 }}>
                      @ {profile.current_city}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <AvailChip status={profile.availability_status} />
                  <FreshnessChip days={profile.freshness_days} />
                </div>
              </div>

              {/* block 2: hiring fit */}
              <div style={{ marginBottom: 12 }}>
                <SectionLabel>Hiring Fit</SectionLabel>
                <MetaRow label="职能方向" value={profile.function_name} />
                <MetaRow label="业务区域" value={profile.business_area_name} />
                <MetaRow label="期望城市" value={profile.expected_city} />
                <MetaRow label="英语水平" value={profile.english_level} />
                {profile.expected_salary_label && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--t-border-subtle)' }}>
                    <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--t-text-muted)', flexShrink: 0 }}>
                      期望薪资
                    </span>
                    <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 13, color: 'var(--t-chart-amber)', fontWeight: 600 }}>
                      {profile.expected_salary_label}
                    </span>
                  </div>
                )}
              </div>

              {/* block 3: summary highlight */}
              {profile.summary && (
                <div style={{ marginBottom: 12, paddingTop: 10, borderTop: '1px solid var(--t-border-subtle)' }}>
                  <SectionLabel>候选人亮点</SectionLabel>
                  <p style={{ fontSize: 12, color: 'var(--t-text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {profile.summary.length > 120 ? profile.summary.slice(0, 120) + '…' : profile.summary}
                  </p>
                </div>
              )}

              {/* block 4: core skills */}
              {tagGroups.length > 0 && (
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--t-border-subtle)', marginBottom: 14 }}>
                  <SectionLabel>Core Skills</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tagGroups.map(g => (
                      <div key={g.label}>
                        <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 9, color: 'var(--t-text-muted)', letterSpacing: '0.12em', marginBottom: 4 }}>
                          {g.label}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {g.tags.slice(0, 4).map(t => (
                            <Tag key={t} label={t} color={g.color} />
                          ))}
                          {g.tags.length > 4 && (
                            <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, color: 'var(--t-text-muted)', alignSelf: 'center' }}>
                              +{g.tags.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA block */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleInvite}
                  disabled={inviting}
                  style={{
                    width: '100%',
                    background: 'var(--t-primary)',
                    border: 'none',
                    borderRadius: 4,
                    color: '#fff',
                    fontFamily: 'var(--t-font-mono)',
                    fontSize: 12,
                    padding: '8px 0',
                    cursor: inviting ? 'not-allowed' : 'pointer',
                    opacity: inviting ? 0.6 : 1,
                    letterSpacing: '0.08em',
                  }}
                >
                  {inviting ? '发送中...' : '发送邀请'}
                </button>
                {!unlocked && (
                  <button
                    onClick={() => navigate('/employer/pricing')}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: '1px solid var(--t-border)',
                      borderRadius: 4,
                      color: 'var(--t-text-secondary)',
                      fontFamily: 'var(--t-font-mono)',
                      fontSize: 11,
                      padding: '7px 0',
                      cursor: 'pointer',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    解锁完整档案
                  </button>
                )}
                {!unlocked && (
                  <div style={{
                    fontFamily: 'var(--t-font-mono)',
                    fontSize: 10,
                    color: 'var(--t-text-muted)',
                    lineHeight: 1.6,
                    textAlign: 'center',
                    letterSpacing: '0.04em',
                  }}>
                    完整工作经历、教育证书、薪资结构<br />及联系方式需订阅后查看
                  </div>
                )}
                {inviteMsg && (
                  <div style={{
                    fontFamily: 'var(--t-font-mono)',
                    fontSize: 11,
                    color: inviteMsg.ok ? 'var(--t-success)' : 'var(--t-danger)',
                    textAlign: 'center',
                  }}>
                    {inviteMsg.text}
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* ── right content area: entirely premium ── */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {unlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* full capability tags */}
                {tagGroups.length > 0 && (
                  <Panel>
                    <SectionLabel>能力标签</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tagGroups.map(group => (
                        <div key={group.label}>
                          <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, color: 'var(--t-text-muted)', marginBottom: 5, letterSpacing: '0.12em' }}>
                            {group.label}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {group.tags.map(t => <Tag key={t} label={t} color={group.color} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* current position */}
                {(profile.current_title || profile.current_company || currentSalary || profile.business_type || profile.is_management_role != null) && (
                  <Panel>
                    <SectionLabel>当前职位</SectionLabel>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                      {profile.current_title   && <MetaRow label="职位"     value={profile.current_title} />}
                      {profile.current_company && <MetaRow label="公司"     value={profile.current_company} />}
                      {profile.business_type   && <MetaRow label="业务类型" value={profile.business_type} />}
                      {profile.function_name   && <MetaRow label="职能"     value={profile.function_name} />}
                      {currentSalary           && <MetaRow label="当前薪资" value={currentSalary} />}
                      {profile.is_management_role != null && (
                        <MetaRow label="管理岗" value={profile.is_management_role ? '是' : '否'} />
                      )}
                      {profile.current_has_year_end_bonus && profile.current_year_end_bonus_months && (
                        <MetaRow label="年终奖" value={`${profile.current_year_end_bonus_months} 个月`} />
                      )}
                      {profile.current_average_bonus_percent > 0 && (
                        <MetaRow label="平均奖金" value={`${profile.current_average_bonus_percent}%`} />
                      )}
                    </div>
                  </Panel>
                )}

                {/* work history */}
                {profile.work_experiences?.length > 0 && (
                  <Panel>
                    <SectionLabel>工作经历</SectionLabel>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {profile.work_experiences.map((exp, i) => {
                        const company = exp.company_name || exp.company
                        const period = exp.period || [exp.start_month, exp.end_month].filter(Boolean).join(' – ')
                        const expSalary = fmtSalary(exp.salary_min, exp.salary_max, exp.salary_months)
                        return (
                          <div key={i} style={{ paddingLeft: 12, borderLeft: '2px solid var(--t-border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t-text)' }}>{exp.title}</span>
                              {period && <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0 }}>{period}</span>}
                            </div>
                            {company && <div style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginBottom: 4 }}>{company}</div>}
                            {expSalary && <div style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, color: 'var(--t-chart-amber)', marginBottom: 4 }}>{expSalary}</div>}
                            {exp.responsibilities && (
                              <p style={{ fontSize: 12, color: 'var(--t-text-muted)', lineHeight: 1.6, margin: 0 }}>{exp.responsibilities}</p>
                            )}
                            {exp.achievements && (
                              <p style={{ fontSize: 12, color: 'var(--t-chart-green)', lineHeight: 1.6, margin: '4px 0 0' }}>{exp.achievements}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Panel>
                )}

                {/* education & certificates */}
                {(profile.education_experiences?.length > 0 || profile.certificates?.length > 0) && (
                  <Panel>
                    <SectionLabel>教育 &amp; 证书</SectionLabel>
                    {profile.education_experiences?.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: profile.certificates?.length ? 12 : 0 }}>
                        {profile.education_experiences.map((edu, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                            <div>
                              <span style={{ fontSize: 13, color: 'var(--t-text)' }}>{edu.school}</span>
                              {edu.major && <span style={{ fontSize: 12, color: 'var(--t-text-secondary)', marginLeft: 8 }}>{edu.major}</span>}
                              {edu.degree && <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 11, color: 'var(--t-chart-blue)', marginLeft: 8 }}>{edu.degree}</span>}
                            </div>
                            {edu.period && <span style={{ fontFamily: 'var(--t-font-mono)', fontSize: 10, color: 'var(--t-text-muted)', flexShrink: 0 }}>{edu.period}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {profile.certificates?.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {profile.certificates.map((c, i) => (
                          <Tag key={i} label={typeof c === 'string' ? c : c.name} color="orange" />
                        ))}
                      </div>
                    )}
                  </Panel>
                )}

                {/* contact info */}
                <Panel>
                  <SectionLabel>联系方式</SectionLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <MetaRow label="邮箱" value={profile.email} />
                    <MetaRow label="电话" value={profile.phone} />
                    <MetaRow label="地址" value={profile.address} />
                  </div>
                </Panel>

              </div>
            ) : (
              <LockedProfilePreview onViewPricing={() => navigate('/employer/pricing')} />
            )}
          </div>
        </div>
      </div>
    </TerminalPageSurface>
  )
}
