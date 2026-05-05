import { create } from 'zustand'

interface BoatState {
  // Position in SVG coordinates
  position: { x: number; y: number }
  // Rotation angle in degrees (0 = facing right/east)
  rotation: number
  // Movement state
  isMoving: boolean
  speed: number // Target speed
  currentSpeed: number // Actual speed (with acceleration/deceleration)
  acceleration: number // Acceleration rate
  lastDirection: 'forward' | 'backward' | null // Last movement direction
  // Alignment state (for aligning to left/right when stopped)
  isAligning: boolean
  targetAlignment: number | null // Target angle for alignment (0 or 180)
}

interface BoatActions {
  setPosition: (x: number, y: number) => void
  setRotation: (angle: number) => void
  rotate: (delta: number) => void // Rotate by delta degrees
  moveForward: (distance: number) => void
  moveBackward: (distance: number) => void
  setMoving: (moving: boolean) => void
  setSpeed: (speed: number) => void
  updateSpeed: (targetSpeed: number, direction?: 'forward' | 'backward' | null) => void // Update current speed with acceleration/deceleration
  startAlignment: () => void // Start alignment animation to nearest horizontal direction
  updateAlignment: () => boolean // Update alignment animation, returns true if still aligning
  cancelAlignment: () => void // Cancel alignment animation
}

type BoatStore = BoatState & BoatActions

export const useBoatStore = create<BoatStore>((set, get) => ({
  // Initial state - boat starts at center
  position: { x: 200, y: 100 },
  rotation: 0,
  isMoving: false,
  speed: 2,
  currentSpeed: 0, // Start from 0 speed
  acceleration: 0.05, // Acceleration rate per frame
  lastDirection: null, // No initial direction
  isAligning: false,
  targetAlignment: null,

  setPosition: (x, y) => set({ position: { x, y } }),

  setRotation: (angle) => set({ rotation: angle }),

  rotate: (delta) => {
    const { rotation } = get()
    const newRotation = rotation + delta
    set({ rotation: newRotation })
  },

  moveForward: (distance) => {
    const { position, rotation } = get()
    const rad = (rotation * Math.PI) / 180
    const x = position.x + Math.cos(rad) * distance
    const y = position.y + Math.sin(rad) * distance
    // console.log('moveForward:', { rotation, x, y, from: position })
    set({ position: { x, y } })
  },

  moveBackward: (distance) => {
    const { position, rotation } = get()
    const rad = (rotation * Math.PI) / 180
    const x = position.x - Math.cos(rad) * distance
    const y = position.y - Math.sin(rad) * distance
    // console.log('moveBackward:', { rotation, x, y, from: position })
    set({ position: { x, y } })
  },

  setMoving: (moving) => set({ isMoving: moving }),

  setSpeed: (speed) => set({ speed }),

  updateSpeed: (targetSpeed, direction = null) => {
    const { currentSpeed, acceleration, isMoving: currentIsMoving } = get()
    let newSpeed = currentSpeed

    if (Math.abs(targetSpeed - currentSpeed) < acceleration) {
      // Close enough, snap to target
      newSpeed = targetSpeed
    } else if (targetSpeed > currentSpeed) {
      // Accelerate
      newSpeed = currentSpeed + acceleration
    } else if (targetSpeed < currentSpeed) {
      // Decelerate
      newSpeed = currentSpeed - acceleration
    }

    // Only set isMoving to true when starting to move
    // Never set it to false here (only alignment completion does that)
    const updates: any = {
      currentSpeed: newSpeed,
      lastDirection: newSpeed > 0.01 ? direction : null, // Clear direction when stopped
    }

    if (newSpeed > 0.01 && !currentIsMoving) {
      updates.isMoving = true
      // console.log('isMoving changed:', true, '(speed:', newSpeed.toFixed(2), ')')
    }

    set(updates)
  },

  startAlignment: () => {
    const { rotation } = get()

    // Normalize rotation to 0-360 range
    const normalizedRotation = ((rotation % 360) + 360) % 360

    // Determine nearest horizontal direction (0 = right, 180 = left)
    // If angle is between 90 and 270, align to left (180), otherwise align to right (0)
    const targetAlignment = normalizedRotation > 90 && normalizedRotation < 270 ? 180 : 0

    // console.log('Start alignment:', { currentRotation: normalizedRotation, targetAlignment })

    set({
      isAligning: true,
      targetAlignment
      // Don't change isMoving here - it stays true until alignment completes
    })
  },

  updateAlignment: () => {
    const { rotation, targetAlignment, isAligning } = get()

    if (!isAligning || targetAlignment === null) {
      return false
    }

    // Normalize current rotation
    const normalizedRotation = ((rotation % 360) + 360) % 360

    // Calculate shortest angular distance
    let diff = targetAlignment - normalizedRotation

    // Adjust diff to take shortest path
    if (diff > 180) {
      diff -= 360
    } else if (diff < -180) {
      diff += 360
    }

    // Rotation speed for alignment (degrees per frame)
    const alignmentSpeed = 2

    // If close enough, snap to target and finish alignment
    if (Math.abs(diff) < alignmentSpeed) {
      // console.log('Alignment complete at:', targetAlignment)
      // console.log('isMoving changed:', false, '(alignment complete)')

      set({
        rotation: targetAlignment,
        isAligning: false,
        targetAlignment: null,
        isMoving: false // Set to static after alignment completes
      })
      return false
    }

    // Rotate towards target
    const delta = diff > 0 ? alignmentSpeed : -alignmentSpeed
    set({ rotation: rotation + delta })

    return true // Still aligning
  },

  cancelAlignment: () => {
    set({
      isAligning: false,
      targetAlignment: null
    })
  },
}))
