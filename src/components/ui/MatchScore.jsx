export function MatchScore({ score, size = 'md' }) {
  const radius = size === 'lg' ? 36 : 28
  const stroke = size === 'lg' ? 5 : 4
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const svgSize = (radius + stroke) * 2

  const color =
    score >= 85 ? '#10b981' :
    score >= 70 ? '#2563eb' :
    score >= 55 ? '#f59e0b' : '#ef4444'

  const textSize = size === 'lg' ? 'text-2xl' : 'text-base'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute font-bold ${textSize}`} style={{ color }}>
        {score}
      </span>
    </div>
  )
}