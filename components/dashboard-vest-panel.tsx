"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { VestSeasonButton } from "@/components/vest-season-button"

// Large panel shown on the dashboard for free-entry players who haven't vested.
// Replaces the equipment + ladder columns. Auto-scrolls into view when the
// player arrives from the vendor's "Vest your season entry now." link
// (/dashboard?vest=1) — primarily for mobile, where it sits below the fold.
export function DashboardVestPanel({
  seasonId,
  entryFee,
  tokenBalance,
}: {
  seasonId: string
  entryFee: number
  tokenBalance: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get("vest") === "1" || window.location.hash === "#vest") {
      // Defer a frame so layout has settled before scrolling.
      requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "center" }))
    }
  }, [])

  const benefits = [
    { term: "EQUIPMENT", text: "Equip an artifact that applies a season-long active effect to your predictions. Successful predictions will make this effect even more powerful." },
    { term: "SEASON LADDER", text: "Build and rank your player-count ladder to be scored at the end of the season for a reward of up to +1100 mana and season score." },
    { term: "AUSPICIOUS OMENS", text: "Unlock a new rite that marks games you are certain will place in the final season ladder, for an escalating all-or-nothing reward of up to +920 mana and season score." },
    { term: "WEEKLY MANA STIPEND", text: "Collect a bonus of +15 mana once a week from the vendor to help fund your efforts." },
    { term: "SEASONAL PLACEMENT", text: "Start earning season score on your predictions. Real prizes are awarded to the top prognosticators at the end of the season." },
  ]

  return (
    <div ref={ref} id="vest" className="lg:col-span-2 scroll-mt-24">
      <div className="h-full flex flex-col items-center text-center gap-5 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-[rgba(10,5,25,0.85)] p-6 md:p-8 shadow-xl">
        <div className="space-y-2">
          <h2 className="font-display text-2xl text-white tracking-wide">Vest Your Season Entry</h2>
          <p className="font-body text-sm text-white/90 max-w-lg mx-auto leading-relaxed">
            You are playing on a free entry. Vest into the season anytime to unlock the full game and participate in the season&apos;s player ranking.
          </p>
        </div>

        {/* Benefits */}
        <ul className="w-full max-w-md mx-auto space-y-2.5 text-left">
          {benefits.map(({ term, text }, i) => (
            <li key={i} className="font-body text-[13px] text-purple-100/85 leading-snug pl-4 -indent-4">
              <span className="font-display text-amber-300 tracking-wide">{term}</span>
              <span className="text-purple-100/70">{" — "}{text}</span>
            </li>
          ))}
        </ul>

        {/* Token balance */}
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-2">
          <span className="font-display text-[10px] uppercase tracking-widest text-amber-300/70">Your Tokens:</span>
          <span className="font-display text-lg text-amber-300 leading-none">{tokenBalance}</span>
        </div>

        {/* Vest flow (equipment selection modal + confirm) */}
        <VestSeasonButton seasonId={seasonId} entryFee={entryFee} currentBalance={tokenBalance} />

        {/* Token purchase — interface pending */}
        <p className="text-xs text-muted-foreground">
          Need more tokens?{" "}
          <Link href="/tokens" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
            Purchase tokens →
          </Link>
        </p>
      </div>
    </div>
  )
}
