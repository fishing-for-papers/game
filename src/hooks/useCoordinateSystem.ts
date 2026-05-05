import { useMemo } from 'react'
import { useCoordinateStore } from '../stores/useCoordinateStore'
import { usePaperStore } from '../stores/usePaperStore'
import { createCoordinateScales } from '../utils/coordinateScales'
import { MARGIN } from '../config/layoutConstants'

/**
 * Centralized coordinate system hook
 * Provides viewport dimensions, content dimensions, and coordinate scales
 * All visualization components should use this hook for consistent coordinate mapping
 */
export function useCoordinateSystem() {
  const width = useCoordinateStore((state) => state.width)
  const height = useCoordinateStore((state) => state.height)
  const papers = usePaperStore((state) => state.papers)

  // Calculate content dimensions (viewport minus margins)
  const contentWidth = width - MARGIN * 2
  const contentHeight = height - MARGIN * 2

  // Create coordinate scales based on paper data extent
  const { xScale, yScale } = useMemo(() => {
    return createCoordinateScales(papers, contentWidth, contentHeight)
  }, [papers, contentWidth, contentHeight])

  return {
    // Viewport dimensions (full container size)
    width,
    height,
    
    // Content dimensions (minus margins)
    contentWidth,
    contentHeight,
    
    // Coordinate scales for data-to-SVG mapping
    xScale,
    yScale,
    
    // Ready flag for conditional rendering
    isReady: contentWidth > 0 && contentHeight > 0,
  }
}
