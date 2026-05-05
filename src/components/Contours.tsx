import { useMemo, useRef } from 'react'
import { usePaperStore } from '../stores/usePaperStore'
import { useCoordinateSystem } from '../hooks/useCoordinateSystem'
import { calculateContours } from '../utils/calculateContours'
import { contourBlobPalette, contourConfig } from '../config/contourConfig'
import { createVariableWidthPath } from '../utils/variableWidthPath'
import { MARGIN } from '../config/layoutConstants'

const outlineVariableWidthConfig = {
  baseWidth: 2.8,
  widthVariation: 0.7,
  noiseScale: 12,
  samplesPerPixel: 0.1,
  minSamples: 16,
  maxSamples: 120,
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const value = parseInt(clean, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (value: number) => value.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function interpolateColor(startHex: string, endHex: string, t: number) {
  const start = hexToRgb(startHex)
  const end = hexToRgb(endHex)

  const r = Math.round(start.r + (end.r - start.r) * t)
  const g = Math.round(start.g + (end.g - start.g) * t)
  const b = Math.round(start.b + (end.b - start.b) * t)

  return rgbToHex(r, g, b)
}

function getBlobColor(t: number) {
  const clamped = Math.max(0, Math.min(1, t))
  const segmentCount = contourBlobPalette.length - 1
  const scaled = clamped * segmentCount
  const lowIdx = Math.floor(scaled)
  const highIdx = Math.min(lowIdx + 1, segmentCount)
  const localT = scaled - lowIdx

  return interpolateColor(contourBlobPalette[lowIdx], contourBlobPalette[highIdx], localT)
}

function Contours() {
  const papers = usePaperStore((state) => state.papers)
  const { contentWidth, contentHeight } = useCoordinateSystem()
  const ribbonCacheRef = useRef<Map<string, string>>(new Map())

  const contoursByCluster = useMemo(
    () => calculateContours(papers, contentWidth, contentHeight, contourConfig),
    [papers, contentWidth, contentHeight]
  )

  const processedClusters = useMemo(() => {
    const cache = ribbonCacheRef.current
    const usedKeys = new Set<string>()

    const result = contoursByCluster.map((cluster) => {
      const sortedContours = [...cluster.contours].sort((a, b) => a.value - b.value)
      const maxIndex = Math.max(sortedContours.length - 1, 1)

      const fillContours = sortedContours.map((contour, i) => {
        const t = i / maxIndex
        const eased = Math.pow(t, 0.9)
        return {
          ...contour,
          fillColor: getBlobColor(eased),
          fillOpacity: i === 0 ? 0.35 : 0.25 + eased * 0.75,
        }
      })

      const outlinedContours = sortedContours.map((contour, i) => {
        const cacheKey = `${cluster.clusterId}:${i}:${contour.path}`
        usedKeys.add(cacheKey)

        let ribbonPath = cache.get(cacheKey)
        if (!ribbonPath) {
          ribbonPath = createVariableWidthPath(
            contour.path,
            outlineVariableWidthConfig,
            cluster.clusterId * 1000 + i
          )
          cache.set(cacheKey, ribbonPath)
        }

        const t = i / maxIndex
        return {
          ...contour,
          ribbonPath,
          outlineOpacity: 0.22 + t * 0.3,
        }
      })

      return {
        clusterId: cluster.clusterId,
        fillContours,
        outlinedContours,
        outermostContour: sortedContours[0],
      }
    })

    for (const key of cache.keys()) {
      if (!usedKeys.has(key)) {
        cache.delete(key)
      }
    }

    return result
  }, [contoursByCluster])

  return (
    <g className="contours" transform={`translate(${MARGIN}, ${MARGIN})`}>
      {processedClusters.map((cluster) => {
        return (
        <g key={cluster.clusterId}>
          {cluster.fillContours.map((contour, i) => {
            return (
              <path
                key={i}
                d={contour.path}
                fill={contour.fillColor}
                fillOpacity={contour.fillOpacity}
                fillRule="evenodd"
              />
            )
          })}

          {cluster.outlinedContours.map((contour, i) => {
            return (
              <path
                key={`outline-${i}`}
                d={contour.ribbonPath}
                fill="#ffffff"
                fillOpacity={contour.outlineOpacity}
                fillRule="evenodd"
              />
            )
          })}

          {cluster.outermostContour && (
            <path
              d={cluster.outermostContour.path}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={0.35}
              strokeWidth={1.2}
            />
          )}
        </g>
      )})}
    </g>
  )
}

export default Contours
