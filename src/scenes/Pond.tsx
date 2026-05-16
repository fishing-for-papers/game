import { useRef, useState, useEffect } from 'react'
import Modal from '../components/ui/Modal'
import BackButton from '../components/BackButton'
import Contours from '../components/Contours'
import Environment from '../components/Environment'
import Ripples from '../components/Ripples'
import FishSchools from '../components/FishSchools'
import Boat from '../components/Boat'
import Cast from '../components/Cast'
import KeywormControl from '../components/controls/KeywormControl'
import AnnotationControl from '../components/annotations/AnnotationControl'
import PondAnnotationsOverlay from '../components/annotations/PondAnnotationsOverlay'
import LoadingOverlay from '../components/LoadingOverlay'
import SearchDebugPanel from '../components/SearchDebugPanel'
import DebugButton from '../components/DebugButton'
import KeywormScene from './Keyworm'
import CatchResult from './CatchResult'
import { MARGIN } from '../config/layoutConstants'
import { useBoatKeyboardControl } from '../hooks/useBoatKeyboardControl'
import { useCoordinateSystem } from '../hooks/useCoordinateSystem'
import { usePondBoundary } from '../hooks/usePondBoundary'
import { useCoordinateStore } from '../stores/useCoordinateStore'
import { usePaperStore } from '../stores/usePaperStore'
import { useKeywormStore } from '../stores/useKeywormStore'
import { useCastStore } from '../stores/useCastStore'
import { useGameStateStore } from '../stores/useGameStateStore'

type PondSceneProps = {
  onNavigate: (target: 'start' | 'pond' | 'map' | 'gallery') => void
}

function PondScene({ onNavigate }: PondSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isKeywormModalOpen, setIsKeywormModalOpen] = useState(false)
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedAnnotationGlyph, setSelectedAnnotationGlyph] = useState<string | null>(null)
  const isGlyphPlacementMode = selectedAnnotationGlyph !== null

  const setDimensions = useCoordinateStore((state) => state.setDimensions)
  const { isReady, contentWidth, contentHeight } = useCoordinateSystem()
  const loadPapersAndBuildIndex = usePaperStore((state) => state.loadPapersAndBuildIndex)
  const isIndexReady = usePaperStore((state) => state.isIndexReady)
  const isLoading = usePaperStore((state) => state.isLoading)
  const selectedVenue = usePaperStore((state) => state.selectedVenue)
  const papers = usePaperStore((state) => state.papers)
  const keywormKeywords = useKeywormStore((state) => state.keywords)
  const addKeyword = useKeywormStore((state) => state.addKeyword)
  const isCatchResultOpen = useCastStore((state) => state.isCatchResultOpen)
  const setIsCatchResultOpen = useCastStore((state) => state.setIsCatchResultOpen)
  const caughtPaper = useCastStore((state) => state.caughtPaper)
  const pondAnnotations = useGameStateStore((state) => state.pondAnnotations)
  const addPondAnnotation = useGameStateStore((state) => state.addPondAnnotation)
  const updatePondAnnotation = useGameStateStore((state) => state.updatePondAnnotation)
  const removePondAnnotation = useGameStateStore((state) => state.removePondAnnotation)

  // Get pond boundary path from shared hook
  const pondBoundaryPath = usePondBoundary()
  const pondBoundaryPaths = pondBoundaryPath ? [pondBoundaryPath] : []

  // Enable keyboard control for boat (disabled when any modal or debug panel is open)
  useBoatKeyboardControl(
    !isKeywormModalOpen && !isDebugPanelOpen && !isCatchResultOpen && !isGlyphPlacementMode
  )

  // Monitor container size and update coordinate store
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setDimensions(width, height)
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [setDimensions])

  // Load papers and build index during loading
  useEffect(() => {
    setIsLoaded(false)  // Reset loading state when entering Pond or switching venue
    loadPapersAndBuildIndex()
  }, [loadPapersAndBuildIndex, selectedVenue])

  // Only set loaded when both dimensions are ready AND index is built AND not loading
  useEffect(() => {
    if (isReady && isIndexReady && !isLoading) {
      setIsLoaded(true)
    } else {
      setIsLoaded(false)  // Reset if any condition is not met
    }
  }, [isReady, isIndexReady, isLoading])

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <LoadingOverlay isLoading={!isLoaded}/>
      <div className={`w-full h-full transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute left-6 top-6 z-10 flex gap-3">
          <BackButton target="map" onNavigate={onNavigate} />
          <BackButton target="gallery" onNavigate={onNavigate}>
            Gallery
          </BackButton>
          <DebugButton />
        </div>
        <KeywormControl
          papers={papers}
          keywords={keywormKeywords}
          onOpenKeyworm={() => setIsKeywormModalOpen(true)}
          onAddKeyword={addKeyword}
        />
        <svg className="w-full h-full">
        <defs>
          <filter id="hand-drawn" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.02"
              numOctaves="3"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="2"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
        {isReady && (
          <>
            <Environment />
            <Contours />
            <Ripples />
            <FishSchools />
            <g transform={`translate(${MARGIN}, ${MARGIN})`}>
              <Boat />
              <Cast 
                enabled={!isKeywormModalOpen && !isDebugPanelOpen && !isCatchResultOpen && !isGlyphPlacementMode}
              />
            </g>
          </>
        )}
      </svg>
        {isReady && (
          <PondAnnotationsOverlay
            annotations={pondAnnotations}
            contentWidth={contentWidth}
            contentHeight={contentHeight}
            isMarkMode={isGlyphPlacementMode}
            selectedGlyph={selectedAnnotationGlyph}
            note=""
            boundaryPaths={pondBoundaryPaths}
            onAddAnnotation={addPondAnnotation}
            onUpdateAnnotation={updatePondAnnotation}
            onRemoveAnnotation={removePondAnnotation}
            onFinishEditing={() => setSelectedAnnotationGlyph(null)}
          />
        )}
        <AnnotationControl
          selectedGlyph={selectedAnnotationGlyph}
          onSelectGlyph={setSelectedAnnotationGlyph}
        />
      </div>

      {/* Keyworm Modal */}
      <Modal isOpen={isKeywormModalOpen} onClose={() => setIsKeywormModalOpen(false)}>
        <KeywormScene />
      </Modal>

      {/* Catch Result */}
      {isCatchResultOpen && (
        <CatchResult
          paper={caughtPaper}
          onClose={() => setIsCatchResultOpen(false)}
        />
      )}

      {/* Search Debug Panel */}
      <SearchDebugPanel
        isOpen={isDebugPanelOpen}
        onClose={() => setIsDebugPanelOpen(false)}
      />
    </div>
  )
}

export default PondScene
