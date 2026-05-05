import { useMemo } from 'react'
import { useCastStore } from '../stores/useCastStore'
import { MARGIN } from '../config/layoutConstants'
import Fish from './Fish'

function FishSchools() {
  const clusters = useCastStore((state) => state.clusters)

  // Fish are rendered independently around each cluster
  const fishSchools = useMemo(() => {
    console.log('[FishSchools] Rendering with clusters:', clusters)
    if (!clusters || clusters.length === 0) {
      console.log('[FishSchools] No clusters available')
      return []
    }

    return clusters.map((cluster, clusterIndex) => {
      // Fish circle around clusters with varying patterns based on cluster size
      const fishCount = Math.min(Math.max(1, Math.floor(cluster.count / 3)), 3) // 1-3 fish per cluster
      const circleRadius = 40 + cluster.count * 2 // Larger clusters = wider circle
      const circleSpeed = 18 + cluster.count * 1 // Larger clusters = slower swimming (much slower base)
      const fishSize = 20 + cluster.count * 2 // Larger clusters = bigger fish

      return (
        <g key={`fish-group-${clusterIndex}`}>
          {Array.from({ length: fishCount }).map((_, fishIndex) => {
            const delay = (fishIndex / fishCount) * circleSpeed
            const direction = fishIndex % 2 === 0 ? 'clockwise' : 'counterclockwise'
            // Vary speed per fish: base speed with some random variation
            const fishSpeed = circleSpeed + (Math.random() - 0.5) * 4

            return (
              <Fish
                key={`fish-${clusterIndex}-${fishIndex}`}
                cx={cluster.x}
                cy={cluster.y}
                radius={circleRadius}
                speed={fishSpeed}
                randomDelay={delay}
                direction={direction}
                randomStartOffset={true}
                size={fishSize}
              />
            )
          })}
        </g>
      )
    })
  }, [clusters])

  return (
    <g className="fish-schools" transform={`translate(${MARGIN}, ${MARGIN})`}>
      {fishSchools}
    </g>
  )
}

export default FishSchools
