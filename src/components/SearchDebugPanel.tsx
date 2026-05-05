import { useState } from 'react'
import { searchService } from '../services/searchService'
import type { Paper } from '../types/paper'

interface SearchDebugPanelProps {
  isOpen: boolean
  onClose: () => void
}

function SearchDebugPanel({ isOpen, onClose }: SearchDebugPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Paper[]>([])
  const [searchTime, setSearchTime] = useState<number>(0)
  const SEARCH_LIMIT = 50

  const handleSearch = (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      setSearchResults([])
      setSearchTime(0)
      return
    }

    const startTime = performance.now()
    const results = searchService.search(query, SEARCH_LIMIT)
    const endTime = performance.now()

    setSearchResults(results)
    setSearchTime(endTime - startTime)
  }

  if (!isOpen) return null

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 flex justify-between items-center">
        <h2 className="text-lg font-semibold">FlexSearch Debug Panel</h2>
        <button
          onClick={onClose}
          className="text-gray-800 hover:text-gray-300 text-2xl leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search papers..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <div className="mt-2 text-sm text-gray-600">
            Found {searchResults.length} results in {searchTime.toFixed(2)}ms
            <span className="ml-2 text-gray-500">(limit: {SEARCH_LIMIT})</span>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-4">
        {searchResults.length === 0 && searchQuery && (
          <div className="text-gray-500 text-center py-8">No results found</div>
        )}
        {searchResults.length === 0 && !searchQuery && (
          <div className="text-gray-500 text-center py-8">
            Enter a search query to see results
          </div>
        )}
        <div className="space-y-3">
          {searchResults.map((paper, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
            >
              <div className="font-semibold text-sm text-gray-900 mb-1">
                {paper.title}
              </div>
              <div className="text-xs text-gray-600 mb-1">
                {paper.authorNamesDeduped}
              </div>
              <div className="text-xs text-gray-500">
                {paper.conference} {paper.year}
              </div>
              {paper.authorKeywords && (
                <div className="text-xs text-blue-600 mt-1">
                  Keywords: {paper.authorKeywords}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
        <div>Total papers indexed: {searchService.getAllPapers().length}</div>
        <div>Index ready: {searchService.isReady() ? 'Yes' : 'No'}</div>
      </div>
    </div>
  )
}

export default SearchDebugPanel
