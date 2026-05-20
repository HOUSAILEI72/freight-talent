import { FolderOpen } from 'lucide-react'

export function EmptyConversationState({ userRole, terminal }) {
  return (
    <div
      className={terminal
        ? 'flex flex-col items-center justify-center py-12 px-4 text-center'
        : 'flex flex-col items-center justify-center py-12 text-slate-400 px-4 text-center'
      }
      style={terminal ? { color: 'var(--t-text-muted)' } : undefined}
    >
      <FolderOpen size={28} className={terminal ? 'mb-2' : 'mb-2 text-slate-300'} style={terminal ? { color: 'var(--t-text-muted)' } : undefined} />
      <p className="text-xs">
        {userRole === 'employer'
          ? '向候选人发出邀约后，沟通入口将出现在这里'
          : '收到企业邀约后，沟通入口将出现在这里'}
      </p>
    </div>
  )
}
