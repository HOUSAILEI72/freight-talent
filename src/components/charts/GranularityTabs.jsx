export function GranularityTabs({ value, onChange }) {
  const opts = [
    { value: "day",     label: "日" },
    { value: "week",    label: "周" },
    { value: "month",   label: "月" },
    { value: "quarter", label: "季度" },
    { value: "year",    label: "年" },
  ]
  return (
    <div className="inline-flex bg-slate-100 rounded-lg p-1 gap-1">
      {opts.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-sm rounded-md transition-all ${
            value === o.value
              ? "bg-white shadow-sm font-medium text-slate-800"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
