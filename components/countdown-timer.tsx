"use client"

import { useEffect, useState } from "react"

interface CountdownTimerProps {
  releaseDate: string | null
  releaseTimeOverride?: string | null
}

export function CountdownTimer({ releaseDate, releaseTimeOverride }: CountdownTimerProps) {
  const [label, setLabel] = useState<string | null>(null)
  const target = releaseTimeOverride ?? releaseDate

  useEffect(() => {
    if (!target) return
    function compute() {
      const diff = new Date(target!).getTime() - Date.now()
      if (diff <= 0) { setLabel("releasing now"); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (d > 0)      setLabel(`${d}d ${h}h ${m}m`)
      else if (h > 0) setLabel(`${h}h ${m}m ${s}s`)
      else            setLabel(`${m}m ${s}s`)
    }
    compute()
    const t = setInterval(compute, 1000)
    return () => clearInterval(t)
  }, [target])

  if (!label || !target) return null

  return (
    <span className="font-display text-[9px] text-muted-foreground/50 tabular-nums">
      {label}
    </span>
  )
}
