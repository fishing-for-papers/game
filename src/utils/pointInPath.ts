/**
 * Check if a point is inside any of the SVG paths using ray casting algorithm
 * @param x - X coordinate of the point
 * @param y - Y coordinate of the point
 * @param paths - Array of SVG path strings
 * @returns true if the point is inside any of the paths
 */
export function isPointInPaths(x: number, y: number, paths: string[]): boolean {
  if (paths.length === 0) return false

  // Create a temporary SVG element for path testing
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.position = 'absolute'
  svg.style.visibility = 'hidden'
  svg.style.pointerEvents = 'none'
  document.body.appendChild(svg)

  try {
    // Test each path
    for (const pathString of paths) {
      if (!pathString) continue

      const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      pathElement.setAttribute('d', pathString)
      svg.appendChild(pathElement)

      // Create a point in SVG coordinate space
      const point = svg.createSVGPoint()
      point.x = x
      point.y = y

      // Check if point is in fill (using even-odd rule)
      if (pathElement.isPointInFill(point)) {
        document.body.removeChild(svg)
        return true
      }

      svg.removeChild(pathElement)
    }

    document.body.removeChild(svg)
    return false
  } catch (error) {
    // Clean up on error
    if (document.body.contains(svg)) {
      document.body.removeChild(svg)
    }
    console.error('Error checking point in path:', error)
    return false
  }
}
