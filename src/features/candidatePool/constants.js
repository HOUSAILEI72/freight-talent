import { DEFAULT_FUNCTIONS } from '../../components/terminal/FunctionRail'

export const FUNCTION_OPTIONS = DEFAULT_FUNCTIONS.filter(f => f.key !== 'ALL')

export const AVAIL_OPTIONS = [
  { value: 'open',    label: '开放机会' },
  { value: 'passive', label: '被动寻找' },
  { value: 'all',     label: '全部' },
]
