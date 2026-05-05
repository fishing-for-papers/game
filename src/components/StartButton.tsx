import type { ButtonHTMLAttributes, ReactNode } from 'react'

const defaultClasses =
  'px-10 py-5 text-xl font-semibold rounded-full bg-white/90 text-slate-900 shadow-xl hover:bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-white'

type StartButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
}

function StartButton({ className, children, ...props }: StartButtonProps) {
  return (
    <button
      type="button"
      className={`start-button ${className ? `${defaultClasses} ${className}` : defaultClasses}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default StartButton
