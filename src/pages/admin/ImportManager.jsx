import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, FileSpreadsheet, Download, Play, CheckCircle2, AlertTriangle,
  XCircle, Info, ChevronDown, ChevronUp, RefreshCw, Clock, Database,
  Loader2, AlertCircle, SkipForward, Tag, ToggleLeft, ToggleRight,
  Check, X, FileSpreadsheet as FileSpreadsheetIcon,
} from 'lucide-react'
import { adminApi } from '../../api/admin'
import { Button } from '../../components/ui/Button'
import {
  getTags, getCategories, importTagsExcel,
  getPendingTags, reviewTag,
  getPendingNotes, reviewNote,
  getTagApprovalSetting, setTagApprovalSetting,
} from '../../api/tagsV2'

// ─────────────────────────────────────────────────────────────────────────────
// 共享小组件
// ─────────────────────────────────────────────────────────────────────────────

function StatPill({ label, value, color = 'slate' }) {
  const colors = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    red:   'bg-red-50 text-red-700 border border-red-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    blue:  'bg-blue-50 text-blue-700 border border-blue-200',
  }
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg text-sm font-medium ${colors[color]}`}>
      <span className="text-xl font-bold">{value ?? '—'}</span>
      <span className="text-xs mt-0.5 opacity-80">{label}</span>
    </div>
  )
}

function SectionToggle({ title, icon: Icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
      >
        <span className="flex items-center gap-2">
          {Icon && <Icon size={15} className="text-slate-500" />}
          {title}
          {count != null && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
              {count}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  )
}

const ERROR_ISSUE_TYPES = new Set([
  'error', 'missing_required', 'file_parse_error',
  'duplicate_header', 'template_mismatch', 'type_conflict',
])
const WARN_ISSUE_TYPES = new Set([
  'warning', 'dup_warning', 'text_global_duplicate', 'row_duplicate',
  'row_limit_truncated', 'no_data',
])

function IssueRow({ issue }) {
  const issueType = issue.issue_type || issue.severity || ''
  const isErr  = ERROR_ISSUE_TYPES.has(issueType)
  const isWarn = !isErr && WARN_ISSUE_TYPES.has(issueType)
  const rowNum  = issue.row ?? issue.row_index
  return (
    <div className={`flex gap-3 px-3 py-2 rounded-lg text-xs ${
      isErr  ? 'bg-red-50 text-red-700' :
      isWarn ? 'bg-amber-50 text-amber-700' :
               'bg-slate-50 text-slate-600'
    }`}>
      {isErr  ? <XCircle size={13} className="flex-shrink-0 mt-0.5" /> :
       isWarn ? <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> :
                <Info size={13} className="flex-shrink-0 mt-0.5" />}
      <span>
        {rowNum != null && <b>第 {rowNum} 行 · </b>}
        {issue.field && <b>[{issue.field}] </b>}
        {issue.reason || issue.message || issue.suggestion || JSON.stringify(issue)}
      </span>
    </div>
  )
}

function StatusBadge({ status, isConfirmed }) {
  if (isConfirmed || status === 'confirmed') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">已确认</span>
  }
  if (status === 'preview') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">预检完成</span>
  }
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 1：数据导入
// ─────────────────────────────────────────────────────────────────────────────

function PreviewPanel({ result, onConfirm, onDryRun, confirming, dryRunning }) {
  const {
    batch_id, import_type, original_filename,
    preview_stats, errors = [], warnings = [], new_fields = [],
    fields_registration_skipped,
    detected_tags = [],
    dry_run_result, confirm_result,
  } = result

  const stats = preview_stats || {}
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await adminApi.downloadAnnotated(batch_id)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `annotated_${original_filename || `batch_${batch_id}.xlsx`}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('下载失败，请重试')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-blue-500" />
            预检结果
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {original_filename} · 批次 #{batch_id} · {import_type === 'job' ? '岗位导入' : '简历导入'}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
          下载标注 Excel
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatPill label="总行数"   value={stats.total_rows}                                color="slate" />
        <StatPill label="可导入"   value={(stats.ok_rows ?? 0) + (stats.warning_rows ?? 0)} color="green" />
        <StatPill label="其中警告" value={stats.warning_rows}                               color="amber" />
        <StatPill label="错误行"   value={stats.error_rows}                                 color="red"   />
        <StatPill label="重复行"   value={stats.dup_rows}                                   color="blue"  />
      </div>

      {fields_registration_skipped && (
        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-500" />
          <div>
            <b>字段注册已跳过：</b>文件存在模板级问题（重复列名 / 模板不匹配），新字段未写入注册表。
            修正 Excel 后重新上传以触发字段注册。
          </div>
        </div>
      )}

      {new_fields.length > 0 && (
        <SectionToggle title="新发现字段" icon={Database} count={new_fields.length} defaultOpen>
          <div className="grid sm:grid-cols-2 gap-2">
            {new_fields.map(f => (
              <div key={f.field_key} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-xs">
                <span className="font-mono text-blue-700 font-semibold">{f.field_key}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{f.label}</span>
                <span className="ml-auto text-blue-400">{f.inferred_type}</span>
              </div>
            ))}
          </div>
        </SectionToggle>
      )}

      {detected_tags.length > 0 && (
        <SectionToggle title="检测到的标签" icon={Tag} count={detected_tags.length} defaultOpen>
          <p className="text-xs text-slate-500 mb-3">
            以下标签将在确认导入时自动写入标签库（已存在的自动跳过）
          </p>
          {Object.entries(
            detected_tags.reduce((acc, t) => {
              if (!acc[t.category]) acc[t.category] = []
              acc[t.category].push(t.name)
              return acc
            }, {})
          ).map(([cat, names]) => (
            <div key={cat} className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 w-16 flex-shrink-0">{cat}</span>
              {names.map(name => (
                <span key={name} className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100">
                  {name}
                </span>
              ))}
            </div>
          ))}
        </SectionToggle>
      )}

      {errors.length > 0 && (
        <SectionToggle title="错误" icon={XCircle} count={errors.length} defaultOpen={errors.length <= 10}>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {errors.map((e, i) => <IssueRow key={i} issue={e} />)}
          </div>
        </SectionToggle>
      )}

      {warnings.length > 0 && (
        <SectionToggle title="警告" icon={AlertTriangle} count={warnings.length}>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {warnings.map((w, i) => <IssueRow key={i} issue={w} />)}
          </div>
        </SectionToggle>
      )}

      {dry_run_result && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-1">
          <p className="font-semibold flex items-center gap-2"><Play size={14} />Dry Run 结果</p>
          <p>可写入 <b>{dry_run_result.writable_rows}</b> 行，
             跳过 <b>{dry_run_result.skipped_rows}</b> 行（共 {dry_run_result.total_rows} 行）。</p>
        </div>
      )}

      {confirm_result && (
        <div className={`px-4 py-3 rounded-xl border text-sm space-y-1 ${
          confirm_result.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {confirm_result.success ? (
            <>
              <p className="font-semibold flex items-center gap-2"><CheckCircle2 size={14} />导入完成</p>
              <p>
                成功写入 <b>{confirm_result.written}</b> 条，
                跳过 <b>{confirm_result.skipped_rows}</b> 行。
                {confirm_result.tags_imported > 0 && (
                  <span className="ml-1 text-blue-700">新增标签 <b>{confirm_result.tags_imported}</b> 个待审批。</span>
                )}
                {confirm_result.junctions_linked > 0 && (
                  <span className="ml-1 text-slate-600">建立 <b>{confirm_result.junctions_linked}</b> 条标签关联。</span>
                )}
              </p>
              {confirm_result.tags_imported > 0 && (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <span className="text-amber-600">⏳</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">
                      新分类/标签需审批后才生效
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      未审批的标签不会出现在筛选器和柱状图中。
                    </p>
                    <a
                      href="/admin/approvals"
                      className="inline-flex items-center gap-1 mt-2 px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700"
                    >
                      前往审批中心 →
                    </a>
                  </div>
                </div>
              )}
              {confirm_result.errors?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {confirm_result.errors.map((e, i) => <IssueRow key={i} issue={e} />)}
                </div>
              )}
            </>
          ) : (
            <p className="font-semibold flex items-center gap-2">
              <XCircle size={14} />导入失败：{confirm_result.message}
            </p>
          )}
        </div>
      )}

      {!confirm_result?.success && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => onDryRun(batch_id)}
            disabled={dryRunning || confirming}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {dryRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Dry Run
          </button>
          <button
            onClick={() => onConfirm(batch_id, false)}
            disabled={confirming || dryRunning || ((stats.ok_rows ?? 0) + (stats.warning_rows ?? 0)) === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {confirming ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            确认导入（含警告行）
          </button>
          {(stats.warning_rows > 0 || stats.error_rows > 0) && (
            <button
              onClick={() => onConfirm(batch_id, true)}
              disabled={confirming || dryRunning || stats.ok_rows === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-amber-300 text-amber-700 text-sm font-medium hover:bg-amber-50 disabled:opacity-50 transition-colors"
            >
              {confirming ? <Loader2 size={14} className="animate-spin" /> : <SkipForward size={14} />}
              仅导入无误行
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function BatchHistory({ batches, loading, onSelect, activeBatchId }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-slate-400 text-sm">
        <Loader2 size={16} className="animate-spin" />加载历史批次...
      </div>
    )
  }
  if (!batches.length) {
    return <p className="text-sm text-slate-400 py-4 text-center">暂无导入记录</p>
  }
  return (
    <div className="space-y-2">
      {batches.map(b => {
        const stats = b.preview_stats || {}
        const isActive = b.id === activeBatchId
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
              isActive
                ? 'border-blue-300 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{b.original_filename}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  #{b.id} · {b.import_type === 'job' ? '岗位' : '简历'} ·{' '}
                  {b.created_at ? new Date(b.created_at).toLocaleString('zh-CN', { hour12: false }) : '—'}
                </p>
              </div>
              <StatusBadge status={b.status} isConfirmed={b.is_confirmed} />
            </div>
            <div className="flex gap-3 mt-2 text-xs text-slate-500">
              <span>总 {stats.total_rows ?? '—'}</span>
              <span className="text-emerald-600">✓ {stats.ok_rows ?? '—'}</span>
              {stats.warning_rows > 0 && <span className="text-amber-600">⚠ {stats.warning_rows}</span>}
              {stats.error_rows   > 0 && <span className="text-red-600">✗ {stats.error_rows}</span>}
            </div>
          </button>
        )
      })}
    </div>
  )
}

function UploadZone({ onPreview, previewing }) {
  const [importType, setImportType] = useState('job')
  const [dragging, setDragging] = useState(false)
  const [file, setFile]   = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  function handleFile(f) {
    if (!f) return
    if (f.name.split('.').pop().toLowerCase() !== 'xlsx') { setError('仅支持 .xlsx 格式'); return }
    setError('')
    setFile(f)
  }

  function handleDrop(e) { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  async function handleSubmit() {
    if (!file) { setError('请先选择文件'); return }
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('import_type', importType)
    try { await onPreview(fd) }
    catch (err) { setError(err.response?.data?.message || '预检失败，请重试') }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {[['job', '岗位导入'], ['resume', '简历导入']].map(([v, label]) => (
          <button key={v} onClick={() => setImportType(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              importType === v ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >{label}</button>
        ))}
        <a
          href={`/api/admin/import/template?type=${importType}`}
          download
          onClick={(e) => {
            // axios 拦截器加 token，但 <a> 直接下载不带 token；改用 fetch 带 token 下载
            e.preventDefault()
            const token = localStorage.getItem('token')
            fetch(`/api/admin/import/template?type=${importType}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
              .then(r => r.blob())
              .then(blob => {
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = importType === 'job' ? '岗位导入模板.xlsx' : '候选人导入模板.xlsx'
                a.click()
                URL.revokeObjectURL(url)
              })
              .catch(() => alert('模板下载失败'))
          }}
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
        >
          <Download size={12} />
          下载模板
        </a>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl py-10 cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <Upload size={28} className={dragging ? 'text-blue-500' : 'text-slate-300'} />
        {file ? (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · 点击更换</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm font-medium text-slate-600">拖拽 .xlsx 文件到此处，或点击选择</p>
            <p className="text-xs text-slate-400 mt-1">最大 20 MB · 上传后自动检测标签</p>
          </div>
        )}
      </div>

      {error && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle size={13} />{error}</p>}

      <button onClick={handleSubmit} disabled={!file || previewing}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {previewing ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
        {previewing ? '预检中...' : '开始预检'}
      </button>
    </div>
  )
}

function DataImportTab() {
  const [batches, setBatches]               = useState([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const [previewResult, setPreviewResult]   = useState(null)
  const [previewing, setPreviewing]         = useState(false)
  const [confirming, setConfirming]         = useState(false)
  const [dryRunning, setDryRunning]         = useState(false)
  const [activeBatchId, setActiveBatchId]   = useState(null)
  const [loadingBatch, setLoadingBatch]     = useState(false)

  const fetchBatches = useCallback(async () => {
    setBatchesLoading(true)
    try {
      const res = await adminApi.listBatches({ perPage: 30 })
      setBatches(res.data.batches || [])
    } catch { /* silent */ }
    finally { setBatchesLoading(false) }
  }, [])

  useEffect(() => { fetchBatches() }, [fetchBatches])

  async function handlePreview(formData) {
    setPreviewing(true)
    try {
      const res = await adminApi.previewImport(formData)
      setPreviewResult(res.data)
      setActiveBatchId(res.data.batch_id)
      await fetchBatches()
    } finally { setPreviewing(false) }
  }

  async function handleSelectBatch(batchId) {
    if (batchId === activeBatchId) return
    setLoadingBatch(true)
    setActiveBatchId(batchId)
    try {
      const res = await adminApi.getBatch(batchId)
      const b = res.data.batch
      const TEMPLATE_ISSUES = new Set(['duplicate_header', 'template_mismatch'])
      const allIssues = [...(b.error_summary || []), ...(b.warning_summary || [])]
      setPreviewResult({
        batch_id:                    b.id,
        import_type:                 b.import_type,
        original_filename:           b.original_filename,
        preview_stats:               b.preview_stats,
        errors:                      b.error_summary || [],
        warnings:                    b.warning_summary || [],
        new_fields:                  b.new_fields || [],
        detected_tags:               b.detected_tags || [],
        fields_registration_skipped: allIssues.some(e => TEMPLATE_ISSUES.has(e.issue_type)),
        confirm_result:              b.is_confirmed ? { success: true, written: '（已确认）', skipped_rows: '—', errors: [] } : null,
      })
    } catch { /* silent */ }
    finally { setLoadingBatch(false) }
  }

  async function handleDryRun(batchId) {
    setDryRunning(true)
    try {
      const res = await adminApi.dryRunImport(batchId)
      setPreviewResult(prev => ({ ...prev, dry_run_result: res.data }))
    } catch (err) { alert(err.response?.data?.message || 'Dry Run 失败') }
    finally { setDryRunning(false) }
  }

  async function handleConfirm(batchId, skipErrors) {
    if (!window.confirm(skipErrors ? '确认仅导入无误行（跳过警告行）？' : '确认导入所有可写入行（含警告行）？')) return
    setConfirming(true)
    try {
      const res = await adminApi.confirmImport(batchId, { skipErrors })
      setPreviewResult(prev => ({ ...prev, confirm_result: res.data, dry_run_result: null }))
      await fetchBatches()
    } catch (err) {
      setPreviewResult(prev => ({
        ...prev,
        confirm_result: { success: false, message: err.response?.data?.message || '确认导入失败' },
      }))
    } finally { setConfirming(false) }
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Upload size={15} className="text-blue-500" />上传文件
          </h2>
          <UploadZone onPreview={handlePreview} previewing={previewing} />
        </div>
        <div className="card p-6 flex flex-col" style={{ maxHeight: '480px' }}>
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Clock size={15} className="text-slate-400" />历史批次
            </h2>
            <button onClick={fetchBatches}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-1">
            <BatchHistory batches={batches} loading={batchesLoading}
              onSelect={handleSelectBatch} activeBatchId={activeBatchId} />
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        {loadingBatch ? (
          <div className="card p-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
            <Loader2 size={18} className="animate-spin" />加载批次详情...
          </div>
        ) : previewResult ? (
          <div className="card p-6">
            <PreviewPanel result={previewResult} onConfirm={handleConfirm}
              onDryRun={handleDryRun} confirming={confirming} dryRunning={dryRunning} />
          </div>
        ) : (
          <div className="card p-10 flex flex-col items-center justify-center text-slate-400 gap-3">
            <FileSpreadsheet size={36} className="text-slate-200" />
            <p className="text-sm">上传 Excel 文件以开始预检，或从左侧选择历史批次</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 2：标签库
// ─────────────────────────────────────────────────────────────────────────────

function TagLibraryTab() {
  const [tagsByCategory, setTagsByCategory] = useState({})
  const [expanded, setExpanded]             = useState({})

  const load = () => {
    getTags({ include_pending: true }).then(data => {
      const map = {}
      for (const t of data.tags || []) {
        if (!map[t.category]) map[t.category] = []
        map[t.category].push(t)
      }
      setTagsByCategory(map)
    }).catch(() => {})
  }
  useEffect(load, [])

  const allCats   = Object.keys(tagsByCategory).sort()
  const allTags   = Object.values(tagsByCategory).flat()
  const total     = allTags.length
  const activeCnt = allTags.filter(t => t.status === 'active').length
  const pendingCnt = allTags.filter(t => t.status === 'pending').length
  const toggleCat = cat => setExpanded(e => ({ ...e, [cat]: !e[cat] }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
        <span>共 <strong className="text-slate-700">{allCats.length}</strong> 个分类</span>
        <span>共 <strong className="text-slate-700">{total}</strong> 个标签</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />已通过 <strong>{activeCnt}</strong>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" />审批中 <strong>{pendingCnt}</strong>
        </span>
        {pendingCnt > 0 && (
          <a href="/admin/approvals"
             className="ml-auto text-xs text-blue-600 hover:text-blue-800">
            前往审批中心 →
          </a>
        )}
      </div>

      {allCats.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <Tag size={32} className="mx-auto mb-3 text-slate-200" />
          <p className="text-sm">暂无标签，请在"数据导入"Tab 上传 Excel 后自动写入</p>
        </div>
      )}

      {allCats.map(cat => {
        const tags = tagsByCategory[cat] || []
        const pending = tags.filter(t => t.status === 'pending').length
        return (
          <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden">
            <button type="button" onClick={() => toggleCat(cat)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left">
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-700">{cat}</span>
                <span className="text-xs text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                  {tags.length} 个
                </span>
                {pending > 0 && (
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    {pending} 个待审批
                  </span>
                )}
              </div>
              {expanded[cat] ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </button>
            {expanded[cat] && (
              <div className="px-4 py-3 flex flex-wrap gap-2">
                {tags.map(t => (
                  <span key={t.id}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      t.status === 'pending'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-100'
                    }`}
                    title={t.status === 'pending' ? '待审批' : '已通过'}
                  >
                    {t.status === 'pending' && '⏳ '}
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 3：待审批标签
// ─────────────────────────────────────────────────────────────────────────────

function PendingTagsTab() {
  const [tags, setTags]           = useState([])
  const [loading, setLoading]     = useState(true)
  const [rejectId, setRejectId]   = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing]     = useState(null)

  const load = () => {
    setLoading(true)
    getPendingTags().then(d => setTags(d.tags || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const approve = async id => {
    setProcessing(id)
    try { await reviewTag(id, 'approve'); setTags(ts => ts.filter(t => t.id !== id)) }
    catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  const reject = async id => {
    if (!rejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(id)
    try {
      await reviewTag(id, 'reject', rejectReason)
      setTags(ts => ts.filter(t => t.id !== id))
      setRejectId(null); setRejectReason('')
    } catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />加载中...
    </div>
  )
  if (!tags.length) return (
    <div className="py-16 text-center text-slate-400">
      <Check size={32} className="mx-auto mb-3 text-emerald-200" />
      <p className="text-sm">暂无待审批标签</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {tags.map(tag => (
        <div key={tag.id} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-400 uppercase">{tag.category}</span>
                <span className="font-semibold text-slate-800">{tag.name}</span>
              </div>
              <p className="text-xs text-slate-500">
                申请人：{tag.creator_name}（{tag.creator_role}） · {tag.created_at?.slice(0, 10)}
              </p>
              {tag.description && <p className="text-xs text-slate-600 mt-1">{tag.description}</p>}
            </div>
            {rejectId !== tag.id && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => approve(tag.id)} disabled={processing === tag.id}>
                  {processing === tag.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  通过
                </Button>
                <Button size="sm" variant="danger" onClick={() => { setRejectId(tag.id); setRejectReason('') }}>
                  <X size={12} />拒绝
                </Button>
              </div>
            )}
          </div>
          {rejectId === tag.id && (
            <div className="mt-3 space-y-2">
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="请填写拒绝原因（必填）"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-red-300" />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => reject(tag.id)} disabled={processing === tag.id}>确认拒绝</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>取消</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab 4：待审批描述
// ─────────────────────────────────────────────────────────────────────────────

function PendingNotesTab() {
  const [notes, setNotes]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [rejectId, setRejectId]         = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing]     = useState(null)

  const load = () => {
    setLoading(true)
    getPendingNotes().then(d => setNotes(d.notes || [])).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  const approve = async id => {
    setProcessing(id)
    try { await reviewNote(id, 'approve'); setNotes(ns => ns.filter(n => n.id !== id)) }
    catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  const reject = async id => {
    if (!rejectReason.trim()) { alert('请填写拒绝原因'); return }
    setProcessing(id)
    try {
      await reviewNote(id, 'reject', rejectReason)
      setNotes(ns => ns.filter(n => n.id !== id))
      setRejectId(null); setRejectReason('')
    } catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setProcessing(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-400">
      <Loader2 size={20} className="animate-spin mr-2" />加载中...
    </div>
  )
  if (!notes.length) return (
    <div className="py-16 text-center text-slate-400">
      <Check size={32} className="mx-auto mb-3 text-emerald-200" />
      <p className="text-sm">暂无待审批描述</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {notes.map(note => (
        <div key={note.id} className="border border-slate-200 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-slate-400">{note.tag_category}</span>
                <span className="font-semibold text-slate-800">{note.tag_name}</span>
              </div>
              <p className="text-sm text-slate-700 mt-1 leading-relaxed">"{note.note}"</p>
              <p className="text-xs text-slate-500 mt-1">
                作者：{note.user_name}（{note.user_role}） · {note.created_at?.slice(0, 10)}
              </p>
            </div>
            {rejectId !== note.id && (
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => approve(note.id)} disabled={processing === note.id}>
                  {processing === note.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  通过
                </Button>
                <Button size="sm" variant="danger" onClick={() => { setRejectId(note.id); setRejectReason('') }}>
                  <X size={12} />拒绝
                </Button>
              </div>
            )}
          </div>
          {rejectId === note.id && (
            <div className="mt-3 space-y-2">
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="请填写拒绝原因（必填）"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-red-300" />
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => reject(note.id)} disabled={processing === note.id}>确认拒绝</Button>
                <Button size="sm" variant="ghost" onClick={() => { setRejectId(null); setRejectReason('') }}>取消</Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 审批开关
// ─────────────────────────────────────────────────────────────────────────────

function ApprovalToggle() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    getTagApprovalSetting().then(d => setEnabled(d.enabled)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const toggle = async () => {
    setSaving(true)
    try { const res = await setTagApprovalSetting(!enabled); setEnabled(res.enabled) }
    catch (e) { alert(e.response?.data?.detail || '操作失败') }
    finally { setSaving(false) }
  }

  if (loading) return null
  return (
    <button type="button" onClick={toggle} disabled={saving}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors
        ${enabled
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
          : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}
    >
      {saving ? <Loader2 size={14} className="animate-spin" /> : enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      审批功能：{enabled ? '已开启' : '已关闭'}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 主页面
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'import',         label: '数据导入' },
  { key: 'library',        label: '标签库' },
  { key: 'pending_tags',   label: '待审批标签' },
  { key: 'pending_notes',  label: '待审批描述' },
]

export default function ImportManager() {
  const [activeTab, setActiveTab] = useState('import')

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* 页头 */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">导入 & 标签管理</h1>
            <p className="text-slate-500 mt-1 text-sm">
              上传岗位或简历 Excel 批量写入数据，同时自动同步标签库；管理用户申请的标签和描述
            </p>
          </div>
          <ApprovalToggle />
        </div>

        {/* Tab 导航 */}
        <div className="flex gap-1 mb-6 border-b border-slate-200">
          {TABS.map(tab => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px
                ${activeTab === tab.key
                  ? 'text-blue-600 border-blue-600 bg-white'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-white/60'}`}
            >{tab.label}</button>
          ))}
        </div>

        {/* Tab 内容 */}
        {activeTab === 'import' && <DataImportTab />}
        {activeTab === 'library' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <TagLibraryTab />
          </div>
        )}
        {activeTab === 'pending_tags' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <PendingTagsTab />
          </div>
        )}
        {activeTab === 'pending_notes' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <PendingNotesTab />
          </div>
        )}
      </div>
    </div>
  )
}
