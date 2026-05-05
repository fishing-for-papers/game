import { Keyworm } from '../components/Keyworm'
import BackButton from '../components/BackButton'
import { useRef, useEffect, useState, useMemo } from 'react'
import { useKeywormStore } from '../stores/useKeywormStore'
import { calculateKeywormDimensions } from '../utils/keywormDimensions'

function KeywormScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [keyword, setKeyword] = useState('')
  const keywords = useKeywormStore((state) => state.keywords)
  const addKeyword = useKeywormStore((state) => state.addKeyword)
  const canAddKeyword = keyword.trim().length > 0

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Calculate keyworm dimensions for centering
  const keywormSize = 150
  const { totalWidth: keywormWidth, totalHeight: keywormHeight } = useMemo(
    () => calculateKeywormDimensions(keywords, keywormSize, 'full'),
    [keywords, keywormSize]
  )
  const keywormX = (dimensions.width - keywormWidth) / 2
  const keywormY = (dimensions.height - keywormHeight) / 2

  const handleAddKeyword = () => {
    const trimmedKeyword = keyword.trim()
    if (trimmedKeyword) {
      addKeyword(trimmedKeyword)
      setKeyword('')
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#f5efe4] text-slate-900">
      <div ref={containerRef} className="w-full flex-1 p-8 overflow-y-auto">
        <div className="w-full h-full rounded-[1.75rem] bg-[#FEFCF7]/80 backdrop-blur-[1px] shadow-inner ring-1 ring-[#d9c8ad] p-4 md:p-6">
          <svg width="100%" height="100%" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}>
            <Keyworm x={keywormX} y={keywormY} size={keywormSize} mode="full" />
          </svg>
        </div>
      </div>

      <div className="shrink-0 px-6 py-4 flex justify-center items-center gap-4 h-40">
        <input
          id="keyworm-keyword"
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
          placeholder="type keyword"
          className="px-6 py-4 text-lg font-medium rounded-full bg-[#FEFCF7] text-slate-900 border-2 border-[#d4a574]/50 shadow-lg hover:bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-white placeholder:text-slate-400 min-w-[300px] transition-all duration-150 h-[60px]"
        />
        <BackButton
          onClick={handleAddKeyword}
          disabled={!canAddKeyword}
          className="px-8 py-4 text-lg font-semibold transition-all duration-200 flex items-center gap-3 h-[60px]"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="whitespace-nowrap">Add</span>
        </BackButton>
      </div>
    </div>
  )
}

export default KeywormScene
