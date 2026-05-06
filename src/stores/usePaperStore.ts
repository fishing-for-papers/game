import { create } from 'zustand'
import type { Paper } from '../types/paper'
import { searchService } from '../services/searchService'

export type Venue = 'VIS' | 'EuroVis' | 'CHI'
export const VENUES: readonly Venue[] = ['VIS', 'EuroVis', 'CHI'] as const

interface PaperState {
  papers: Paper[]
  searchQuery: string
  selectedPaper: Paper | null
  isLoading: boolean
  isIndexReady: boolean
  selectedVenue: Venue
}

interface PaperActions {
  loadPapersAndBuildIndex: () => Promise<void>
  setSearchQuery: (query: string) => void
  selectPaper: (paper: Paper | null) => void
  getFilteredPapers: () => Paper[]
  setSelectedVenue: (venue: Venue) => void
}

type PaperStore = PaperState & PaperActions

export const usePaperStore = create<PaperStore>((set, get) => ({
  papers: [],
  searchQuery: '',
  selectedPaper: null,
  isLoading: false,
  isIndexReady: false,
  selectedVenue: 'VIS',

  loadPapersAndBuildIndex: async () => {
    set({ isLoading: true, isIndexReady: false })

    try {
      // Get the currently selected venue
      const { selectedVenue } = get()
      // console.log('[PaperStore] Loading papers for venue:', selectedVenue)

      // Import all JSON files statically to ensure Vite can resolve them during build
      const papersModules = {
        VIS: () => import('../assets/papers/VIS.json'),
        EuroVis: () => import('../assets/papers/EuroVis.json'),
        CHI: () => import('../assets/papers/CHI.json'),
      }

      const papersModule = await papersModules[selectedVenue]()
      const papersData = papersModule.default as Paper[]
      // console.log('[PaperStore] Loaded', papersData.length, 'papers for', selectedVenue)

      // Initialize search service and build index
      await searchService.initialize(papersData)

      set({
        papers: papersData,
        isLoading: false,
        isIndexReady: true,
      })
      // console.log('[PaperStore] Index built for', selectedVenue)
    } catch (error) {
      console.error('Failed to load papers or build index:', error)
      set({ isLoading: false })
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  selectPaper: (paper) => set({ selectedPaper: paper }),

  getFilteredPapers: () => {
    const { papers, searchQuery } = get()
    if (!searchQuery.trim()) return papers

    // Use the shared search service so default and fallback modes stay consistent.
    return searchService.search(searchQuery).papers
  },

  setSelectedVenue: (venue) => {
    set({ 
      selectedVenue: venue,
      isIndexReady: false,  // Reset index ready state to force reload
      papers: []  // Clear existing papers
    })
    // Note: Data loading is handled by Pond scene's useEffect
  },
}))
