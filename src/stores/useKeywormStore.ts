import { create } from 'zustand'

interface KeywormState {
  keywords: string[]
}

interface KeywormActions {
  addKeyword: (keyword: string) => void
  removeKeyword: (keyword: string) => void
  clearKeywords: () => void
  setKeywords: (keywords: string[]) => void
}

type KeywormStore = KeywormState & KeywormActions

export const useKeywormStore = create<KeywormStore>((set, get) => ({
  keywords: [],

  addKeyword: (keyword) => {
    const { keywords } = get()
    if (!keywords.includes(keyword)) {
      set({ keywords: [...keywords, keyword] })
    }
  },

  removeKeyword: (keyword) => {
    const { keywords } = get()
    set({ keywords: keywords.filter((k) => k !== keyword) })
  },

  clearKeywords: () => {
    set({ keywords: [] })
  },

  setKeywords: (keywords) => {
    set({ keywords: keywords })
  },
}))
