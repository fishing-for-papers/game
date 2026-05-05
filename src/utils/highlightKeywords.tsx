import React from 'react'

interface HighlightedTextProps {
  text: string
  keywords?: string[]
  highlightClassName?: string
  keywormKeywords?: string[]
  keywormHighlightClassName?: string
}

/**
 * Highlights all occurrences of keywords in the given text (case-insensitive)
 * Supports two sets of keywords with different highlight colors:
 * - keywords: primary highlights (default: peachy beige)
 * - keywormKeywords: search term highlights (default: yellow)
 */
export function HighlightedText({
  text,
  keywords,
  highlightClassName = 'bg-[#FFECD9] px-1 rounded',
  keywormKeywords,
  keywormHighlightClassName = 'bg-yellow-200 px-1 rounded'
}: HighlightedTextProps) {
  // Combine all keywords for splitting
  const validKeywords = (keywords || [])
    .filter(k => k && k.trim().length > 0)
    .map(k => k.trim())

  const validKeywormKeywords = (keywormKeywords || [])
    .filter(k => k && k.trim().length > 0)
    .map(k => k.trim())

  const hasKeywords = validKeywords.length > 0
  const hasKeywormKeywords = validKeywormKeywords.length > 0

  if (!hasKeywords && !hasKeywormKeywords) {
    return <>{text}</>
  }

  // Create a character-level highlight map
  // null = no highlight, 'keyword' = orange, 'keyworm' = yellow
  const charHighlights: (null | 'keyword' | 'keyworm')[] = new Array(text.length).fill(null)

  // First, mark regular keywords (lower priority)
  // Use word boundaries (\b) for exact word matching
  for (const keyword of validKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi')
    let match
    while ((match = regex.exec(text)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        if (charHighlights[i] === null) {
          charHighlights[i] = 'keyword'
        }
      }
    }
  }

  // Then, mark keyworm keywords (higher priority - can override)
  // Allow partial matching (no word boundaries)
  for (const keyword of validKeywormKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedKeyword, 'gi')
    let match
    while ((match = regex.exec(text)) !== null) {
      for (let i = match.index; i < match.index + match[0].length; i++) {
        charHighlights[i] = 'keyworm'
      }
    }
  }

  // Build result array based on character highlight map
  const result: React.ReactNode[] = []
  let currentType: null | 'keyword' | 'keyworm' = null
  let currentText = ''
  let currentIndex = 0

  for (let i = 0; i < text.length; i++) {
    if (charHighlights[i] !== currentType) {
      // Flush current segment
      if (currentText) {
        if (currentType === 'keyworm') {
          result.push(
            <span key={currentIndex} className={keywormHighlightClassName}>
              {currentText}
            </span>
          )
        } else if (currentType === 'keyword') {
          result.push(
            <span key={currentIndex} className={highlightClassName}>
              {currentText}
            </span>
          )
        } else {
          result.push(<React.Fragment key={currentIndex}>{currentText}</React.Fragment>)
        }
        currentIndex++
        currentText = ''
      }
      currentType = charHighlights[i]
    }
    currentText += text[i]
  }

  // Flush final segment
  if (currentText) {
    if (currentType === 'keyworm') {
      result.push(
        <span key={currentIndex} className={keywormHighlightClassName}>
          {currentText}
        </span>
      )
    } else if (currentType === 'keyword') {
      result.push(
        <span key={currentIndex} className={highlightClassName}>
          {currentText}
        </span>
      )
    } else {
      result.push(<React.Fragment key={currentIndex}>{currentText}</React.Fragment>)
    }
  }

  return <>{result}</>
}
