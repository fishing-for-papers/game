import type { ReactNode } from 'react'
import { Icon } from '@iconify/react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
  widthVw?: number
}

function Modal({ isOpen, onClose, children, widthVw = 80 }: ModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

      {/* Modal Content */}
      <div
        className="relative h-[80vh] overflow-visible"
        style={{ width: `${widthVw}vw` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative w-full h-full rounded-3xl shadow-lg"
          style={{
            backgroundColor: '#FEFCF7',
            boxShadow: 'inset 0 -4px 0 0 #356072, inset -4px 0 0 0 #356072, inset 4px 0 0 0 #356072, 0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Top left corner border */}
          <div
            className="absolute left-0 top-0 w-16 h-16 rounded-tl-3xl pointer-events-none"
            style={{
              boxShadow: 'inset 4px 0 0 0 #356072, inset 0 4px 0 0 #356072',
            }}
          />
          {/* Top right corner border */}
          <div
            className="absolute right-0 top-0 w-16 h-16 rounded-tr-3xl pointer-events-none"
            style={{
              boxShadow: 'inset -4px 0 0 0 #356072, inset 0 4px 0 0 #356072',
            }}
          />

          {/* Close Button */}
          <div
            onClick={onClose}
            className="absolute bg-[#9EC29A] -top-5 -right-2 p-2 rounded-2xl transition-all hover:bg-opacity-100 hover:rotate-90 hover:scale-110 hover:shadow-lg cursor-pointer z-10"
            role="button"
            aria-label="Close"
            title="Close"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClose()
              }
            }}
          >
            <Icon icon="mdi:close-thick" className="h-6 w-6 text-white" />
          </div>

          {/* Blue circle in bottom-left corner */}
          <div
            className="absolute bg-[#356072]/40 -bottom-2 -left-2 p-3 rounded-full shadow-lg z-10 border-2 border-[#356072]"
            role="presentation"
          />

          {/* Content */}
          <div className="w-full h-full overflow-hidden rounded-3xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Modal
