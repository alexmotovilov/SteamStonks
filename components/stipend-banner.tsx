"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"
import { ManaIcon } from "@/components/mana-icon"

interface StipendBannerProps {
  claimable: boolean
  seasonId: string
}

export function StipendBanner({ claimable, seasonId }: StipendBannerProps) {
  const router = useRouter()
  const [localClaimed, setLocalClaimed] = useState(!claimable)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCollect() {
    setClaiming(true)
    setError(null)
    const res = await fetch("/api/vendor/stipend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season_id: seasonId }),
    })
    if (res.ok) {
      setLocalClaimed(true)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? "Failed to collect stipend")
    }
    setClaiming(false)
  }

  if (localClaimed) {
    return (
      <div className="w-[537px] max-w-full mx-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/8 bg-[rgba(15,15,25,0.6)]">
        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <span className="font-display text-[11px] text-muted-foreground/60 tracking-wide">
          Weekly stipend claimed — returns next week
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 w-[537px] max-w-full mx-auto">
      <div className="flex items-center justify-center gap-4 px-4 py-3 rounded-xl border border-cyan-500/20 bg-[rgba(10,20,30,0.7)]">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-[11px] text-cyan-200 tracking-wide">
            Weekly mana stipend available
          </span>
          <div className="flex items-center gap-1">
            <ManaIcon size={13} />
            <span className="font-display text-[11px] text-cyan-300">+15</span>
          </div>
        </div>
        <button
          onClick={handleCollect}
          disabled={claiming}
          className="shrink-0 px-3 py-1.5 rounded-lg font-display text-[11px] border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-950/60 hover:border-cyan-500/60 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
        >
          {claiming && <Loader2 className="h-3 w-3 animate-spin" />}
          {claiming ? "Collecting…" : "Collect"}
        </button>
      </div>
      {error && (
        <p className="text-[10px] text-red-400 font-body text-center">{error}</p>
      )}
    </div>
  )
}
