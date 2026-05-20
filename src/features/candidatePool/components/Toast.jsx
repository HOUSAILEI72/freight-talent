import { useEffect } from 'react'
import { CheckCircle } from 'lucide-react'

export function Toast({ name, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900 text-white rounded-xl shadow-xl">
      <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
      <span className="text-sm font-medium">已向 <strong>{name}</strong> 发出邀约</span>
    </div>
  )
}
