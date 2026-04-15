export function TagList({ tags = [], max = 5, colorFn }) {
  const shown = tags.slice(0, max)
  const rest = tags.length - max

  const defaultColors = ['blue', 'purple', 'green', 'orange']
  const getColor = colorFn || ((_, i) => defaultColors[i % defaultColors.length])

  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((tag, i) => (
        <span
          key={tag}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
            ${getColor(tag, i) === 'blue' ? 'bg-blue-50 text-blue-700' : ''}
            ${getColor(tag, i) === 'purple' ? 'bg-purple-50 text-purple-700' : ''}
            ${getColor(tag, i) === 'green' ? 'bg-emerald-50 text-emerald-700' : ''}
            ${getColor(tag, i) === 'orange' ? 'bg-orange-50 text-orange-700' : ''}
          `}
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