import type { HTMLAttributes } from 'react'
import { Keyworm } from '../Keyworm'

const defaultClasses =
  'px-4 py-2 text-sm font-semibold'

type GearProps = HTMLAttributes<HTMLDivElement> & {
  onClick?: () => void
}

function Gear({ className, onClick, ...props }: GearProps) {
  return (
    <div
      className={`gear-button ${className ? `${defaultClasses} ${className}` : defaultClasses} cursor-pointer hover:opacity-80 transition-opacity`}
      onClick={onClick}
      {...props}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        width: '100%',
        height: '24px'
      }}>
        <Keyworm size={24} />
      </div>
    </div>
  )
}

export default Gear
