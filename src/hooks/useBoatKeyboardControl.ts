import { useEffect, useRef } from 'react'
import { useBoatStore } from '../stores/useBoatStore'
import { useCastStore } from '../stores/useCastStore'
import { useSound } from './useSound'
import boatMovingSound from '../assets/sounds/boat-moving.wav'

// Time in seconds before auto-alignment starts (when user has no input)
const ALIGNMENT_IDLE_TIME = 1

export function useBoatKeyboardControl(enabled: boolean = true) {
  const moveForward = useBoatStore((state) => state.moveForward)
  const moveBackward = useBoatStore((state) => state.moveBackward)
  const rotate = useBoatStore((state) => state.rotate)
  const setMoving = useBoatStore((state) => state.setMoving)
  const updateSpeed = useBoatStore((state) => state.updateSpeed)
  const startAlignment = useBoatStore((state) => state.startAlignment)
  const updateAlignment = useBoatStore((state) => state.updateAlignment)
  const cancelAlignment = useBoatStore((state) => state.cancelAlignment)
  
  // Check if currently casting and get cancel function
  const castPosition = useCastStore((state) => state.castPosition)
  const setCastPosition = useCastStore((state) => state.setCastPosition)

  const keysPressed = useRef<Set<string>>(new Set())
  const animationFrameId = useRef<number | undefined>()
  const isPlayingSound = useRef<boolean>(false)
  const hasStartedAlignment = useRef<boolean>(false)
  const lastInputTime = useRef<number>(Date.now())
  const hasSetInitialDirection = useRef<boolean>(false)

  const { play: playBoatSound, pause: pauseBoatSound } = useSound(boatMovingSound)

  useEffect(() => {
    if (!enabled) {
      // Clear keys and stop animation when disabled
      keysPressed.current.clear()
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
        animationFrameId.current = undefined
      }
      if (isPlayingSound.current) {
        pauseBoatSound()
        isPlayingSound.current = false
      }
      return
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
        
        // If currently casting, cancel the cast on first movement key press
        if (castPosition !== null) {
          setCastPosition(null)
          return // Don't register the key press, just cancel the cast
        }
        
        keysPressed.current.add(key)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysPressed.current.delete(key)
    }

    const updateBoat = () => {
      const keys = keysPressed.current
      const state = useBoatStore.getState()
      const currentTime = Date.now()

      // console.log('updateBoat called, keys:', Array.from(keys), 'currentSpeed:', state.currentSpeed)

      // Check if boat is in stationary state (not moving and speed is 0)
      const isStationary = !state.isMoving && state.currentSpeed <= 0.01

      // If user has any input, update last input time and cancel alignment
      if (keys.size > 0) {
        lastInputTime.current = currentTime
        if (state.isAligning) {
          cancelAlignment()
          hasStartedAlignment.current = false
        }

        // Handle first direction key press when stationary
        if (isStationary && !hasSetInitialDirection.current) {
          // Check if any direction key is pressed
          const hasDirectionKey = keys.has('w') || keys.has('s') || keys.has('a') || keys.has('d') ||
                                   keys.has('arrowup') || keys.has('arrowdown') ||
                                   keys.has('arrowleft') || keys.has('arrowright')

          // If a direction key was pressed, mark as moving (keep current rotation)
          if (hasDirectionKey) {
            setMoving(true)
            hasSetInitialDirection.current = true
            // console.log('Started moving from stationary state')
          }
        }
      } else {
        // Reset the initial direction flag when no keys are pressed
        hasSetInitialDirection.current = false
      }

      // Rotation (slow: 3 degrees per frame) - only when already moving
      if (!isStationary || hasSetInitialDirection.current) {
        if (keys.has('a') || keys.has('arrowleft')) {
          rotate(-3)
        }
        if (keys.has('d') || keys.has('arrowright')) {
          rotate(3)
        }
      }

      // Determine target speed and direction based on key state
      let targetSpeed = 0
      let direction: 'forward' | 'backward' | null = null

      if (keys.has('w') || keys.has('arrowup')) {
        targetSpeed = state.speed
        direction = 'forward'
        // console.log('Forward key detected, targetSpeed:', targetSpeed)
      } else if (keys.has('s') || keys.has('arrowdown')) {
        targetSpeed = state.speed
        direction = 'backward'
        // console.log('Backward key detected, targetSpeed:', targetSpeed)
      } else {
        // No movement keys pressed, use last direction for deceleration
        direction = state.lastDirection
      }

      // Update speed with acceleration/deceleration
      updateSpeed(targetSpeed, direction)

      // Move boat using current speed
      const newState = useBoatStore.getState()
      if (newState.currentSpeed > 0.01 && newState.lastDirection) {
        // Move in the last direction while speed is still significant
        if (newState.lastDirection === 'forward') {
          moveForward(newState.currentSpeed)
        } else {
          moveBackward(newState.currentSpeed)
        }

        // Play boat moving sound if not already playing
        if (!isPlayingSound.current) {
          playBoatSound()
          isPlayingSound.current = true
        }
      } else {
        // Stop the sound when boat is stopped
        if (isPlayingSound.current) {
          pauseBoatSound()
          isPlayingSound.current = false
        }
      }

      // Check if boat has stopped and user has been idle
      if (keys.size === 0 && newState.currentSpeed <= 0.01) {
        const idleTime = (currentTime - lastInputTime.current) / 1000 // Convert to seconds

        // Only start alignment if user has been idle for the specified time
        if (!hasStartedAlignment.current && !newState.isAligning && idleTime >= ALIGNMENT_IDLE_TIME) {
          // Start alignment animation
          // console.log('Starting alignment after', idleTime.toFixed(1), 'seconds of idle time')
          startAlignment()
          hasStartedAlignment.current = true
          // Continue animation loop to process alignment
          animationFrameId.current = requestAnimationFrame(updateBoat)
        }
        // Update alignment animation if active
        else if (newState.isAligning || hasStartedAlignment.current) {
          const stillAligning = updateAlignment()
          if (stillAligning) {
            animationFrameId.current = requestAnimationFrame(updateBoat)
          } else {
            // Alignment complete
            animationFrameId.current = undefined
            hasStartedAlignment.current = false
          }
        } else if (idleTime < ALIGNMENT_IDLE_TIME) {
          // Keep animation running while waiting for idle timeout
          animationFrameId.current = requestAnimationFrame(updateBoat)
        } else {
          // Fully stopped and aligned
          animationFrameId.current = undefined
        }
      } else {
        // Continue animation loop if any keys are pressed or boat is still moving
        hasStartedAlignment.current = false
        animationFrameId.current = requestAnimationFrame(updateBoat)
      }
    }

    const handleAnimationStart = () => {
      if (keysPressed.current.size > 0 && !animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(updateBoat)
      }
    }

    // Start animation loop when keys are pressed
    const keyDownWithAnimation = (e: KeyboardEvent) => {
      handleKeyDown(e)
      handleAnimationStart()
    }

    window.addEventListener('keydown', keyDownWithAnimation)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', keyDownWithAnimation)
      window.removeEventListener('keyup', handleKeyUp)
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
      // Stop sound when component unmounts
      if (isPlayingSound.current) {
        pauseBoatSound()
        isPlayingSound.current = false
      }
    }
  }, [enabled, castPosition, moveForward, moveBackward, rotate, setMoving, updateSpeed, playBoatSound, pauseBoatSound, startAlignment, updateAlignment, cancelAlignment])
}
