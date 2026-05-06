import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { submitTagNote, getMyTagNote } from '../../api/tagsV2'

/**
 * TagNoteModal — 为已选标签写自定义描述
 *
 * Props:
 *   tag       { id, name, category }  必须是 active 标签对象（含 id）
 *   onClose   () => void
 */
export function TagNoteModal({ tag, onClose }) {
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | submitting | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [existingStatus, setExistingStatus] = useState(null)

  // 加载当前用户已有的描述
  useEffect(() => {
    if (!tag?.id) return
    setStatus('loading')
    getMyTagNote(tag.id)
      .then((data) => {
        if (data.note) {
          setNote(data.note.note || '')
          setExistingStatus(data.note.status)
        }
        setStatus('idle')
      })
      .catch(() => setStatus('idle'))
  }, [tag?.id])

  const handleSubmit = async () => {
    const trimmed = note.trim()
    if (!trimmed) { setErrorMsg('请输入描述内容'); return }
    if (trimmed.length > 200) { setErrorMsg('描述不能超过 200 字'); return }
    setErrorMsg('')
    setStatus('submitting')
    try {
      const res = await submitTagNote(tag.id, trimmed)
      setExistingStatus(res.status)
      setStatus('done')
    } catch (e) {
      setErrorMsg(e.response?.data?.detail || '提交失败，请重试')
      setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800">自定义标签描述</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-medium text-blue-600">{tag?.name}</span>
              <span className="mx-1 text-slate-300">·</span>
              {tag?.category}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* 状态提示 */}
        {existingStatus === 'pending' && status !== 'done' && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs border border-amber-100">
            当前描述正在审核中，重新提交将覆盖并重置审核状态
          </div>
        )}

        {status === 'done' ? (
          <div className="py-6 text-center">
            <p className="text-emerald-600 font-medium">
              {existingStatus === 'active' ? '描述已保存' : '描述已提交，等待管理员审批'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 text-sm text-slate-500 hover:text-slate-700"
            >
              关闭
            </button>
          </div>
        ) : (
          <>
            {/* 文本域 */}
            <div className="relative">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={200}
                placeholder={`描述你在「${tag?.name}」方面的具体经验或使用场景...`}
                disabled={status === 'loading' || status === 'submitting'}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm resize-none outline-none
                  focus:border-blue-400 focus:ring-1 focus:ring-blue-100
                  disabled:bg-slate-50 disabled:opacity-60"
              />
              <span className={`absolute bottom-2 right-3 text-xs ${note.length > 190 ? 'text-orange-500' : 'text-slate-400'}`}>
                {note.length}/200
              </span>
            </div>

            {errorMsg && (
              <p className="mt-1.5 text-xs text-red-500">{errorMsg}</p>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={status === 'loading' || status === 'submitting'}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 font-medium"
              >
                {status === 'submitting' ? '提交中...' : '保存描述'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
