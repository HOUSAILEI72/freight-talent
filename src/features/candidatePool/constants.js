import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'
import { Users, Inbox, Star, UserSearch, UsersRound, BriefcaseBusiness } from 'lucide-react'

export const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

export const AVAIL_OPTIONS = [
  { value: 'all',         label: '全部' },
  { value: 'open',        label: '离职-随时到岗' },
  { value: 'passive_now', label: '在职-月内到岗' },
  { value: 'passive',     label: '在职-考虑机会' },
]

export const CANDIDATE_POOL_TABS = [
  { key: 'all',                 label: '全量候选人', short: 'ALL', icon: Users },
  { key: 'applied',             label: '投递候选人', short: 'APP', icon: Inbox },
  { key: 'favorited',           label: '企业收藏',   short: 'FAV', icon: Star },
  { key: 'personal_headhunter', label: '个人猎头池', short: 'PH',  icon: UserSearch },
  { key: 'team_headhunter',     label: '团队猎头池', short: 'TH',  icon: UsersRound },
  { key: 'entrusted',           label: '委托招聘池', short: 'ENT', icon: BriefcaseBusiness },
]
