import { useNavigate } from 'react-router-dom'
import { MessageSquare, UserCheck, FileText, Briefcase, X, BellOff } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'

const TYPE_ICONS = {
  new_message:               MessageSquare,
  invitation_status_change:  UserCheck,
  application_status_change: FileText,
  headhunting_request:       Briefcase,
}

function getNavPath(notif, role) {
  const d = notif.data || {}
  switch (notif.type) {
    case 'new_message':
      return role === 'employer' ? '/employer/messages' : '/candidate/messages'
    case 'invitation_status_change':
      return role === 'employer' ? '/employer/candidates' : '/candidate/home'
    case 'application_status_change':
      return role === 'employer' ? '/employer/candidates' : '/candidate/home'
    case 'headhunting_request':
      return '/employer/headhunting'
    default:
      return null
  }
}

function relativeTime(isoStr) {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function NotificationItem({ notif, onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { markRead, dismiss } = useNotifications()

  const Icon = TYPE_ICONS[notif.type] || MessageSquare

  const handleClick = async () => {
    await markRead(notif.id)
    const path = getNavPath(notif, user?.role)
    if (path) navigate(path)
    onClose()
  }

  const handleDismiss = (e) => {
    e.stopPropagation()
    dismiss(notif.id)
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 14px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--t-border-subtle)',
        background: notif.is_read ? 'transparent' : 'var(--t-bg-elevated)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--t-bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = notif.is_read ? 'transparent' : 'var(--t-bg-elevated)'}
    >
      <div style={{
        flexShrink: 0,
        marginTop: 2,
        color: 'var(--t-primary)',
      }}>
        <Icon size={14} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '12px',
          fontWeight: notif.is_read ? 400 : 600,
          color: 'var(--t-text)',
          lineHeight: '1.4',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {notif.title}
        </div>
        {notif.body && (
          <div style={{
            fontSize: '11px',
            color: 'var(--t-text-muted)',
            marginTop: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {notif.body}
          </div>
        )}
        <div style={{
          fontSize: '10px',
          color: 'var(--t-text-muted)',
          marginTop: 3,
        }}>
          {relativeTime(notif.created_at)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {!notif.is_read && (
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--t-danger)',
          }} />
        )}
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            borderRadius: 'var(--t-radius)',
            border: 'none',
            background: 'transparent',
            color: 'var(--t-text-muted)',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--t-text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--t-text-muted)'}
          title="删除"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  )
}

export default function NotificationPanel() {
  const { notifications, unreadCount, markAllRead, setPanelOpen } = useNotifications()

  return (
    <>
      {/* backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 49,
        }}
        onClick={() => setPanelOpen(false)}
      />

      {/* panel */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          zIndex: 50,
          width: 320,
          maxHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--t-bg-panel)',
          border: '1px solid var(--t-border)',
          borderRadius: 'var(--t-radius)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--t-border)',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--t-text)',
            letterSpacing: '0.05em',
          }}>
            通知
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                style={{
                  fontSize: '11px',
                  color: 'var(--t-primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--t-primary-hover)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--t-primary)'}
              >
                全部已读
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 20, height: 20,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--t-text-muted)', padding: 0,
                borderRadius: 'var(--t-radius)',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--t-text)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--t-text-muted)'}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px 16px',
              gap: 8,
              color: 'var(--t-text-muted)',
            }}>
              <BellOff size={24} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: '12px' }}>暂无通知</span>
            </div>
          ) : (
            notifications.map(n => (
              <NotificationItem
                key={n.id}
                notif={n}
                onClose={() => setPanelOpen(false)}
              />
            ))
          )}
        </div>
      </div>
    </>
  )
}
