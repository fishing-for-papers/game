interface RippleProps {
  cx: number
  cy: number
  baseRadius?: number
  ringCount?: number
  ringSpacing?: number
  color?: string
  opacity?: number
  duration?: number
  pauseDuration?: number
  randomDelay?: number
}

function Ripple({
  cx,
  cy,
  baseRadius = 20,
  ringCount = 3,
  ringSpacing = 15,
  color = '#ffffff',
  opacity = 0.8,
  duration = 2,
  pauseDuration = 0,
  randomDelay = 0,
}: RippleProps) {
  const rings = []
  const maxRadius = baseRadius + (ringCount - 1) * ringSpacing
  const totalDuration = duration + pauseDuration // Total cycle time including pause

  for (let i = 0; i < ringCount; i++) {
    const ringDelay = (i / ringCount) * duration
    const startDelay = randomDelay + ringDelay

    // Calculate the percentage of time spent animating vs pausing
    const animationPercent = (duration / totalDuration) * 100

    rings.push(
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={baseRadius}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0}
      >
        <animate
          attributeName="r"
          values={`${baseRadius};${maxRadius};${maxRadius}`}
          keyTimes={`0;${animationPercent / 100};1`}
          dur={`${totalDuration}s`}
          begin={`${startDelay}s`}
          repeatCount="indefinite"
        />
        <animate
          attributeName="stroke-opacity"
          values={`0;${opacity};0;0`}
          keyTimes={`0;${animationPercent / 200};${animationPercent / 100};1`}
          dur={`${totalDuration}s`}
          begin={`${startDelay}s`}
          repeatCount="indefinite"
        />
      </circle>
    )
  }

  return <g className="ripple">{rings}</g>
}

export default Ripple
