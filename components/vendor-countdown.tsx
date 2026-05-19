"use client"

import { useEffect, useState } from "react"

function getNextReset(): Date {
  const now = new Date()
  const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon, …, 6=Sat
  // Days until next Monday; if today is Monday (already past 00:00) push to next week
  let daysToAdd = (1 - dayOfWeek + 7) % 7
  if (daysToAdd === 0) daysToAdd = 7
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + daysToAdd,
    0, 0, 0, 0
  ))
}

function formatDiff(ms: number): string {
  if (ms <= 0) return "Restocking…"
  const totalSecs = Math.floor(ms / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export function VendorCountdown() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    function tick() {
      setLabel(formatDiff(getNextReset().getTime() - Date.now()))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!label) return null

  return (
    <p className="font-display text-[11px] text-muted-foreground/60 tracking-widest mt-1">
      Restocks in{" "}
      <span className="text-amber-400/80">{label}</span>
    </p>
  )
}
