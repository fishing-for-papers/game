import type { Paper } from '../types/paper'

export type KeywordRecommendation = {
  keyword: string
  paperCount: number
}

export const MIN_RECOMMENDED_KEYWORD_PAPER_COUNT = 15

const normalizeKeyword = (keyword: string) => keyword.trim().replace(/\s+/g, ' ').toLowerCase()

const isRecommendableKeyword = (keyword: string) => {
  const normalized = normalizeKeyword(keyword)
  return (
    normalized.length >= 3 &&
    !normalized.includes('://') &&
    !normalized.startsWith('www.')
  )
}

export function getPopularKeywordRecommendations(
  papers: Paper[],
  minPaperCount = MIN_RECOMMENDED_KEYWORD_PAPER_COUNT
): KeywordRecommendation[] {
  const keywordStats = new Map<string, { keyword: string; paperCount: number }>()

  for (const paper of papers) {
    const paperKeywords = new Set(
      (paper.keywords ?? [])
        .filter(isRecommendableKeyword)
        .map(normalizeKeyword)
    )

    for (const keyword of paperKeywords) {
      const existing = keywordStats.get(keyword)
      if (existing) {
        existing.paperCount += 1
      } else {
        keywordStats.set(keyword, {
          keyword,
          paperCount: 1,
        })
      }
    }
  }

  const recommendations = [...keywordStats.values()].filter(
    ({ paperCount }) => paperCount >= minPaperCount
  )

  // if (typeof window !== 'undefined' && import.meta.env.DEV) {
  //   console.log(
  //     `[KeywordRecommendations] ${recommendations.length} keywords meet minPaperCount >= ${minPaperCount}`
  //   )
  // }

  return recommendations
}

export function getRandomPopularKeywordRecommendation(
  papers: Paper[],
  minPaperCount = MIN_RECOMMENDED_KEYWORD_PAPER_COUNT
) {
  const recommendations = getPopularKeywordRecommendations(papers, minPaperCount)
  if (recommendations.length === 0) return null

  return recommendations[Math.floor(Math.random() * recommendations.length)]
}
