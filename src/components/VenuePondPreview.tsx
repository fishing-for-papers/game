import { useMemo, useState, useEffect } from 'react'
import * as d3 from 'd3'
import concaveman from 'concaveman'
import { contourConfig, contourOutermostColor } from '../config/contourConfig'
import { createVariableWidthPath } from '../utils/variableWidthPath'
import type { Paper } from '../types/paper'
import type { Venue } from '../stores/usePaperStore'

const OUTLINE_PADDING = 10

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

  let t = ((x - x1) * dx + (y - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))

  const projX = x1 + t * dx
  const projY = y1 + t * dy

  return Math.sqrt((x - projX) ** 2 + (y - projY) ** 2)
}

function offsetPolygon(
  points: [number, number][],
  offset: number
): [number, number][] {
  const result: [number, number][] = []

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]
    const curr = points[i]
    const next = points[(i + 1) % points.length]

    const v1x = curr[0] - prev[0]
    const v1y = curr[1] - prev[1]
    const len1 = Math.sqrt(v1x * v1x + v1y * v1y) || 1
    const n1x = -v1y / len1
    const n1y = v1x / len1

    const v2x = next[0] - curr[0]
    const v2y = next[1] - curr[1]
    const len2 = Math.sqrt(v2x * v2x + v2y * v2y) || 1
    const n2x = -v2y / len2
    const n2y = v2x / len2

    const nx = (n1x + n2x) / 2
    const ny = (n1y + n2y) / 2

    const crossProduct = v1x * v2y - v1y * v2x
    const offsetMultiplier = crossProduct > 0 ? 1 : -1
    const actualOffset = offset * offsetMultiplier

    result.push([curr[0] + nx * actualOffset, curr[1] + ny * actualOffset])
  }

  return result
}

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

type VenuePondPreviewProps = {
  venue: Venue
  onClick: () => void
  width?: number
  height?: number
}

function VenuePondPreview({ venue, onClick, width = 300, height = 300 }: VenuePondPreviewProps) {
  const [papers, setPapers] = useState<Paper[]>([])

  useEffect(() => {
    const loadVenuePapers = async () => {
      try {
        const papersModule = await import(`../assets/papers/${venue}.json`)
        setPapers(papersModule.default as Paper[])
      } catch (error) {
        console.error(`Failed to load papers for ${venue}:`, error)
        setPapers([])
      }
    }

    loadVenuePapers()
  }, [venue])

  const { outlinePath, squigglyOutlinePath } = useMemo(() => {
    if (papers.length === 0) {
      return { outlinePath: '', squigglyOutlinePath: '' }
    }

    // Find bounds of paper data
    const xExtent = d3.extent(papers, (p) => p.x) as [number, number]
    const yExtent = d3.extent(papers, (p) => p.y) as [number, number]

    // Create scales with some padding
    const padding = 30
    const contentWidth = width - 2 * padding
    const contentHeight = height - 2 * padding

    const xScale = d3.scaleLinear()
      .domain(xExtent)
      .range([padding, padding + contentWidth])

    const yScale = d3.scaleLinear()
      .domain(yExtent)
      .range([padding, padding + contentHeight])

    // Group by cluster
    const clusterGroups = d3.group(papers, (d) => d.cluster)
    clusterGroups.delete(-1)

    const allContourPoints: [number, number][] = []
    const clusterIds = Array.from(clusterGroups.keys()).sort((a, b) => a - b)

    // Generate contours for each cluster
    for (const clusterId of clusterIds) {
      const clusterData = clusterGroups.get(clusterId)!
      if (clusterData.length < 3) continue

      const contours = d3
        .contourDensity<Paper>()
        .x((d) => xScale(d.x))
        .y((d) => yScale(d.y))
        .size([width, height])
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
      return { outlinePath: '', squigglyOutlinePath: '' }
    }

    // Calculate concave hull
    const hullRaw = concaveman(combinedPoints, 2.0, 0)
    let hull: [number, number][] = hullRaw.map((p) => [p[0], p[1]])

    // Simplify (less aggressive to preserve shape detail)
    hull = simplifyPath(hull, 1)
    if (hull.length > 0 && (hull[0][0] !== hull[hull.length - 1][0] || hull[0][1] !== hull[hull.length - 1][1])) {
      hull.push(hull[0])
    }
    hull = simplifyPath(hull, 1)
    if (hull.length > 1) hull = hull.slice(0, -1)

    // Offset outward
    hull = offsetPolygon(hull, OUTLINE_PADDING)

    // Resample (more points for detailed shapes)
    hull = resampleClosed(hull, Math.max(80, Math.min(hull.length, 300)))

    // Generate smooth path
    const lineGenerator = d3
      .line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(d3.curveBasisClosed)

    const outlinePath = lineGenerator(hull) || ''

    // Create squiggly outline
    const variableWidthConfig = {
      baseWidth: 6.0,
      widthVariation: 0.6,
      noiseScale: 8,
      samplesPerPixel: 0.12,
      minSamples: 15,
      maxSamples: 150,
    }
    const squigglyOutlinePath = outlinePath
      ? createVariableWidthPath(outlinePath, variableWidthConfig)
      : ''

    return { 
      outlinePath, 
      squigglyOutlinePath
    }
  }, [papers, width, height])

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="cursor-pointer transition-transform hover:scale-105"
        onClick={onClick}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#e8f1f5"
          fillOpacity={0}
          rx={8}
        />
        {outlinePath && squigglyOutlinePath && (
          <>
            {/* Filled outline area */}
            <path
              d={outlinePath}
              fill={contourOutermostColor}
              fillOpacity={contourConfig.minOpacity}
            />
            {/* Squiggly ribbon outline with depth effect */}
            <path
              d={squigglyOutlinePath}
              fill={'#ffffff'}
              fillOpacity={0.5}
            />
          </>
        )}
      </svg>
      <div className="text-lg font-semibold text-slate-800">{venue}</div>
    </div>
  )
}

export default VenuePondPreview
