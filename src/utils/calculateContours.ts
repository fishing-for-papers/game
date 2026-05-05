import * as d3 from 'd3'
import type { Paper } from '../types/paper'
import { createCoordinateScales } from './coordinateScales'

export interface ContourPath {
  path: string
  value: number
  opacity: number
}

export interface ClusterContours {
  clusterId: number
  contours: ContourPath[]
}

interface ContourConfig {
  bandwidth: number
  thresholds: number
  minOpacity: number
  maxOpacity: number
}

export function calculateContours(
  papers: Paper[],
  width: number,
  height: number,
  config: ContourConfig
): ClusterContours[] {
  if (papers.length === 0 || width <= 0 || height <= 0) {
    return []
  }

  // Create scales based on data extent using shared utility
  const { xScale, yScale } = createCoordinateScales(papers, width, height)

  // Group papers by cluster
  const clusterGroups = d3.group(papers, (d) => d.cluster)

  // Remove noise cluster (-1) if exists
  clusterGroups.delete(-1)

  const pathGenerator = d3.geoPath()

  // First pass: calculate all contours and find global max density
  const clusterContoursRaw: Array<{
    clusterId: number
    contours: d3.ContourMultiPolygon[]
  }> = []

  let globalMaxDensity = 0

  const clusterIds = Array.from(clusterGroups.keys()).sort((a, b) => a - b)

  for (const clusterId of clusterIds) {
    const clusterData = clusterGroups.get(clusterId)!

    if (clusterData.length < 3) {
      continue
    }

    const contours = d3
      .contourDensity<Paper>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.y))
      .size([width, height])
      .bandwidth(config.bandwidth)
      .thresholds(config.thresholds)(clusterData)

    clusterContoursRaw.push({ clusterId, contours })

    const maxValue = d3.max(contours, (d) => d.value) || 0
    if (maxValue > globalMaxDensity) {
      globalMaxDensity = maxValue
    }
  }

  // Second pass: normalize opacity using global max
  const result: ClusterContours[] = []

  for (const { clusterId, contours } of clusterContoursRaw) {
    const contourPaths: ContourPath[] = contours.map((contour) => {
      const normalizedValue =
        globalMaxDensity > 0 ? contour.value / globalMaxDensity : 0
      const opacity =
        config.minOpacity +
        normalizedValue * (config.maxOpacity - config.minOpacity)

      return {
        path: pathGenerator(contour) || '',
        value: contour.value,
        opacity,
      }
    })

    result.push({ clusterId, contours: contourPaths })
  }

  return result
}
