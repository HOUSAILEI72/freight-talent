const COLOR_CLASSES = [
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-emerald-50 text-emerald-700',
  'bg-orange-50 text-orange-700',
]

export function TagList({ tags = [], max = 5, colorFn }) {
  const shown = tags.slice(0, max)
  const rest = tags.length - max

  return (
    <div className="flex flex-row flex-wrap gap-1.5">
      {shown.map((tag, i) => (
        <span
          key={tag}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorFn ? colorFn(tag, i) : COLOR_CLASSES[i % COLOR_CLASSES.length]}`}
        >
          {tag}
        </span>
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
          +{rest}
        </span>
      )}
    </div>
  )
}