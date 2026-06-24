"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"

export function ParallaxBackground() {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const isHomepage = pathname === "/"
  const isMailbox = pathname === "/mailbox"
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
            backgroundImage: "url('/postoffice.png')",
            backgroundSize: "cover",
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 8%, black 80%, transparent 100%)",
            WebkitMaskComposite: "destination-in",
            maskImage: "linear-gradient(to right, transparent 0%, black 4%, black 96%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 8%, black 80%, transparent 100%)",
            maskComposite: "intersect",
          }}
        />
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
