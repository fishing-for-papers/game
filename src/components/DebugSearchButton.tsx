import type { ButtonHTMLAttributes } from 'react'

export type DebugSearchButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> & {
  onClick: () => void
  className?: string
}

function DebugSearchButton({ onClick, className, ...props }: DebugSearchButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-4 rounded-full bg-white/90 hover:bg-white shadow-md flex items-center justify-center transition-colors ${className || ''}`}
      title="Toggle search debug panel"
      {...props}
    >
      debug search
    </button>
  )
}

export default DebugSearchButton
