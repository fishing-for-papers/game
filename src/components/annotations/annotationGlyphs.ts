import tentBanner from '@iconify-icons/icon-park-outline/tent-banner.js'
import type { IconifyIcon } from '@iconify/types'

export type AnnotationGlyph = {
  id: string
  icon: IconifyIcon | string
  label: string
}

export const DEFAULT_ANNOTATION_GLYPH = 'tent-banner'

export const ANNOTATION_GLYPHS: AnnotationGlyph[] = [
  { id: DEFAULT_ANNOTATION_GLYPH, icon: tentBanner, label: 'Banner' },
  { id: 'question', icon: 'mdi:help-circle-outline', label: 'Question' },
  { id: 'lightbulb', icon: 'mdi:lightbulb-outline', label: 'Lightbulb' },
  { id: 'bookmark', icon: 'mdi:bookmark-outline', label: 'Bookmark' },
  { id: 'star', icon: 'mdi:star-outline', label: 'Star' },
]

export const getAnnotationGlyphIcon = (glyphId: string): IconifyIcon | string =>
  ANNOTATION_GLYPHS.find((glyph) => glyph.id === glyphId)?.icon ?? tentBanner
