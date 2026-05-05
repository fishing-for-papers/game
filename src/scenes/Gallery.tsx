import { useState, useEffect } from 'react'
import galleryBackground from '../assets/scenes/gallery-background.svg'
import BackButton from '../components/BackButton'
import LoadingOverlay from '../components/LoadingOverlay'
import PictureFrame from '../components/PictureFrame'
import CatchResult from './CatchResult'
import type { Paper } from '../types/paper'
import { useGameStateStore } from '../stores/useGameStateStore'
import { exportCaughtPapersAsBibTeX } from '../utils/bibtex'
import { getImageUrl } from '../utils/imageUrl'
import image1 from '../assets/images/image1.png'
import frame01Svg from '../assets/frames/frame-01.svg'
import frame02Svg from '../assets/frames/frame-02.svg'
import frame03Svg from '../assets/frames/frame-03.svg'
import frame04Svg from '../assets/frames/frame-04.svg'
import frame05Svg from '../assets/frames/frame-05.svg'
import frame06Svg from '../assets/frames/frame-06.svg'

type GallerySceneProps = {
  onNavigate: (target: 'start' | 'pond' | 'map' | 'gallery') => void
}

function GalleryScene({ onNavigate }: GallerySceneProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null)
  const [isCatchResultOpen, setIsCatchResultOpen] = useState(false)
  const savedPapers = useGameStateStore((state) => state.caughtPapers)
  const loadSavedGame = useGameStateStore((state) => state.loadSavedGame)

  const frameSvgs = [
    frame01Svg,
    frame02Svg,
    frame03Svg,
    frame04Svg,
    frame05Svg,
    frame06Svg,
  ]

  useEffect(() => {
    if (savedPapers.length === 0) {
      loadSavedGame()
    }
  }, [savedPapers.length, loadSavedGame])

  const handleExportBibTeX = () => {
    exportCaughtPapersAsBibTeX(savedPapers)
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      <img
        src={galleryBackground}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setIsLoaded(true)}
      />
      <LoadingOverlay isLoading={!isLoaded} />
      <div className={`w-full h-full relative transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute left-6 top-6 z-10 flex items-center gap-3">
          <BackButton target="map" onNavigate={onNavigate} />
        </div>
        <div className="absolute right-6 top-6 z-10 flex items-center gap-3">
          <BackButton onClick={handleExportBibTeX} disabled={savedPapers.length === 0}>
            Export BibTeX
          </BackButton>
        </div>
        <div className="gallery-frames-container flex flex-wrap content-start justify-center w-full h-full p-16 overflow-y-auto gap-8">
          {savedPapers.map((savedPaper, index) => {
            const doi = savedPaper.paper.doi
            let fishImage = doi ? getImageUrl(doi) : image1

            // Add version parameter for cache busting if image was regenerated
            if (savedPaper.imageVersion && doi) {
              fishImage = `${fishImage}?v=${savedPaper.imageVersion}`
            }

            return (
              <PictureFrame
                key={`saved-paper-${savedPaper.caughtAt}-${index}`}
                image={fishImage}
                fallbackImage={image1}
                frameSvg={frameSvgs[index % frameSvgs.length]}
                label={savedPaper.paper.title}
                score={savedPaper.paper.score}
                onClick={() => {
                  setSelectedPaper(savedPaper.paper)
                  setIsCatchResultOpen(true)
                }}
              />
            )
          })}
        </div>
      </div>

      {isCatchResultOpen && (
        <CatchResult
          paper={selectedPaper}
          onClose={() => setIsCatchResultOpen(false)}
          closeButtonText="Close"
        />
      )}
    </div>
  )
}

export default GalleryScene
