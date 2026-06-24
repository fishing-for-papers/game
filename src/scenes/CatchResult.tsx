import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import type { Paper } from '../types/paper'
import { useCastStore } from '../stores/useCastStore'
import { useGameStateStore } from '../stores/useGameStateStore'
import { useKeywormStore } from '../stores/useKeywormStore'
import { getImageUrl } from '../utils/imageUrl'
import { HighlightedText } from '../utils/highlightKeywords'
import { Keyworm } from '../components/Keyworm'
import ScoreIcons from '../components/ScoreIcons'

type CatchResultProps = {
  paper?: Paper | null
  onClose?: () => void
  closeButtonText?: string
}

function CatchResult({ paper, onClose, closeButtonText = 'Close' }: CatchResultProps) {
  const caughtPaper = paper ?? useCastStore((state) => state.caughtPaper)
  const catchPaper = useGameStateStore((state) => state.catchPaper)
  const removePaper = useGameStateStore((state) => state.removePaper)
  const savedPapers = useGameStateStore((state) => state.caughtPapers)
  const updateCaughtPaper = useGameStateStore((state) => state.updateCaughtPaper)
  const setKeywormKeywords = useKeywormStore((state) => state.setKeywords)

  // Fish image generation state
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isHoveringImage, setIsHoveringImage] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Keyword highlighting toggle state
  const [showKeywords, setShowKeywords] = useState(false)

  const isSaved = !!caughtPaper && savedPapers.some((saved) => {
    if (caughtPaper.doi && saved.paper.doi) {
      return saved.paper.doi === caughtPaper.doi
    }
    return saved.paper.title === caughtPaper.title
  })

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true)
    // Wait for animation to complete before calling onClose
    setTimeout(() => {
      onClose?.()
    }, 300) // Match animation duration
  }

  // Handle fish image generation
  const handleGenerateImage = async () => {
    if (!caughtPaper || isGenerating) return

    setIsGenerating(true)
    setImageError(false)

    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787'
      const response = await fetch(`${workerUrl}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doi: caughtPaper.doi,
          title: caughtPaper.title,
          abstract: caughtPaper.abstract || ''
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate image')
      }

      const data = await response.json()
      setGeneratedImageUrl(data.imageUrl)
    } catch (error) {
      console.error('Error generating fish image:', error)
      setImageError(true)
    } finally {
      setIsGenerating(false)
    }
  }

  // Handle fish image regeneration
  const handleRegenerateImage = async () => {
    if (!caughtPaper || isGenerating) return

    setIsGenerating(true)
    setImageError(false)

    try {
      const workerUrl = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787'
      const response = await fetch(`${workerUrl}/regenerate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doi: caughtPaper.doi,
          title: caughtPaper.title,
          abstract: caughtPaper.abstract || ''
        })
      })

      if (!response.ok) {
        throw new Error('Failed to regenerate image')
      }

      const data = await response.json()
      const newVersion = Date.now()
      // Force reload by adding timestamp to URL
      setGeneratedImageUrl(`${data.imageUrl}?t=${newVersion}`)

      // Update the imageVersion in saved papers for cache busting in Gallery
      if (caughtPaper?.doi) {
        const paperIndex = savedPapers.findIndex(saved => saved.paper.doi === caughtPaper.doi)
        if (paperIndex !== -1) {
          updateCaughtPaper(paperIndex, { imageVersion: newVersion })
        }
      }
    } catch (error) {
      console.error('Error regenerating fish image:', error)
      setImageError(true)
    } finally {
      setIsGenerating(false)
    }
  }

  // Set image URL directly when paper changes
  useEffect(() => {
    if (!caughtPaper?.doi) {
      setGeneratedImageUrl(null)
      return
    }

    // Directly set the image URL - if it doesn't exist, onError will handle it
    setGeneratedImageUrl(getImageUrl(caughtPaper.doi))
  }, [caughtPaper?.doi])

  // Handle image load error
  const handleImageError = () => {
    // Image doesn't exist, clear URL to show "Generate image" button
    setGeneratedImageUrl(null)
  }

  if (!caughtPaper) {
    return null
  }


  // Container with card positioning - right side slide in
  const renderCard = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-end pr-12">
      {/* Backdrop - click to close (invisible) */}
      <div
        className="absolute inset-0"
        onClick={handleClose}
        aria-label="Close"
      />

      {/* Card content */}
      <div
        className={`relative flex flex-col w-130 mt-6 mb-8 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top section - Fish and stars OUTSIDE the main card */}
        <div className="relative px-6 pt-4 pb-3 -mb-25" style={{ zIndex: 10 }}>
          <div className="relative">
            {/* Fish image */}
            <div className="flex justify-center h-40">
              {generatedImageUrl ? (
                <div
                  className="relative h-full"
                  onMouseEnter={() => setIsHoveringImage(true)}
                  onMouseLeave={() => setIsHoveringImage(false)}
                >
                  <img
                    src={generatedImageUrl}
                    alt="Generated fish illustration"
                    className={`h-full w-auto object-contain ${isGenerating ? 'animate-fish-swim' : ''}`}
                    style={{
                      filter: 'drop-shadow(0 0 4px white) drop-shadow(0 0 4px white) drop-shadow(0 0 4px white)'
                    }}
                    onError={handleImageError}
                  />
                  {/* Regenerate icon button (top-right corner) */}
                  {isHoveringImage && !isGenerating && (
                    <div
                      onClick={handleRegenerateImage}
                      className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full p-1.5 rounded-full bg-white bg-opacity-90 hover:bg-opacity-100 transition-all shadow-md hover:shadow-lg cursor-pointer"
                      title="Regenerate fish image"
                      role="button"
                      tabIndex={0}
                    >
                      <Icon icon="mdi:refresh" width="18" height="18" style={{ color: '#8b4513' }} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="group relative h-40 flex justify-center items-center">
                  <Icon
                    icon="ion:fish"
                    height="160"
                    className={`transition-all ${isGenerating ? 'animate-fish-swim' : ''}`}
                    style={{
                      color: '#8b8b8b',
                      filter: isGenerating
                        ? 'grayscale(50%) drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))'
                        : 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))'
                    }}
                  />
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute top-4 -translate-y-full left-1/2 -translate-x-1/2 z-10 rounded-lg bg-slate-950/90 px-4 py-2 text-center text-sm font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap">
                    Save the paper to generate an image
                  </div>
                </div>
              )}
            </div>

            {/* Star rating and love icon */}
            <div className="flex items-center justify-center gap-8">
              <ScoreIcons score={caughtPaper.score || 0} />

              {/* Love icon toggle for save/unsave */}
              <div
                role="button"
                tabIndex={0}
                className="transition-all hover:scale-110"
                style={{
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (!caughtPaper) return
                  if (isSaved) {
                    removePaper(caughtPaper)
                  } else {
                    catchPaper(caughtPaper)
                    // Generate image when saving if no image exists
                    if (!generatedImageUrl) {
                      handleGenerateImage()
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (!caughtPaper) return
                    if (isSaved) {
                      removePaper(caughtPaper)
                    } else {
                      catchPaper(caughtPaper)
                      // Generate image when saving if no image exists
                      if (!generatedImageUrl) {
                        handleGenerateImage()
                      }
                    }
                  }
                }}
                title={isSaved ? 'Remove from collection' : 'Save to collection'}
              >
                <Icon
                  icon={isSaved ? 'mdi:heart' : 'mdi:heart-outline'}
                  width="32"
                  height="32"
                  style={{
                    color: isSaved ? '#e74c3c' : '#356072',
                    filter: isSaved ? 'drop-shadow(0 2px 4px rgba(231, 76, 60, 0.3))' : 'none'
                  }}
                />
              </div>
            </div>

            {imageError && (
              <p className="text-center mt-2 text-xs" style={{ color: '#7a2f2f' }}>
                Failed to generate
              </p>
            )}
          </div>
        </div>

        {/* Tilted background box behind the main card */}
        <div
          className="absolute rounded-3xl"
          style={{
            width: '102%',
            height: '78vh',
            backgroundColor: 'rgba(53, 96, 114, 0.25)',
            transform: 'rotate(1deg) translate(-10px, 0)',
            zIndex: -1,
            top: '7rem',
            left: '0.5rem',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        />

        {/* Museum-style exhibit card - BELOW the fish section */}
        <div
          className="relative h-[75vh] px-6 pb-6 pt-27 flex flex-col min-h-0 shadow-lg rounded-3xl"
          style={{
            backgroundColor: '#FEFCF7',
            boxShadow: 'inset 0 -4px 0 0 #356072, inset -4px 0 0 0 #356072, inset 4px 0 0 0 #356072, 0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Top left corner border */}
          <div 
            className="absolute left-0 top-0 w-16 h-16 rounded-tl-3xl pointer-events-none"
            style={{
              boxShadow: 'inset 4px 0 0 0 #356072, inset 0 4px 0 0 #356072',
            }}
          />
          {/* Top right corner border */}
          <div 
            className="absolute right-0 top-0 w-16 h-16 rounded-tr-3xl pointer-events-none"
            style={{
              boxShadow: 'inset -4px 0 0 0 #356072, inset 0 4px 0 0 #356072',
            }}
          />

          {/* Close button in top-right corner */}
          {onClose && (
            <div
              onClick={handleClose}
              className="absolute bg-[#9EC29A] -top-5 -right-2 p-2 rounded-2xl transition-all hover:bg-opacity-100 hover:rotate-90 hover:scale-110 hover:shadow-lg cursor-pointer z-10"
              role="button"
              aria-label="Close"
              title="Close"
            >
              <Icon icon="mdi:close-thick" className="h-6 w-6 text-white" />
            </div>
          )}

          {/* Blue circle in bottom-left corner */}
          <div
            className="absolute bg-[#356072]/40 -bottom-2 -left-2 p-3 rounded-full shadow-lg z-10 border-2 border-[#356072]"
            role="presentation"
          />

          {/* Keyword hint toggle icon in bottom-right corner */}
          <div className="group absolute bottom-6 right-6 z-10">
            <div
              onClick={() => setShowKeywords(!showKeywords)}
              className="p-2 rounded-full shadow-lg border-2 transition-all cursor-pointer hover:scale-110"
              style={{
                backgroundColor: showKeywords ? '#D4A574' : '#356072',
                borderColor: showKeywords ? '#B48246' : '#2a4d5a'
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setShowKeywords(!showKeywords)
                }
              }}
            >
              <Icon
                icon={showKeywords ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'}
                width="20"
                height="20"
                style={{ color: 'white' }}
              />
            </div>
            {/* Tooltip */}
            <div className="pointer-events-none absolute bottom-full right-0 mb-2 z-20 rounded-lg bg-slate-950/90 px-3 py-2 text-xs font-medium leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 whitespace-nowrap">
              {showKeywords ? 'Hide keyword highlights' : 'Highlight keywords for rarity measurement'}
            </div>
          </div>

          {/* Venue and Year labels on left side */}
          <div className="absolute -left-2 top-7 flex flex-col gap-2 items-start">
            <div
              className="relative w-fit px-3 py-0 rounded-r-lg"
              style={{
                backgroundColor: 'rgba(212, 165, 116, 0.9)',
                border: '2px solid rgba(180, 130, 70, 0.4)',
                boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.15)',
                transform: 'rotate(-1deg)'
              }}
            >
              <span className="text-sm font-medium" style={{
                color: 'rgba(44, 24, 16, 0.56)'
              }}>
                {caughtPaper.conference || 'N/A'}
              </span>
            </div>
            <div
              className="relative w-fit px-3 py-0 rounded-r-lg"
              style={{
                backgroundColor: 'rgba(198, 211, 165, 0.85)',
                border: '2px solid rgba(140, 160, 110, 0.3)',
                boxShadow: '2px 2px 4px rgba(0, 0, 0, 0.15)',
                transform: 'rotate(1deg)'
              }}
            >
              <span className="text-sm font-medium" style={{
                color: 'rgba(44, 24, 16, 0.65)'
              }}>
                {caughtPaper.year || 'N/A'}
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-col space-y-3 flex-1 min-h-0 items-center">
            {/* Meta data section */}
            <div className="space-y-1 w-full px-2">
              {/* Title */}
              <div>
                <h2 className="text-2xl font-semibold leading-snug text-[#00334A]">
                  <HighlightedText
                    text={caughtPaper.title}
                    keywords={showKeywords ? caughtPaper.keywords : undefined}
                    keywormKeywords={caughtPaper.usedKeyworm}
                  />
                  <span className="inline-flex items-center gap-1 ml-2">
                    {caughtPaper.doi && (
                      <a
                        href={`https://doi.org/${caughtPaper.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-opacity hover:opacity-60"
                        title="View DOI"
                      >
                        <Icon icon="academicons:doi" width="18" height="18" style={{ color: '#ba713a', opacity: 0.85 }} />
                      </a>
                    )}
                    <a
                      href={`https://scholar.google.com/scholar?q=${encodeURIComponent(caughtPaper.title)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-opacity hover:opacity-60"
                      title="View on Google Scholar"
                    >
                      <Icon icon="academicons:google-scholar" width="18" height="18" style={{ color: '#ba713a', opacity: 0.85 }} />
                    </a>
                  </span>
                </h2>
              </div>

              {/* Authors */}
              <div>
                <p className='text-[#356072] font-medium'>
                  {caughtPaper.authorNames || caughtPaper.authorNamesDeduped || 'N/A'}
                </p>
              </div>

              {/* Conference and Year */}
              {/* <div className="text-sm flex items-center justify-center gap-3">
                <p className="font-semibold" style={{ color: '#8b4513' }}>
                  {caughtPaper.conference || 'N/A'} • {caughtPaper.year || 'N/A'}
                </p>
                <div className="flex items-center gap-1">
                  {caughtPaper.doi && (
                    <a
                      href={`https://doi.org/${caughtPaper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-opacity hover:opacity-60"
                      title="View DOI"
                    >
                      <Icon icon="academicons:doi" width="20" height="20" style={{ color: '#8b4513' }} />
                    </a>
                  )}
                  <a
                    href={`https://scholar.google.com/scholar?q=${encodeURIComponent(caughtPaper.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-opacity hover:opacity-60"
                    title="View on Google Scholar"
                  >
                    <Icon icon="academicons:google-scholar" width="20" height="20" style={{ color: '#8b4513' }} />
                  </a>
                </div>
              </div> */}
            </div>

            {/* Abstract */}
            {caughtPaper.abstract && (
              <div className='mt-1 p-2 overflow-auto flex-auto'>
                <div
                  className="p-4 h-full overflow-auto border-[#64aacc] border-2 rounded-xl bg-white"
                  style={{
                    boxShadow: '0 0 0 8px rgba(100, 170, 204, 0.15)'
                  }}
                >
                  <p className="text-sm leading-relaxed text-justify" style={{ color: '#2F3949' }}>
                    <HighlightedText
                      text={caughtPaper.abstract}
                      keywords={showKeywords ? caughtPaper.keywords : undefined}
                      keywormKeywords={caughtPaper.usedKeyworm}
                    />
                  </p>
                </div>
              </div>
            )}

            {caughtPaper.usedKeyworm && caughtPaper.usedKeyworm.length > 0 && (
              <div className="w-full mt-auto pt-2 px-2">
                <p className="text-xs font-semibold tracking-wide text-[#356072] mb-2 text-center uppercase">
                  Keyworm Used
                </p>
                <div
                  role="button"
                  tabIndex={0}
                  className="group w-full pb-1 cursor-pointer"
                  title="Click to set this keyworm"
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log('[CatchResult] Keyworm clicked, setting keywords:', caughtPaper.usedKeyworm)
                    setKeywormKeywords(caughtPaper.usedKeyworm ?? [])
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('[CatchResult] Keyworm keyboard interaction, setting keywords:', caughtPaper.usedKeyworm)
                      setKeywormKeywords(caughtPaper.usedKeyworm ?? [])
                    }
                  }}
                >
                  <div className="w-fit mx-auto flex justify-center overflow-x-auto overflow-y-hidden">
                    <Keyworm
                      size={90}
                      mode="full"
                      keywords={caughtPaper.usedKeyworm}
                      editable={false}
                    />
                  </div>
                  <p className="text-center text-[11px] text-[#356072] mt-1 opacity-0 transition-opacity group-hover:opacity-100">
                    Click to set this keyworm
                  </p>
                </div>
              </div>
            )}

              {/* Action Buttons */}
              {/* <div className="flex w-full justify-between">
                <div
                  role="button"
                  tabIndex={0}
                  className="text-center px-4 py-1.5 transition-all text-sm font-semibold tracking-wider border-2"
                  style={{
                    backgroundColor: isSaved ? '#7a2f2f' : '#2d5a3a',
                    color: '#faf8f3',
                    borderColor: isSaved ? '#7a2f2f' : '#2d5a3a',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isSaved ? '#632626' : '#244a30'
                    e.currentTarget.style.borderColor = isSaved ? '#632626' : '#244a30'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSaved ? '#7a2f2f' : '#2d5a3a'
                    e.currentTarget.style.borderColor = isSaved ? '#7a2f2f' : '#2d5a3a'
                  }}
                  onClick={() => {
                    if (!caughtPaper) return
                    if (isSaved) {
                      removePaper(caughtPaper)
                    } else {
                      catchPaper(caughtPaper)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (!caughtPaper) return
                      if (isSaved) {
                        removePaper(caughtPaper)
                      } else {
                        catchPaper(caughtPaper)
                      }
                    }
                  }}
                >
                  {isSaved ? 'REMOVE' : 'Save'}
                </div>

                {onClose && (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={onClose}
                    className="text-center px-4 py-1.5 transition-all text-sm font-semibold tracking-wider border-2"
                    style={{
                      backgroundColor: 'rgba(139, 69, 19, 0.1)',
                      color: '#8b4513',
                      borderColor: '#8b4513',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(139, 69, 19, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(139, 69, 19, 0.1)'
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onClose()
                      }
                    }}
                    aria-label="Close"
                  >
                    {closeButtonText}
                  </div>
                )}
              </div> */}
          </div>
        </div>
      </div>

      {/* Slide-in/out animation styles */}
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slide-out-right {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }

        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }

        .animate-slide-out-right {
          animation: slide-out-right 0.3s ease-in;
        }

        @keyframes fish-swim {
          0%, 100% {
            transform: scaleX(1);
          }
          50% {
            transform: scaleX(0.88);
          }
        }

        .animate-fish-swim {
          animation: fish-swim 1.2s ease-in-out infinite;
          transform-origin: center center;
        }
      `}</style>
    </div>
  )

  return renderCard()
}

export default CatchResult
