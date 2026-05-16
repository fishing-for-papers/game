import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoatStore } from '../stores/useBoatStore'
import { useCastStore } from '../stores/useCastStore'
import { useFishingStore } from '../stores/useFishingStore'
import { useCoordinateSystem } from '../hooks/useCoordinateSystem'
import { rippleConfig } from '../config/rippleConfig'
import { useDebugStore } from '../stores/useDebugStore'
import { boatConfig } from '../config/boatConfig'
import { MARGIN } from '../config/layoutConstants'
import { useKeywormStore } from '../stores/useKeywormStore'
import FishSvg from '../assets/fish/fish-01.svg?react'
import { findFishBiteTarget } from '../utils/fishMotion'
import type { Paper } from '../types/paper'

interface CastProps {
  enabled?: boolean
}

// Fishable range configuration
// Note: bowOffset is in boat SVG's own coordinate system (before scaling)
// minDistance and maxDistance are in canvas coordinate system (after scaling)
const FISHABLE_RANGE_CONFIG = {
  bowOffset: { x: 400, y: 60 }, // Offset from boat bottom to bow in boat SVG coordinates (x: along boat direction, y: perpendicular from bottom)
  angleRange: 80, // Angle range in degrees
  minDistance: 15, // Minimum fishing distance in canvas coordinates
  maxDistance: 75, // Maximum fishing distance in canvas coordinates
}

const MIN_CATCH_DELAY_MS = 2000
const MAX_CATCH_DELAY_MS = 5000
const CATCH_PROGRESS_BAR_WIDTH = 44
const CATCH_PROGRESS_BAR_HEIGHT = 6
const CATCH_PROGRESS_BAR_OFFSET_Y = 22
const NO_CATCH_MESSAGE_DURATION_MS = 1800
const BITE_FISH_SWIM_DURATION_MS = 1100
const BITE_FISH_TURN_DURATION_MS = 650
const FISH_BITE_POLL_INTERVAL_MS = 100
const FISH_FORWARD_ANGLE_OFFSET = -90

type PendingCatchState = {
  x: number
  y: number
  phase: 'waiting-for-animation-start' | 'waiting-for-animation-end'
}

type CatchFeedbackState = {
  x: number
  y: number
  message: string
} | null

type ActiveBiteFish = {
  id: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  startAngle: number
  targetAngle: number
  facingScaleX: number
  size: number
  paper: Paper
  startedAt: number
  progress: number
  swimProgress: number
  rotationProgress: number
} | null

function Cast(_props: CastProps) {
  const { enabled = true } = _props
  const position = useBoatStore((state) => state.position)
  const rotation = useBoatStore((state) => state.rotation)
  const isMoving = useBoatStore((state) => state.isMoving)
  const castPosition = useCastStore((state) => state.castPosition)
  const clusters = useCastStore((state) => state.clusters)
  const fishDescriptors = useCastStore((state) => state.fishDescriptors)
  const setCastPosition = useCastStore((state) => state.setCastPosition)
  const findPapersWithinRadius = useCastStore((state) => state.findPapersWithinRadius)
  const getClosestPaper = useCastStore((state) => state.getClosestPaper)
  const setCaughtPaper = useCastStore((state) => state.setCaughtPaper)
  const setIsCatchResultOpen = useCastStore((state) => state.setIsCatchResultOpen)
  const hideFish = useCastStore((state) => state.hideFish)
  const setCastTarget = useFishingStore((state) => state.setCastTarget)
  const isCastAnimating = useFishingStore((state) => state.isCastAnimating)
  const keywormKeywords = useKeywormStore((state) => state.keywords)
  const { xScale, yScale } = useCoordinateSystem()
  const isDebugMode = useDebugStore((state) => state.isDebugMode)
  const catchTimeoutRef = useRef<number | null>(null)
  const bitePollTimeoutRef = useRef<number | null>(null)
  const catchAnimationFrameRef = useRef<number | null>(null)
  const biteAnimationFrameRef = useRef<number | null>(null)
  const biteFishRef = useRef<SVGGElement>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const [pendingCatch, setPendingCatch] = useState<PendingCatchState | null>(null)
  const [catchProgress, setCatchProgress] = useState(1)
  const [isCatchTimerVisible, setIsCatchTimerVisible] = useState(false)
  const [catchFeedback, setCatchFeedback] = useState<CatchFeedbackState>(null)
  const [activeBiteFish, setActiveBiteFish] = useState<ActiveBiteFish>(null)

  const clearPendingCatch = useCallback(() => {
    if (catchTimeoutRef.current !== null) {
      window.clearTimeout(catchTimeoutRef.current)
      catchTimeoutRef.current = null
    }

    if (bitePollTimeoutRef.current !== null) {
      window.clearTimeout(bitePollTimeoutRef.current)
      bitePollTimeoutRef.current = null
    }

    if (catchAnimationFrameRef.current !== null) {
      cancelAnimationFrame(catchAnimationFrameRef.current)
      catchAnimationFrameRef.current = null
    }

    setIsCatchTimerVisible(false)
  }, [])

  const finishCatch = useCallback((paper: Paper) => {
    setCaughtPaper({
      ...paper,
      usedKeyworm: [...keywormKeywords],
    })
    setIsCatchResultOpen(true)
    setActiveBiteFish(null)
    setCastPosition(null)
  }, [keywormKeywords, setCastPosition, setCaughtPaper, setIsCatchResultOpen])

  const startBiteFish = useCallback((target: NonNullable<ReturnType<typeof findFishBiteTarget>>, castX: number, castY: number) => {
    if (biteAnimationFrameRef.current !== null) {
      cancelAnimationFrame(biteAnimationFrameRef.current)
      biteAnimationFrameRef.current = null
    }

    const startedAt = performance.now()
    const startAngle = target.pose.angle
    const targetAngle = Math.atan2(castY - target.pose.y, castX - target.pose.x) * 180 / Math.PI
    const facingScaleX = target.fish.direction === 'counterclockwise' ? -1 : 1
    hideFish(target.fish.id)

    const animate = () => {
      const elapsed = performance.now() - startedAt
      const rotationProgress = easeInOutCubic(
        Math.min(1, elapsed / BITE_FISH_TURN_DURATION_MS)
      )
      const swimElapsed = Math.max(0, elapsed - BITE_FISH_TURN_DURATION_MS)
      const swimProgress = easeInOutCubic(
        Math.min(1, swimElapsed / BITE_FISH_SWIM_DURATION_MS)
      )
      const progress = Math.max(rotationProgress, swimProgress)

      setActiveBiteFish({
        id: target.fish.id,
        fromX: target.pose.x,
        fromY: target.pose.y,
        toX: castX,
        toY: castY,
        startAngle,
        targetAngle,
        facingScaleX,
        size: target.fish.size,
        paper: target.paper,
        startedAt,
        progress,
        swimProgress,
        rotationProgress,
      })

      if (swimProgress < 1) {
        biteAnimationFrameRef.current = requestAnimationFrame(animate)
        return
      }

      biteAnimationFrameRef.current = null
      finishCatch(target.paper)
    }

    animate()
  }, [finishCatch, hideFish])

  const showCatchFeedback = useCallback((x: number, y: number, message: string) => {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current)
    }

    setCatchFeedback({ x, y, message })
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setCatchFeedback(null)
      feedbackTimeoutRef.current = null
    }, NO_CATCH_MESSAGE_DURATION_MS)
  }, [])

  const resolveCatch = useCallback((castX: number, castY: number) => {
    clearPendingCatch()
    setPendingCatch(null)

    if (!xScale || !yScale) {
      console.log('🎣 Coordinate scales not ready yet')
      setCastPosition(null)
      return
    }

    const papersInRadius = findPapersWithinRadius(
      castX,
      castY,
      rippleConfig.castRadius,
      xScale,
      yScale
    )

    if (papersInRadius.length > 0) {
      const paper = getClosestPaper(papersInRadius, castX, castY, xScale, yScale)

      if (paper) {
        console.log('🎣 Caught a paper!', {
          title: paper.title,
          authors: paper.authorNames,
          year: paper.year,
          conference: paper.conference,
          papersInRadius: papersInRadius.length,
          paper,
        })

        finishCatch(paper)
      }
    } else {
      console.log('🎣 No papers found within radius')
      setCaughtPaper(null)
      showCatchFeedback(castX, castY, 'No paper caught')
    }

    setCastPosition(null)
  }, [clearPendingCatch, findPapersWithinRadius, finishCatch, getClosestPaper, setCaughtPaper, setCastPosition, showCatchFeedback, xScale, yScale])

  const startCatchTimer = useCallback((castX: number, castY: number) => {
    clearPendingCatch()

    const duration = Math.floor(
      Math.random() * (MAX_CATCH_DELAY_MS - MIN_CATCH_DELAY_MS + 1)
    ) + MIN_CATCH_DELAY_MS
    const startTime = performance.now()

    setCatchProgress(1)
    setIsCatchTimerVisible(true)

    const checkForFishBite = () => {
      const fishBiteTarget = findFishBiteTarget(
        { x: castX, y: castY },
        fishDescriptors,
        clusters
      )

      if (fishBiteTarget) {
        console.log('🎣 Fish noticed the waiting hook!', {
          fishId: fishBiteTarget.fish.id,
          title: fishBiteTarget.paper.title,
        })
        clearPendingCatch()
        startBiteFish(fishBiteTarget, castX, castY)
        return
      }

      bitePollTimeoutRef.current = window.setTimeout(
        checkForFishBite,
        FISH_BITE_POLL_INTERVAL_MS
      )
    }

    const updateProgress = () => {
      const elapsed = performance.now() - startTime
      const remainingProgress = Math.max(0, 1 - elapsed / duration)
      setCatchProgress(remainingProgress)

      if (remainingProgress > 0) {
        catchAnimationFrameRef.current = requestAnimationFrame(updateProgress)
      } else {
        catchAnimationFrameRef.current = null
      }
    }

    catchAnimationFrameRef.current = requestAnimationFrame(updateProgress)
    checkForFishBite()
    catchTimeoutRef.current = window.setTimeout(() => {
      resolveCatch(castX, castY)
    }, duration)
  }, [clearPendingCatch, clusters, fishDescriptors, resolveCatch, startBiteFish])

  // Handle click on fishable area to set cast position
  const handleFishableAreaClick = (e: React.MouseEvent<SVGPathElement>) => {
    // Get the SVG element
    const svg = e.currentTarget.ownerSVGElement
    if (!svg) {
      console.warn('SVG element not found')
      return
    }

    // Get the screen-to-SVG transformation matrix
    const ctm = svg.getScreenCTM()
    if (!ctm) {
      console.warn('Screen CTM not available')
      return
    }

    // Convert screen coordinates to SVG coordinates
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPoint = pt.matrixTransform(ctm.inverse())

    // Adjust for MARGIN offset (Cast is wrapped in a translate(MARGIN, MARGIN) group)
    // The boat position is in content coordinates, so we need to subtract MARGIN
    const contentX = svgPoint.x - MARGIN
    const contentY = svgPoint.y - MARGIN

    // Set the cast position at the clicked location
    setCastPosition({ x: contentX, y: contentY })
    setCatchFeedback(null)
    setActiveBiteFish(null)

    // Trigger the fishing rod cast to this SVG coordinate
    setCastTarget(contentX, contentY)

    // Wait for the cast animation to finish before starting the catch timer
    setPendingCatch({
      x: contentX,
      y: contentY,
      phase: 'waiting-for-animation-start',
    })
  }

  // Calculate bow position
  const rad = (rotation * Math.PI) / 180
  const isFacingLeft = Math.abs(rotation - 180) < 90
  
  // Adjust y offset to be relative to boat bottom instead of center
  // In boat's local coordinate system, bottom is at y = svgHeight/2 (y-axis points down)
  // When facing left, the boat is not flipped in X, so Y offset should be inverted
  const yOffsetMultiplier = isFacingLeft ? -1 : 1
  const adjustedBowOffset = {
    x: FISHABLE_RANGE_CONFIG.bowOffset.x,
    y: (FISHABLE_RANGE_CONFIG.bowOffset.y + boatConfig.svgHeight / 2) * yOffsetMultiplier,
  }
  // Convert bowOffset from boat SVG coordinates to canvas coordinates by applying boat scale
  const scaledBowOffset = {
    x: adjustedBowOffset.x * boatConfig.scale,
    y: adjustedBowOffset.y * boatConfig.scale,
  }
  // x direction: along boat rotation, y direction: perpendicular to boat (rotation + 90°)
  const bowPosition = {
    x: position.x + Math.cos(rad) * scaledBowOffset.x - Math.sin(rad) * scaledBowOffset.y,
    y: position.y + Math.sin(rad) * scaledBowOffset.x + Math.cos(rad) * scaledBowOffset.y,
  }

  // Calculate fishable range angles based on boat rotation
  // If boat faces right (rotation ≈ 0), sweep from 0 to range
  // If boat faces left (rotation ≈ 180), sweep from 180 to (180 - range)
  const normalizedRotation = ((rotation % 360) + 360) % 360 // Normalize to [0, 360)
  const isFacingRight = normalizedRotation < 90 || normalizedRotation > 270
  const startAngle = rotation
  const endAngle = isFacingRight ? rotation + FISHABLE_RANGE_CONFIG.angleRange : rotation - FISHABLE_RANGE_CONFIG.angleRange

  // Helper function to create arc path
  const createArc = (centerX: number, centerY: number, radius: number, startAngleDeg: number, endAngleDeg: number) => {
    const startRad = (startAngleDeg * Math.PI) / 180
    const endRad = (endAngleDeg * Math.PI) / 180
    const startX = centerX + Math.cos(startRad) * radius
    const startY = centerY + Math.sin(startRad) * radius
    const endX = centerX + Math.cos(endRad) * radius
    const endY = centerY + Math.sin(endRad) * radius

    // Determine if we should use the large arc flag
    const angleDiff = Math.abs(endAngleDeg - startAngleDeg)
    const largeArcFlag = angleDiff > 180 ? 1 : 0
    const sweepFlag = isFacingRight ? 1 : 0

    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}`
  }

  // Helper function to create fishable area path (ring between min and max distance)
  const createFishableAreaPath = (centerX: number, centerY: number, minRadius: number, maxRadius: number, startAngleDeg: number, endAngleDeg: number) => {
    const startRad = (startAngleDeg * Math.PI) / 180
    const endRad = (endAngleDeg * Math.PI) / 180

    // Inner arc (min distance)
    const innerStartX = centerX + Math.cos(startRad) * minRadius
    const innerStartY = centerY + Math.sin(startRad) * minRadius
    const innerEndX = centerX + Math.cos(endRad) * minRadius
    const innerEndY = centerY + Math.sin(endRad) * minRadius

    // Outer arc (max distance)
    const outerStartX = centerX + Math.cos(startRad) * maxRadius
    const outerStartY = centerY + Math.sin(startRad) * maxRadius
    const outerEndX = centerX + Math.cos(endRad) * maxRadius
    const outerEndY = centerY + Math.sin(endRad) * maxRadius

    const angleDiff = Math.abs(endAngleDeg - startAngleDeg)
    const largeArcFlag = angleDiff > 180 ? 1 : 0
    const sweepFlag = isFacingRight ? 1 : 0

    // Create path: start at inner arc start, draw inner arc, line to outer arc end, draw outer arc back, close
    return `
      M ${innerStartX} ${innerStartY}
      A ${minRadius} ${minRadius} 0 ${largeArcFlag} ${sweepFlag} ${innerEndX} ${innerEndY}
      L ${outerEndX} ${outerEndY}
      A ${maxRadius} ${maxRadius} 0 ${largeArcFlag} ${sweepFlag ? 0 : 1} ${outerStartX} ${outerStartY}
      Z
    `
  }

  useEffect(() => {
    if (!pendingCatch) {
      return
    }

    if (pendingCatch.phase === 'waiting-for-animation-start' && isCastAnimating) {
      setPendingCatch({ ...pendingCatch, phase: 'waiting-for-animation-end' })
      return
    }

    if (pendingCatch.phase === 'waiting-for-animation-end' && !isCastAnimating) {
      startCatchTimer(pendingCatch.x, pendingCatch.y)
      setPendingCatch(null)
    }
  }, [isCastAnimating, pendingCatch, startCatchTimer])

  useEffect(() => {
    if (!enabled && castPosition) {
      clearPendingCatch()
      setPendingCatch(null)
      setCastPosition(null)
    }
  }, [castPosition, clearPendingCatch, enabled, setCastPosition])

  useEffect(() => {
    if (!castPosition) {
      clearPendingCatch()
      setPendingCatch(null)
      setCatchProgress(1)
    }
  }, [castPosition, clearPendingCatch])

  useEffect(() => {
    return () => {
      clearPendingCatch()

      if (feedbackTimeoutRef.current !== null) {
        window.clearTimeout(feedbackTimeoutRef.current)
      }

      if (biteAnimationFrameRef.current !== null) {
        cancelAnimationFrame(biteAnimationFrameRef.current)
      }
    }
  }, [clearPendingCatch])

  useEffect(() => {
    if (!biteFishRef.current) {
      return
    }

    biteFishRef.current.querySelectorAll('path').forEach((path) => {
      path.setAttribute('fill', '#4a7c7e')
    })
  }, [activeBiteFish?.id])

  // Calculate boundary line endpoints
  const startAngleRad = (startAngle * Math.PI) / 180
  const endAngleRad = (endAngle * Math.PI) / 180

  const startLineEnd = {
    x: bowPosition.x + Math.cos(startAngleRad) * FISHABLE_RANGE_CONFIG.maxDistance,
    y: bowPosition.y + Math.sin(startAngleRad) * FISHABLE_RANGE_CONFIG.maxDistance,
  }

  const endLineEnd = {
    x: bowPosition.x + Math.cos(endAngleRad) * FISHABLE_RANGE_CONFIG.maxDistance,
    y: bowPosition.y + Math.sin(endAngleRad) * FISHABLE_RANGE_CONFIG.maxDistance,
  }

  const startLineMinEnd = {
    x: bowPosition.x + Math.cos(startAngleRad) * FISHABLE_RANGE_CONFIG.minDistance,
    y: bowPosition.y + Math.sin(startAngleRad) * FISHABLE_RANGE_CONFIG.minDistance,
  }

  const endLineMinEnd = {
    x: bowPosition.x + Math.cos(endAngleRad) * FISHABLE_RANGE_CONFIG.minDistance,
    y: bowPosition.y + Math.sin(endAngleRad) * FISHABLE_RANGE_CONFIG.minDistance,
  }

  return (
    <g>
      {/* Fishable Range Visualization - only show when boat is not moving */}
      {!isMoving && (
        <g>
          {/* Fishable area fill */}
          <path
            d={createFishableAreaPath(
              bowPosition.x,
              bowPosition.y,
              FISHABLE_RANGE_CONFIG.minDistance,
              FISHABLE_RANGE_CONFIG.maxDistance,
              startAngle,
              endAngle
            )}
            fill="#7dd3fc"
            opacity={0.4}
            style={{ cursor: 'crosshair' }}
            pointerEvents="fill"
            onClick={handleFishableAreaClick}
          />

          {/* Debug: Show bow position */}
          {isDebugMode && (
            <>
              <circle
                cx={bowPosition.x}
                cy={bowPosition.y}
                r={4}
                fill="#ef4444"
                opacity={0.8}
              />
              <circle
                cx={bowPosition.x}
                cy={bowPosition.y}
                r={6}
                fill="none"
                stroke="#ef4444"
                strokeWidth={1}
                opacity={0.6}
              />
            </>
          )}

          {/* Boundary lines: 0 to min distance (lower opacity, thinner) */}
          <line
            x1={bowPosition.x}
            y1={bowPosition.y}
            x2={startLineMinEnd.x}
            y2={startLineMinEnd.y}
            stroke="#bae6fd"
            strokeWidth={1.5}
            strokeDasharray="2,2"
            opacity={0.5}
          />
          <line
            x1={bowPosition.x}
            y1={bowPosition.y}
            x2={endLineMinEnd.x}
            y2={endLineMinEnd.y}
            stroke="#bae6fd"
            strokeWidth={1.5}
            strokeDasharray="2,2"
            opacity={0.5}
          />

          {/* Boundary lines: min to max distance (with white outline) */}
          <line
            x1={startLineMinEnd.x}
            y1={startLineMinEnd.y}
            x2={startLineEnd.x}
            y2={startLineEnd.y}
            stroke="white"
            strokeWidth={2.5}
            strokeDasharray="6,3"
            opacity={0.65}
          />
          <line
            x1={endLineMinEnd.x}
            y1={endLineMinEnd.y}
            x2={endLineEnd.x}
            y2={endLineEnd.y}
            stroke="white"
            strokeWidth={2.5}
            strokeDasharray="6,3"
            opacity={0.65}
          />

          {/* Arc lines for min and max distance */}
          <path
            d={createArc(bowPosition.x, bowPosition.y, FISHABLE_RANGE_CONFIG.minDistance, startAngle, endAngle)}
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeDasharray="4,4"
            opacity={0.5}
          />
          <path
            d={createArc(bowPosition.x, bowPosition.y, FISHABLE_RANGE_CONFIG.maxDistance, startAngle, endAngle)}
            fill="none"
            stroke="white"
            strokeWidth={2}
            strokeDasharray="4,4"
            opacity={0.5}
          />
        </g>
      )}

      {/* Cast Position (only if cast is active) */}
      {castPosition && (
        <>
          {/* Debug: show search radius circle */}
          {isDebugMode && (
            <circle
              cx={castPosition.x}
              cy={castPosition.y}
              r={rippleConfig.castRadius}
              fill="none"
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="5,5"
              opacity={0.5}
            />
          )}

          {/* Yellow/amber dot at cast position */}
          <circle
            cx={castPosition.x}
            cy={castPosition.y}
            r={5}
            fill="#fbbf24"
            opacity={0.9}
          />

          {/* Catch timer progress bar */}
          {isCatchTimerVisible && (
            <g
              transform={`translate(${castPosition.x - CATCH_PROGRESS_BAR_WIDTH / 2}, ${castPosition.y - CATCH_PROGRESS_BAR_OFFSET_Y})`}
              pointerEvents="none"
            >
              <rect
                x={0}
                y={0}
                width={CATCH_PROGRESS_BAR_WIDTH}
                height={CATCH_PROGRESS_BAR_HEIGHT}
                rx={CATCH_PROGRESS_BAR_HEIGHT / 2}
                fill="#1f2937"
                opacity={0.55}
              />
              <rect
                x={0}
                y={0}
                width={CATCH_PROGRESS_BAR_WIDTH * catchProgress}
                height={CATCH_PROGRESS_BAR_HEIGHT}
                rx={CATCH_PROGRESS_BAR_HEIGHT / 2}
                fill="#fbbf24"
                opacity={0.95}
              />
            </g>
          )}

          {/* Optional: Add a ripple effect */}
          <circle
            cx={castPosition.x}
            cy={castPosition.y}
            r={10}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={2}
            opacity={0.6}
          >
            <animate
              attributeName="r"
              from="5"
              to="20"
              dur="1s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              from="0.6"
              to="0"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
        </>
      )}

      {activeBiteFish && (
        <g
          transform={`translate(${
            activeBiteFish.fromX + (activeBiteFish.toX - activeBiteFish.fromX) * activeBiteFish.swimProgress
          }, ${
            activeBiteFish.fromY + (activeBiteFish.toY - activeBiteFish.fromY) * activeBiteFish.swimProgress
          }) rotate(${interpolateAngle(
            activeBiteFish.startAngle,
            activeBiteFish.targetAngle + FISH_FORWARD_ANGLE_OFFSET,
            activeBiteFish.rotationProgress
          )})`}
          pointerEvents="none"
        >
          <g
            ref={biteFishRef}
            style={{
              transform: `scaleX(${activeBiteFish.facingScaleX})`,
              transformOrigin: 'center',
            }}
          >
            <FishSvg
              width={activeBiteFish.size}
              height={activeBiteFish.size}
              x={-activeBiteFish.size / 2}
              y={-activeBiteFish.size / 2}
              style={{ overflow: 'visible' }}
            />
          </g>
          <circle
            cx={0}
            cy={0}
            r={activeBiteFish.size * 0.75}
            fill="none"
            stroke="#fbbf24"
            strokeWidth={1.5}
            opacity={0.55}
          />
        </g>
      )}

      {catchFeedback && (
        <g
          transform={`translate(${catchFeedback.x}, ${catchFeedback.y - 26})`}
          pointerEvents="none"
        >
          <rect
            x={-60}
            y={-14}
            width={120}
            height={28}
            rx={14}
            fill="#111827"
            opacity={0.82}
          />
          <text
            x={0}
            y={0}
            fill="#f8fafc"
            fontSize={12}
            fontWeight={600}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {catchFeedback.message}
          </text>
        </g>
      )}
    </g>
  )
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2
}

function interpolateAngle(startAngle: number, endAngle: number, progress: number) {
  const delta = ((((endAngle - startAngle) % 360) + 540) % 360) - 180
  return startAngle + delta * progress
}

export default Cast
