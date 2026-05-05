import type { ButtonHTMLAttributes, ReactNode } from 'react'

const defaultClasses =
  'px-4 py-2 text-sm font-semibold rounded-full !bg-white/85 !text-slate-900 shadow-lg hover:!bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:!bg-white/85'

const grayClasses =
  'px-4 py-2 text-sm font-semibold rounded-full !bg-slate-200/85 !text-slate-900 shadow-lg hover:!bg-slate-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-slate-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:!bg-slate-200/85'

const redClasses =
  'px-4 py-2 text-sm font-semibold rounded-full !bg-red-400/85 !text-white shadow-lg hover:!bg-red-400 focus-visible:outline focus-visible:outline-4 focus-visible:outline-red-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:!bg-red-400/85'

type BaseBackButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick' | 'className'
> & {
  children?: ReactNode
  className?: string
  variant?: 'white' | 'gray' | 'red'
}

type BackButtonNavigateProps<TTarget extends string> = BaseBackButtonProps & {
  target: TTarget
  onNavigate: (target: TTarget) => void
  onClick?: never
}

type BackButtonActionProps = BaseBackButtonProps & {
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick']
  target?: never
  onNavigate?: never
}

export type BackButtonProps<TTarget extends string> =
  | BackButtonNavigateProps<TTarget>
  | BackButtonActionProps

function BackButton<TTarget extends string>({
  target,
  onNavigate,
  onClick,
  className,
  children,
  variant = 'white',
  ...props
}: BackButtonProps<TTarget>) {
  let baseClasses = defaultClasses
  if (variant === 'gray') baseClasses = grayClasses
  if (variant === 'red') baseClasses = redClasses

  const handleClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'] = (event) => {
    if (onClick) {
      onClick(event)
      return
    }
    if (target !== undefined && onNavigate) {
      onNavigate(target)
    }
  }

  return (
    <button
      type="button"
      className={`back-button ${className ? `${baseClasses} ${className}` : baseClasses}`}
      onClick={handleClick}
      {...props}
    >
      {children ?? 'Back'}
    </button>
  )
}

export default BackButton