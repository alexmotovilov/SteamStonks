"use client"

import { useEffect, useState } from "react"

interface CountdownTimerProps {
  releaseDate: string | null
  releaseTimeOverride?: string | null
}

export function CountdownTimer({ releaseDate, releaseTimeOverride }: CountdownTimerProps) {
  const [label, setLabel] = useState<string | null>(null)
  const [classes, setClasses] = useState({ text: "text-muted-foreground/50", border: "border-muted-foreground/20" })
  const target = releaseTimeOverride ?? releaseDate

  useEffect(() => {
    if (!target) return
    function compute() {
      const diff = new Date(target!).getTime() - Date.now()
      if (diff <= 0) { setLabel("releasing now"); setClasses({ text: "text-muted-foreground/50", border: "border-muted-foreground/20" }); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      if (d > 0)      setLabel(`${d}d ${h}h ${m}m`)
      else if (h > 0) setLabel(`${h}h ${m}m ${s}s`)
      else            setLabel(`${m}m ${s}s`)

      if (d < 1)        setClasses({ text: "text-red-400",              border: "border-red-500/40" })
      else if (d <= 7)  setClasses({ text: "text-yellow-400",           border: "border-yellow-500/40" })
      else if (d <= 30) setClasses({ text: "text-emerald-400",          border: "border-emerald-500/40" })
      else              setClasses({ text: "text-muted-foreground/50",   border: "border-muted-foreground/20" })
    }
    compute()
    const t = setInterval(compute, 1000)
    return () => clearInterval(t)
  }, [target])

  if (!label || !target) return null

  return (
    <span className={`font-display text-[11px] tabular-nums px-2 py-0.5 rounded border ${classes.text} ${classes.border}`}>
      {label}
    </span>
  )
}
