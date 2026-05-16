import { useCallback, useEffect, useRef, useState } from 'react'
import { useBoatStore } from '../stores/useBoatStore'
import { useCastStore } from '../stores/useCastStore'
import { useFishingStore } from '../stores/useFishingStore'
import { useCoordinateSystem } from '../hooks/useCoordinateSystem'
import { useDebugStore } from '../stores/useDebugStore'
import { boatConfig } from '../config/boatConfig'
import { catchingConfig } from '../config/catchingConfig'
import { MARGIN } from '../config/layoutConstants'
import { useKeywormStore } from '../stores/useKeywormStore'
import FishSvg from '../assets/fish/fish-01.svg?react'
import { findFishBiteTarget, stableUnit } from '../utils/fishMotion'
import { getRippleMetrics } from '../utils/rippleMetrics'
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

const NO_CATCH_MESSAGE_DURATION_MS = 1800
const FEEDBACK_CHAR_WIDTH = 7
const FEEDBACK_HORIZONTAL_PADDING = 24
const FEEDBACK_MIN_WIDTH = 120

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
  restoreFishId?: string
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
  fadeFrom: number
  progress: number
  fadeProgress: number
  swimProgress: number
  rotationProgress: number
  shakeProgress: number
} | null

type StaticCandidate = {
  id: string
  paper: Paper
  spawnX: number
  spawnY: number
  biteDelay: number
  fishSize: number
  startAngleOffset: number
}

function Cast(_props: CastProps) {
  const { enabled = true } = _props
  const position = useBoatStore((state) => state.position)
  const rotation = useBoatStore((state) => state.rotation)
  const isMoving = useBoatStore((state) => state.isMoving)
  const castPosition = useCastStore((state) => state.castPosition)
  const clusters = useCastStore((state) => state.clusters)
  const fishDescriptors = useCastStore((state) => state.fishDescriptors)
  const setCastPosition = useCastStore((state) => state.setCastPosition)
  const setCaughtPaper = useCastStore((state) => state.setCaughtPaper)
  const setIsCatchResultOpen = useCastStore((state) => state.setIsCatchResultOpen)
  const hideFish = useCastStore((state) => state.hideFish)
  const showFish = useCastStore((state) => state.showFish)
  const setCastTarget = useFishingStore((state) => state.setCastTarget)
  const isCastAnimating = useFishingStore((state) => state.isCastAnimating)
  const keywormKeywords = useKeywormStore((state) => state.keywords)
  const { xScale, yScale } = useCoordinateSystem()
  const isDebugMode = useDebugStore((state) => state.isDebugMode)
  const bitePollTimeoutRef = useRef<number | null>(null)
  const staticBiteTimeoutRef = useRef<number | null>(null)
  const noBiteHintTimeoutRef = useRef<number | null>(null)
  const biteAnimationFrameRef = useRef<number | null>(null)
  const biteFishRef = useRef<SVGGElement>(null)
  const feedbackTimeoutRef = useRef<number | null>(null)
  const activeBiteFishRef = useRef<ActiveBiteFish>(null)
  const [pendingCatch, setPendingCatch] = useState<PendingCatchState | null>(null)
  const [catchFeedback, setCatchFeedback] = useState<CatchFeedbackState>(null)
  const [activeBiteFish, setActiveBiteFish] = useState<ActiveBiteFish>(null)

  useEffect(() => {
    activeBiteFishRef.current = activeBiteFish
  }, [activeBiteFish])

  const clearPendingCatch = useCallback(() => {
    if (bitePollTimeoutRef.current !== null) {
      window.clearTimeout(bitePollTimeoutRef.current)
      bitePollTimeoutRef.current = null
    }

    if (staticBiteTimeoutRef.current !== null) {
      window.clearTimeout(staticBiteTimeoutRef.current)
      staticBiteTimeoutRef.current = null
    }

    if (noBiteHintTimeoutRef.current !== null) {
      window.clearTimeout(noBiteHintTimeoutRef.current)
      noBiteHintTimeoutRef.current = null
    }
  }, [])

  const finishCatch = useCallback((paper: Paper) => {
    clearPendingCatch()
    setCaughtPaper({
      ...paper,
      usedKeyworm: [...keywormKeywords],
    })
    setIsCatchResultOpen(true)
    activeBiteFishRef.current = null
    setActiveBiteFish(null)
    setCastPosition(null)
  }, [clearPendingCatch, keywormKeywords, setCastPosition, setCaughtPaper, setIsCatchResultOpen])

  const cancelActiveHook = useCallback((restoreHiddenFish = true) => {
    clearPendingCatch()

    if (biteAnimationFrameRef.current !== null) {
      cancelAnimationFrame(biteAnimationFrameRef.current)
      biteAnimationFrameRef.current = null
    }

    setPendingCatch(null)
    setCastPosition(null)
    setCatchFeedback(null)
    activeBiteFishRef.current = null

    setActiveBiteFish((currentBiteFish) => {
      if (restoreHiddenFish && currentBiteFish?.restoreFishId) {
        showFish(currentBiteFish.restoreFishId)
      }

      return null
    })
  }, [clearPendingCatch, setCastPosition, showFish])

  const startBiteAnimation = useCallback((bite: {
    id: string
    restoreFishId?: string
    fromX: number
    fromY: number
    toX: number
    toY: number
    startAngle: number
    targetAngle: number
    facingScaleX: number
    size: number
    paper: Paper
    fadeFrom: number
    adjustStartPoint: boolean
  }) => {
    if (biteAnimationFrameRef.current !== null) {
      cancelAnimationFrame(biteAnimationFrameRef.current)
      biteAnimationFrameRef.current = null
    }

    const startedAt = performance.now()
    const mouthOffset = getMouthOffset(
      bite.targetAngle,
      bite.size,
      bite.facingScaleX
    )
    const endCenterX = bite.toX - mouthOffset.x
    const endCenterY = bite.toY - mouthOffset.y
    const adjustedStart = bite.adjustStartPoint
      ? getAdjustedBiteStartPoint(
          bite.fromX,
          bite.fromY,
          endCenterX,
          endCenterY,
          bite.targetAngle,
          bite.size
        )
      : { x: bite.fromX, y: bite.fromY }

    const animate = () => {
      const elapsed = performance.now() - startedAt
      const rotationProgress = easeInOutCubic(
        Math.min(1, elapsed / catchingConfig.biteFishTurnDurationMs)
      )
      const fadeProgress = easeOutCubic(
        Math.min(1, elapsed / catchingConfig.biteFishFadeInDurationMs)
      )
      const swimElapsed = Math.max(0, elapsed - catchingConfig.biteFishTurnDurationMs)
      const swimProgress = easeInOutCubic(
        Math.min(1, swimElapsed / catchingConfig.biteFishSwimDurationMs)
      )
      const shakeElapsed = Math.max(
        0,
        elapsed - catchingConfig.biteFishTurnDurationMs - catchingConfig.biteFishSwimDurationMs
      )
      const shakeProgress = Math.min(
        1,
        shakeElapsed / catchingConfig.biteFishShakeDurationMs
      )
      const progress = Math.max(rotationProgress, swimProgress, shakeProgress)

      setActiveBiteFish({
        id: bite.id,
        restoreFishId: bite.restoreFishId,
        fromX: adjustedStart.x,
        fromY: adjustedStart.y,
        toX: endCenterX,
        toY: endCenterY,
        startAngle: bite.startAngle,
        targetAngle: bite.targetAngle,
        facingScaleX: bite.facingScaleX,
        size: bite.size,
        paper: bite.paper,
        startedAt,
        fadeFrom: bite.fadeFrom,
        progress,
        fadeProgress,
        swimProgress,
        rotationProgress,
        shakeProgress,
      })

      if (shakeProgress < 1) {
        biteAnimationFrameRef.current = requestAnimationFrame(animate)
        return
      }

      biteAnimationFrameRef.current = null
      finishCatch(bite.paper)
    }

    animate()
  }, [finishCatch])

  const startVisibleFishBite = useCallback((target: NonNullable<ReturnType<typeof findFishBiteTarget>>, castX: number, castY: number) => {
    const targetAngle = Math.atan2(castY - target.pose.y, castX - target.pose.x) * 180 / Math.PI
    const facingScaleX = target.fish.direction === 'counterclockwise' ? -1 : 1
    hideFish(target.fish.id)

    startBiteAnimation({
      id: target.fish.id,
      restoreFishId: target.fish.id,
      fromX: target.pose.x,
      fromY: target.pose.y,
      toX: castX,
      toY: castY,
      startAngle: target.pose.angle,
      targetAngle,
      facingScaleX,
      size: target.fish.size,
      paper: target.paper,
      fadeFrom: 1,
      adjustStartPoint: false,
    })
  }, [hideFish, startBiteAnimation])

  const startStaticFishBite = useCallback((candidate: StaticCandidate, castX: number, castY: number) => {
    const targetAngle = Math.atan2(castY - candidate.spawnY, castX - candidate.spawnX) * 180 / Math.PI

    startBiteAnimation({
      id: candidate.id,
      fromX: candidate.spawnX,
      fromY: candidate.spawnY,
      toX: castX,
      toY: castY,
      startAngle: targetAngle + candidate.startAngleOffset,
      targetAngle,
      facingScaleX: 1,
      size: candidate.fishSize,
      paper: candidate.paper,
      fadeFrom: 0,
      adjustStartPoint: true,
    })
  }, [startBiteAnimation])

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

  const startWaitingForBite = useCallback((castX: number, castY: number) => {
    clearPendingCatch()

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
        startVisibleFishBite(fishBiteTarget, castX, castY)
        return
      }

      bitePollTimeoutRef.current = window.setTimeout(
        checkForFishBite,
        catchingConfig.fishBitePollIntervalMs
      )
    }

    const staticCandidate = getStaticCandidate(castX, castY, clusters, xScale, yScale)
    if (staticCandidate) {
      staticBiteTimeoutRef.current = window.setTimeout(() => {
        clearPendingCatch()
        startStaticFishBite(staticCandidate, castX, castY)
      }, staticCandidate.biteDelay)
    } else {
      noBiteHintTimeoutRef.current = window.setTimeout(() => {
        showCatchFeedback(castX, castY, 'No bite yet. Try casting elsewhere.')
      }, catchingConfig.noBiteHintDelayMs)
    }

    checkForFishBite()
  }, [clearPendingCatch, clusters, fishDescriptors, showCatchFeedback, startStaticFishBite, startVisibleFishBite, xScale, yScale])

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

    cancelActiveHook()

    // Set the cast position at the clicked location
    setCastPosition({ x: contentX, y: contentY })
    setCatchFeedback(null)
    setActiveBiteFish(null)

    // Trigger the fishing rod cast to this SVG coordinate
    setCastTarget(contentX, contentY)

    // Wait for the cast animation to finish before the hook starts waiting for fish.
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
      startWaitingForBite(pendingCatch.x, pendingCatch.y)
      setPendingCatch(null)
    }
  }, [isCastAnimating, pendingCatch, startWaitingForBite])

  useEffect(() => {
    if ((!enabled || isMoving) && (castPosition || pendingCatch || activeBiteFish)) {
      cancelActiveHook()
    }
  }, [activeBiteFish, cancelActiveHook, castPosition, enabled, isMoving, pendingCatch])

  useEffect(() => {
    if (!castPosition) {
      clearPendingCatch()
      setPendingCatch(null)
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

      if (activeBiteFishRef.current?.restoreFishId) {
        showFish(activeBiteFishRef.current.restoreFishId)
      }
    }
  }, [clearPendingCatch, showFish])

  useEffect(() => {
    if (!biteFishRef.current) {
      return
    }

    biteFishRef.current.querySelectorAll('path').forEach((path) => {
      path.setAttribute('fill', '#315f63')
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
            <>
              <circle
                cx={castPosition.x}
                cy={castPosition.y}
                r={catchingConfig.hookDebugRadius}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={2}
                strokeDasharray="5,5"
                opacity={0.5}
              />
              <circle
                cx={castPosition.x}
                cy={castPosition.y}
                r={catchingConfig.neighbourhoodRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth={1.5}
                strokeDasharray="3,4"
                opacity={0.65}
              >
                <title>Neighbourhood radius</title>
              </circle>
            </>
          )}

          {/* Yellow/amber dot at cast position */}
          <circle
            cx={castPosition.x}
            cy={castPosition.y}
            r={5}
            fill="#fbbf24"
            opacity={0.9}
          />

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
          transform={getBiteFishTransform(activeBiteFish)}
          opacity={getBiteFishOpacity(activeBiteFish)}
          pointerEvents="none"
        >
          <g transform={getBiteFishPivotTransform(activeBiteFish)}>
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
          </g>
        </g>
      )}

      {catchFeedback && (
        <g
          transform={`translate(${catchFeedback.x}, ${catchFeedback.y - 26})`}
          pointerEvents="none"
        >
          <rect
            x={-getCatchFeedbackWidth(catchFeedback.message) / 2}
            y={-14}
            width={getCatchFeedbackWidth(catchFeedback.message)}
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

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3)
}

function interpolateAngle(startAngle: number, endAngle: number, progress: number) {
  const delta = ((((endAngle - startAngle) % 360) + 540) % 360) - 180
  return startAngle + delta * progress
}

function getCatchFeedbackWidth(message: string) {
  return Math.max(
    FEEDBACK_MIN_WIDTH,
    message.length * FEEDBACK_CHAR_WIDTH + FEEDBACK_HORIZONTAL_PADDING
  )
}

function getBiteFishOpacity(biteFish: NonNullable<ActiveBiteFish>) {
  return biteFish.fadeFrom + (1 - biteFish.fadeFrom) * biteFish.fadeProgress
}

function getBiteFishTransform(biteFish: NonNullable<ActiveBiteFish>) {
  const baseX = biteFish.fromX + (biteFish.toX - biteFish.fromX) * biteFish.swimProgress
  const baseY = biteFish.fromY + (biteFish.toY - biteFish.fromY) * biteFish.swimProgress
  const angle = interpolateAngle(
    biteFish.startAngle,
    biteFish.targetAngle + catchingConfig.fishForwardAngleOffset,
    biteFish.rotationProgress
  )

  return `translate(${baseX}, ${baseY}) rotate(${angle})`
}

function getBiteFishPivotTransform(biteFish: NonNullable<ActiveBiteFish>) {
  const shakeRotation = getBiteFishShakeRotation(biteFish)
  const pivotX = 0
  const pivotY = biteFish.size * catchingConfig.fishMouthOffsetScale

  return `translate(${pivotX}, ${pivotY}) rotate(${shakeRotation}) translate(${-pivotX}, ${-pivotY})`
}

function getBiteFishShakeRotation(biteFish: NonNullable<ActiveBiteFish>) {
  if (biteFish.shakeProgress <= 0) {
    return 0
  }

  const decay = 1 - biteFish.shakeProgress
  const wave = Math.sin(
    biteFish.shakeProgress * Math.PI * 2 * catchingConfig.biteFishShakeCycles
  )

  return wave * catchingConfig.biteFishShakeRotationDegrees * decay
}

function getMouthOffset(targetAngle: number, fishSize: number, facingScaleX: number) {
  const visualAngle = targetAngle + catchingConfig.fishForwardAngleOffset
  const localMouthAngle = visualAngle + (facingScaleX === -1 ? 180 : 0) - catchingConfig.fishForwardAngleOffset
  const mouthRad = localMouthAngle * Math.PI / 180
  const mouthDistance = fishSize * catchingConfig.fishMouthOffsetScale

  return {
    x: Math.cos(mouthRad) * mouthDistance,
    y: Math.sin(mouthRad) * mouthDistance,
  }
}

function getAdjustedBiteStartPoint(
  fromX: number,
  fromY: number,
  endCenterX: number,
  endCenterY: number,
  targetAngle: number,
  fishSize: number
) {
  const minDistance = fishSize * catchingConfig.minBiteFishSwimDistanceScale
  const distance = getDistance(fromX, fromY, endCenterX, endCenterY)

  if (distance >= minDistance) {
    return { x: fromX, y: fromY }
  }

  const targetRad = targetAngle * Math.PI / 180

  return {
    x: endCenterX - Math.cos(targetRad) * minDistance,
    y: endCenterY - Math.sin(targetRad) * minDistance,
  }
}

function getStaticCandidate(
  castX: number,
  castY: number,
  clusters: Array<{ x: number; y: number; count: number; papers: Paper[] }>,
  xScale: ((x: number) => number) | null,
  yScale: ((y: number) => number) | null
): StaticCandidate | null {
  return (
    getClusterStaticCandidate(castX, castY, clusters) ??
    getNeighbourhoodStaticCandidate(castX, castY, clusters, xScale, yScale)
  )
}

function getClusterStaticCandidate(
  castX: number,
  castY: number,
  clusters: Array<{ x: number; y: number; count: number; papers: Paper[] }>
): StaticCandidate | null {
  let bestCluster: {
    clusterIndex: number
    normalizedDistance: number
    cluster: { x: number; y: number; count: number; papers: Paper[] }
  } | null = null

  clusters.forEach((cluster, clusterIndex) => {
    if (cluster.papers.length === 0) {
      return
    }

    const metrics = getRippleMetrics(cluster.count)
    const distance = getDistance(castX, castY, cluster.x, cluster.y)
    const normalizedDistance = distance / metrics.influenceRadius

    if (normalizedDistance > 1) {
      return
    }

    if (!bestCluster || normalizedDistance < bestCluster.normalizedDistance) {
      bestCluster = {
        clusterIndex,
        normalizedDistance,
        cluster,
      }
    }
  })

  if (!bestCluster) {
    return null
  }

  const { cluster, clusterIndex, normalizedDistance } = bestCluster
  const distanceScore = 1 - clamp(normalizedDistance, 0, 1)
  const delay = lerp(
    catchingConfig.clusterBiteMaxDelayMs,
    catchingConfig.clusterBiteMinDelayMs,
    distanceScore
  ) * lerp(
    catchingConfig.clusterBiteJitterMin,
    catchingConfig.clusterBiteJitterMax,
    stableUnit(`cluster-bite-delay-${clusterIndex}-${Math.round(castX)}-${Math.round(castY)}`)
  )
  const spawnPoint = getClusterSpawnPoint(cluster.x, cluster.y, castX, castY)

  return {
    id: `cluster-bite-${clusterIndex}-${Math.round(castX)}-${Math.round(castY)}`,
    paper: pickClusterPaper(cluster.papers, `cluster-paper-${clusterIndex}-${Math.round(castX)}-${Math.round(castY)}`),
    spawnX: spawnPoint.x,
    spawnY: spawnPoint.y,
    biteDelay: delay,
    fishSize: 28,
    startAngleOffset: -45,
  }
}

function getNeighbourhoodStaticCandidate(
  castX: number,
  castY: number,
  clusters: Array<{ x: number; y: number; count: number; papers: Paper[] }>,
  xScale: ((x: number) => number) | null,
  yScale: ((y: number) => number) | null
): StaticCandidate | null {
  if (!xScale || !yScale) {
    return null
  }

  let nearestPaper: {
    paper: Paper
    distance: number
    paperX: number
    paperY: number
  } | null = null

  for (const cluster of clusters) {
    for (const paper of cluster.papers) {
      const paperX = xScale(paper.x)
      const paperY = yScale(paper.y)
      const distance = getDistance(castX, castY, paperX, paperY)

      if (distance > catchingConfig.neighbourhoodRadius) {
        continue
      }

      if (!nearestPaper || distance < nearestPaper.distance) {
        nearestPaper = {
          paper,
          distance,
          paperX,
          paperY,
        }
      }
    }
  }

  if (!nearestPaper) {
    return null
  }

  const distanceScore = 1 - clamp(
    nearestPaper.distance / catchingConfig.neighbourhoodRadius,
    0,
    1
  )
  const delay = lerp(
    catchingConfig.neighbourhoodBiteMaxDelayMs,
    catchingConfig.neighbourhoodBiteMinDelayMs,
    distanceScore
  ) * lerp(
    catchingConfig.neighbourhoodBiteJitterMin,
    catchingConfig.neighbourhoodBiteJitterMax,
    stableUnit(`neighbourhood-bite-delay-${Math.round(castX)}-${Math.round(castY)}`)
  )
  const spawnPoint = getNeighbourhoodSpawnPoint(
    castX,
    castY,
    nearestPaper.paperX,
    nearestPaper.paperY
  )

  return {
    id: `neighbourhood-bite-${Math.round(castX)}-${Math.round(castY)}`,
    paper: nearestPaper.paper,
    spawnX: spawnPoint.x,
    spawnY: spawnPoint.y,
    biteDelay: delay,
    fishSize: catchingConfig.neighbourhoodFishSize,
    startAngleOffset: -30,
  }
}

function getClusterSpawnPoint(clusterX: number, clusterY: number, castX: number, castY: number) {
  return {
    x: lerp(clusterX, castX, 0.35),
    y: lerp(clusterY, castY, 0.35),
  }
}

function getNeighbourhoodSpawnPoint(castX: number, castY: number, paperX: number, paperY: number) {
  return {
    x: lerp(castX, paperX, 0.65),
    y: lerp(castY, paperY, 0.65),
  }
}

function pickClusterPaper(papers: Paper[], seed: string) {
  const index = Math.floor(stableUnit(seed) * papers.length)
  return papers[index] ?? papers[0]
}

function getDistance(x1: number, y1: number, x2: number, y2: number) {
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress
}

export default Cast
