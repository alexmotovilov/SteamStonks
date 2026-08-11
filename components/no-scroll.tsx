"use client"
import { useEffect } from "react"

export function NoScroll() {
  useEffect(() => {
    if (window.innerWidth < 768) return
    const prevBody = document.body.style.overflow
    const prevHtml = document.documentElement.style.overflow
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    const prevent = (e: Event) => e.preventDefault()
    window.addEventListener("wheel", prevent, { passive: false })
    window.addEventListener("touchmove", prevent, { passive: false })
    return () => {
      document.body.style.overflow = prevBody
      document.documentElement.style.overflow = prevHtml
      window.removeEventListener("wheel", prevent)
      window.removeEventListener("touchmove", prevent)
    }
  }, [])
  return null
}
