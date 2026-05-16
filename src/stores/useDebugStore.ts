import { create } from 'zustand'

interface DebugState {
  isDebugMode: boolean
}

interface DebugActions {
  toggleDebugMode: () => void
  setDebugMode: (enabled: boolean) => void
}

type DebugStore = DebugState & DebugActions

export const useDebugStore = create<DebugStore>((set, get) => ({
  isDebugMode: true, // Debug mode is ON by default while tuning catch interactions

  toggleDebugMode: () => {
    set({ isDebugMode: !get().isDebugMode })
  },

  setDebugMode: (enabled) => {
    set({ isDebugMode: enabled })
  },
}))
