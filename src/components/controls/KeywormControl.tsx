import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Icon } from '@iconify/react'
import { Keyworm } from '../Keyworm'
import type { Paper } from '../../types/paper'
import { getPopularKeywordRecommendations } from '../../utils/keywordRecommendations'

type SuggestionMode = 'auto' | 'manual' | 'dismissed' | null

const AUTO_SUGGESTION_DELAY_MS = 3000

type KeywormControlProps = {
  papers: Paper[]
  keywords: string[]
  onOpenKeyworm: () => void
  onAddKeyword: (keyword: string) => void
}

function KeywormControl({
  papers,
  keywords,
  onOpenKeyworm,
  onAddKeyword,
}: KeywormControlProps) {
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null)
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>(null)
  const previousKeywordCount = useRef(keywords.length)
  const suggestionChipFrameRef = useRef<HTMLDivElement>(null)
  const suggestionChipRef = useRef<HTMLDivElement>(null)

  const recommendedKeywords = useMemo(() => {
    const selectedKeywords = new Set(
      keywords.map((keyword) => keyword.trim().replace(/\s+/g, ' ').toLowerCase())
    )

    return getPopularKeywordRecommendations(papers).filter(
      ({ keyword }) => !selectedKeywords.has(keyword)
    )
  }, [keywords, papers])

  const hasSuggestedKeywords = recommendedKeywords.length > 0
  const hasKeywords = keywords.length > 0
  const suggestionsEnabled =
    suggestionMode === 'manual' || (suggestionMode === 'auto' && !hasKeywords)
  const suggestedKeyword =
    recommendedKeywords.find(({ keyword }) => keyword === selectedSuggestion) ??
    recommendedKeywords[0] ??
    null
  const suggestionChipVisible = suggestionsEnabled && Boolean(suggestedKeyword)

  useLayoutEffect(() => {
    const chipFrame = suggestionChipFrameRef.current
    const chip = suggestionChipRef.current
    if (!chipFrame || !chip) return

    const updateSuggestionChipWidth = () => {
      chipFrame.style.setProperty('--suggestion-chip-width', `${chip.scrollWidth}px`)
    }

    updateSuggestionChipWidth()

    const resizeObserver = new ResizeObserver(updateSuggestionChipWidth)
    resizeObserver.observe(chip)

    return () => {
      resizeObserver.disconnect()
    }
  }, [suggestedKeyword?.keyword])

  useEffect(() => {
    if (previousKeywordCount.current === 0 && keywords.length > 0) {
      window.setTimeout(() => setSuggestionMode(null), 0)
    }

    previousKeywordCount.current = keywords.length
  }, [keywords.length])

  useEffect(() => {
    if (hasKeywords || suggestionMode !== null) return

    const zeroKeywordTimer = window.setTimeout(() => {
      setSuggestionMode('auto')
    }, AUTO_SUGGESTION_DELAY_MS)

    return () => {
      window.clearTimeout(zeroKeywordTimer)
    }
  }, [hasKeywords, suggestionMode])

  const handleAddSuggestedKeyword = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (!suggestedKeyword) return

    if (suggestionMode !== 'manual') {
      setSuggestionMode(null)
    }
    onAddKeyword(suggestedKeyword.keyword)
  }

  const handleShuffleSuggestedKeyword = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (recommendedKeywords.length === 0) return

    const nextRecommendations = suggestedKeyword
      ? recommendedKeywords.filter(
          ({ keyword }) => keyword !== suggestedKeyword.keyword
        )
      : recommendedKeywords
    const recommendationPool =
      nextRecommendations.length > 0 ? nextRecommendations : recommendedKeywords

    const nextRecommendation =
      recommendationPool[Math.floor(Math.random() * recommendationPool.length)]

    setSelectedSuggestion(nextRecommendation.keyword)
  }

  const handleToggleSuggestions = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    setSuggestionMode(suggestionsEnabled ? 'dismissed' : 'manual')
  }

  return (
    <>
      <div className="absolute right-6 top-6 z-10 flex flex-col items-end gap-1.5">
        <div
          className="mb-2 cursor-pointer transition-opacity hover:opacity-80 flex gap-2 items-end"
          onClick={onOpenKeyworm}
        >
          {hasSuggestedKeywords && (
            <div className="relative mr-1 flex items-center gap-2 text-white/80">
              <div
                ref={suggestionChipFrameRef}
                className={`group relative flex origin-right items-center overflow-hidden whitespace-nowrap transition-[max-width,opacity] ease-out motion-reduce:transition-none ${
                  suggestionChipVisible
                    ? 'opacity-100 duration-1200'
                    : 'pointer-events-none opacity-0 duration-700'
                }`}
                style={{
                  maxWidth: suggestionChipVisible
                    ? 'calc(var(--suggestion-chip-width, 0px) + 2rem)'
                    : 0,
                }}
                aria-hidden={!suggestionChipVisible}
              >
                <div
                  ref={suggestionChipRef}
                  className="flex w-max shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-black/10 px-2 pb-0.5 text-base font-medium tracking-[0.06em] transition-all duration-200 [text-shadow:0_1px_1px_rgba(69,49,64,0.1),0_0_6px_rgba(69,49,64,0.05)] hover:bg-black/15"
                  onClick={handleAddSuggestedKeyword}
                >
                  {suggestedKeyword?.keyword}
                  <span
                    role="button"
                    tabIndex={suggestionChipVisible ? 0 : -1}
                    aria-label="Shuffle suggested keyword"
                    className="cursor-pointer text-white/50 transition-colors duration-200 hover:text-white/80"
                    onClick={handleShuffleSuggestedKeyword}
                  >
                    <Icon icon="mdi:refresh" width={16} />
                  </span>
                </div>
              </div>
              <div
                role="button"
                tabIndex={0}
                aria-label={
                  suggestionsEnabled
                    ? 'Turn off keyword suggestions'
                    : 'Turn on keyword suggestions'
                }
                aria-pressed={suggestionsEnabled}
                className="flex size-6 cursor-pointer items-center justify-center rounded-full text-white/75 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                onClick={handleToggleSuggestions}
              >
                <Icon
                  icon={
                    suggestionsEnabled ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline'
                  }
                  width={20}
                  className="drop-shadow-[0_1px_5px_rgba(69,49,64,0.45)]"
                />
              </div>
            </div>
          )}
          <Keyworm size={32} />
        </div>

      </div>
    </>
  )
}

export default KeywormControl
