import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Smile, MessageSquarePlus, Paperclip, Image as ImageIcon, X, Pencil, Trash2, Plus, Check } from 'lucide-react'
import Picker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import { useAutoResize } from '../../../hooks/useAutoResize'
import { CandidateEmailActionBar } from './CandidateEmailActionBar'

// ── Emoji picker (emoji-mart) ─────────────────────────────────────────────────
function EmojiPickerPanel({ anchorRef, onSelect }) {
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  // Detect terminal dark/light theme
  const theme = (() => {
    const attr = document.querySelector('[data-terminal-theme]')?.dataset.terminalTheme
    if (attr === 'dark' || attr === 'light') return attr
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })()

  useEffect(() => {
    if (!anchorRef.current) return
    const r = anchorRef.current.getBoundingClientRect()
    const panelW = 352
    const left = Math.min(r.left, window.innerWidth - panelW - 8)
    setPos({ bottom: window.innerHeight - r.top + 4, left })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      data-emoji-panel
      style={{ position: 'fixed', bottom: pos.bottom, left: pos.left, zIndex: 9999 }}
    >
      <Picker
        data={emojiData}
        onEmojiSelect={e => onSelect(e.native)}
        theme={theme}
        locale="zh"
        previewPosition="none"
        skinTonePosition="search"
      />
    </div>
  )
}

// ── Message templates ─────────────────────────────────────────────────────────
const TEMPLATES = [
  { label: '邀约面试',  text: '您好！我们对您的背景很感兴趣，想邀请您来参加面试，请问您近期是否方便？' },
  { label: '确认面试',  text: '确认您的面试时间为【日期/时间】，地点为【地址】，期待与您见面！' },
  { label: '感谢应聘',  text: '感谢您投递我们的职位，我们会在3个工作日内与您联系，请保持电话畅通。' },
  { label: '简历更新',  text: '您好，麻烦您更新一下简历，特别是【具体信息】部分，以便我们更好地评估，谢谢！' },
  { label: 'offer 确认', text: '恭喜您通过面试！我们正式发出 Offer，薪资及福利详情见附件，请确认后回复，谢谢。' },
  { label: '婉拒候选人', text: '感谢您对我们公司的关注，经评估您目前与该职位匹配度不够，希望之后有机会再合作，谢谢理解。' },
]

const TEMPLATE_STORAGE_KEY = 'ace_msg_templates_v1'

function loadUserTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || '[]') } catch { return [] }
}
function saveUserTemplates(list) {
  try { localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(list)) } catch {}
}

function TemplatePanel({ onSelect, anchorRef }) {
  const panelRef = useRef(null)
  const [pos, setPos] = useState({ bottom: 0, left: 0 })

  const [userTemplates, setUserTemplates] = useState(loadUserTemplates)
  const [editId,    setEditId]    = useState(null)
  const [formLabel, setFormLabel] = useState('')
  const [formText,  setFormText]  = useState('')
  const formTextRef = useRef(null)
  useEffect(() => {
    const el = formTextRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [formText])

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect()
      const panelW = 340
      const left = Math.min(r.left, window.innerWidth - panelW - 8)
      setPos({ bottom: window.innerHeight - r.top + 4, left })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function openNew() { setFormLabel(''); setFormText(''); setEditId('new') }
  function openEdit(t) { setFormLabel(t.label); setFormText(t.text); setEditId(t.id) }
  function cancelEdit() { setEditId(null) }

  function saveForm() {
    if (!formText.trim()) return
    const label = formLabel.trim() || formText.slice(0, 10)
    let next
    if (editId === 'new') {
      next = [...userTemplates, { id: Date.now(), label, text: formText.trim() }]
    } else {
      next = userTemplates.map(t => t.id === editId ? { ...t, label, text: formText.trim() } : t)
    }
    saveUserTemplates(next)
    setUserTemplates(next)
    setEditId(null)
  }

  function deleteTemplate(id) {
    const next = userTemplates.filter(t => t.id !== id)
    saveUserTemplates(next)
    setUserTemplates(next)
    if (editId === id) setEditId(null)
  }

  return (
    <div
      ref={panelRef}
      className="terminal-mode"
      style={{
        position: 'fixed', bottom: pos.bottom, left: pos.left,
        zIndex: 9999, width: 340, borderRadius: 10,
        background: 'var(--t-bg-elevated)',
        border: '1px solid var(--t-border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 10px 7px 14px', borderBottom: '1px solid var(--t-border-subtle)' }}>
        <span style={{ flex: 1, fontSize: 11, color: 'var(--t-text-muted)', fontWeight: 500 }}>常用语</span>
        <button
          type="button" onClick={openNew}
          style={{
            display: 'flex', alignItems: 'center', gap: 3,
            padding: '3px 8px', borderRadius: 5,
            fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
            background: 'var(--t-bg-hover)', color: 'var(--t-text-secondary)',
            transition: 'background 100ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-primary-muted)'; e.currentTarget.style.color = 'var(--t-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text-secondary)' }}
        >
          <Plus size={11} /> 新建
        </button>
      </div>

      <div style={{ maxHeight: 300, overflowY: 'auto' }} className="terminal-scrollbar">
        {TEMPLATES.map(t => (
          <button
            key={t.label} type="button" onClick={() => onSelect(t.text)}
            style={{ width: '100%', textAlign: 'left', padding: '9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--t-border-subtle)', transition: 'background 100ms' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-text-secondary)' }}>{t.label}</div>
              <span style={{ fontSize: 9, color: 'var(--t-text-muted)', opacity: 0.6 }}>内置</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.text}</div>
          </button>
        ))}

        {userTemplates.map(t => (
          <div key={t.id} style={{ position: 'relative', borderBottom: '1px solid var(--t-border-subtle)' }}>
            <button
              type="button" onClick={() => onSelect(t.text)}
              style={{ width: '100%', textAlign: 'left', padding: '9px 70px 9px 14px', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'background 100ms' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t-primary)', marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--t-text-muted)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.text}</div>
            </button>
            <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 2 }}>
              <button
                type="button" onClick={e => { e.stopPropagation(); openEdit(t) }} title="编辑"
                style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--t-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' }}
              ><Pencil size={12} /></button>
              <button
                type="button" onClick={e => { e.stopPropagation(); deleteTemplate(t.id) }} title="删除"
                style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer', color: 'var(--t-text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-danger)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' }}
              ><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {editId !== null && (
        <div style={{ borderTop: '1px solid var(--t-border)', padding: '10px 14px 12px', background: 'var(--t-bg-panel)' }}>
          <div style={{ fontSize: 11, color: 'var(--t-text-muted)', marginBottom: 6, fontWeight: 500 }}>
            {editId === 'new' ? '新建常用语' : '编辑常用语'}
          </div>
          <input
            type="text" placeholder="标题（选填）"
            value={formLabel} onChange={e => setFormLabel(e.target.value)}
            style={{
              width: '100%', marginBottom: 6, padding: '5px 8px', borderRadius: 5, fontSize: 12,
              border: '1px solid var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text)',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--t-font-ui)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-border-focus)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-border)' }}
          />
          <textarea
            ref={formTextRef} rows={1} placeholder="内容（必填）"
            value={formText} onChange={e => setFormText(e.target.value)}
            style={{
              width: '100%', marginBottom: 8, padding: '5px 8px', borderRadius: 5, fontSize: 12,
              border: '1px solid var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text)',
              outline: 'none', resize: 'none', overflow: 'hidden', boxSizing: 'border-box',
              lineHeight: 1.5, fontFamily: 'var(--t-font-ui)',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-border-focus)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-border)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button" onClick={cancelEdit}
              style={{ padding: '4px 12px', borderRadius: 5, fontSize: 12, border: '1px solid var(--t-border)', background: 'transparent', color: 'var(--t-text-muted)', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-bg-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >取消</button>
            <button
              type="button" onClick={saveForm} disabled={!formText.trim()}
              style={{
                padding: '4px 12px', borderRadius: 5, fontSize: 12, border: 'none',
                background: formText.trim() ? 'var(--t-primary)' : 'var(--t-bg-hover)',
                color: formText.trim() ? '#fff' : 'var(--t-text-muted)',
                cursor: formText.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Check size={11} /> 保存
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolBtn({ icon: Icon, title, active, onClick }) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={!onClick}
      style={{
        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none',
        background: active ? 'var(--t-bg-hover)' : 'transparent',
        color: active ? 'var(--t-primary)' : 'var(--t-text-muted)',
        cursor: onClick ? 'pointer' : 'not-allowed',
        opacity: onClick ? 1 : 0.52,
        transition: 'background 120ms, color 120ms',
      }}
      onMouseEnter={e => { if (onClick && !active) { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text-secondary)' } }}
      onMouseLeave={e => { if (onClick && !active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' } }}
    >
      <Icon size={17} />
    </button>
  )
}

export function MessageComposer({
  input, onChange, onSubmit, terminal,
  textareaClassName = '',
  candidateId, jobId, threadId, myRole,
}) {
  const textareaRef = useAutoResize(input, { maxRows: 6, lineHeight: 22 })
  const [emojiOpen,     setEmojiOpen]     = useState(false)
  const [templateOpen,  setTemplateOpen]  = useState(false)
  const [pendingFiles,  setPendingFiles]  = useState([])
  const emojiAnchorRef    = useRef(null)
  const templateAnchorRef = useRef(null)
  const fileInputRef      = useRef(null)
  const imageInputRef     = useRef(null)

  const showQuickChips = terminal
    && (myRole === 'employer' || myRole === 'admin')
    && !!candidateId && !!jobId

  // Close pickers on outside click
  useEffect(() => {
    if (!emojiOpen && !templateOpen) return
    function handle(e) {
      if (emojiAnchorRef.current?.contains(e.target))    return
      if (templateAnchorRef.current?.contains(e.target)) return
      if (e.target.closest('[data-emoji-panel]') || e.target.closest('[data-template-panel]')) return
      setEmojiOpen(false)
      setTemplateOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [emojiOpen, templateOpen])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const insertAtCursor = useCallback((text) => {
    const ta = textareaRef.current
    const start = ta?.selectionStart ?? input.length
    const end   = ta?.selectionEnd   ?? input.length
    const newVal = input.slice(0, start) + text + input.slice(end)
    onChange(newVal)
    requestAnimationFrame(() => {
      if (ta) {
        const pos = start + [...text].length
        ta.setSelectionRange(pos, pos)
        ta.focus()
      }
    })
  }, [input, onChange, textareaRef])

  function handleFileSelect(e, isImage) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newFiles = files.map(f => ({
      name: f.name, isImage,
      preview: isImage ? URL.createObjectURL(f) : null,
    }))
    setPendingFiles(prev => [...prev, ...newFiles])
    e.target.value = ''
  }

  function removeFile(idx) {
    setPendingFiles(prev => {
      if (prev[idx]?.preview) URL.revokeObjectURL(prev[idx].preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  function handleFormSubmit(e) {
    e.preventDefault()
    const fileText = pendingFiles.map(f => `[${f.isImage ? '图片' : '文件'}: ${f.name}]`).join('\n')
    const finalMsg = fileText
      ? (input.trim() ? `${input}\n${fileText}` : fileText)
      : input
    if (!finalMsg.trim()) return
    setPendingFiles(prev => { prev.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) }); return [] })
    onSubmit(e, finalMsg)
  }

  // ── public light branch ──────────────────────────────────────────────────
  if (!terminal) {
    return (
      <form
        onSubmit={e => { e.preventDefault(); onSubmit(e) }}
        className="px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            value={input}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e) } }}
            className={[
              'flex-1 px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none',
              textareaClassName,
            ].filter(Boolean).join(' ')}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={13} />发送
          </button>
        </div>
      </form>
    )
  }

  const canSend = !!input.trim() || pendingFiles.length > 0

  // ── Terminal BOSS-style composer ─────────────────────────────────────────
  return (
    <form
      onSubmit={handleFormSubmit}
      style={{ flexShrink: 0, borderTop: '1px solid var(--t-border)', background: 'var(--t-bg-panel)', position: 'relative' }}
    >
      <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e, false)} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e, true)} />

      {emojiOpen && (
        <EmojiPickerPanel
          anchorRef={emojiAnchorRef}
          onSelect={text => { insertAtCursor(text); setEmojiOpen(false) }}
        />
      )}
      {templateOpen && (
        <div data-template-panel>
          <TemplatePanel onSelect={text => { insertAtCursor(text); setTemplateOpen(false) }} anchorRef={templateAnchorRef} />
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '7px 14px 7px 12px', gap: 2, borderBottom: '1px solid var(--t-border-subtle)', minHeight: 44 }}>
        <button
          ref={emojiAnchorRef}
          type="button" title="表情"
          onClick={() => { setTemplateOpen(false); setEmojiOpen(v => !v) }}
          style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, border: 'none',
            background: emojiOpen ? 'var(--t-bg-hover)' : 'transparent',
            color: emojiOpen ? 'var(--t-primary)' : 'var(--t-text-muted)',
            cursor: 'pointer', transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={e => { if (!emojiOpen) { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text-secondary)' } }}
          onMouseLeave={e => { if (!emojiOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' } }}
        >
          <Smile size={17} />
        </button>

        <button
          ref={templateAnchorRef}
          type="button" title="常用语"
          onClick={() => { setEmojiOpen(false); setTemplateOpen(v => !v) }}
          style={{
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, border: 'none',
            background: templateOpen ? 'var(--t-bg-hover)' : 'transparent',
            color: templateOpen ? 'var(--t-primary)' : 'var(--t-text-muted)',
            cursor: 'pointer', transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={e => { if (!templateOpen) { e.currentTarget.style.background = 'var(--t-bg-hover)'; e.currentTarget.style.color = 'var(--t-text-secondary)' } }}
          onMouseLeave={e => { if (!templateOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--t-text-muted)' } }}
        >
          <MessageSquarePlus size={17} />
        </button>

        <ToolBtn icon={Paperclip} title="附件" active={false} onClick={() => fileInputRef.current?.click()} />
        <ToolBtn icon={ImageIcon}  title="图片" active={false} onClick={() => imageInputRef.current?.click()} />

        {showQuickChips && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--t-border)', margin: '0 6px', flexShrink: 0 }} />
            <CandidateEmailActionBar candidateId={candidateId} jobId={jobId} threadId={threadId} terminal />
          </>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--t-text-muted)', opacity: 0.5, flexShrink: 0, paddingLeft: 8 }}>
          Enter 发送 · Shift+Enter 换行
        </span>
      </div>

      {/* Pending file chips */}
      {pendingFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px 4px', borderBottom: '1px solid var(--t-border-subtle)' }}>
          {pendingFiles.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', borderRadius: 6, background: 'var(--t-bg-elevated)', border: '1px solid var(--t-border)', maxWidth: 200 }}>
              {f.preview ? (
                <img src={f.preview} alt="" style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
              ) : (
                <Paperclip size={12} style={{ color: 'var(--t-text-muted)', flexShrink: 0 }} />
              )}
              <span style={{ fontSize: 11, color: 'var(--t-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
              <button
                type="button" onClick={() => removeFile(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t-text-muted)', padding: 1, display: 'flex', flexShrink: 0 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--t-danger)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--t-text-muted)' }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea + send */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, padding: '10px 16px 12px' }}>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="请输入消息内容…"
          value={input}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFormSubmit(e) }
          }}
          className={['flex-1 resize-none focus:outline-none terminal-scrollbar', textareaClassName].filter(Boolean).join(' ')}
          style={{ background: 'transparent', border: 'none', color: 'var(--t-text)', fontSize: 14, lineHeight: 1.65, padding: 0, fontFamily: 'var(--t-font-ui)' }}
        />
        <button
          type="submit"
          disabled={!canSend}
          className={canSend ? 't-card-pressable' : ''}
          style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: canSend ? 'var(--t-primary)' : 'var(--t-bg-elevated)',
            color: canSend ? '#fff' : 'var(--t-text-muted)',
            border: `1px solid ${canSend ? 'var(--t-primary)' : 'var(--t-border)'}`,
            cursor: canSend ? 'pointer' : 'not-allowed',
            transition: 'background 120ms, color 120ms, transform var(--t-dur-fast) var(--t-ease-std)',
          }}
          onMouseEnter={e => { if (canSend) e.currentTarget.style.background = 'var(--t-primary-hover)' }}
          onMouseLeave={e => { if (canSend) e.currentTarget.style.background = 'var(--t-primary)' }}
        >
          <Send size={14} />发送
        </button>
      </div>
    </form>
  )
}
