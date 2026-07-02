"use client"
import { useEffect } from "react"

export function NoScroll() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()
    window.addEventListener("wheel", prevent, { passive: false })
    window.addEventListener("touchmove", prevent, { passive: false })
    return () => {
      window.removeEventListener("wheel", prevent)
      window.removeEventListener("touchmove", prevent)
    }
  }, [])
  return null
}
