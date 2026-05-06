import { useEffect, useState } from 'react'
import { Icon } from '@iconify-icon/react'
import IconButton from '../ui/IconButton'
import { ANNOTATION_GLYPHS } from './annotationGlyphs'
import { DEFAULT_ANNOTATION_GLYPH } from './annotationGlyphs'

type AnnotationControlProps = {
  selectedGlyph: string | null
  onSelectGlyph: (glyph: string | null) => void
}

function AnnotationControl({
  selectedGlyph,
  onSelectGlyph,
}: AnnotationControlProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    if (selectedGlyph !== null) {
      setIsMenuOpen(true)
    }
  }, [selectedGlyph])

  const handleToggle = () => {
    const next = !isMenuOpen
    setIsMenuOpen(next)
    onSelectGlyph(next ? DEFAULT_ANNOTATION_GLYPH : null)
  }

  return (
    <div className="absolute right-6 bottom-6 z-30 flex items-center gap-2">
      {isMenuOpen && (
        <div className="flex items-center gap-1.5">
          {ANNOTATION_GLYPHS.map((glyph) => (
            <button
              key={glyph.id}
              type="button"
              className={`no-focus-ring flex size-9 items-center justify-center rounded-lg border p-0 transition ${
                selectedGlyph === glyph.id
                  ? '!border-yellow-300 !bg-white/85 text-yellow-400 shadow-[0_0_14px_rgba(250,204,21,0.42)]'
                  : '!border-white/80 !bg-white/85 text-slate-800 hover:!bg-white'
              }`}
              aria-label={`Use ${glyph.label} annotation glyph`}
              title={glyph.label}
              onClick={() => onSelectGlyph(selectedGlyph === glyph.id ? null : glyph.id)}
            >
              <Icon icon={glyph.icon} width={20} />
            </button>
          ))}
        </div>
      )}

      <IconButton
        size="md"
        aria-label={isMenuOpen ? 'Exit annotation mode' : 'Enter annotation mode'}
        aria-pressed={isMenuOpen}
        title={isMenuOpen ? 'Exit annotation mode' : 'Mark pond'}
        onClick={handleToggle}
      >
        <Icon icon={isMenuOpen ? 'mdi:close' : 'ri:mark-pen-line'} width={20} />
      </IconButton>
    </div>
  )
}

export default AnnotationControl
