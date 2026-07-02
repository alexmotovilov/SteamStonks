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
  if (ms <= 0) return "00:00:00"
  const totalSecs = Math.floor(ms / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  return `${String(d).padStart(2, "0")}:${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function VendorCountdown() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    function tick() {
      setLabel(formatDiff(getNextReset().getTime() - Date.now()))
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [])

  if (!label) return null

  return (
    <span className="font-display text-white tracking-widest" style={{ display: "inline-block", transform: "scaleY(1.5)", transformOrigin: "center center" }}>{label}</span>
  )
}
