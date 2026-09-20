import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ onClose, children, labelledBy }) {
  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-navy-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="glass-panel relative my-8 w-full max-w-4xl rounded-3xl border border-cyan-royal/30 p-1 shadow-blue-glow">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute -top-3 -right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-gold/50 bg-navy-900 text-gold-soft shadow-gold-glow hover:bg-navy-800"
        >
          <X size={18} />
        </button>
        <div className="max-h-[85vh] overflow-y-auto rounded-[1.35rem] p-5 sm:p-8">{children}</div>
      </div>
    </div>
  )
}
