import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, Sparkles, AlertCircle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { candidatesApi } from '../../api/candidates'

export default function UploadResume({ terminal = false }) {
  const navigate = useNavigate()

  // phase: idle | uploading | parsing | done | error
  const [phase, setPhase] = useState('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [existingProfile, setExistingProfile] = useState(null)

  useEffect(() => {
    candidatesApi.getMyCandidateProfile()
      .then(res => { if (res.data.profile) setExistingProfile(res.data.profile) })
      .catch(() => {})
  }, [])

  async function handleFile(file) {
    setError('')
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'doc', 'docx'].includes(ext)) { setError('仅支持 PDF、DOC、DOCX 格式'); return }
    if (file.size > 10 * 1024 * 1024) { setError('文件大小不能超过 10MB'); return }

    setPhase('uploading')
    setUploadProgress(0)
    try {
      await candidatesApi.uploadResumeFile(file, p => setUploadProgress(p))

      setPhase('parsing')
      try {
        const parseRes = await candidatesApi.aiParseResume()
        const d = parseRes.data?.data
        if (d) sessionStorage.setItem('ai_parse_result', JSON.stringify(d))
      } catch {
        // AI 解析失败不阻断，直接进 edit 页让用户手填
      }

      setPhase('done')
      setTimeout(() => navigate('/candidate/profile/me?tab=edit&ai_prefill=1'), 700)
    } catch (err) {
      setPhase('idle')
      setError(err.response?.data?.message ?? '上传失败，请重试')
    }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const busy = phase === 'uploading' || phase === 'parsing' || phase === 'done'

  return (
    <div
      className={terminal
        ? 'terminal-mode flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-8'
        : 'max-w-2xl mx-auto px-6 py-12'}
      style={terminal ? { background: 'var(--t-bg)', color: 'var(--t-text)' } : undefined}
    >
      <div className={terminal ? 'mx-auto w-full max-w-2xl' : ''}>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: terminal ? 'var(--t-text)' : '#1e293b' }}>
          {existingProfile?.resume_file_name ? '更新你的简历' : '上传你的简历'}
        </h1>
        <p style={{ fontSize: 13, marginBottom: 24, color: terminal ? 'var(--t-text-muted)' : '#64748b' }}>
          支持 PDF、Word 格式。上传后 AI 会自动解析并预填档案所有字段，直接进入编辑页确认即可。
        </p>

        {error && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <AlertCircle size={15} className="flex-shrink-0" />{error}
          </div>
        )}

        {/* 已有简历提示 */}
        {existingProfile?.resume_file_name && !busy && (
          <div style={{
            marginBottom: 20, padding: 14,
            background: terminal ? 'rgba(74,222,128,0.08)' : '#f0fdf4',
            border: `1px solid ${terminal ? 'rgba(74,222,128,0.3)' : '#bbf7d0'}`,
            borderRadius: terminal ? 'var(--t-radius)' : 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={16} style={{ color: terminal ? 'var(--t-success)' : '#16a34a', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: terminal ? 'var(--t-success)' : '#16a34a' }}>
                  当前简历：{existingProfile.resume_file_name}
                </p>
                <p style={{ fontSize: 11, color: terminal ? 'var(--t-text-muted)' : '#4ade80', marginTop: 2 }}>
                  上传于 {existingProfile.resume_uploaded_at?.slice(0, 10) ?? '—'}
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/candidate/profile/me?tab=edit')}>
              直接编辑档案
            </Button>
          </div>
        )}

        {/* 上传区域 */}
        <div
          style={{
            border: `2px dashed ${
              dragging ? (terminal ? 'var(--t-primary)' : '#3b82f6') :
              busy      ? (terminal ? 'var(--t-border-focus)' : '#93c5fd') :
              terminal  ? 'var(--t-border)' : '#e2e8f0'
            }`,
            borderRadius: 16,
            padding: '60px 32px',
            textAlign: 'center',
            cursor: busy ? 'default' : 'pointer',
            background: dragging ? (terminal ? 'var(--t-primary-muted)' : '#eff6ff') :
                        busy     ? (terminal ? 'rgba(37,99,235,0.05)' : '#f8fafc') :
                        'transparent',
            transition: 'border-color 150ms, background 150ms',
          }}
          onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={busy ? undefined : handleDrop}
          onClick={() => !busy && document.getElementById('resume-file-input').click()}
          onMouseEnter={terminal && !busy ? e => { e.currentTarget.style.background = 'var(--t-bg-elevated)' } : undefined}
          onMouseLeave={terminal && !busy ? e => { e.currentTarget.style.background = 'transparent' } : undefined}
        >
          <input id="resume-file-input" type="file" className="hidden" accept=".pdf,.doc,.docx"
            onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />

          {phase === 'idle' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: terminal ? 'var(--t-bg-elevated)' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Upload size={24} style={{ color: terminal ? 'var(--t-text-muted)' : '#94a3b8' }} />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: terminal ? 'var(--t-text)' : '#1e293b' }}>
                {existingProfile?.resume_file_name ? '拖拽新简历到此处' : '拖拽简历到此处'}
              </p>
              <p style={{ fontSize: 13, marginBottom: 16, color: terminal ? 'var(--t-text-muted)' : '#94a3b8' }}>
                或点击选择文件
              </p>
              <Badge color="gray">PDF / Word · 最大 10MB</Badge>
            </>
          )}

          {phase === 'uploading' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: terminal ? 'var(--t-primary-muted)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Sparkles size={24} className="animate-pulse" style={{ color: terminal ? 'var(--t-primary)' : '#3b82f6' }} />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: terminal ? 'var(--t-text)' : '#1e293b' }}>上传中...</p>
              <p style={{ fontSize: 13, marginBottom: 16, color: terminal ? 'var(--t-text-muted)' : '#64748b' }}>{uploadProgress}%</p>
              <div style={{ height: 6, borderRadius: 9999, overflow: 'hidden', width: 180, margin: '0 auto', background: terminal ? 'var(--t-bg-elevated)' : '#e2e8f0' }}>
                <div style={{ height: '100%', borderRadius: 9999, transition: 'width 200ms', width: `${uploadProgress}%`, background: terminal ? 'var(--t-primary)' : '#3b82f6' }} />
              </div>
            </>
          )}

          {phase === 'parsing' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: terminal ? 'var(--t-primary-muted)' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Sparkles size={24} className="animate-pulse" style={{ color: terminal ? 'var(--t-primary)' : '#3b82f6' }} />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: terminal ? 'var(--t-text)' : '#1e293b' }}>AI 正在解析简历...</p>
              <p style={{ fontSize: 13, color: terminal ? 'var(--t-text-muted)' : '#64748b' }}>
                提取工作经历、教育背景、技能标签中
              </p>
            </>
          )}

          {phase === 'done' && (
            <>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: terminal ? 'rgba(74,222,128,0.12)' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={24} style={{ color: terminal ? 'var(--t-success)' : '#16a34a' }} />
              </div>
              <p style={{ fontWeight: 600, marginBottom: 4, color: terminal ? 'var(--t-text)' : '#1e293b' }}>解析完成，正在跳转...</p>
              <p style={{ fontSize: 13, color: terminal ? 'var(--t-text-muted)' : '#64748b' }}>即将进入档案编辑页</p>
            </>
          )}
        </div>

        {/* 说明 */}
        {phase === 'idle' && (
          <div style={{ marginTop: 24, padding: 16, borderRadius: 12, border: `1px solid ${terminal ? 'var(--t-border)' : '#bfdbfe'}`, background: terminal ? 'var(--t-primary-muted)' : '#eff6ff' }}>
            <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, color: terminal ? 'var(--t-primary)' : '#1d4ed8' }}>AI 解析后将自动提取：</p>
            <ul style={{ fontSize: 12, lineHeight: 1.8, color: terminal ? 'var(--t-text-secondary)' : '#3b82f6', margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              <li>· 姓名、性别、出生年月</li>
              <li>· 当前任职（公司、职位、业务方向、薪资结构）</li>
              <li>· 工作经历（每段公司、职位、起止月份、工作内容、薪资、福利）</li>
              <li>· 期望职位 & 期望薪资</li>
              <li>· 项目经历、教育经历、英语水平、资格证书</li>
              <li>· 能力标签（岗位标签 & 软技能）</li>
            </ul>
          </div>
        )}

      </div>
    </div>
  )
}
