import { useState, useEffect, useRef, useCallback } from 'react'
import { Save, X, Edit3, Lock, Eye, EyeOff, CheckCircle, AlertCircle, ShieldBan, Search, Plus, Trash2 } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import { candidatesApi } from '../../api/candidates'
import { companiesApi } from '../../api/companies'
import ThemeModeSelector from '../../components/terminal/ThemeModeSelector'
import AvatarUpload from '../../components/ui/AvatarUpload'

// ── atoms ─────────────────────────────────────────────────────────────────────

function SectionHead({ label, action }) {
  return (
    <div className="flex h-8 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5">
      <span className="font-[var(--t-font-sans)] text-[10px] font-bold uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
        {label}
      </span>
      {action}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-stretch border-b border-[var(--t-border-subtle)] last:border-b-0">
      <div className="flex w-40 shrink-0 items-center border-r border-[var(--t-border-subtle)] px-5 py-3">
        <span className="text-xs text-[color:var(--t-text-muted)]">{label}</span>
      </div>
      <div className="flex flex-1 items-center px-5 py-3">{children}</div>
    </div>
  )
}

function Val({ children }) {
  return <span className="text-sm text-[color:var(--t-text)]">{children ?? '—'}</span>
}

function TInput({ value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="h-8 w-full rounded-[var(--t-radius-sm)] border border-[var(--t-border)] bg-[var(--t-bg-input)] px-3 text-sm text-[color:var(--t-text)] placeholder:text-[color:var(--t-text-muted)] focus:border-[var(--t-border-focus)] focus:outline-none"
    />
  )
}

function ActionRow({ onSave, onCancel, saving }) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--t-border-subtle)] px-5 py-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-[var(--t-radius-sm)] bg-[color:var(--t-primary)] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[color:var(--t-primary-hover)] disabled:opacity-40"
      >
        <Save size={12} />
        {saving ? '保存中…' : '保存'}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 rounded-[var(--t-radius-sm)] border border-[var(--t-border)] px-3 py-1.5 text-xs text-[color:var(--t-text-secondary)] transition-colors hover:bg-[var(--t-bg-hover)]"
      >
        <X size={12} />
        取消
      </button>
    </div>
  )
}

function Toast({ msg }) {
  if (!msg) return null
  const ok = msg.type === 'ok'
  return (
    <div className={`flex items-center gap-2 border-b border-[var(--t-border-subtle)] px-5 py-2.5 text-xs ${ok ? 'text-[color:var(--t-success)]' : 'text-[color:var(--t-danger)]'}`}>
      {ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      {msg.text}
    </div>
  )
}

function EditBtn({ onClick, label = '编辑' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-[var(--t-radius-sm)] border border-[var(--t-border)] px-2.5 py-1 text-[10px] font-[var(--t-font-sans)] text-[color:var(--t-text-muted)] transition-colors hover:border-[color:var(--t-primary)] hover:text-[color:var(--t-primary)]"
    >
      <Edit3 size={11} />
      {label}
    </button>
  )
}

// ── BlockedCompaniesSection ───────────────────────────────────────────────────

function BlockedCompaniesSection() {
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  // search picker state
  const [searchQ, setSearchQ] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    candidatesApi.getBlockedCompanies()
      .then(res => setBlocked(res.data.companies ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current)
    if (!q.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await companiesApi.listCompanies(q.trim())
        const ids = new Set(blocked.map(c => c.id))
        setSuggestions((res.data.companies ?? []).filter(c => !ids.has(c.id)))
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 250)
  }, [blocked])

  function handleSearchChange(e) {
    const q = e.target.value
    setSearchQ(q)
    search(q)
  }

  function addCompany(company) {
    setBlocked(prev => [...prev, company])
    setSuggestions(prev => prev.filter(c => c.id !== company.id))
    setSearchQ('')
  }

  function removeCompany(id) {
    setBlocked(prev => prev.filter(c => c.id !== id))
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const res = await candidatesApi.updateBlockedCompanies(blocked.map(c => c.id))
      setBlocked(res.data.companies ?? [])
      setMsg({ type: 'ok', text: '屏蔽列表已保存' })
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.message ?? '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
        <SectionHead label="Blocked Companies" />
        <div className="px-5 py-4 text-xs text-[color:var(--t-text-muted)]">加载中…</div>
      </section>
    )
  }

  return (
    <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
      <SectionHead
        label="Blocked Companies"
        action={
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 rounded-[var(--t-radius-sm)] border border-[var(--t-border)] px-2.5 py-1 text-[10px] font-[var(--t-font-sans)] text-[color:var(--t-text-muted)] transition-colors hover:border-[color:var(--t-primary)] hover:text-[color:var(--t-primary)] disabled:opacity-40"
          >
            <Save size={11} />
            {saving ? '保存中…' : '保存'}
          </button>
        }
      />

      {/* 说明文字 */}
      <div className="flex items-start gap-2 border-b border-[var(--t-border-subtle)] px-5 py-3">
        <ShieldBan size={13} className="mt-0.5 shrink-0 text-[color:var(--t-text-muted)]" />
        <p className="text-xs leading-relaxed text-[color:var(--t-text-muted)]">
          屏蔽后，对方企业的所有员工将无法在候选人池中找到你，也无法查看你的档案。
        </p>
      </div>

      {/* 搜索输入 */}
      <div className="border-b border-[var(--t-border-subtle)] px-5 py-3">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--t-text-muted)]"
          />
          <input
            type="text"
            value={searchQ}
            onChange={handleSearchChange}
            placeholder="搜索公司名称…"
            className="h-8 w-full rounded-[var(--t-radius-sm)] border border-[var(--t-border)] bg-[var(--t-bg-input)] pl-8 pr-3 text-sm text-[color:var(--t-text)] placeholder:text-[color:var(--t-text-muted)] focus:border-[var(--t-border-focus)] focus:outline-none"
          />
        </div>
        {/* 搜索建议下拉 */}
        {(suggestions.length > 0 || searching) && (
          <div className="mt-1 rounded-[var(--t-radius-sm)] border border-[var(--t-border)] bg-[var(--t-bg-panel)] shadow-lg">
            {searching && (
              <div className="px-3 py-2 text-xs text-[color:var(--t-text-muted)]">搜索中…</div>
            )}
            {!searching && suggestions.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => addCompany(c)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[color:var(--t-text)] transition-colors hover:bg-[var(--t-bg-hover)]"
              >
                <span>{c.name}</span>
                <Plus size={13} className="text-[color:var(--t-primary)]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* toast */}
      {msg && <Toast msg={msg} />}

      {/* 已屏蔽列表 */}
      {blocked.length === 0 ? (
        <div className="px-5 py-4 text-xs text-[color:var(--t-text-muted)]">
          暂无屏蔽公司
        </div>
      ) : (
        <div className="divide-y divide-[var(--t-border-subtle)]">
          {blocked.map(c => (
            <div key={c.id} className="flex items-center justify-between px-5 py-2.5">
              <span className="text-sm text-[color:var(--t-text)]">{c.name}</span>
              <button
                type="button"
                onClick={() => removeCompany(c.id)}
                className="flex items-center gap-1 text-xs text-[color:var(--t-text-muted)] transition-colors hover:text-[color:var(--t-danger)]"
              >
                <Trash2 size={12} />
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function TerminalCandidateSettings() {
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [avatarMsg, setAvatarMsg] = useState(null)

  useEffect(() => {
    candidatesApi.getMyCandidateProfile()
      .then(res => setProfile(res.data.candidate ?? res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // ── name (via authApi, same as employer settings) ──────────────────
  const [editName, setEditName] = useState(false)
  const [nf, setNf] = useState({ name: '' })
  const [nfSaving, setNfSaving] = useState(false)
  const [nfMsg, setNfMsg] = useState(null)

  function openName() {
    setNf({ name: user?.name ?? '' })
    setNfMsg(null)
    setEditName(true)
  }

  async function saveName() {
    if (!nf.name.trim()) { setNfMsg({ type: 'err', text: '请填写姓名' }); return }
    setNfSaving(true)
    setNfMsg(null)
    try {
      const res = await authApi.updateMe({ name: nf.name.trim() })
      window.dispatchEvent(new CustomEvent('auth:user-updated', { detail: res.data.user }))
      setNfMsg({ type: 'ok', text: '已保存' })
      setEditName(false)
    } catch (e) {
      setNfMsg({ type: 'err', text: e.response?.data?.message ?? '保存失败' })
    } finally {
      setNfSaving(false)
    }
  }

  // ── contact & privacy ───────────────────────────────────────────────
  const [editContact, setEditContact] = useState(false)
  const [cf, setCf] = useState({})
  const [cfSaving, setCfSaving] = useState(false)
  const [cfMsg, setCfMsg] = useState(null)

  function openContact() {
    setCf({
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
      contact_visible: profile?.contact_visible ?? false,
    })
    setCfMsg(null)
    setEditContact(true)
  }

  async function saveContact() {
    setCfSaving(true)
    setCfMsg(null)
    try {
      const payload = { ...profile, ...cf }
      const res = await candidatesApi.updateMyCandidateProfile(payload)
      setProfile(res.data.candidate ?? res.data)
      setCfMsg({ type: 'ok', text: '已保存' })
      setEditContact(false)
    } catch (e) {
      setCfMsg({ type: 'err', text: e.response?.data?.message ?? '保存失败' })
    } finally {
      setCfSaving(false)
    }
  }

  // ── password ────────────────────────────────────────────────────────
  const [editPwd, setEditPwd] = useState(false)
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  async function savePwd() {
    if (!pw.old) { setPwMsg({ type: 'err', text: '请填写当前密码' }); return }
    if (pw.next.length < 6) { setPwMsg({ type: 'err', text: '新密码至少 6 位' }); return }
    if (pw.next !== pw.confirm) { setPwMsg({ type: 'err', text: '两次密码不一致' }); return }
    setPwSaving(true)
    setPwMsg(null)
    try {
      await authApi.updateMe({ old_password: pw.old, new_password: pw.next })
      setPwMsg({ type: 'ok', text: '密码已更新' })
      setEditPwd(false)
    } catch (e) {
      setPwMsg({ type: 'err', text: e.response?.data?.message ?? '修改失败' })
    } finally {
      setPwSaving(false)
    }
  }

  const joinDate = user?.created_at?.slice(0, 10) ?? '—'

  return (
    <TerminalLayout title="SETTINGS" activeIconId="settings" navItems={CANDIDATE_ICON_NAV}>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* sub-header */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5">
          <div className="flex items-center gap-3">
            <span className="font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
              ACCOUNT
            </span>
            <span className="font-[var(--t-font-sans)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)] truncate">
              {user?.name}
            </span>
          </div>
          <span className="rounded border border-[var(--t-border)] px-2 py-0.5 font-[var(--t-font-sans)] text-[10px] uppercase tracking-[0.04em] text-[color:var(--t-text-muted)]">
            Candidate
          </span>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-[color:var(--t-text-muted)]">
            加载中…
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto terminal-scrollbar">
            <div className="mx-auto max-w-2xl py-6 space-y-6">

              {/* ── 账号（只读）── */}
              <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
                <SectionHead label="Account" />
                <Row label="账号 ID"><Val>#{user?.id}</Val></Row>
                <Row label="邮箱"><Val>{user?.email}</Val></Row>
                <Row label="注册日期"><Val>{joinDate}</Val></Row>
              </section>

              {/* ── 头像 ── */}
              <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
                <SectionHead label="Avatar" />
                <Row label="头像">
                  <AvatarUpload
                    currentUrl={user?.avatar_url}
                    userName={user?.name}
                    size="md"
                    onChange={() => {}}
                    onError={msg => setAvatarMsg({ type: 'err', text: msg })}
                  />
                </Row>
                {avatarMsg && <Toast msg={avatarMsg} />}
              </section>

              {/* ── 姓名（通过 authApi，与 employer settings 一致）── */}
              <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
                <SectionHead label="Profile" action={!editName && <EditBtn onClick={openName} />} />
                <Toast msg={nfMsg} />
                {editName ? (
                  <>
                    <Row label="真实姓名">
                      <TInput value={nf.name} onChange={e => setNf(f => ({ ...f, name: e.target.value }))} placeholder="请输入姓名" />
                    </Row>
                    <ActionRow onSave={saveName} onCancel={() => setEditName(false)} saving={nfSaving} />
                  </>
                ) : (
                  <Row label="真实姓名"><Val>{user?.name}</Val></Row>
                )}
              </section>

              {/* ── 联系方式与隐私 —— */}
              <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
                <SectionHead label="Contact &amp; Privacy" action={!editContact && <EditBtn onClick={openContact} />} />
                <Toast msg={cfMsg} />
                {editContact ? (
                  <>
                    <Row label="联系邮箱">
                      <TInput type="email" value={cf.email} onChange={e => setCf(f => ({ ...f, email: e.target.value }))} placeholder="联系邮箱（非登录邮箱）" />
                    </Row>
                    <Row label="手机号码">
                      <TInput value={cf.phone} onChange={e => setCf(f => ({ ...f, phone: e.target.value }))} placeholder="如 13800000000" />
                    </Row>
                    <Row label="详细地址">
                      <TInput value={cf.address} onChange={e => setCf(f => ({ ...f, address: e.target.value }))} placeholder="可选" />
                    </Row>
                    <Row label="对企业公开">
                      <button
                        type="button"
                        onClick={() => setCf(f => ({ ...f, contact_visible: !f.contact_visible }))}
                        className={`flex items-center gap-1.5 rounded-[var(--t-radius-sm)] border px-2.5 py-1 text-xs transition-colors ${
                          cf.contact_visible
                            ? 'border-[color:var(--t-success)] text-[color:var(--t-success)]'
                            : 'border-[var(--t-border)] text-[color:var(--t-text-muted)]'
                        }`}
                      >
                        {cf.contact_visible ? <Eye size={12} /> : <EyeOff size={12} />}
                        {cf.contact_visible ? '已公开' : '已隐藏'}
                      </button>
                    </Row>
                    <ActionRow onSave={saveContact} onCancel={() => setEditContact(false)} saving={cfSaving} />
                  </>
                ) : (
                  <>
                    <Row label="联系邮箱"><Val>{profile?.email}</Val></Row>
                    <Row label="手机号码"><Val>{profile?.phone}</Val></Row>
                    <Row label="详细地址"><Val>{profile?.address}</Val></Row>
                    <Row label="对企业公开">
                      <span className={`text-xs ${profile?.contact_visible ? 'text-[color:var(--t-success)]' : 'text-[color:var(--t-text-muted)]'}`}>
                        {profile?.contact_visible ? '已公开' : '已隐藏'}
                      </span>
                    </Row>
                  </>
                )}
              </section>

              {/* ── 屏蔽公司 ── */}
              <BlockedCompaniesSection />

              {/* ── 外观 ── */}
              <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
                <SectionHead label="Appearance" />
                <Row label="外观模式">
                  <ThemeModeSelector />
                </Row>
              </section>

              {/* ── 安全 ── */}
              <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
                <SectionHead
                  label="Security"
                  action={!editPwd && <EditBtn onClick={() => { setPw({ old: '', next: '', confirm: '' }); setPwMsg(null); setEditPwd(true) }} label="改密码" />}
                />
                <Toast msg={pwMsg} />
                {editPwd ? (
                  <>
                    <Row label="当前密码">
                      <TInput type="password" value={pw.old} onChange={e => setPw(p => ({ ...p, old: e.target.value }))} placeholder="请输入当前密码" />
                    </Row>
                    <Row label="新密码">
                      <TInput type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="至少 6 位" />
                    </Row>
                    <Row label="确认新密码">
                      <TInput type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="再次输入" />
                    </Row>
                    <ActionRow onSave={savePwd} onCancel={() => setEditPwd(false)} saving={pwSaving} />
                  </>
                ) : (
                  <Row label="登录密码">
                    <div className="flex items-center gap-2">
                      <Val>••••••••</Val>
                      <Lock size={12} className="text-[color:var(--t-text-muted)]" />
                    </div>
                  </Row>
                )}
              </section>

            </div>
          </div>
        )}
      </main>
    </TerminalLayout>
  )
}
