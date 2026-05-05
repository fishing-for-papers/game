import type { Paper } from '../types/paper'

class SearchService {
  private papers: Paper[] = []

  async initialize(papers: Paper[]): Promise<void> {
    // Clear papers first to prevent using stale data during reinitialization
    this.papers = []
    // Then set new papers
    this.papers = papers
    console.log(`Loaded ${papers.length} papers`)
  }

  search(query: string, limit = 100, options?: { random?: boolean }): Paper[] {
    if (this.papers.length === 0 || !query.trim()) {
      return []
    }

    // Simple string matching: split query into keywords
    const keywords = query.toLowerCase().trim().split(/\s+/).filter(Boolean)

    // Filter papers that match ALL keywords
    const matchedPapers: Paper[] = []
    for (const paper of this.papers) {
      const searchableContent = [
        paper.title,
        paper.abstract,
        paper.authorNamesDeduped,
        paper.authorKeywords,
        paper.authorAffiliation,
      ].filter(Boolean).join(' ').toLowerCase()

      // Check if all keywords are present
      const allMatch = keywords.every(keyword => searchableContent.includes(keyword))
      if (allMatch) {
        matchedPapers.push(paper)
      }
    }

    // If random sampling is requested, shuffle and limit
    if (options?.random && limit > 0 && matchedPapers.length > limit) {
      // Fisher-Yates shuffle
      const shuffled = [...matchedPapers]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      return shuffled.slice(0, limit)
    }

    // Return matched papers, limited to the requested amount
    return matchedPapers.slice(0, limit)
  }

  getAllPapers(): Paper[] {
    return this.papers
  }

  isReady(): boolean {
    return this.papers.length > 0
  }
}

export const searchService = new SearchService()
