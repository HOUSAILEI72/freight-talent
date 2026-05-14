import { useState } from 'react'
import { Save, X, Edit3, Lock, CheckCircle, AlertCircle } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { useAuth } from '../../context/AuthContext'
import { authApi } from '../../api/auth'
import ThemeModeSelector from '../../components/terminal/ThemeModeSelector'

// ── atoms ─────────────────────────────────────────────────────────────────────

function SectionHead({ label }) {
  return (
    <div className="flex h-8 shrink-0 items-center border-b border-[var(--t-border-subtle)] px-5">
      <span className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
        {label}
      </span>
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
      className="flex items-center gap-1 rounded-[var(--t-radius-sm)] border border-[var(--t-border)] px-2.5 py-1 text-[10px] font-[var(--t-font-mono)] uppercase tracking-wider text-[color:var(--t-text-muted)] transition-colors hover:border-[color:var(--t-primary)] hover:text-[color:var(--t-primary)]"
    >
      <Edit3 size={11} />
      {label}
    </button>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function TerminalSettings() {
  const { user } = useAuth()

  // profile section
  const [editProfile, setEditProfile] = useState(false)
  const [pf, setPf] = useState({ name: '', company_name: '' })
  const [pfSaving, setPfSaving] = useState(false)
  const [pfMsg, setPfMsg] = useState(null)

  function openProfile() {
    setPf({ name: user?.name ?? '', company_name: user?.company_name ?? '' })
    setPfMsg(null)
    setEditProfile(true)
  }

  async function saveProfile() {
    if (!pf.name.trim()) { setPfMsg({ type: 'err', text: '姓名不能为空' }); return }
    setPfSaving(true)
    setPfMsg(null)
    try {
      const res = await authApi.updateMe({ name: pf.name.trim(), company_name: pf.company_name.trim() })
      window.dispatchEvent(new CustomEvent('auth:user-updated', { detail: res.data.user }))
      setPfMsg({ type: 'ok', text: '已保存' })
      setEditProfile(false)
    } catch (e) {
      setPfMsg({ type: 'err', text: e.response?.data?.message ?? '保存失败' })
    } finally {
      setPfSaving(false)
    }
  }

  // password section
  const [editPwd, setEditPwd] = useState(false)
  const [pw, setPw] = useState({ old: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState(null)

  function openPwd() {
    setPw({ old: '', next: '', confirm: '' })
    setPwMsg(null)
    setEditPwd(true)
  }

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
    <TerminalLayout title="SETTINGS" activeIconId="settings">
      {/* sub-header */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--t-border-subtle)] px-5">
          <div className="flex items-center gap-3">
            <span className="font-[var(--t-font-mono)] text-[10px] uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
              ACCOUNT
            </span>
            <span className="font-[var(--t-font-mono)] text-[length:var(--t-text-sm)] font-semibold text-[color:var(--t-text)] truncate">
              {user?.company_name ?? user?.name}
            </span>
          </div>
          <span className="rounded border border-[var(--t-border)] px-2 py-0.5 font-[var(--t-font-mono)] text-[10px] uppercase tracking-widest text-[color:var(--t-text-muted)]">
            Employer
          </span>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto terminal-scrollbar">
          <div className="mx-auto max-w-2xl py-6 space-y-6">

            {/* ── 账号信息（只读）── */}
            <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
              <SectionHead label="Account" />
              <Row label="账号 ID"><Val>#{user?.id}</Val></Row>
              <Row label="邮箱"><Val>{user?.email}</Val></Row>
              <Row label="注册日期"><Val>{joinDate}</Val></Row>
              <Row label="账号角色">
                <span className="rounded border border-[var(--t-border)] px-2 py-0.5 font-[var(--t-font-mono)] text-[10px] uppercase tracking-wider text-[color:var(--t-text-muted)]">
                  Employer
                </span>
              </Row>
            </section>

            {/* ── 企业资料（可编辑）── */}
            <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
              <div className="flex items-center justify-between border-b border-[var(--t-border-subtle)] px-5 h-8">
                <span className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
                  Profile
                </span>
                {!editProfile && <EditBtn onClick={openProfile} />}
              </div>

              <Toast msg={pfMsg} />

              {editProfile ? (
                <>
                  <Row label="联系人姓名">
                    <TInput value={pf.name} onChange={e => setPf(f => ({ ...f, name: e.target.value }))} placeholder="请输入姓名" />
                  </Row>
                  <Row label="公司名称">
                    <TInput value={pf.company_name} onChange={e => setPf(f => ({ ...f, company_name: e.target.value }))} placeholder="请输入公司名称" />
                  </Row>
                  <ActionRow onSave={saveProfile} onCancel={() => setEditProfile(false)} saving={pfSaving} />
                </>
              ) : (
                <>
                  <Row label="联系人姓名"><Val>{user?.name}</Val></Row>
                  <Row label="公司名称"><Val>{user?.company_name}</Val></Row>
                </>
              )}
            </section>

            {/* ── 外观 ── */}
            <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
              <SectionHead label="Appearance" />
              <Row label="外观模式">
                <ThemeModeSelector />
              </Row>
            </section>

            {/* ── 安全（修改密码）── */}
            <section className="border border-[var(--t-border)]" style={{ borderRadius: 'var(--t-radius)' }}>
              <div className="flex items-center justify-between border-b border-[var(--t-border-subtle)] px-5 h-8">
                <span className="font-[var(--t-font-mono)] text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--t-text-muted)]">
                  Security
                </span>
                {!editPwd && <EditBtn onClick={openPwd} label="改密码" />}
              </div>

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
                    <TInput type="password" value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="再次输入新密码" />
                  </Row>
                  <ActionRow onSave={savePwd} onCancel={() => setEditPwd(false)} saving={pwSaving} />
                </>
              ) : (
                <Row label="登录密码">
                  <div className="flex items-center gap-3">
                    <Val>••••••••</Val>
                    <Lock size={12} className="text-[color:var(--t-text-muted)]" />
                  </div>
                </Row>
              )}
            </section>

          </div>
        </div>
      </main>
    </TerminalLayout>
  )
}
