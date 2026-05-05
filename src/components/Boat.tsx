import { useEffect, useRef, useState } from 'react'
import { useBoatStore } from '../stores/useBoatStore'
import { useFishingStore } from '../stores/useFishingStore'
import { useCoordinateSystem } from '../hooks/useCoordinateSystem'
import BoatMovingSvg from '../assets/boat/boat-moving.svg?react'
import BoatStaticSvg from '../assets/boat/boat-static.svg?react'
import { FishingRod } from './FishingRod'
import { boatConfig } from '../config/boatConfig'

function Boat() {
  const position = useBoatStore((state) => state.position)
  const rotation = useBoatStore((state) => state.rotation)
  const isMoving = useBoatStore((state) => state.isMoving)
  const setPosition = useBoatStore((state) => state.setPosition)
  const castTarget = useFishingStore((state) => state.castTarget)
  const { contentWidth, contentHeight } = useCoordinateSystem()

  // Ref and state for dynamic boat center calculation
  const boatSvgRef = useRef<SVGGElement>(null)
  const [boatCenter, setBoatCenter] = useState({ x: 0, y: 0 })

  // Initialize boat position to center when dimensions are available
  useEffect(() => {
    if (contentWidth > 0 && contentHeight > 0) {
      setPosition(contentWidth / 2, contentHeight / 2)
    }
  }, [contentWidth, contentHeight, setPosition])

  // Calculate boat center dynamically based on SVG bounding box
  useEffect(() => {
    if (boatSvgRef.current) {
      const bbox = boatSvgRef.current.getBBox()
      setBoatCenter({
        x: bbox.x + bbox.width / 2,
        y: bbox.y + bbox.height / 2,
      })
    }
  }, [isMoving]) // Recalculate when switching between moving/static SVG

  // Scale factor for the boat size
  const boatScale = boatConfig.scale

  // Choose boat image based on moving state
  // Show static image only when isMoving is false (after alignment completes)
  const BoatSvg = isMoving ? BoatMovingSvg : BoatStaticSvg

  // When static, flip horizontally based on direction instead of rotating
  // Facing right (0°): normal, Facing left (180°): flipped
  const isFacingLeft = Math.abs(rotation - 180) < 90
  const scaleX = isFacingLeft ? boatScale : -boatScale
  
  // Fishing rod position varies based on boat direction
  const rodX = 300 * scaleX

  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      <g
        transform={
          isMoving
            ? `rotate(${rotation}) scale(${-boatScale}, ${boatScale})`
            : `scale(${scaleX}, ${boatScale})`
        }
      >
        <g ref={boatSvgRef} transform={`translate(${-boatCenter.x}, ${-boatCenter.y})`}>
          <BoatSvg style={{ fill: '#f5e6d3' }} />
        </g>
      </g>
      
      {/* Fishing rod attached to boat - only show when not moving */}
      {!isMoving && (
        <FishingRod 
          x={rodX} 
          y={-7} 
          rodLength={60} 
          targetX={castTarget?.x ?? 0} 
          targetY={castTarget?.y ?? 0} 
          facingLeft={isFacingLeft}
          boatX={position.x}
          boatY={position.y}
        />
      )}
    </g>
  )
}

export default Boat
