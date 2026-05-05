import FishSvg from '../assets/fish/fish-01.svg?react'
import { useRef, useEffect } from 'react'

interface FishProps {
  cx: number
  cy: number
  radius?: number
  speed?: number
  randomDelay?: number
  direction?: 'clockwise' | 'counterclockwise'
  randomStartOffset?: boolean
  size?: number
}

function Fish({
  cx,
  cy,
  radius = 60,
  speed = 5 + Math.random() * 30, // Random speed between 15s and 25s
  randomDelay = 20,
  direction = 'counterclockwise',
  randomStartOffset = true,
  size = 25,
}: FishProps) {
  const fishRef = useRef<SVGGElement>(null)
  const fishSize = size

  // Apply fill color to SVG paths
  useEffect(() => {
    if (fishRef.current) {
      const paths = fishRef.current.querySelectorAll('path')
      paths.forEach((path) => {
        path.setAttribute('fill', '#4a7c7e')
      })
    }
  }, [])
    //Calculate random starting offset
  const startOffset = randomStartOffset ? Math.random() * 360 : 0

  // Generate positions around the circle
  const steps = 24
  const xPositions: number[] = []
  const yPositions: number[] = []
  const rotations: number[] = []

  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    const angle = ratio * 360 * (direction === 'clockwise' ? 1 : -1) + startOffset
    const rad = (angle * Math.PI) / 180

    const x = cx + radius * Math.cos(rad)
    const y = cy + radius * Math.sin(rad)

    xPositions.push(x)
    yPositions.push(y)
    rotations.push(angle)
  }

  return (
    <g className="fish">
      <g transform={`translate(${xPositions[0]}, ${yPositions[0]})`}>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={xPositions.map((x, i) => `${x}, ${yPositions[i]}`).join(';')}
          dur={`${speed}s`}
          begin={`${randomDelay}s`}
          repeatCount="indefinite"
          additive="replace"
        />

        <g transform={`rotate(${rotations[0]})`}>
          <animateTransform
            attributeName="transform"
            type="rotate"
            values={rotations.join(';')}
            dur={`${speed}s`}
            begin={`${randomDelay}s`}
            repeatCount="indefinite"
            additive="replace"
          />

          <g
            style={{
              transform: direction === 'counterclockwise' ? 'scaleX(-1)' : 'scaleX(1)',
              transformOrigin: 'center',
            }}
          >
            <g ref={fishRef}>
              <FishSvg
                width={fishSize}
                height={fishSize}
                x={-fishSize / 2}
                y={-fishSize / 2}
                style={{
                  overflow: 'visible',
                }}
              />
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}

export default Fish

