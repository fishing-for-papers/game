import type { ButtonHTMLAttributes, ReactNode } from 'react'

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'p-1.5',
  md: 'p-2',
  lg: 'p-3',
}

function IconButton({
  children,
  className,
  size = 'md',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`back-button no-focus-ring inline-flex items-center justify-center rounded-full border !border-white/80 !bg-white/85 !text-slate-900 shadow-lg transition hover:!bg-white ${sizeClasses[size]} ${className || ''}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default IconButton
