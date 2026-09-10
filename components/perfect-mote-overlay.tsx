"use client"

import { useRef, useEffect } from "react"

interface Props {
  delay: number       // seconds to wait before starting (matches shimmer end)
  shimmerKey?: number // increment to restart the effect
  visible?: boolean   // fade out on hover/expand
}

export function PerfectMoteOverlay({ delay, shimmerKey = 0, visible = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let rafId: number

    const timeoutId = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      canvas.width  = W
      canvas.height = H

      const cx = W / 2
      const cy = H / 2
      const R  = Math.min(W, H) * 0.42

      function randomInCircle() {
        const r = R * Math.sqrt(Math.random())
        const θ = Math.random() * Math.PI * 2
        return { x: cx + r * Math.cos(θ), y: cy + r * Math.sin(θ) }
      }

      type Mote = {
        x: number; y: number
        alpha: number; alphaDir: number; alphaSpeed: number; holdFrames: number
        size: number; hue: number
      }

      const motes: Mote[] = Array.from({ length: 18 }, () => ({
        ...randomInCircle(),
        alpha: Math.random(),
        alphaDir: Math.random() > 0.5 ? 1 : -1,
        alphaSpeed: 0.004 + Math.random() * 0.007,
        holdFrames: Math.floor(Math.random() * 120),
        size: 0.5 + Math.random() * 1.5,
        hue: 38 + Math.random() * 16,
      }))

      const draw = () => {
        ctx.clearRect(0, 0, W, H)
        for (const m of motes) {
          if (m.holdFrames > 0) { m.holdFrames--; continue }

          m.alpha += m.alphaDir * m.alphaSpeed
          if (m.alpha >= 1) {
            m.alpha = 1; m.alphaDir = -1
            m.holdFrames = 30 + Math.floor(Math.random() * 100)
          }
          if (m.alpha <= 0) {
            m.alpha = 0; m.alphaDir = 1
            ;({ x: m.x, y: m.y } = randomInCircle())
            m.holdFrames = Math.floor(Math.random() * 60)
          }

          ctx.save()
          ctx.globalAlpha = m.alpha
          ctx.shadowBlur   = m.size * 20
          ctx.shadowColor  = `hsl(${m.hue}, 100%, 65%)`
          ctx.fillStyle    = `hsl(${m.hue}, 95%, 55%)`
          ctx.beginPath()
          ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
        rafId = requestAnimationFrame(draw)
      }

      draw()
    }, delay * 1000)

    return () => {
      clearTimeout(timeoutId)
      cancelAnimationFrame(rafId)
    }
  }, [shimmerKey, delay])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.2s ease",
        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        maskImage: "linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%)",
        WebkitMaskComposite: "destination-in",
        maskComposite: "intersect",
      }}
    />
  )
}
