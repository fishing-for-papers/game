import { create } from 'zustand'

interface FishingState {
  castTarget: { x: number; y: number } | null
  isCastAnimating: boolean
  setCastTarget: (x: number, y: number) => void
  clearCastTarget: () => void
  setCastAnimating: (isAnimating: boolean) => void
}

export const useFishingStore = create<FishingState>((set) => ({
  castTarget: null,
  isCastAnimating: false,
  setCastTarget: (x: number, y: number) => {
    set({ castTarget: { x, y } })
  },
  clearCastTarget: () => {
    set({ castTarget: null })
  },
  setCastAnimating: (isAnimating) => {
    set({ isCastAnimating: isAnimating })
  },
}))
