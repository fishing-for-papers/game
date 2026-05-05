import type { ButtonHTMLAttributes } from 'react'
import { useDebugStore } from '../stores/useDebugStore'

const defaultClasses =
  'px-4 py-2 text-sm font-semibold rounded-full shadow-lg focus-visible:outline focus-visible:outline-4 focus-visible:outline-white transition-colors'

export type DebugButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> & {
  className?: string
}

function DebugButton({ className, ...props }: DebugButtonProps) {
  const { isDebugMode, toggleDebugMode } = useDebugStore()

  return (
    <button
      type="button"
      className={`debug-button ${className ? `${defaultClasses} ${className}` : defaultClasses}`}
      onClick={toggleDebugMode}
      title={isDebugMode ? 'Debug mode ON' : 'Debug mode OFF'}
      {...props}
    >
      Debug: {isDebugMode ? 'ON' : 'OFF'}
    </button>
  )
}

export default DebugButton
