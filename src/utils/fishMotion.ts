import type { Paper } from '../types/paper'

export type FishDirection = 'clockwise' | 'counterclockwise'

export interface FishDescriptor {
  id: string
  clusterIndex: number
  cx: number
  cy: number
  radius: number
  speed: number
  delay: number
  direction: FishDirection
  startOffset: number
  size: number
  startedAt: number
}

export interface FishPose {
  x: number
  y: number
  angle: number
  headingX: number
  headingY: number
}

export interface FishBiteTarget {
  fish: FishDescriptor
  pose: FishPose
  paper: Paper
}

export const FISH_ATTENTION_ZONE = {
  minDistanceScale: 0.55,
  maxDistanceScale: 2.1,
  angleDegrees: 42,
} as const

export function getOrbitFishPose(fish: FishDescriptor, now = performance.now()): FishPose {
  const elapsedSeconds = Math.max(0, (now - fish.startedAt) / 1000 - fish.delay)
  const cycleProgress = fish.speed > 0 ? (elapsedSeconds % fish.speed) / fish.speed : 0
  const directionMultiplier = fish.direction === 'clockwise' ? 1 : -1
  const angle = cycleProgress * 360 * directionMultiplier + fish.startOffset
  const rad = (angle * Math.PI) / 180
  const x = fish.cx + fish.radius * Math.cos(rad)
  const y = fish.cy + fish.radius * Math.sin(rad)
  const headingAngle = angle + (fish.direction === 'clockwise' ? 90 : -90)
  const headingRad = (headingAngle * Math.PI) / 180

  return {
    x,
    y,
    angle,
    headingX: Math.cos(headingRad),
    headingY: Math.sin(headingRad),
  }
}

export function isPointInFishAttentionZone(
  point: { x: number; y: number },
  pose: FishPose,
  fishSize: number
): boolean {
  const dx = point.x - pose.x
  const dy = point.y - pose.y
  const distance = Math.sqrt(dx * dx + dy * dy)
  const minDistance = fishSize * FISH_ATTENTION_ZONE.minDistanceScale
  const maxDistance = fishSize * FISH_ATTENTION_ZONE.maxDistanceScale

  if (distance < minDistance || distance > maxDistance) {
    return false
  }

  const directionToPointX = dx / distance
  const directionToPointY = dy / distance
  const dot = pose.headingX * directionToPointX + pose.headingY * directionToPointY
  const halfAngleRad = (FISH_ATTENTION_ZONE.angleDegrees / 2) * Math.PI / 180

  return dot >= Math.cos(halfAngleRad)
}

export function findFishBiteTarget(
  point: { x: number; y: number },
  fishDescriptors: FishDescriptor[],
  clusters: Array<{ papers: Paper[] }>,
  now = performance.now()
): FishBiteTarget | null {
  let bestTarget: FishBiteTarget | null = null
  let bestForwardDistance = Infinity

  for (const fish of fishDescriptors) {
    const cluster = clusters[fish.clusterIndex]
    if (!cluster || cluster.papers.length === 0) {
      continue
    }

    const pose = getOrbitFishPose(fish, now)
    if (!isPointInFishAttentionZone(point, pose, fish.size)) {
      continue
    }

    const dx = point.x - pose.x
    const dy = point.y - pose.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance < bestForwardDistance) {
      bestForwardDistance = distance
      bestTarget = {
        fish,
        pose,
        paper: pickPaperForFish(cluster.papers, fish.id),
      }
    }
  }

  return bestTarget
}

function pickPaperForFish(papers: Paper[], seed: string): Paper {
  const index = Math.abs(hashString(seed)) % papers.length
  return papers[index]
}

export function stableUnit(seed: string): number {
  const value = Math.sin(hashString(seed)) * 10000
  return value - Math.floor(value)
}

function hashString(value: string): number {
  let hash = 0

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }

  return hash
}
