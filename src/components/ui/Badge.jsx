const colorMap = {
  blue: 'bg-blue-50 text-blue-700 border border-blue-100',
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  orange: 'bg-orange-50 text-orange-700 border border-orange-100',
  purple: 'bg-purple-50 text-purple-700 border border-purple-100',
  gray: 'bg-slate-100 text-slate-600 border border-slate-200',
  red: 'bg-red-50 text-red-600 border border-red-100',
}

export function Badge({ children, color = 'blue', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorMap[color]} ${className}`}>
      {children}
    </span>
  )
}

export function StatusBadge({ status }) {
  const map = {
    published: { label: '招聘中', color: 'green' },
    active:    { label: '招聘中', color: 'green' },
    draft:     { label: '草稿',   color: 'gray'   },
    paused:    { label: '已暂停', color: 'orange'  },
    closed:    { label: '已关闭', color: 'gray'    },
  }
  const { label, color } = map[status] || { label: status, color: 'gray' }
  return <Badge color={color}>{label}</Badge>
}