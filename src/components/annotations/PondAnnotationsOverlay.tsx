import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { Icon } from '@iconify-icon/react'
import type { PondAnnotation } from '../../types/gameState'
import { MARGIN } from '../../config/layoutConstants'
import { getAnnotationGlyphIcon } from './annotationGlyphs'
import { isPointInPaths } from '../../utils/pointInPath'

const ANNOTATION_LABEL_EDGE_BUFFER = 280

type PondAnnotationsOverlayProps = {
  annotations: PondAnnotation[]
  contentWidth: number
  contentHeight: number
  isMarkMode: boolean
  selectedGlyph: string | null
  note: string
  boundaryPaths: string[]
  onAddAnnotation: (annotation: Pick<PondAnnotation, 'x' | 'y' | 'glyph' | 'note'>) => string
  onUpdateAnnotation: (id: string, updates: Partial<Pick<PondAnnotation, 'glyph' | 'note'>>) => void
  onRemoveAnnotation: (id: string) => void
  onFinishEditing: () => void
}

function PondAnnotationsOverlay({
  annotations,
  contentWidth,
  contentHeight,
  isMarkMode,
  selectedGlyph,
  note,
  boundaryPaths,
  onAddAnnotation,
  onUpdateAnnotation,
  onRemoveAnnotation,
  onFinishEditing,
}: PondAnnotationsOverlayProps) {
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [hoveredAnnotationId, setHoveredAnnotationId] = useState<string | null>(null)
  const [isInBoundary, setIsInBoundary] = useState(false)
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null)
  const labelInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const ignoreNextSurfaceClickRef = useRef(false)
  
  const selectedAnnotation =
    annotations.find((annotation) => annotation.id === selectedAnnotationId) ?? null
  const shouldPlaceEditorLeft = selectedAnnotation
    ? selectedAnnotation.x > contentWidth - ANNOTATION_LABEL_EDGE_BUFFER
    : false

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (!isMarkMode) return

    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - rect.left, 0), contentWidth)
    const y = Math.min(Math.max(event.clientY - rect.top, 0), contentHeight)

    if (selectedAnnotationId || selectedGlyph === null) {
      setIsInBoundary(false)
      setCursorPosition({ x, y })
      return
    }

    const inBoundary = boundaryPaths.length === 0 || isPointInPaths(x, y, boundaryPaths)
    setIsInBoundary(inBoundary)
    setCursorPosition({ x, y })
  }

  const handleMouseLeave = () => {
    setCursorPosition(null)
    setIsInBoundary(false)
  }

  const handleAddAnnotation = (event: MouseEvent<HTMLDivElement>) => {
    if (ignoreNextSurfaceClickRef.current) {
      ignoreNextSurfaceClickRef.current = false
      return
    }

    if (selectedAnnotationId) {
      finishEditing()
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - rect.left, 0), contentWidth)
    const y = Math.min(Math.max(event.clientY - rect.top, 0), contentHeight)

    if (selectedGlyph === null) {
      return
    }

    // Check if the point is within any pond boundary
    if (boundaryPaths.length > 0 && !isPointInPaths(x, y, boundaryPaths)) {
      // Point is outside pond boundaries, do not add annotation
      return
    }

    const annotationId = onAddAnnotation({
      x,
      y,
      glyph: selectedGlyph,
      note: note.trim(),
    })
    setSelectedAnnotationId(annotationId)
  }

  const finishEditing = () => {
    setSelectedAnnotationId(null)
    onFinishEditing()
  }

  useEffect(() => {
    if (!selectedAnnotationId) return

    labelInputRef.current?.focus()
  }, [selectedAnnotationId])

  useEffect(() => {
    if (!selectedAnnotationId) return

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (editorRef.current?.contains(target)) return

      ignoreNextSurfaceClickRef.current = true
      finishEditing()
    }

    document.addEventListener('pointerdown', handlePointerDownOutside, true)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true)
    }
  }, [selectedAnnotationId])

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {isMarkMode && (
        <>
          <div
            className="pointer-events-auto absolute bg-amber-100/5"
            style={{
              left: MARGIN,
              top: MARGIN,
              width: contentWidth,
              height: contentHeight,
            }}
            onClick={handleAddAnnotation}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          {/* Cursor hint - pulsing yellow circle */}
          {cursorPosition && isInBoundary && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: MARGIN + cursorPosition.x,
                top: MARGIN + cursorPosition.y,
              }}
            >
              {/* Outer pulsing ring */}
              <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-yellow-400/40" />
              {/* Inner solid circle */}
              <div className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-yellow-400/80 bg-yellow-300/60" />
            </div>
          )}
        </>
      )}

      {annotations.map((annotation) => (
        <div
          key={annotation.id}
          className="pointer-events-auto absolute size-9 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: MARGIN + annotation.x,
            top: MARGIN + annotation.y,
          }}
          onMouseEnter={() => {
            if (!selectedAnnotationId) {
              setHoveredAnnotationId(annotation.id)
            }
          }}
          onMouseLeave={() => setHoveredAnnotationId(null)}
        >
          {/* Annotation glyph */}
          <span
            className="flex size-9 cursor-pointer items-center justify-center text-yellow-400 drop-shadow-[0_2px_2px_rgba(255,255,255,0.42)] drop-shadow-[0_8px_13px_rgba(15,23,42,0.34)]"
            aria-label="Pond annotation"
            title={annotation.note || 'Pond annotation'}
            onClick={() =>
              setSelectedAnnotationId((currentId) =>
                currentId === annotation.id ? null : annotation.id
              )
            }
          >
            <Icon
              icon={getAnnotationGlyphIcon(annotation.glyph)}
              width={23}
              className="[filter:drop-shadow(0_0_4px_rgba(250,204,21,0.65))]"
            />
          </span>

          {/* Editor - show when this annotation is selected */}
          {selectedAnnotationId === annotation.id && (
            <div
              ref={editorRef}
              className={`pointer-events-auto absolute top-1/2 flex -translate-y-1/2 items-center gap-1.5 ${
                shouldPlaceEditorLeft ? 'right-full mr-2' : 'left-full ml-2'
              }`}
            >
              <input
                type="text"
                ref={labelInputRef}
                value={annotation.note}
                onChange={(event) =>
                  onUpdateAnnotation(annotation.id, { note: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    finishEditing()
                  }
                }}
                className="h-8 w-44 rounded-full border border-white/35 bg-white/38 px-3 text-sm font-medium text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.24)] outline-none backdrop-blur-md placeholder:text-slate-500"
                placeholder="Label"
                maxLength={180}
              />
              <button
                type="button"
                className="no-focus-ring flex size-8 items-center justify-center rounded-full !border-white/35 !bg-white/38 p-0 text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-md hover:!bg-white/50"
                aria-label="Delete pond annotation"
                title="Delete"
                onClick={() => {
                  onRemoveAnnotation(annotation.id)
                  setSelectedAnnotationId(null)
                }}
              >
                <Icon icon="mdi:trash-can-outline" width={16} />
              </button>
            </div>
          )}

          {/* Tooltip - show when hovering and not editing */}
          {hoveredAnnotationId === annotation.id && !selectedAnnotationId && annotation.note && (
            <div
              className={`pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center ${
                annotation.x > contentWidth - ANNOTATION_LABEL_EDGE_BUFFER
                  ? 'right-full mr-2'
                  : 'left-full ml-2'
              }`}
            >
              <div className="h-8 rounded-full border border-white/35 bg-white/38 px-3 text-sm font-medium text-slate-900 shadow-[0_14px_30px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.24)] backdrop-blur-md flex items-center whitespace-nowrap">
                {annotation.note}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default PondAnnotationsOverlay
