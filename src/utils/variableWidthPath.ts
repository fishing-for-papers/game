/**
 * Convert a path string to a variable-width filled ribbon
 * Creates two separate closed curves and combines them as compound path
 * Handles multi-ring paths (MultiPolygon) by processing each ring separately
 */
import * as d3 from 'd3'

// Simple seeded random for consistent results
function seededRandom(seed: number) {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

// Smooth noise approximation
function noise1D(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const smooth = f * f * (3 - 2 * f)
  const a = seededRandom(i + seed)
  const b = seededRandom(i + 1 + seed)
  return a + (b - a) * smooth
}

interface Point {
  x: number
  y: number
}

let measurementSvg: SVGSVGElement | null = null
let measurementPath: SVGPathElement | null = null

function getMeasurementPath(): SVGPathElement | null {
  if (typeof document === 'undefined') return null

  if (measurementPath) return measurementPath

  measurementSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  measurementSvg.setAttribute('width', '0')
  measurementSvg.setAttribute('height', '0')
  measurementSvg.style.position = 'absolute'
  measurementSvg.style.left = '-9999px'
  measurementSvg.style.top = '-9999px'
  measurementSvg.style.pointerEvents = 'none'
  measurementSvg.style.opacity = '0'

  measurementPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  measurementSvg.appendChild(measurementPath)
  document.body.appendChild(measurementSvg)

  return measurementPath
}

// Split a compound path into individual subpaths
function splitPath(d: string): string[] {
  // Split on M command but keep the M
  const parts = d.split(/(?=M)/g).filter((p) => p.trim().length > 0)
  return parts
}

// Sample points from a single SVG subpath based on path length
function sampleSubpath(
  d: string,
  samplesPerPixel: number,
  minSamples: number,
  maxSamples: number
): Point[] {
  const path = getMeasurementPath()
  if (!path) return []

  path.setAttribute('d', d)

  const totalLength = path.getTotalLength()

  // Calculate samples based on path length
  const numSamples = Math.min(
    maxSamples,
    Math.max(minSamples, Math.floor(totalLength * samplesPerPixel))
  )

  const points: Point[] = []

  for (let i = 0; i < numSamples; i++) {
    const distance = (i / numSamples) * totalLength
    const point = path.getPointAtLength(distance)
    points.push({ x: point.x, y: point.y })
  }

  return points
}

// Calculate normal vectors with wrap-around for closed paths
function calculateNormals(points: Point[]): Point[] {
  const normals: Point[] = []
  const n = points.length

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]

    const dx = next.x - prev.x
    const dy = next.y - prev.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1

    normals.push({ x: -dy / len, y: dx / len })
  }

  return normals
}

export interface VariableWidthConfig {
  baseWidth: number
  widthVariation: number
  noiseScale: number
  samplesPerPixel: number
  minSamples: number
  maxSamples: number
}

// Process a single subpath into a variable-width ribbon
function processSubpath(
  d: string,
  config: VariableWidthConfig,
  seed: number
): string | null {
  const { baseWidth, widthVariation, noiseScale, samplesPerPixel, minSamples, maxSamples } = config

  const points = sampleSubpath(d, samplesPerPixel, minSamples, maxSamples)
  if (points.length < 3) return null

  const normals = calculateNormals(points)

  // Create offset points on both sides with variable width
  const outerPoints: [number, number][] = []
  const innerPoints: [number, number][] = []

  for (let i = 0; i < points.length; i++) {
    const t = i / points.length
    const noiseVal = noise1D(t * noiseScale, seed)
    const width = baseWidth * (1 + (noiseVal - 0.5) * 2 * widthVariation)
    const halfWidth = width / 2

    outerPoints.push([
      points[i].x + normals[i].x * halfWidth,
      points[i].y + normals[i].y * halfWidth,
    ])
    innerPoints.push([
      points[i].x - normals[i].x * halfWidth,
      points[i].y - normals[i].y * halfWidth,
    ])
  }

  // Create line generator with closed curve
  const line = d3
    .line<[number, number]>()
    .x((p) => p[0])
    .y((p) => p[1])
    .curve(d3.curveCatmullRomClosed.alpha(0.5))

  // Generate outer closed curve
  const outerPath = line(outerPoints)

  // Generate inner closed curve (reversed for opposite winding direction)
  const innerPath = line(innerPoints.reverse())

  if (!outerPath || !innerPath) return null

  // Combine as compound path - two separate closed curves
  return `${outerPath} ${innerPath}`
}

export function createVariableWidthPath(
  d: string,
  config: VariableWidthConfig,
  seed: number = 0
): string {
  // Split the path into individual subpaths (handles MultiPolygon)
  const subpaths = splitPath(d)

  // Process each subpath separately
  const ribbonPaths: string[] = []

  for (let i = 0; i < subpaths.length; i++) {
    const ribbon = processSubpath(subpaths[i], config, seed + i * 100)
    if (ribbon) {
      ribbonPaths.push(ribbon)
    }
  }

  if (ribbonPaths.length === 0) return d

  // Combine all ribbon paths
  return ribbonPaths.join(' ')
}
