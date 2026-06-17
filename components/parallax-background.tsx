"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export function ParallaxBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const isHomepage = pathname === "/"
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
