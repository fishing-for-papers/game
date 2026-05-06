import { create } from 'zustand'
import type { GameState, CaughtPaper, PondAnnotation } from '../types/gameState'
import type { Paper } from '../types/paper'
import {
  saveGameState,
  loadGameState,
  createInitialGameState,
  createGameSession,
  renameGameSession,
  deleteGameSession,
  loadActiveGameState,
  listGameSessions,
  setActiveGameSessionId,
  type GameSessionSummary,
} from '../utils/gameStorage'

interface GameStateStore extends GameState {
  currentSessionId: string | null
  // Actions
  catchPaper: (paper: Paper, frameType?: string) => void
  removePaper: (paper: Paper) => void
  loadSavedGame: () => void
  resetGame: () => void
  updateCaughtPaper: (index: number, updates: Partial<CaughtPaper>) => void
  setKeywormKeywords: (keywords: string[]) => void
  addPondAnnotation: (annotation: Omit<PondAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => string
  updatePondAnnotation: (id: string, updates: Partial<Omit<PondAnnotation, 'id' | 'createdAt'>>) => void
  removePondAnnotation: (id: string) => void
  startNewSession: () => void
  resumeSession: (sessionId: string) => boolean
  getAvailableSessions: () => GameSessionSummary[]
  renameSession: (sessionId: string, newName: string) => boolean
  deleteSession: (sessionId: string) => boolean
}

export const useGameStateStore = create<GameStateStore>((set, get) => ({
  // Initialize with empty state
  ...createInitialGameState(),
  currentSessionId: null,

  catchPaper: (paper, frameType) => {
    const caughtPaper: CaughtPaper = {
      paper,
      caughtAt: Date.now(),
      frameType,
    }

    set((state) => {
      const newState: GameState = {
        caughtPapers: [...state.caughtPapers, caughtPaper],
        keywormKeywords: state.keywormKeywords,
        pondAnnotations: state.pondAnnotations,
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }
      
      return newState
    })
  },

  removePaper: (paper) => {
    set((state) => {
      const newState: GameState = {
        caughtPapers: state.caughtPapers.filter((caught) => {
          if (paper.doi && caught.paper.doi) {
            return caught.paper.doi !== paper.doi
          }
          return caught.paper.title !== paper.title
        }),
        keywormKeywords: state.keywormKeywords,
        pondAnnotations: state.pondAnnotations,
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }

      return newState
    })
  },

  loadSavedGame: () => {
    const activeSession = loadActiveGameState()
    if (activeSession) {
      set({
        ...activeSession.state,
        currentSessionId: activeSession.sessionId,
      })
    }
  },

  resetGame: () => {
    const initialState = createInitialGameState()
    const currentSessionId = get().currentSessionId

    set({
      ...initialState,
      currentSessionId,
    })

    if (currentSessionId) {
      saveGameState(initialState, currentSessionId)
    }
  },

  updateCaughtPaper: (index, updates) => {
    set((state) => {
      const updatedPapers = [...state.caughtPapers]
      if (index >= 0 && index < updatedPapers.length) {
        updatedPapers[index] = {
          ...updatedPapers[index],
          ...updates,
        }
      }

      const newState: GameState = {
        caughtPapers: updatedPapers,
        keywormKeywords: state.keywormKeywords,
        pondAnnotations: state.pondAnnotations,
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }

      return newState
    })
  },

  setKeywormKeywords: (keywords) => {
    set((state) => {
      const newState: GameState = {
        caughtPapers: state.caughtPapers,
        keywormKeywords: [...keywords],
        pondAnnotations: state.pondAnnotations,
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }

      return {
        keywormKeywords: [...keywords],
      }
    })
  },

  addPondAnnotation: (annotation) => {
    const now = Date.now()
    const id = `annotation-${now}-${Math.random().toString(36).slice(2, 8)}`

    set((state) => {
      const newAnnotation: PondAnnotation = {
        ...annotation,
        id,
        createdAt: now,
        updatedAt: now,
      }
      const newState: GameState = {
        caughtPapers: state.caughtPapers,
        keywormKeywords: state.keywormKeywords,
        pondAnnotations: [...state.pondAnnotations, newAnnotation],
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }

      return newState
    })

    return id
  },

  updatePondAnnotation: (id, updates) => {
    set((state) => {
      const nextAnnotations = state.pondAnnotations.map((annotation) =>
        annotation.id === id
          ? {
              ...annotation,
              ...updates,
              updatedAt: Date.now(),
            }
          : annotation
      )
      const newState: GameState = {
        caughtPapers: state.caughtPapers,
        keywormKeywords: state.keywormKeywords,
        pondAnnotations: nextAnnotations,
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }

      return newState
    })
  },

  removePondAnnotation: (id) => {
    set((state) => {
      const newState: GameState = {
        caughtPapers: state.caughtPapers,
        keywormKeywords: state.keywormKeywords,
        pondAnnotations: state.pondAnnotations.filter((annotation) => annotation.id !== id),
      }

      const currentSessionId = get().currentSessionId
      if (currentSessionId) {
        saveGameState(newState, currentSessionId)
      }

      return newState
    })
  },

  startNewSession: () => {
    const { sessionId, state } = createGameSession()

    set({
      ...state,
      currentSessionId: sessionId,
    })
  },

  resumeSession: (sessionId) => {
    const savedState = loadGameState(sessionId)
    if (!savedState) {
      return false
    }

    setActiveGameSessionId(sessionId)
    set({
      ...savedState,
      currentSessionId: sessionId,
    })

    return true
  },

  getAvailableSessions: () => {
    return listGameSessions()
  },

  renameSession: (sessionId, newName) => {
    return renameGameSession(sessionId, newName)
  },

  deleteSession: (sessionId) => {
    const wasCurrentSession = get().currentSessionId === sessionId
    const deleted = deleteGameSession(sessionId)
    if (!deleted) return false

    if (wasCurrentSession) {
      const activeSession = loadActiveGameState()
      if (activeSession) {
        set({
          ...activeSession.state,
          currentSessionId: activeSession.sessionId,
        })
      } else {
        set({
          ...createInitialGameState(),
          currentSessionId: null,
        })
      }
    }

    return true
  },
}))
