import { useMemo } from 'react'
import * as d3 from 'd3'
import concaveman from 'concaveman'
import { usePaperStore } from '../stores/usePaperStore'
import { useCoordinateSystem } from './useCoordinateSystem'
import { contourConfig } from '../config/contourConfig'
import { OUTLINE_PADDING } from '../config/layoutConstants'

// Douglas-Peucker simplification
function simplifyPath(
  points: [number, number][],
  tolerance: number
): [number, number][] {
  if (points.length <= 2) return points

  let maxDist = 0
  let maxIndex = 0
  const first = points[0]
  const last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last)
    if (dist > maxDist) {
      maxDist = dist
      maxIndex = i
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance)
    const right = simplifyPath(points.slice(maxIndex), tolerance)
    return [...left.slice(0, -1), ...right]
  } else {
    return [first, last]
  }
}

function perpendicularDistance(
  point: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [x, y] = point
  const [x1, y1] = lineStart
  const [x2, y2] = lineEnd

  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2)
  }

  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq))
  const projX = x1 + t * dx
  const projY = y1 + t * dy

  return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2)
}

// Offset polygon outward along vertex normals
function offsetPolygon(
  points: [number, number][],
  offset: number
): [number, number][] {
  if (points.length < 3) return points

  const result: [number, number][] = []

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const curr = points[i]
    const next = points[(i + 1) % points.length]

    const e1x = curr[0] - prev[0]
    const e1y = curr[1] - prev[1]
    const e2x = next[0] - curr[0]
    const e2y = next[1] - curr[1]

    const len1 = Math.sqrt(e1x * e1x + e1y * e1y) || 1
    const len2 = Math.sqrt(e2x * e2x + e2y * e2y) || 1

    const n1x = -e1y / len1
    const n1y = e1x / len1
    const n2x = -e2y / len2
    const n2y = e2x / len2

    let nx = n1x + n2x
    let ny = n1y + n2y
    const nlen = Math.sqrt(nx * nx + ny * ny) || 1
    nx /= nlen
    ny /= nlen

    const dot = n1x * n2x + n1y * n2y
    const miterScale = dot > -0.5 ? 1 / (1 + dot) : 1
    const actualOffset = offset * Math.min(miterScale, 2)

    result.push([curr[0] + nx * actualOffset, curr[1] + ny * actualOffset])
  }

  return result
}

// Resample closed polygon to have evenly spaced points
function resampleClosed(
  points: [number, number][],
  numPoints: number
): [number, number][] {
  if (points.length < 3 || numPoints < 3) return points

  const distances: number[] = [0]
  for (let i = 1; i <= points.length; i++) {
    const p1 = points[i - 1]
    const p2 = points[i % points.length]
    const d = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2)
    distances.push(distances[i - 1] + d)
  }

  const totalLength = distances[distances.length - 1]
  const step = totalLength / numPoints

  const result: [number, number][] = []

  for (let i = 0; i < numPoints; i++) {
    const targetDist = i * step

    let segIdx = 0
    while (segIdx < distances.length - 1 && distances[segIdx + 1] < targetDist) {
      segIdx++
    }

    const segStart = distances[segIdx]
    const segEnd = distances[segIdx + 1] || distances[segIdx]
    const segLength = segEnd - segStart

    const t = segLength > 0 ? (targetDist - segStart) / segLength : 0
    const p1 = points[segIdx]
    const p2 = points[(segIdx + 1) % points.length]

    result.push([
      p1[0] + t * (p2[0] - p1[0]),
      p1[1] + t * (p2[1] - p1[1]),
    ])
  }

  return result
}

/**
 * Calculate the pond boundary outline path
 * This uses the same algorithm as the Environment component
 */
export function usePondBoundary() {
  const papers = usePaperStore((state) => state.papers)
  const { contentWidth, contentHeight, xScale, yScale } = useCoordinateSystem()

  const outlinePath = useMemo(() => {
    if (papers.length === 0 || contentWidth <= 0 || contentHeight <= 0) {
      return ''
    }

    const clusterGroups = d3.group(papers, (d) => d.cluster)
    clusterGroups.delete(-1)

    const allContourPoints: [number, number][] = []
    const clusterIds = Array.from(clusterGroups.keys()).sort((a, b) => a - b)

    for (const clusterId of clusterIds) {
      const clusterData = clusterGroups.get(clusterId)!
      if (clusterData.length < 3) continue

      const contours = d3
        .contourDensity<(typeof papers)[0]>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .size([contentWidth, contentHeight])
        .bandwidth(contourConfig.bandwidth)
        .thresholds(contourConfig.thresholds)(clusterData)

      const outermostContour = contours[0]
      if (outermostContour) {
        for (const polygon of outermostContour.coordinates) {
          for (const ring of polygon) {
            for (const point of ring) {
              allContourPoints.push([point[0], point[1]])
            }
          }
        }
      }
    }

    const allPaperPoints: [number, number][] = papers.map((p) => [
      xScale(p.x),
      yScale(p.y),
    ])

    const combinedPoints: [number, number][] = [
      ...allContourPoints,
      ...allPaperPoints,
    ]

    if (combinedPoints.length < 3) {
      return ''
    }

    // Calculate concave hull
    const hullRaw = concaveman(combinedPoints, 2.5, 0)
    let hull: [number, number][] = hullRaw.map((p) => [p[0], p[1]])

    // Simplify to remove noise
    hull = simplifyPath(hull, 8)

    // Close the path for simplification
    if (hull.length > 0 && (hull[0][0] !== hull[hull.length - 1][0] || hull[0][1] !== hull[hull.length - 1][1])) {
      hull.push(hull[0])
    }
    hull = simplifyPath(hull, 8)
    // Remove duplicate closing point
    if (hull.length > 1) hull = hull.slice(0, -1)

    // Offset outward
    hull = offsetPolygon(hull, OUTLINE_PADDING)

    // Resample for even spacing
    hull = resampleClosed(hull, Math.max(60, Math.min(hull.length, 120)))

    // Use basis curve for maximum smoothness
    const lineGenerator = d3
      .line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(d3.curveBasisClosed)

    return lineGenerator(hull) || ''
  }, [papers, contentWidth, contentHeight, xScale, yScale])

  return outlinePath
}
