import React, { useState, useEffect } from 'react'
import { useFishingStore } from '../stores/useFishingStore'

interface FishingRodProps {
  x?: number
  y?: number
  rodLength?: number
  lineLength?: number
  targetX?: number
  targetY?: number
  facingLeft?: boolean
  boatX?: number
  boatY?: number
}

export const FishingRod: React.FC<FishingRodProps> = ({
  x = 0,
  y = 0,
  rodLength = 200,
  targetX = 500,
  targetY = 300,
  facingLeft = false,
  boatX = 0,
  boatY = 0,
}) => {
  const [rotation, setRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [extendedLineLength, setExtendedLineLength] = useState(0)
  const [currentTarget, setCurrentTarget] = useState({ x: targetX - boatX, y: targetY - boatY })
  
  const castTarget = useFishingStore((state) => state.castTarget)
  const clearCastTarget = useFishingStore((state) => state.clearCastTarget)
  const setCastAnimating = useFishingStore((state) => state.setCastAnimating)
  
  const rodWidth = 4
  
  // Calculate tip position based on initial angle
  // When facing left, mirror the angle
  const initialAngle = facingLeft ? -3 * Math.PI / 4 : -Math.PI / 4
  const tipX = x + rodLength * Math.cos(initialAngle)
  const tipY = y + rodLength * Math.sin(initialAngle)
  
  // Calculate distance from tip to target for line extension
  const distanceToTarget = Math.sqrt(
    Math.pow(currentTarget.x - tipX, 2) + Math.pow(currentTarget.y - tipY, 2)
  )
  
  // Listen for cast target changes and trigger animation
  useEffect(() => {
    if (castTarget && !isAnimating) {
      // Adjust cast target to boat's local coordinate system
      const adjustedTarget = { x: castTarget.x - boatX, y: castTarget.y - boatY }
      setCurrentTarget(adjustedTarget)
      performCast(adjustedTarget)
      clearCastTarget()
    }
  }, [castTarget, boatX, boatY])
  
  const performCast = (targetToUse = currentTarget) => {
    setIsAnimating(true)
    setCastAnimating(true)
    setExtendedLineLength(0)

    // Rotate in opposite directions based on facing direction
    if (facingLeft) {
      // Facing left: rotate forward (clockwise) by 90 degrees
      setRotation((prev) => prev + 90)
      
      // After 500ms, rotate back (counterclockwise) by 90 degrees at 2x speed
      setTimeout(() => {
        setRotation((prev) => prev - 90)
        
        // After rotation completes (at 750ms total), animate line extension
        setTimeout(() => {
          // Animate line extending to target over 800ms
          const startTime = Date.now()
          const duration = 800
          
          const animateLineExtension = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const dist = Math.sqrt(
              Math.pow(targetToUse.x - tipX, 2) + Math.pow(targetToUse.y - tipY, 2)
            )
            setExtendedLineLength(dist * progress)
            
            if (progress < 1) {
              requestAnimationFrame(animateLineExtension)
            } else {
              setIsAnimating(false)
              setCastAnimating(false)
            }
          }
          
          animateLineExtension()
        }, 250)
      }, 500)
    } else {
      // Facing right: rotate back (counterclockwise) by 90 degrees
      setRotation((prev) => prev - 90)
      
      // After 500ms, rotate forward (clockwise) by 90 degrees at 2x speed
      setTimeout(() => {
        setRotation((prev) => prev + 90)
        
        // After rotation completes (at 750ms total), animate line extension
        setTimeout(() => {
          // Animate line extending to target over 800ms
          const startTime = Date.now()
          const duration = 800
          
          const animateLineExtension = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            const dist = Math.sqrt(
              Math.pow(targetToUse.x - tipX, 2) + Math.pow(targetToUse.y - tipY, 2)
            )
            setExtendedLineLength(dist * progress)
            
            if (progress < 1) {
              requestAnimationFrame(animateLineExtension)
            } else {
              setIsAnimating(false)
              setCastAnimating(false)
            }
          }
          
          animateLineExtension()
        }, 250)
      }, 500)
    }
  }

  useEffect(() => {
    return () => {
      setCastAnimating(false)
    }
  }, [setCastAnimating])
  
  return (
    <g className="fishing-rod">
      {/* Rod with rotation */}
      <g
        style={{ 
          cursor: isAnimating ? 'not-allowed' : 'pointer',
          transformOrigin: `${x}px ${y}px`,
          transition: `transform ${isAnimating && rotation % 180 !== 0 ? '0.25s' : '0.5s'} ease-in`,
          transform: `rotate(${rotation}deg)`
        }}
      >
        {/* Fishing rod - angled line */}
        <line
          x1={x}
          y1={y}
          x2={tipX}
          y2={tipY}
          stroke="#8B4513"
          strokeWidth={rodWidth}
          strokeLinecap="round"
        />
        
        {/* Rod tip detail */}
        <circle
          cx={tipX}
          cy={tipY}
          r={rodWidth / 2}
          fill="#654321"
        />
      </g>
      
      {/* Fishing line with counter-rotation to always point down */}
      <g
        style={{ 
          transformOrigin: `${tipX}px ${tipY}px`,
          transition: 'transform 0.5s ease-in-out',
          transform: `translate(${tipX}px, ${tipY}px) rotate(${-rotation}deg) translate(${-tipX}px, ${-tipY}px)`
        }}
      >
        <g
          style={{ 
            transformOrigin: `${tipX}px ${tipY}px`,
            transform: `rotate(${-rotation}deg)`
          }}
        >
          {/* Extended line towards target */}
          {extendedLineLength > 0 && (
            <line
              x1={tipX}
              y1={tipY}
              x2={tipX + (currentTarget.x - tipX) * (extendedLineLength / distanceToTarget)}
              y2={tipY + (currentTarget.y - tipY) * (extendedLineLength / distanceToTarget)}
              stroke="#333"
              strokeWidth={1.5}
              strokeLinecap="round"
              opacity={0.8}
            />
          )}
          
          {/* Hook at end of extended line */}
          {extendedLineLength > 0 && (
            <circle
              cx={tipX + (currentTarget.x - tipX) * (extendedLineLength / distanceToTarget)}
              cy={tipY + (currentTarget.y - tipY) * (extendedLineLength / distanceToTarget)}
              r={4}
              fill="#666"
              stroke="#333"
              strokeWidth={1}
            />
          )}
        </g>
      </g>
    </g>
  )
}
