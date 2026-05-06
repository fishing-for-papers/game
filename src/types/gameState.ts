import type { Paper } from './paper'

export interface CaughtPaper {
  paper: Paper
  caughtAt: number // timestamp
  frameType?: string // which frame it's displayed in
  imageVersion?: number // timestamp for image cache busting when regenerated
}

export interface PondAnnotation {
  id: string
  x: number
  y: number
  glyph: string
  note: string
  createdAt: number
  updatedAt: number
}

export interface GameState {
  caughtPapers: CaughtPaper[]
  keywormKeywords: string[]
  pondAnnotations: PondAnnotation[]
  // Add more game state properties here as needed:
  // currentScene?: string
  // playerProgress?: number
  // unlockedAreas?: string[]
  // etc.
}

export const GAME_STATE_KEY = 'fishing-game-state'
