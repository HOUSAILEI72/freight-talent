import {
  LayoutDashboard,
  Briefcase,
  Users,
  MessageSquare,
  Tags,
  Settings,
  Send,
  Inbox,
  CircleUser,
} from 'lucide-react'

export const EMPLOYER_ICON_NAV = [
  { id: 'dashboard',  icon: LayoutDashboard, label: 'Dashboard',  href: '/employer/dashboard' },
  { id: 'jobs',       icon: Briefcase,       label: 'Jobs',       href: '/employer/jobs' },
  { id: 'candidates', icon: Users,           label: 'Candidates', href: '/employer/candidates' },
  { id: 'messages',   icon: MessageSquare,   label: 'Messages',   href: '/employer/messages' },
  { id: 'tags',       icon: Tags,            label: 'Tags',       href: '/employer/tags' },
  { id: 'settings',   icon: Settings,        label: 'Settings',   href: '/employer/settings' },
]

export const CANDIDATE_ICON_NAV = [
  { id: 'dashboard',    icon: LayoutDashboard, label: 'Dashboard',     href: '/candidate/home' },
  { id: 'jobs',         icon: Briefcase,       label: 'Jobs',          href: '/candidate/jobs' },
  { id: 'applications', icon: Send,            label: 'Applications',  href: '/candidate/applications' },
  { id: 'invitations',  icon: Inbox,           label: 'Invitations',   href: '/candidate/invitations' },
  { id: 'messages',    icon: MessageSquare,   label: 'Messages',      href: '/candidate/messages' },
  { id: 'tags',         icon: Tags,            label: 'Subscriptions', href: '/candidate/tags' },
  { id: 'profile',      icon: CircleUser,      label: 'Profile',       href: '/candidate/profile/me' },
  { id: 'settings',     icon: Settings,        label: 'Settings',      href: '/candidate/settings' },
]
