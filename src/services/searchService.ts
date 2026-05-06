import MiniSearch from 'minisearch'
import type { Paper } from '../types/paper'

interface SearchDocument {
  id: number
  title: string
  abstract: string
  authorKeywords: string
  authorNamesDeduped: string
  authorAffiliation: string
}

export type SearchMode = 'exact' | 'bm25'

export interface SearchResponse {
  papers: Paper[]
  mode: SearchMode | null
  defaultMode: SearchMode
  fallbackMode: SearchMode | null
  usedFallback: boolean
  defaultCount: number
  fallbackCount: number
  message?: string
}

interface SearchOptions {
  random?: boolean
  defaultMode?: SearchMode
  fallbackMode?: SearchMode | null
  fallbackLimit?: number
}

class SearchService {
  private papers: Paper[] = []
  private miniSearch: MiniSearch<SearchDocument> | null = null
  private paperById = new Map<number, Paper>()
  private defaultMode: SearchMode = 'exact'
  private fallbackMode: SearchMode | null = 'bm25'
  private lastSearchResponse: SearchResponse = {
    papers: [],
    mode: null,
    defaultMode: this.defaultMode,
    fallbackMode: this.fallbackMode,
    usedFallback: false,
    defaultCount: 0,
    fallbackCount: 0,
  }

  async initialize(papers: Paper[]): Promise<void> {
    // Clear papers first to prevent using stale data during reinitialization
    this.papers = []
    this.paperById.clear()
    this.miniSearch = null
    // Then set new papers
    this.papers = papers

    const documents = papers.map((paper, id) => {
      this.paperById.set(id, paper)

      return {
        id,
        title: paper.title ?? '',
        abstract: paper.abstract ?? '',
        authorKeywords: paper.authorKeywords ?? '',
        authorNamesDeduped: paper.authorNamesDeduped ?? '',
        authorAffiliation: paper.authorAffiliation ?? '',
      }
    })

    this.miniSearch = new MiniSearch<SearchDocument>({
      fields: [
        'title',
        'abstract',
        'authorKeywords',
        'authorNamesDeduped',
        'authorAffiliation',
      ],
      storeFields: ['id'],
    })
    this.miniSearch.addAll(documents)

    console.log(`Loaded ${papers.length} papers`)
  }

  search(
    query: string,
    limit = 100,
    options?: SearchOptions
  ): SearchResponse {
    const defaultMode = options?.defaultMode ?? this.defaultMode
    const fallbackMode = options?.fallbackMode ?? this.fallbackMode

    if (this.papers.length === 0 || !query.trim()) {
      this.lastSearchResponse = {
        papers: [],
        mode: null,
        defaultMode,
        fallbackMode,
        usedFallback: false,
        defaultCount: 0,
        fallbackCount: 0,
      }
      return this.lastSearchResponse
    }

    const defaultResults = this.runSearchMode(defaultMode, query, limit, options)
    if (defaultResults.length > 0 || !fallbackMode) {
      this.lastSearchResponse = {
        papers: defaultResults,
        mode: defaultResults.length > 0 ? defaultMode : null,
        defaultMode,
        fallbackMode,
        usedFallback: false,
        defaultCount: defaultResults.length,
        fallbackCount: 0,
        message: defaultResults.length > 0
          ? undefined
          : `No ${defaultMode} matches found.`,
      }
      return this.lastSearchResponse
    }

    const fallbackLimit = options?.fallbackLimit ?? 10
    const fallbackResults = this.runSearchMode(fallbackMode, query, fallbackLimit, options)
    this.lastSearchResponse = {
      papers: fallbackResults,
      mode: fallbackResults.length > 0 ? fallbackMode : null,
      defaultMode,
      fallbackMode,
      usedFallback: true,
      defaultCount: 0,
      fallbackCount: fallbackResults.length,
      message: fallbackResults.length > 0
        ? `No ${defaultMode} match. Falling back to ${fallbackMode} search, showing top ${fallbackLimit} papers.`
        : `No ${defaultMode} match. ${fallbackMode} found no results.`,
    }

    return this.lastSearchResponse
  }

  searchExact(query: string, limit = 100, options?: Pick<SearchOptions, 'random'>): Paper[] {
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

  searchBm25(query: string, limit: number): Paper[] {
    if (!this.miniSearch || limit <= 0) {
      return []
    }

    return this.miniSearch
      .search(query, {
        combineWith: 'OR',
        prefix: true,
        boost: {
          title: 3,
          authorKeywords: 2.5,
          abstract: 1,
          authorNamesDeduped: 0.5,
          authorAffiliation: 0.25,
        },
        bm25: {
          k: 1.2,
          b: 0.7,
          d: 0.5,
        },
      })
      .slice(0, limit)
      .map((result) => this.paperById.get(Number(result.id)))
      .filter((paper): paper is Paper => Boolean(paper))
  }

  private runSearchMode(
    mode: SearchMode,
    query: string,
    limit: number,
    options?: SearchOptions
  ): Paper[] {
    switch (mode) {
      case 'exact':
        return this.searchExact(query, limit, options)
      case 'bm25':
        return this.searchBm25(query, limit)
    }
  }

  getAllPapers(): Paper[] {
    return this.papers
  }

  getLastSearchResponse(): SearchResponse {
    return this.lastSearchResponse
  }

  isReady(): boolean {
    return this.papers.length > 0
  }
}

export const searchService = new SearchService()
