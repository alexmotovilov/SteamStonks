"use client"

import { useEffect, useState } from "react"

export function VendorScaler({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    function update() {
      setScale(Math.min(1, window.innerWidth / 1173))
    }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return (
    <div style={{
      transform: `translateY(175px) scale(${scale})`,
      transformOrigin: "top center",
      position: "relative",
      zIndex: 10,
    }}>
      {children}
    </div>
  )
}
