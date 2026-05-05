import { Icon } from '@iconify/react'

type ScoreIconsProps = {
  score: number
  size?: number
  gap?: number
}

// Rarity level configuration: icon, color, glow, and description
// Colors are distinct and nominal (not following a gradient progression)
const RARITY_LEVELS = {
  1: {
    icon: 'mdi:leaf',
    color: '#8BC34A',
    glow: '#AED581',
    name: 'Common',
    description: 'A pleasant discovery'
  },
  2: {
    icon: 'mdi:flower',
    color: '#F48FB1',
    glow: '#F8BBD0',
    name: 'Uncommon',
    description: 'An interesting find'
  },
  3: {
    icon: 'mdi:clover',
    color: '#26A69A',
    glow: '#80CBC4',
    name: 'Rare',
    description: 'A lucky encounter'
  },
  4: {
    icon: 'mdi:sparkles',
    color: '#FDD835',
    glow: '#FFF176',
    name: 'Epic',
    description: 'A delightful surprise'
  },
  5: {
    icon: 'mdi:diamond-stone',
    color: '#C77DFF',
    glow: '#F3E5F5',
    name: 'Legendary',
    description: 'A serendipitous gem'
  },
} as const

function ScoreIcons({ score, size = 36, gap = 2 }: ScoreIconsProps) {
  // Calculate rating (1-5)
  const rating = Math.min(5, Math.max(1, Math.round(score))) as keyof typeof RARITY_LEVELS
  const rarity = RARITY_LEVELS[rating]
  // const rarity = RARITY_LEVELS[5]

  return (
    <div className={`flex gap-${gap} justify-center items-center`}>
      <div className="group relative">
        <Icon
          icon={rarity.icon}
          width={size}
          height={size}
          style={{
            color: rarity.color,
            filter: `drop-shadow(0 0 4px ${rarity.glow}) drop-shadow(0 0 8px ${rarity.glow})`,
          }}
        />
        {/* Tooltip showing all levels */}
        <div className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 z-[100] rounded-lg bg-slate-950/90 px-4 py-3 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 min-w-[240px]">
          <div className="text-xs font-semibold text-white/80 mb-2 text-center">
            Rarity Level
          </div>
          <div className="space-y-1.5">
            {Object.entries(RARITY_LEVELS).map(([level, config]) => (
              <div
                key={level}
                className={`flex items-center gap-2 text-xs ${
                  Number(level) === rating ? 'font-semibold' : 'font-normal'
                }`}
                style={{
                  color: Number(level) === rating ? config.color : '#fff',
                  opacity: Number(level) === rating ? 1 : 0.6,
                }}
              >
                <Icon icon={config.icon} width={16} height={16} style={{ color: config.color }} />
                <span>
                  {config.name}: {config.description}
                </span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/60 mt-3 italic text-center border-t border-white/20 pt-2">
            *Based on unexpectedness of keyword combinations - for entertainment only
          </div>
        </div>
      </div>
    </div>
  )

  /* Original star-based rating system
  return (
    <div className={`flex gap-${gap} justify-center`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Icon
          key={index}
          icon={index <= rating ? 'mdi:star' : 'mdi:star-outline'}
          width={size}
          height={size}
          style={{
            color: '#FFA500',
            filter: 'drop-shadow(0 0 4px #FFD700) drop-shadow(0 0 8px #FFD700)',
          }}
        />
      ))}
    </div>
  )
  */
}

export default ScoreIcons
