import { create } from 'zustand'
import type { Paper } from '../types/paper'
import type { FishDescriptor } from '../utils/fishMotion'

// Helper function to calculate Euclidean distance
function calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2
  const dy = y1 - y2
  return Math.sqrt(dx * dx + dy * dy)
}

export interface Cluster {
  x: number
  y: number
  count: number
  papers: Paper[]
}

interface CastState {
  // Grid data
  clusters: Cluster[]
  gridSize: number
  fishDescriptors: FishDescriptor[]
  hiddenFishIds: string[]

  // Cast position
  castPosition: { x: number; y: number } | null

  // Caught paper
  caughtPaper: Paper | null
  isCatchResultOpen: boolean
}

interface CastActions {
  // Update clusters data (called by Ripples component)
  setClusters: (
    clusters: Cluster[],
    gridSize: number
  ) => void
  setFishDescriptors: (fishDescriptors: FishDescriptor[]) => void
  hideFish: (fishId: string) => void

  // Update cast position
  setCastPosition: (position: { x: number; y: number } | null) => void

  // Update caught paper and modal state
  setCaughtPaper: (paper: Paper | null) => void
  setIsCatchResultOpen: (isOpen: boolean) => void

  // Find papers within radius of a position
  findPapersWithinRadius: (
    x: number,
    y: number,
    radius: number,
    xScale: (x: number) => number,
    yScale: (y: number) => number
  ) => Paper[]

  // Get a random paper from an array of papers
  getRandomPaper: (papers: Paper[]) => Paper | null

  // Get the closest paper to a position
  getClosestPaper: (
    papers: Paper[],
    x: number,
    y: number,
    xScale: (x: number) => number,
    yScale: (y: number) => number
  ) => Paper | null
}

type CastStore = CastState & CastActions

export const useCastStore = create<CastStore>((set, get) => ({
  // Initial state
  clusters: [],
  gridSize: 20,
  fishDescriptors: [],
  hiddenFishIds: [],
  castPosition: null,
  caughtPaper: null,
  isCatchResultOpen: false,

  setClusters: (clusters, gridSize) => {
    set({ clusters, gridSize })
  },

  setFishDescriptors: (fishDescriptors) => {
    set((state) => ({
      fishDescriptors,
      hiddenFishIds: state.hiddenFishIds.filter((fishId) =>
        fishDescriptors.some((fish) => fish.id === fishId)
      ),
    }))
  },

  hideFish: (fishId) => {
    set((state) => ({
      hiddenFishIds: state.hiddenFishIds.includes(fishId)
        ? state.hiddenFishIds
        : [...state.hiddenFishIds, fishId],
    }))
  },

  setCastPosition: (position) => {
    set({ castPosition: position })
  },

  setCaughtPaper: (paper) => {
    set({ caughtPaper: paper })
  },

  setIsCatchResultOpen: (isOpen) => {
    set({ isCatchResultOpen: isOpen })
  },

  findPapersWithinRadius: (x, y, radius, xScale, yScale) => {
    const { clusters } = get()
    const papersInRadius: Paper[] = []

    // Iterate through all clusters and their papers
    for (const cluster of clusters) {
      for (const paper of cluster.papers) {
        // Convert paper's data coordinates to SVG coordinates
        const paperSvgX = xScale(paper.x)
        const paperSvgY = yScale(paper.y)

        // Calculate distance from cast position to paper (both in SVG coordinates)
        const distance = calculateDistance(x, y, paperSvgX, paperSvgY)

        if (distance <= radius) {
          papersInRadius.push(paper)
        }
      }
    }

    return papersInRadius
  },

  getRandomPaper: (papers) => {
    if (!papers || papers.length === 0) {
      return null
    }

    const randomIndex = Math.floor(Math.random() * papers.length)
    return papers[randomIndex]
  },

  getClosestPaper: (papers, x, y, xScale, yScale) => {
    if (!papers || papers.length === 0) {
      return null
    }

    let closestPaper: Paper | null = null
    let minDistance = Infinity

    for (const paper of papers) {
      // Convert paper's data coordinates to SVG coordinates
      const paperSvgX = xScale(paper.x)
      const paperSvgY = yScale(paper.y)

      // Calculate distance from cast position to paper
      const distance = calculateDistance(x, y, paperSvgX, paperSvgY)

      if (distance < minDistance) {
        minDistance = distance
        closestPaper = paper
      }
    }

    return closestPaper
  },
}))
