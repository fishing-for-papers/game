import { useEffect, useState } from 'react'
import frame01Svg from '../assets/frames/frame-01.svg'
import ScoreIcons from './ScoreIcons'

type PictureFrameProps = {
  width?: number
  height?: number
  image?: string
  fallbackImage?: string
  frameSvg?: string
  label?: string
  onClick?: () => void
  imageScale?: number
  score?: number
  glowScale?: number
}

function PictureFrame({ width = 400, height = 250, image, fallbackImage, frameSvg = frame01Svg, label, onClick, imageScale = 0.75, score, glowScale = 0.75 }: PictureFrameProps) {
  const [clipPathContent, setClipPathContent] = useState<string | null>(null)
  const [viewBox, setViewBox] = useState<{ minX: number; minY: number; width: number; height: number } | null>(null)
  const [imageError, setImageError] = useState(false)
  const [currentImage, setCurrentImage] = useState(image)

  // Reset image state when image prop changes
  useEffect(() => {
    setImageError(false)
    setCurrentImage(image)
  }, [image])

  useEffect(() => {
    const loadClipPath = async () => {
      try {
        const response = await fetch(frameSvg)
        const svgText = await response.text()
        const parser = new DOMParser()
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')

        // Find the clipPath element
        const clipPathElement = svgDoc.querySelector('clipPath')

        if (clipPathElement) {
          const serializer = new XMLSerializer()
          const content = Array.from(clipPathElement.childNodes)
            .map((node) => serializer.serializeToString(node))
            .join('')
            .trim()
          setClipPathContent(content.length > 0 ? content : null)
        } else {
          setClipPathContent(null)
        }

        // Get viewBox for scaling
        const svgElement = svgDoc.querySelector('svg')
        if (svgElement) {
          const viewBoxAttr = svgElement.getAttribute('viewBox')
          if (viewBoxAttr) {
            const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number)
            if (parts.length === 4) {
              const [minX, minY, width, height] = parts
              setViewBox({ minX, minY, width, height })
            }
          }
        }
      } catch (error) {
        console.error('Failed to load clip path from SVG:', error)
      }
    }

    loadClipPath()
  }, [frameSvg])

  const handleImageError = () => {
    if (!imageError && fallbackImage && currentImage !== fallbackImage) {
      setImageError(true)
      setCurrentImage(fallbackImage)
    }
  }


  return (
    <div className="flex-shrink-0 flex flex-col items-center">
      <div
        className={`group relative${onClick ? ' cursor-pointer' : ''}`}
        onClick={onClick}
        style={{
          width: `${width}px`,
          height: `${height}px`,
        }}
        aria-label={label}
      >
      {label && (
        <div
          className="pointer-events-none absolute inset-x-4 bottom-6 z-10 rounded-lg bg-slate-950/90 px-4 py-3 text-center text-sm font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {label}
        </div>
      )}
      {currentImage && viewBox && (
        <svg
          className="absolute inset-0"
          viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            {clipPathContent && (
              <clipPath
                id={`frame-clip-${frameSvg.replace(/[^a-zA-Z0-9]/g, '-')}`}
                clipPathUnits="userSpaceOnUse"
                dangerouslySetInnerHTML={{ __html: clipPathContent }}
              />
            )}
            {/* White glow filter for fish image */}
            <filter id={`white-glow-${frameSvg.replace(/[^a-zA-Z0-9]/g, '-')}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
              <feFlood floodColor="white" floodOpacity="0.4" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Dark background */}
          <rect
            x={viewBox.minX}
            y={viewBox.minY}
            width={viewBox.width}
            height={viewBox.height}
            fill="#0a1520"
            clipPath={
              clipPathContent
                ? `url(#frame-clip-${frameSvg.replace(/[^a-zA-Z0-9]/g, '-')})`
                : undefined
            }
          />
          {/* Subtle concentric circles - only 3 layers, very transparent */}
          <g
            clipPath={
              clipPathContent
                ? `url(#frame-clip-${frameSvg.replace(/[^a-zA-Z0-9]/g, '-')})`
                : undefined
            }
          >
            <circle
              cx={viewBox.minX + viewBox.width / 2}
              cy={viewBox.minY + viewBox.height / 2}
              r={Math.min(viewBox.width, viewBox.height) * 0.42 * glowScale}
              fill="#018DCA"
              opacity="0.25"
            />
            <circle
              cx={viewBox.minX + viewBox.width / 2}
              cy={viewBox.minY + viewBox.height / 2}
              r={Math.min(viewBox.width, viewBox.height) * 0.28 * glowScale}
              fill="#02D7FF"
              opacity="0.3"
            />
            <circle
              cx={viewBox.minX + viewBox.width / 2}
              cy={viewBox.minY + viewBox.height / 2}
              r={Math.min(viewBox.width, viewBox.height) * 0.14 * glowScale}
              fill="#01FFFF"
              opacity="0.35"
            />
          </g>
          <image
            href={currentImage}
            x={viewBox.minX + viewBox.width * (1 - imageScale) / 2}
            y={viewBox.minY + viewBox.height * (1 - imageScale) / 2}
            width={viewBox.width * imageScale}
            height={viewBox.height * imageScale}
            preserveAspectRatio="xMidYMid meet"
            clipPath={
              clipPathContent
                ? `url(#frame-clip-${frameSvg.replace(/[^a-zA-Z0-9]/g, '-')})`
                : undefined
            }
            filter={`url(#white-glow-${frameSvg.replace(/[^a-zA-Z0-9]/g, '-')})`}
            onError={handleImageError}
          />
        </svg>
      )}
      <img
        src={frameSvg}
        alt="Picture frame"
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
      />
      </div>
      {score && (
        <div className="mt-2">
          <ScoreIcons score={score} size={36} gap={2} />
        </div>
      )}
    </div>
  )
}

export default PictureFrame
