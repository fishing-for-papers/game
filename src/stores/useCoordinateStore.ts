import { create } from 'zustand'

interface CoordinateState {
  width: number
  height: number
  setDimensions: (width: number, height: number) => void
}

export const useCoordinateStore = create<CoordinateState>((set) => ({
  width: 0,
  height: 0,
  setDimensions: (width, height) => set({ width, height }),
}))
