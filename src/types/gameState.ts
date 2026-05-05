import type { Paper } from './paper'

export interface CaughtPaper {
  paper: Paper
  caughtAt: number // timestamp
  frameType?: string // which frame it's displayed in
  imageVersion?: number // timestamp for image cache busting when regenerated
}

export interface GameState {
  caughtPapers: CaughtPaper[]
  keywormKeywords: string[]
  // Add more game state properties here as needed:
  // currentScene?: string
  // playerProgress?: number
  // unlockedAreas?: string[]
  // etc.
}

export const GAME_STATE_KEY = 'fishing-game-state'
