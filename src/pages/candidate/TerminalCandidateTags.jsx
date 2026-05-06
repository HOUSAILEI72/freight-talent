import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, AlertCircle, ListChecks, FileUp, ArrowRight } from 'lucide-react'
import TerminalLayout from '../../components/terminal/TerminalLayout'
import { CANDIDATE_ICON_NAV } from '../../components/terminal/navItems'
import MyTags from '../tags/MyTags'
import { candidatesApi } from '../../api/candidates'
import {
  getMissingProfileFields,
  summarizeMissingFields,
} from '../../utils/candidateProfile'

/**
 * /candidate/tags is the canonical "个人订阅" entry point. Before showing the
 * subscription/tag UI, we gate on candidate-profile completeness. If the
 * profile is incomplete, we point the user at /candidate/profile/builder
 * (CAND-2) — until that page lands, this gate also surfaces the existing
 * /candidate/upload as a fallback path so the user is never stuck.
 */
export default function TerminalCandidateTags() {
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [profile, setProfile] = useState(null)

  const source = searchParams.get('source')

  useEffect(() => {
    let cancelled = false
    candidatesApi.getMyCandidateProfile()
      .then(res => {
        if (cancelled) return
        setProfile(res.data?.profile ?? null)
      })
      .catch(err => {
        if (cancelled) return
        setError(err.response?.data?.message ?? '加载档案失败，请刷新重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const missing = getMissingProfileFields(profile)
  const isComplete = !loading && !error && missing.length === 0

  return (
    <TerminalLayout title="SUBSCRIPTIONS" activeIconId="tags" navItems={CANDIDATE_ICON_NAV}>
      {loading && <GateLoading />}
      {!loading && error && <GateError message={error} />}
      {!loading && !error && !isComplete && <GateIncomplete missing={missing} source={source} />}
      {isComplete && <MyTags terminal />}
    </TerminalLayout>
  )
}

function GateLoading() {
  return (
    <div
      className="flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text-muted)' }}
    >
      <div className="flex items-center gap-2 text-sm">
        <Loader2 size={14} className="animate-spin" />
        <span>正在加载候选人档案...</span>
      </div>
    </div>
  )
}

function GateError({ message }) {
  return (
    <div
      className="flex-1 w-full min-w-0 h-full min-h-0 flex items-center justify-center px-6"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      <div
        className="max-w-md w-full rounded-lg border p-5"
        style={{ background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }}
      >
        <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--t-danger)' }}>
          <AlertCircle size={16} />
          <span className="text-sm font-semibold">无法加载档案</span>
        </div>
        <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>{message}</p>
      </div>
    </div>
  )
}

function GateIncomplete({ missing, source }) {
  const navigate = useNavigate()
  const labels = summarizeMissingFields(missing)

  // 如果来自邀约邮件，显示特殊文案
  const isFromInvite = source === 'invite_email'
  const title = isFromInvite ? '你收到了企业邀约' : '请先完善候选人档案'
  const description = isFromInvite
    ? '请先构建个人档案，完成后即可查看邀约、订阅岗位并与企业沟通。'
    : '完整的档案是订阅个人岗位推荐和投递岗位的前提。我们需要以下信息才能为你做精确匹配：'

  return (
    <div
      className="flex-1 w-full min-w-0 h-full min-h-0 overflow-y-auto terminal-scrollbar px-6 py-10"
      style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-1" style={{ color: 'var(--t-text-muted)' }}>
          <ListChecks size={14} />
          <span className="text-[11px] tracking-[0.2em] uppercase">SUBSCRIPTIONS · GATE</span>
        </div>
        <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--t-text)' }}>
          {title}
        </h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--t-text-secondary)' }}>
          {description}
        </p>

        <div
          className="rounded-lg border p-4 mb-6"
          style={{ background: 'var(--t-bg-panel)', borderColor: 'var(--t-border)' }}
        >
          <p className="text-xs mb-3" style={{ color: 'var(--t-text-muted)' }}>
            缺失项（{labels.length}）
          </p>
          <ul className="space-y-1.5">
            {labels.map((label) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--t-text-secondary)' }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: 'var(--t-warning)' }}
                />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/candidate/profile/builder')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: 'var(--t-primary)', color: '#fff' }}
          >
            去构建档案
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/candidate/upload')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
            style={{
              background: 'var(--t-bg-elevated)',
              borderColor: 'var(--t-border)',
              color: 'var(--t-text-secondary)',
            }}
          >
            <FileUp size={14} />
            或上传简历
          </button>
        </div>

        <p className="mt-6 text-xs" style={{ color: 'var(--t-text-muted)' }}>
          完成档案后会自动回到本页面。
        </p>
      </div>
    </div>
  )
}
