import { useEffect, useRef, useState } from 'react'
import './App.css'
import PondScene from './scenes/Pond'
import StartScene from './scenes/Start'
import MapScene from './scenes/Map'
import GalleryScene from './scenes/Gallery'
import backgroundMusic from './assets/sounds/background-music.mp3'
import IconButton from './components/ui/IconButton'
import { useGameStateStore } from './stores/useGameStateStore'
import { useKeywormStore } from './stores/useKeywormStore'
import type { GameSessionSummary } from './utils/gameStorage'

type SceneId = 'start' | 'pond' | 'map' | 'gallery'

function App() {
  const [scene, setScene] = useState<SceneId>('start')
  const [isMuted, setIsMuted] = useState(false)
  const [sessions, setSessions] = useState<GameSessionSummary[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const startNewSession = useGameStateStore((state) => state.startNewSession)
  const resumeSession = useGameStateStore((state) => state.resumeSession)
  const getAvailableSessions = useGameStateStore((state) => state.getAvailableSessions)
  const renameSession = useGameStateStore((state) => state.renameSession)
  const deleteSession = useGameStateStore((state) => state.deleteSession)
  const loadSavedGame = useGameStateStore((state) => state.loadSavedGame)
  const gameKeywormKeywords = useGameStateStore((state) => state.keywormKeywords)
  const setGameKeywormKeywords = useGameStateStore((state) => state.setKeywormKeywords)
  const keywormKeywords = useKeywormStore((state) => state.keywords)
  const setKeywormKeywords = useKeywormStore((state) => state.setKeywords)

  const keywordsEqual = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) return false

    return left.every((keyword, index) => keyword === right[index])
  }

  const refreshSessions = () => {
    setSessions(getAvailableSessions())
  }

  useEffect(() => {
    const audio = new Audio(backgroundMusic)
    audio.loop = true
    audio.volume = 0.35
    audio.muted = isMuted
    audioRef.current = audio

    const tryPlay = () => {
      if (!audioRef.current || audioRef.current.muted) return
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked until first user interaction.
      })
    }

    tryPlay()

    const handleFirstInteraction = () => {
      tryPlay()
    }

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true })
    window.addEventListener('keydown', handleFirstInteraction, { once: true })

    return () => {
      window.removeEventListener('pointerdown', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
      audio.pause()
      audio.currentTime = 0
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!audioRef.current) return

    audioRef.current.muted = isMuted

    if (!isMuted) {
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked until first user interaction.
      })
    }
  }, [isMuted])

  useEffect(() => {
    if (scene !== 'start') return

    loadSavedGame()
    const restoredKeywords = useGameStateStore.getState().keywormKeywords
    setKeywormKeywords(restoredKeywords)
    refreshSessions()
  }, [scene, loadSavedGame, getAvailableSessions, setKeywormKeywords])

  useEffect(() => {
    if (keywordsEqual(keywormKeywords, gameKeywormKeywords)) return
    setGameKeywormKeywords(keywormKeywords)
  }, [keywormKeywords, gameKeywormKeywords, setGameKeywormKeywords])

  const handleStartNewGame = () => {
    startNewSession()
    setKeywormKeywords([])
    setScene('map')
  }

  const handleResumeGame = (sessionId: string) => {
    const resumed = resumeSession(sessionId)
    if (resumed) {
      const restoredKeywords = useGameStateStore.getState().keywormKeywords
      setKeywormKeywords(restoredKeywords)
      setScene('map')
    }
  }

  const handleRenameGame = (sessionId: string, newName: string) => {
    const renamed = renameSession(sessionId, newName)
    if (renamed) {
      refreshSessions()
    }
  }

  const handleDeleteGame = (sessionId: string) => {
    const deleted = deleteSession(sessionId)
    if (deleted) {
      const restoredKeywords = useGameStateStore.getState().keywormKeywords
      setKeywormKeywords(restoredKeywords)
      refreshSessions()
    }
  }

  return (
    <div className="w-full h-full">
      {scene === 'start' ? (
        <StartScene
          onStartNewGame={handleStartNewGame}
          onResumeGame={handleResumeGame}
          onRenameGame={handleRenameGame}
          onDeleteGame={handleDeleteGame}
          sessions={sessions}
        />
      ) : scene === 'pond' ? (
        <PondScene onNavigate={setScene} />
      ) : scene === 'map' ? (
        <MapScene onNavigate={setScene} />
      ) : (
        <GalleryScene onNavigate={setScene} />
      )}

      <div className="fixed left-6 bottom-6 z-50">
        <IconButton
          onClick={() => setIsMuted((prev) => !prev)}
          aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
          title={isMuted ? 'Unmute music' : 'Mute music'}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          )}
        </IconButton>
      </div>
    </div>
  )
}

export default App
