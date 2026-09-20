import { useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// Bantalan tanda tangan sederhana berbasis <canvas>, tanpa dependensi
// tambahan. Mendukung mouse & sentuhan (touch). onChange dipanggil dengan
// data URL PNG setiap kali pengguna selesai satu goresan.
export default function SignaturePad({ onChange, height = 160 }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const [hasDrawn, setHasDrawn] = useState(false)

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const point = e.touches ? e.touches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  const start = (e) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const move = (e) => {
    if (!drawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current.getContext('2d')
    const { x, y } = getPos(e)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#0f172a'
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    setHasDrawn(true)
    onChange?.(canvasRef.current.toDataURL('image/png'))
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    onChange?.(null)
  }

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-white/20 bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={height}
          className="w-full touch-none rounded-xl"
          style={{ height }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        {!hasDrawn && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Tanda tangan di sini</p>}
      </div>
      <button type="button" onClick={clear} className="mt-2 flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400">
        <Eraser size={13} /> Hapus & Ulangi
      </button>
    </div>
  )
}
