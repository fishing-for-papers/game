import type { GameState } from '../types/gameState'
import { GAME_STATE_KEY } from '../types/gameState'

const GAME_SESSIONS_KEY = 'fishing-game-sessions'
const GAME_ACTIVE_SESSION_KEY = 'fishing-game-active-session'

export interface GameSessionSummary {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  paperCount: number
}

interface StoredGameSession extends GameSessionSummary {
  state: GameState
}

const normalizeGameState = (state: Partial<GameState> | null | undefined): GameState => ({
  caughtPapers: Array.isArray(state?.caughtPapers) ? state.caughtPapers : [],
  keywormKeywords: Array.isArray(state?.keywormKeywords) ? state.keywormKeywords : [],
  pondAnnotations: Array.isArray(state?.pondAnnotations) ? state.pondAnnotations : [],
})

const parseStoredSessions = (): StoredGameSession[] => {
  try {
    const serialized = localStorage.getItem(GAME_SESSIONS_KEY)
    if (!serialized) return []

    const parsed = JSON.parse(serialized) as StoredGameSession[]
    if (!Array.isArray(parsed)) return []

    return parsed
  } catch (error) {
    console.error('Failed to parse game sessions:', error)
    return []
  }
}

const saveStoredSessions = (sessions: StoredGameSession[]): void => {
  try {
    localStorage.setItem(GAME_SESSIONS_KEY, JSON.stringify(sessions))
  } catch (error) {
    console.error('Failed to save game sessions:', error)
  }
}

const createSessionSummary = (session: StoredGameSession): GameSessionSummary => ({
  id: session.id,
  name: session.name,
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  paperCount: session.state.caughtPapers.length,
})

const createSessionName = (existingCount: number): string => `Game ${existingCount + 1}`

const createSessionId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `session-${Date.now()}-${randomPart}`
}

const migrateLegacySaveIfNeeded = (): void => {
  const sessions = parseStoredSessions()
  if (sessions.length > 0) return

  try {
    const serialized = localStorage.getItem(GAME_STATE_KEY)
    if (!serialized) return

    const legacyState = normalizeGameState(JSON.parse(serialized) as Partial<GameState>)
    const now = Date.now()
    const migratedSession: StoredGameSession = {
      id: createSessionId(),
      name: 'Migrated Save',
      createdAt: now,
      updatedAt: now,
      paperCount: legacyState.caughtPapers.length,
      state: legacyState,
    }

    saveStoredSessions([migratedSession])
    setActiveGameSessionId(migratedSession.id)
    localStorage.removeItem(GAME_STATE_KEY)
  } catch (error) {
    console.error('Failed to migrate legacy game save:', error)
  }
}

/**
 * Save game state to localStorage
 */
export const saveGameState = (state: GameState, sessionId: string): void => {
  migrateLegacySaveIfNeeded()

  const sessions = parseStoredSessions()
  const now = Date.now()
  const targetIndex = sessions.findIndex((session) => session.id === sessionId)
  const normalizedState = normalizeGameState(state)

  if (targetIndex === -1) {
    const newSession: StoredGameSession = {
      id: sessionId,
      name: createSessionName(sessions.length),
      createdAt: now,
      updatedAt: now,
      paperCount: normalizedState.caughtPapers.length,
      state: normalizedState,
    }

    saveStoredSessions([...sessions, newSession])
    setActiveGameSessionId(sessionId)
    return
  }

  const updatedSessions = [...sessions]
  updatedSessions[targetIndex] = {
    ...updatedSessions[targetIndex],
    updatedAt: now,
    paperCount: normalizedState.caughtPapers.length,
    state: normalizedState,
  }

  saveStoredSessions(updatedSessions)
  setActiveGameSessionId(sessionId)
}

/**
 * Load game state from localStorage
 */
export const loadGameState = (sessionId: string): GameState | null => {
  migrateLegacySaveIfNeeded()

  const sessions = parseStoredSessions()
  const session = sessions.find((item) => item.id === sessionId)
  if (!session) return null

  return normalizeGameState(session.state)
}

/**
 * Clear all game state from localStorage
 */
export const clearGameState = (): void => {
  try {
    localStorage.removeItem(GAME_SESSIONS_KEY)
    localStorage.removeItem(GAME_ACTIVE_SESSION_KEY)
    localStorage.removeItem(GAME_STATE_KEY)
  } catch (error) {
    console.error('Failed to clear game state:', error)
  }
}

export const listGameSessions = (): GameSessionSummary[] => {
  migrateLegacySaveIfNeeded()

  return parseStoredSessions()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((session) => createSessionSummary(session))
}

export const createGameSession = (name?: string): { sessionId: string; state: GameState } => {
  migrateLegacySaveIfNeeded()

  const sessions = parseStoredSessions()
  const sessionId = createSessionId()
  const now = Date.now()
  const state = createInitialGameState()
  const newSession: StoredGameSession = {
    id: sessionId,
    name: name?.trim() || createSessionName(sessions.length),
    createdAt: now,
    updatedAt: now,
    paperCount: 0,
    state,
  }

  saveStoredSessions([...sessions, newSession])
  setActiveGameSessionId(sessionId)

  return { sessionId, state }
}

export const renameGameSession = (sessionId: string, newName: string): boolean => {
  migrateLegacySaveIfNeeded()

  const trimmedName = newName.trim()
  if (!trimmedName) return false

  const sessions = parseStoredSessions()
  const targetIndex = sessions.findIndex((session) => session.id === sessionId)
  if (targetIndex === -1) return false

  const updatedSessions = [...sessions]
  updatedSessions[targetIndex] = {
    ...updatedSessions[targetIndex],
    name: trimmedName,
    updatedAt: Date.now(),
  }

  saveStoredSessions(updatedSessions)
  return true
}

export const deleteGameSession = (sessionId: string): boolean => {
  migrateLegacySaveIfNeeded()

  const sessions = parseStoredSessions()
  const targetIndex = sessions.findIndex((session) => session.id === sessionId)
  if (targetIndex === -1) return false

  const updatedSessions = sessions.filter((session) => session.id !== sessionId)
  saveStoredSessions(updatedSessions)

  const activeSessionId = getActiveGameSessionId()
  if (activeSessionId === sessionId) {
    if (updatedSessions.length === 0) {
      try {
        localStorage.removeItem(GAME_ACTIVE_SESSION_KEY)
      } catch (error) {
        console.error('Failed to clear active game session id:', error)
      }
      return true
    }

    const nextActiveSession = [...updatedSessions].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    setActiveGameSessionId(nextActiveSession.id)
  }

  return true
}

export const getActiveGameSessionId = (): string | null => {
  migrateLegacySaveIfNeeded()

  try {
    return localStorage.getItem(GAME_ACTIVE_SESSION_KEY)
  } catch (error) {
    console.error('Failed to read active game session id:', error)
    return null
  }
}

export const setActiveGameSessionId = (sessionId: string): void => {
  try {
    localStorage.setItem(GAME_ACTIVE_SESSION_KEY, sessionId)
  } catch (error) {
    console.error('Failed to set active game session id:', error)
  }
}

export const loadActiveGameState = (): { sessionId: string; state: GameState } | null => {
  migrateLegacySaveIfNeeded()

  const activeSessionId = getActiveGameSessionId()
  if (activeSessionId) {
    const state = loadGameState(activeSessionId)
    if (state) {
      return { sessionId: activeSessionId, state }
    }
  }

  const sessions = listGameSessions()
  if (sessions.length === 0) return null

  const latestSessionId = sessions[0].id
  const latestState = loadGameState(latestSessionId)
  if (!latestState) return null

  setActiveGameSessionId(latestSessionId)

  return {
    sessionId: latestSessionId,
    state: latestState,
  }
}

/**
 * Initialize a new game state
 */
export const createInitialGameState = (): GameState => ({
  caughtPapers: [],
  keywormKeywords: [],
  pondAnnotations: [],
})
