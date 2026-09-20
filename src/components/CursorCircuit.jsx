import { useEffect, useRef } from 'react'

const TRAIL_LENGTH = 26
const NODE_COUNT = 26
const LINK_DISTANCE = 130

// Overlay canvas: garis "grafik" bercahaya yang mengikuti gerak kursor,
// plus titik sirkuit ambient yang terhubung saat kursor mendekat.
export default function CursorCircuit() {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let frameId
    let nodes = []
    const trail = []
    const mouse = { x: width / 2, y: height / 2, active: false }
    let lastMoveAt = 0

    const resize = () => {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      }))
    }

    const onMove = (e) => {
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.active = true
      lastMoveAt = performance.now()
      trail.push({ x: mouse.x, y: mouse.y })
      if (trail.length > TRAIL_LENGTH) trail.shift()
    }
    const onLeave = () => {
      mouse.active = false
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height)

      nodes.forEach((n) => {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1
      })

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(103, 232, 249, ${0.12 * (1 - dist / LINK_DISTANCE)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.stroke()
          }
        }

        if (mouse.active) {
          const dx = nodes[i].x - mouse.x
          const dy = nodes[i].y - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DISTANCE * 1.4) {
            const t = 1 - dist / (LINK_DISTANCE * 1.4)
            ctx.strokeStyle = `rgba(212, 175, 55, ${0.5 * t})`
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.stroke()

            ctx.fillStyle = `rgba(103, 232, 249, ${0.6 * t + 0.15})`
            ctx.beginPath()
            ctx.arc(nodes[i].x, nodes[i].y, 2, 0, Math.PI * 2)
            ctx.fill()
          } else {
            ctx.fillStyle = 'rgba(103, 232, 249, 0.25)'
            ctx.beginPath()
            ctx.arc(nodes[i].x, nodes[i].y, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        } else {
          ctx.fillStyle = 'rgba(103, 232, 249, 0.25)'
          ctx.beginPath()
          ctx.arc(nodes[i].x, nodes[i].y, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      if (mouse.active && trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const t = i / trail.length
          const p0 = trail[i - 1]
          const p1 = trail[i]
          const grad = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y)
          grad.addColorStop(0, `rgba(67, 100, 247, ${0.05 + t * 0.35})`)
          grad.addColorStop(1, `rgba(103, 232, 249, ${0.1 + t * 0.55})`)
          ctx.strokeStyle = grad
          ctx.lineWidth = 1 + t * 2.5
          ctx.lineCap = 'round'
          ctx.beginPath()
          ctx.moveTo(p0.x, p0.y)
          ctx.lineTo(p1.x, p1.y)
          ctx.stroke()
        }

        const head = trail[trail.length - 1]
        if (head) {
          ctx.beginPath()
          ctx.arc(head.x, head.y, 3.5, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(212, 175, 55, 0.9)'
          ctx.shadowColor = 'rgba(212, 175, 55, 0.9)'
          ctx.shadowBlur = 12
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      if (performance.now() - lastMoveAt > 30 && trail.length) {
        trail.shift()
      }

      frameId = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[9999] hidden sm:block" aria-hidden="true" />
}
