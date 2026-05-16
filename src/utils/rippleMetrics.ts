const RIPPLE_RING_SPACING = 15
const RIPPLE_INFLUENCE_BLEND = 0.55
const RIPPLE_HOOK_TOLERANCE = 6

export type RippleMetrics = {
  baseRadius: number
  ringCount: number
  ringSpacing: number
  outerRadius: number
  influenceRadius: number
}

export function getRippleMetrics(clusterCount: number): RippleMetrics {
  const baseRadius = 10 + clusterCount
  const ringCount = Math.min(1 + Math.floor(clusterCount / 5), 6)
  const outerRadius = baseRadius + (ringCount - 1) * RIPPLE_RING_SPACING
  const visualMidRadius = baseRadius + (outerRadius - baseRadius) * RIPPLE_INFLUENCE_BLEND
  const influenceRadius = Math.min(
    outerRadius,
    visualMidRadius + RIPPLE_HOOK_TOLERANCE
  )

  return {
    baseRadius,
    ringCount,
    ringSpacing: RIPPLE_RING_SPACING,
    outerRadius,
    influenceRadius,
  }
}
