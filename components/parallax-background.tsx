"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export function ParallaxBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const moteCanvasRef = useRef<HTMLCanvasElement>(null)
  const pathname = usePathname()
  const isHomepage = pathname === "/"
  const isMailbox = pathname === "/mailbox"
  const isVendor = pathname === "/vendor"
  const isGames = pathname === "/games"
  const bgImage = isHomepage ? "/background-extended.png" : "/background.png"
  // How far (in vh) the image slides down over the full page scroll
  const slideVh = isHomepage ? 60 : 8

  useEffect(() => {
    function onScroll() {
      if (!ref.current) return
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      if (maxScroll <= 0) return
      // Slide the image div DOWN — same direction as the user's scroll
      const maxOffset = (slideVh / 100) * window.innerHeight
      const offset = (window.scrollY / maxScroll) * maxOffset
      ref.current.style.transform = `translateY(-${offset}px)`
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [slideVh])

  useEffect(() => {
    if (!isGames) return
    const canvas = moteCanvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    type Mote = {
      x: number; y: number; vx: number; vy: number
      alpha: number; alphaDir: number; alphaSpeed: number
      holdFrames: number
      size: number; hue: number; lightness: number
    }

    const bandTop = () => canvas.height * 0.38
    const bandBot = () => canvas.height * 0.62

    const motes: Mote[] = Array.from({ length: 45 }, () => ({
      x: Math.random() * window.innerWidth,
      y: bandTop() + Math.random() * (bandBot() - bandTop()),
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.15,
      alpha: Math.random(),
      alphaDir: Math.random() > 0.5 ? 1 : -1,
      alphaSpeed: 0.003 + Math.random() * 0.005,
      holdFrames: 0,
      size: 0.8 + Math.random() * 2.4,
      hue: 265 + Math.random() * 45,
      lightness: 65 + Math.random() * 25,
    }))

    let rafId: number
    const draw = () => {
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const m of motes) {
        if (m.holdFrames > 0) {
          m.holdFrames--
        } else {
          m.alpha += m.alphaDir * m.alphaSpeed
          if (m.alpha >= 1) {
            m.alpha = 1; m.alphaDir = -1
            m.holdFrames = 40 + Math.floor(Math.random() * 140)
          }
          if (m.alpha <= 0) {
            m.alpha = 0; m.alphaDir = 1
            m.holdFrames = 20 + Math.floor(Math.random() * 80)
          }
        }
        m.x += m.vx
        m.y += m.vy
        if (m.x < -10) m.x = canvas.width + 10
        if (m.x > canvas.width + 10) m.x = -10
        const bt = bandTop(), bb = bandBot()
        if (m.y < bt) { m.y = bb; m.vy = Math.abs(m.vy) * -1 }
        if (m.y > bb) { m.y = bt; m.vy = Math.abs(m.vy) }

        ctx.save()
        ctx.globalAlpha = m.alpha * 0.75
        ctx.shadowBlur = m.size * 8
        ctx.shadowColor = `hsl(${m.hue}, 85%, ${m.lightness}%)`
        ctx.fillStyle = `hsl(${m.hue}, 95%, ${m.lightness + 12}%)`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      rafId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
    }
  }, [isGames])

  if (isVendor) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0, zIndex: -2, backgroundColor: "#000" }} />
        {/* Lantern glow */}
        <div style={{
          position: "fixed",
          left: "calc(63% - 300px)",
          top: "calc(44% - 185px)",
          width: "600px",
          height: "380px",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(ellipse at center, rgba(255,200,60,0.55) 0%, rgba(255,140,20,0.28) 30%, rgba(200,80,10,0.12) 60%, transparent 80%)",
          filter: "blur(28px)",
          zIndex: 6,
          pointerEvents: "none",
          animation: "lanternFlicker 3.2s ease-in-out infinite",
        }} />
        {/* Fog layers — bottom half of screen */}
        <div style={{ position: "fixed", left: 0, right: 0, top: "50%", bottom: 0, zIndex: 5, pointerEvents: "none", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 70%, transparent 100%)", maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 70%, transparent 100%)" }}>
          <div style={{ position: "absolute", width: "90%", height: "120%", top: "-20%", left: "-5%", background: "radial-gradient(ellipse at center, rgba(190,210,240,0.75) 0%, transparent 65%)", animation: "fogDrift1 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "80%", height: "110%", top: "10%", right: "-5%", background: "radial-gradient(ellipse at center, rgba(170,195,230,0.70) 0%, transparent 65%)", animation: "fogDrift2 17s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "100%", height: "80%", bottom: 0, left: 0, background: "radial-gradient(ellipse at center, rgba(150,180,220,0.80) 0%, transparent 60%)", animation: "fogDrift3 28s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "70%", height: "90%", top: 0, left: "15%", background: "radial-gradient(ellipse at center, rgba(210,220,245,0.65) 0%, transparent 70%)", animation: "fogDrift4 13s ease-in-out infinite" }} />
        </div>
        <div
          className="bag-blur chest-blur"
          style={{
            position: "fixed",
            top: "calc(5% + 35px)",
            right: "5%",
            bottom: "5%",
            left: "5%",
            transform: "scale(1.10)",
            transformOrigin: "center center",
            zIndex: -1,
            opacity: 0.5,
            backgroundImage: "url('/vendor-background.png')",
            backgroundSize: "100.93%",
            backgroundPosition: "calc(50% + 0px) calc(50% + 0px)",
            backgroundRepeat: "no-repeat",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%), linear-gradient(to bottom, transparent 3%, black 25%, black 80%, transparent 97%)",
            WebkitMaskComposite: "destination-in",
            maskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%), linear-gradient(to bottom, transparent 3%, black 25%, black 80%, transparent 97%)",
            maskComposite: "intersect",
          }}
        />
      </>
    )
  }

  if (isMailbox) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0, zIndex: -2, backgroundColor: "#000" }} />
        <div
          style={{
            position: "fixed",
            top: "calc(5% + 35px)",
            right: "5%",
            bottom: "5%",
            left: "5%",
            transform: "scale(1.10)",
            transformOrigin: "center center",
            zIndex: -1,
            opacity: 0.5,
            backgroundImage: "url('/postoffice.png')",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%), linear-gradient(to bottom, transparent 3%, black 25%, black 80%, transparent 97%)",
            WebkitMaskComposite: "destination-in",
            maskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%), linear-gradient(to bottom, transparent 3%, black 25%, black 80%, transparent 97%)",
            maskComposite: "intersect",
          }}
        />
      </>
    )
  }

  if (isGames) {
    return (
      <>
        <div style={{ position: "fixed", inset: 0, zIndex: -2, backgroundColor: "#000" }} />
        {/* Purple glow — behind tablet, blurred radial bloom */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: -1,
            background: "radial-gradient(ellipse 55% 75% at 50% 50%, rgba(130,40,220,0.5) 0%, rgba(90,20,170,0.28) 30%, rgba(50,10,100,0.08) 60%, transparent 80%)",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        {/* Floating energy motes */}
        <canvas
          ref={moteCanvasRef}
          style={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none" }}
        />
        {/* Fog layers — bottom half of screen */}
        <div style={{ position: "fixed", left: 0, right: 0, top: "30vh", bottom: "30vh", zIndex: -1, pointerEvents: "none", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)", maskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%)" }}>
          <div style={{ position: "absolute", width: "90%", height: "120%", top: "-20%", left: "-5%", background: "radial-gradient(ellipse at center, rgba(190,210,240,0.12) 0%, transparent 65%)", animation: "fogDrift1 22s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "80%", height: "110%", top: "10%", right: "-5%", background: "radial-gradient(ellipse at center, rgba(170,195,230,0.10) 0%, transparent 65%)", animation: "fogDrift2 17s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "100%", height: "80%", bottom: 0, left: 0, background: "radial-gradient(ellipse at center, rgba(150,180,220,0.13) 0%, transparent 60%)", animation: "fogDrift3 28s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "70%", height: "90%", top: 0, left: "15%", background: "radial-gradient(ellipse at center, rgba(210,220,245,0.09) 0%, transparent 70%)", animation: "fogDrift4 13s ease-in-out infinite" }} />
        </div>
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: -1,
            pointerEvents: "none",
            opacity: 0.65,
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/prediction-tablet.png"
            alt=""
            style={{ height: "100vh", width: "auto", display: "block", userSelect: "none" }}
            draggable={false}
          />
        </div>
      </>
    )
  }

  return (
    <>
      {/* Solid dark base — fills the gap that appears at the top as the image slides down */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -2,
          backgroundColor: "oklch(0.13 0.01 260)",
        }}
      />
      {/* Background image — slides DOWN with the scroll */}
      <div
        ref={ref}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: `calc(100vh + ${slideVh}vh)`,
          zIndex: -1,
          backgroundImage: `url('${bgImage}')`,
          backgroundSize: "cover",
          backgroundPosition: "center 20%",
          backgroundRepeat: "no-repeat",
          willChange: "transform",
        }}
      />
      {/* Dark overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
        }}
      />
    </>
  )
}
