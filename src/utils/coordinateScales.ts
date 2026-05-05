import * as d3 from 'd3'
import type { Paper } from '../types/paper'

export interface CoordinateScales {
  xScale: d3.ScaleLinear<number, number>
  yScale: d3.ScaleLinear<number, number>
}

/**
 * Creates coordinate scales based on paper data extent
 * This ensures consistent coordinate mapping across all visualization layers
 */
export function createCoordinateScales(
  papers: Paper[],
  width: number,
  height: number,
  padding = 0.05
): CoordinateScales {
  if (papers.length === 0 || width <= 0 || height <= 0) {
    // Return identity scales if no data
    return {
      xScale: d3.scaleLinear().domain([0, 1]).range([0, width]),
      yScale: d3.scaleLinear().domain([0, 1]).range([height, 0]),
    }
  }

  const xExtent = d3.extent(papers, (d) => d.x) as [number, number]
  const yExtent = d3.extent(papers, (d) => d.y) as [number, number]

  const xRange = xExtent[1] - xExtent[0]
  const yRange = yExtent[1] - yExtent[0]

  const xScale = d3
    .scaleLinear()
    .domain([xExtent[0] - xRange * padding, xExtent[1] + xRange * padding])
    .range([0, width])

  const yScale = d3
    .scaleLinear()
    .domain([yExtent[0] - yRange * padding, yExtent[1] + yRange * padding])
    .range([height, 0]) // Flip Y for SVG coordinate system

  return { xScale, yScale }
}
