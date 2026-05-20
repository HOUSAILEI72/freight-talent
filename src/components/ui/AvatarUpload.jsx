import { useRef, useState } from 'react'
import { Camera, Trash2, Loader } from 'lucide-react'
import { usersApi } from '../../api/users'
import { useAuth } from '../../context/AuthContext'

const SIZE_MAP = {
  sm: { outer: 32, icon: 12, text: '10px' },
  md: { outer: 48, icon: 14, text: '14px' },
  lg: { outer: 72, icon: 16, text: '22px' },
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 3 * 1024 * 1024

function initials(name) {
  if (!name) return '?'
  return name.trim()[0].toUpperCase()
}

/**
 * Props:
 *   currentUrl   string|null   当前头像 URL
 *   userName     string        用于首字 fallback
 *   size         'sm'|'md'|'lg'
 *   onChange     (newUrl|null) => void   上传/删除成功后回调
 *   onError      (msg) => void           可选，错误提示
 *   terminal     bool          使用 --t-* token（Terminal 深色路径）
 */
export default function AvatarUpload({
  currentUrl,
  userName = '',
  size = 'md',
  onChange,
  onError,
  terminal = true,
}) {
  const { user } = useAuth()
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hovered, setHovered] = useState(false)

  const dim = SIZE_MAP[size] ?? SIZE_MAP.md
  const displayUrl = preview ?? currentUrl

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!ALLOWED_TYPES.includes(file.type)) {
      onError?.('仅支持 JPEG、PNG、WebP 格式')
      return
    }
    if (file.size > MAX_BYTES) {
      onError?.('图片不能超过 3 MB')
      return
    }

    // 本地预览
    const url = URL.createObjectURL(file)
    setPreview(url)

    // 自动上传
    doUpload(file, url)
  }

  async function doUpload(file, localUrl) {
    setUploading(true)
    try {
      const res = await usersApi.uploadAvatar(file)
      const newUrl = res.data.avatar_url
      URL.revokeObjectURL(localUrl)
      setPreview(null)
      window.dispatchEvent(new CustomEvent('auth:user-updated', {
        detail: { ...user, avatar_url: newUrl },
      }))
      onChange?.(newUrl)
    } catch (e) {
      URL.revokeObjectURL(localUrl)
      setPreview(null)
      onError?.(e.response?.data?.detail ?? '上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await usersApi.deleteAvatar()
      window.dispatchEvent(new CustomEvent('auth:user-updated', {
        detail: { ...user, avatar_url: null },
      }))
      onChange?.(null)
    } catch {
      onError?.('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const busy = uploading || deleting

  return (
    <div className="flex items-center gap-3">
      {/* 头像圆圈 */}
      <div
        className="relative shrink-0 rounded-full overflow-hidden cursor-pointer select-none"
        style={{
          width: dim.outer,
          height: dim.outer,
          background: displayUrl ? 'transparent' : 'var(--t-primary)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => !busy && fileRef.current?.click()}
        title="点击更换头像"
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="头像"
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center font-bold text-white"
            style={{ fontSize: dim.text }}
          >
            {initials(userName)}
          </div>
        )}

        {/* hover 遮罩 */}
        {hovered && !busy && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <Camera size={dim.icon} color="#fff" />
          </div>
        )}

        {/* 上传 spinner */}
        {busy && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <Loader size={dim.icon} color="#fff" className="animate-spin" />
          </div>
        )}
      </div>

      {/* 删除按钮（有头像时才显示） */}
      {(currentUrl || preview) && !uploading && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--t-danger)',
            background: 'transparent',
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.4 : 1,
            padding: '2px 0',
          }}
        >
          <Trash2 size={11} />
          删除头像
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
