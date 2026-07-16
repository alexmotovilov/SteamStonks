"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface SeasonScoreBadgeProps {
  user: SupabaseUser
  activeSeasonId: string | null
}

export function SeasonScoreBadge({ user, activeSeasonId }: SeasonScoreBadgeProps) {
  const [score, setScore] = useState<number | null>(null)
  const [rank, setRank] = useState<number | null>(null)

  useEffect(() => {
    if (!activeSeasonId) return
    const supabase = createClient()

    async function fetchData() {
      const { data: entry } = await supabase
        .from("season_entries")
        .select("prediction_mana_earned")
        .eq("user_id", user.id)
        .eq("season_id", activeSeasonId!)
        .single()

      if (!entry) return
      setScore(entry.prediction_mana_earned)

      const { count } = await supabase
        .from("season_entries")
        .select("*", { count: "exact", head: true })
        .eq("season_id", activeSeasonId!)
        .gt("prediction_mana_earned", entry.prediction_mana_earned)

      setRank((count ?? 0) + 1)
    }

    fetchData()
  }, [user.id, activeSeasonId])

  // All sizes in vh/vw — scales with viewport, immune to zoom reflow.
  // Reference: 84×92px badge at 1080px viewport height = 7.8vh × 8.5vh.
  return (
    <div
      className="hidden sm:flex items-center relative"
      style={{ width: "10.4vh", height: "11.3vh", marginRight: "-3.3vh", zIndex: 2 }}
    >
      <img
        src="/icons/season-score-scroll.png"
        alt="Season Score"
        style={{
          width: "10.4vh",
          height: "11.3vh",
          objectFit: "contain",
          marginTop: "0.3vh",
          WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 80%, transparent 100%)",
        }}
      />
      {score !== null && rank !== null && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-end font-display"
          style={{ paddingBottom: "2.5vh" }}
        >
          <span
            className="text-amber-900 font-bold leading-none"
            style={{ fontSize: "1.3vh", textShadow: "0 0 6px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.3)" }}
          >
            #{rank}
          </span>
          <span className="flex items-center leading-none" style={{ gap: "0.3vh" }}>
            <img
              src="/icons/season-score-icon.png"
              alt=""
              style={{ width: "1.2vh", height: "1.2vh", opacity: 0.6, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))" }}
            />
            <span
              className="text-amber-900 font-semibold leading-none"
              style={{ fontSize: "1.25vh", textShadow: "0 0 6px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.3)" }}
            >
              {score.toLocaleString()}
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
