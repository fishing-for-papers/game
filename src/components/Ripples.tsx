import { useMemo, useEffect } from 'react'
import { useKeywormStore } from '../stores/useKeywormStore'
import { usePaperStore } from '../stores/usePaperStore'
import { useDebugStore } from '../stores/useDebugStore'
import { useCastStore } from '../stores/useCastStore'
import { useCoordinateSystem } from '../hooks/useCoordinateSystem'
import { searchService } from '../services/searchService'
import { MARGIN } from '../config/layoutConstants'
import { rippleConfig } from '../config/rippleConfig'
import { getRippleMetrics } from '../utils/rippleMetrics'
import type { SearchResponse } from '../services/searchService'
import type { Paper } from '../types/paper'
import Ripple from './Ripple'

interface Cluster {
  x: number
  y: number
  count: number
  papers: Paper[]
}

// Grid-based clustering for nearby points
function clusterByGrid(
  papers: Paper[],
  xScale: (x: number) => number,
  yScale: (y: number) => number,
  gridSize = 20
): Cluster[] {
  const grid = new Map<string, Paper[]>()

  // Assign papers to grid cells
  papers.forEach((paper) => {
    const x = xScale(paper.x)
    const y = yScale(paper.y)
    const gridX = Math.floor(x / gridSize)
    const gridY = Math.floor(y / gridSize)
    const key = `${gridX},${gridY}`

    if (!grid.has(key)) {
      grid.set(key, [])
    }
    grid.get(key)!.push(paper)
  })

  // Create cluster for each grid cell with center point
  return Array.from(grid.values()).map((clusterPapers) => {
    const centerX =
      clusterPapers.reduce((sum, p) => sum + xScale(p.x), 0) /
      clusterPapers.length
    const centerY =
      clusterPapers.reduce((sum, p) => sum + yScale(p.y), 0) /
      clusterPapers.length

    return {
      x: centerX,
      y: centerY,
      count: clusterPapers.length,
      papers: clusterPapers,
    }
  })
}

function Ripples() {
  const keywords = useKeywormStore((state) => state.keywords)
  const papers = usePaperStore((state) => state.papers)
  const isIndexReady = usePaperStore((state) => state.isIndexReady)
  const isDebugMode = useDebugStore((state) => state.isDebugMode)
  const setClusters = useCastStore((state) => state.setClusters)
  const { contentWidth, contentHeight, xScale, yScale } = useCoordinateSystem()

  // Search papers using combined keywords
  const searchResponse = useMemo<SearchResponse>(() => {
    if (keywords.length === 0 || !searchService.isReady() || !isIndexReady) {
      console.log('[Ripples] No keywords or search service not ready', {
        hasKeywords: keywords.length > 0,
        searchServiceReady: searchService.isReady(),
        isIndexReady
      })
      return {
        papers: [],
        mode: null,
        defaultMode: 'exact',
        fallbackMode: 'bm25',
        usedFallback: false,
        defaultCount: 0,
        fallbackCount: 0,
      }
    }

    // Combine all keywords into a single search query
    const combinedQuery = keywords.join(' ')
    console.log('[Ripples] Search query:', combinedQuery)

    // Search with random sampling enabled
    const response = searchService.search(
      combinedQuery,
      rippleConfig.searchLimit,
      {
        random: rippleConfig.randomSampling,
        fallbackLimit: rippleConfig.fallbackSearchLimit,
      }
    )

    // console.log('[Ripples] Search results:', {
    //   query: combinedQuery,
    //   mode: response.mode,
    //   defaultMode: response.defaultMode,
    //   fallbackMode: response.fallbackMode,
    //   usedFallback: response.usedFallback,
    //   defaultCount: response.defaultCount,
    //   fallbackCount: response.fallbackCount,
    //   message: response.message,
    //   displayedCount: response.papers.length,
    //   papers: response.papers
    // })

    return response
  }, [keywords, papers, isIndexReady])
  const searchedPapers = searchResponse.papers

  // Cluster nearby papers
  const clusters = useMemo(() => {
    if (searchedPapers.length === 0) return []
    const clustersResult = clusterByGrid(searchedPapers, xScale, yScale, rippleConfig.clusterGridSize)

    // Log cluster size distribution
    if (clustersResult.length > 0) {
      const distribution = new Map<number, number>()
      const sizes = clustersResult.map(c => c.count)

      // Count frequency of each size
      sizes.forEach(size => {
        distribution.set(size, (distribution.get(size) || 0) + 1)
      })

      // Calculate statistics
      const totalClusters = clustersResult.length
      const totalPapers = sizes.reduce((sum, size) => sum + size, 0)
      const avgSize = totalPapers / totalClusters
      const minSize = Math.min(...sizes)
      const maxSize = Math.max(...sizes)

      console.log('[Ripples] Cluster Distribution:', {
        totalClusters,
        totalPapers,
        avgSize: avgSize.toFixed(2),
        minSize,
        maxSize,
        distribution: Object.fromEntries(
          Array.from(distribution.entries()).sort((a, b) => a[0] - b[0])
        ),
        details: clustersResult.map((c, i) => ({
          cluster: i,
          count: c.count,
          position: { x: Math.round(c.x), y: Math.round(c.y) }
        }))
      })
    }

    return clustersResult
  }, [searchedPapers, xScale, yScale])

  // Update cast store with clusters data
  useEffect(() => {
    setClusters(clusters, rippleConfig.clusterGridSize)
  }, [clusters, setClusters])

  // Calculate grid lines based on cluster grid size
  const gridSize = rippleConfig.clusterGridSize
  const innerWidth = contentWidth
  const innerHeight = contentHeight
  const estimatedMessageWidth = (searchResponse.message?.length ?? 0) * 7 + 36
  const messageWidth = Math.min(
    480,
    contentWidth - 32,
    Math.max(260, estimatedMessageWidth)
  )

  // Debug elements
  const verticalLines = []
  const horizontalLines = []

  if (isDebugMode) {
    // Create vertical grid lines
    for (let x = 0; x <= innerWidth; x += gridSize) {
      verticalLines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={innerHeight}
          stroke="#ddd"
          strokeWidth={0.5}
          strokeOpacity={0.3}
          strokeDasharray="2,2"
        />
      )
    }

    // Create horizontal grid lines
    for (let y = 0; y <= innerHeight; y += gridSize) {
      horizontalLines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={innerWidth}
          y2={y}
          stroke="#ddd"
          strokeWidth={0.5}
          strokeOpacity={0.3}
          strokeDasharray="2,2"
        />
      )
    }
  }

  return (
    <g className="ripples" transform={`translate(${MARGIN}, ${MARGIN})`}>
      {/* Debug grid lines */}
      {isDebugMode && (
        <g className="debug-grid">
          {verticalLines}
          {horizontalLines}
        </g>
      )}

      {/* Animated ripples for each cluster */}
      {clusters.map((cluster, index) => {
        // Map cluster size to ripple parameters
        const { baseRadius, ringCount } = getRippleMetrics(cluster.count)
        const opacity = Math.min(0.3 + cluster.count * 0.05, 0.8) // More papers = more visible
        const duration = cluster.count === 1 ? 5 : Math.max(2, 4 - cluster.count * 0.1) // More papers = faster animation (min 1.5s)

        // Fewer papers = longer pause between animations
        const pauseDuration = Math.max(0, 4 - cluster.count * 0.3) // 1 paper: 3.7s pause, 10 papers: 1s pause, 14+ papers: 0s pause

        // Random initial delay for each ripple (0 to total cycle time)
        const randomDelay = Math.random() * (duration + pauseDuration)

        return (
          <Ripple
            key={`ripple-${index}`}
            cx={cluster.x}
            cy={cluster.y}
            baseRadius={baseRadius}
            ringCount={ringCount}
            opacity={opacity}
            duration={duration}
            pauseDuration={pauseDuration}
            randomDelay={randomDelay}
            color="#ffffff"
          />
        )
      })}

      {searchResponse.message && (
        <g
          className="search-fallback-message"
          transform={`translate(${contentWidth / 2}, 28)`}
          pointerEvents="none"
        >
          <rect
            x={-messageWidth / 2}
            y={-18}
            width={messageWidth}
            height={36}
            rx={8}
            fill="rgba(255, 255, 255, 0.78)"
            stroke="rgba(42, 57, 72, 0.2)"
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill="#2a3948"
          >
            {searchResponse.message}
          </text>
        </g>
      )}

      {/* Debug circles - only show in debug mode */}
      {isDebugMode &&
        clusters.map((cluster, index) => {
          const { influenceRadius, outerRadius } = getRippleMetrics(cluster.count)

          return (
            <g key={`debug-${index}`}>
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={outerRadius}
                fill="none"
                stroke="#ffffff"
                strokeWidth={1}
                strokeDasharray="3,3"
                strokeOpacity={0.28}
              />
              <circle
                cx={cluster.x}
                cy={cluster.y}
                r={influenceRadius}
                fill="none"
                stroke={rippleConfig.color}
                strokeWidth={1.25}
                strokeDasharray="6,3"
                strokeOpacity={0.65}
              >
                <title>{`${cluster.count} paper${cluster.count > 1 ? 's' : ''}`}</title>
              </circle>
            </g>
          )
        })}
    </g>
  )
}

export default Ripples
