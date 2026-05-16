import { useEffect, useMemo, useRef, useState } from 'react'
import { useCastStore } from '../stores/useCastStore'
import { useDebugStore } from '../stores/useDebugStore'
import { MARGIN } from '../config/layoutConstants'
import {
  FISH_ATTENTION_ZONE,
  getOrbitFishPose,
  stableUnit,
  type FishDescriptor,
} from '../utils/fishMotion'
import Fish from './Fish'

function FishSchools() {
  const clusters = useCastStore((state) => state.clusters)
  const setFishDescriptors = useCastStore((state) => state.setFishDescriptors)
  const hiddenFishIds = useCastStore((state) => state.hiddenFishIds)
  const isDebugMode = useDebugStore((state) => state.isDebugMode)
  const schoolStartedAtRef = useRef(performance.now())
  const [debugNow, setDebugNow] = useState(() => performance.now())

  // Fish are rendered independently around each cluster
  const fishDescriptors = useMemo<FishDescriptor[]>(() => {
    console.log('[FishSchools] Rendering with clusters:', clusters)
    if (!clusters || clusters.length === 0) {
      console.log('[FishSchools] No clusters available')
      return []
    }

    return clusters.flatMap((cluster, clusterIndex) => {
      // Fish circle around clusters with varying patterns based on cluster size
      const fishCount = Math.min(Math.max(1, Math.floor(cluster.count / 3)), 3) // 1-3 fish per cluster
      const circleRadius = 40 + cluster.count * 2 // Larger clusters = wider circle
      const circleSpeed = 18 + cluster.count * 1 // Larger clusters = slower swimming (much slower base)
      const fishSize = 20 + cluster.count * 2 // Larger clusters = bigger fish

      return Array.from({ length: fishCount }).map((_, fishIndex) => {
        const id = [
          'fish',
          clusterIndex,
          Math.round(cluster.x),
          Math.round(cluster.y),
          cluster.count,
          fishIndex,
        ].join('-')
        const delay = (fishIndex / fishCount) * circleSpeed
        const direction = fishIndex % 2 === 0 ? 'clockwise' : 'counterclockwise'
        const fishSpeed = circleSpeed + (stableUnit(`${id}-speed`) - 0.5) * 4
        const startOffset = stableUnit(`${id}-offset`) * 360

        return {
          id,
          clusterIndex,
          cx: cluster.x,
          cy: cluster.y,
          radius: circleRadius,
          speed: fishSpeed,
          delay,
          direction,
          startOffset,
          size: fishSize,
          startedAt: schoolStartedAtRef.current,
        }
      })
    })
  }, [clusters])

  useEffect(() => {
    setFishDescriptors(fishDescriptors)
  }, [fishDescriptors, setFishDescriptors])

  useEffect(() => {
    if (!isDebugMode) {
      return
    }

    let frameId: number

    const updateDebugNow = () => {
      setDebugNow(performance.now())
      frameId = requestAnimationFrame(updateDebugNow)
    }

    frameId = requestAnimationFrame(updateDebugNow)
    return () => cancelAnimationFrame(frameId)
  }, [isDebugMode])

  return (
    <g className="fish-schools" transform={`translate(${MARGIN}, ${MARGIN})`}>
      {clusters.map((_, clusterIndex) => (
        <g key={`fish-group-${clusterIndex}`}>
          {fishDescriptors
            .filter((fish) => fish.clusterIndex === clusterIndex)
            .filter((fish) => !hiddenFishIds.includes(fish.id))
            .map((fish) => (
              <Fish
                key={fish.id}
                cx={fish.cx}
                cy={fish.cy}
                radius={fish.radius}
                speed={fish.speed}
                randomDelay={fish.delay}
                direction={fish.direction}
                startOffset={fish.startOffset}
                size={fish.size}
              />
            ))}
        </g>
      ))}

      {isDebugMode && (
        <g className="debug-fish-attention-zones" pointerEvents="none">
          {fishDescriptors.map((fish) => {
            if (hiddenFishIds.includes(fish.id)) {
              return null
            }

            const pose = getOrbitFishPose(fish, debugNow)
            const minDistance = fish.size * FISH_ATTENTION_ZONE.minDistanceScale
            const maxDistance = fish.size * FISH_ATTENTION_ZONE.maxDistanceScale
            const headingAngle = Math.atan2(pose.headingY, pose.headingX) * 180 / Math.PI
            const halfAngle = FISH_ATTENTION_ZONE.angleDegrees / 2
            const attentionPath = createAttentionZonePath(
              pose.x,
              pose.y,
              minDistance,
              maxDistance,
              headingAngle - halfAngle,
              headingAngle + halfAngle
            )

            return (
              <g key={`debug-attention-zone-${fish.id}`}>
                <line
                  x1={pose.x}
                  y1={pose.y}
                  x2={pose.x + pose.headingX * maxDistance}
                  y2={pose.y + pose.headingY * maxDistance}
                  stroke="#f97316"
                  strokeWidth={1}
                  strokeDasharray="2,4"
                  opacity={0.45}
                />
                <path
                  d={attentionPath}
                  fill="#f97316"
                  fillOpacity={0.08}
                  stroke="#f97316"
                  strokeWidth={1}
                  strokeOpacity={0.55}
                />
                <circle
                  cx={pose.x}
                  cy={pose.y}
                  r={2}
                  fill="#f97316"
                  opacity={0.65}
                />
              </g>
            )
          })}
        </g>
      )}
    </g>
  )
}

function createAttentionZonePath(
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const startRad = startAngleDeg * Math.PI / 180
  const endRad = endAngleDeg * Math.PI / 180
  const innerStartX = cx + Math.cos(startRad) * innerRadius
  const innerStartY = cy + Math.sin(startRad) * innerRadius
  const innerEndX = cx + Math.cos(endRad) * innerRadius
  const innerEndY = cy + Math.sin(endRad) * innerRadius
  const outerStartX = cx + Math.cos(startRad) * outerRadius
  const outerStartY = cy + Math.sin(startRad) * outerRadius
  const outerEndX = cx + Math.cos(endRad) * outerRadius
  const outerEndY = cy + Math.sin(endRad) * outerRadius
  const largeArcFlag = Math.abs(endAngleDeg - startAngleDeg) > 180 ? 1 : 0

  return [
    `M ${innerStartX} ${innerStartY}`,
    `L ${outerStartX} ${outerStartY}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEndX} ${outerEndY}`,
    `L ${innerEndX} ${innerEndY}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStartX} ${innerStartY}`,
    'Z',
  ].join(' ')
}

export default FishSchools
