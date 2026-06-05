"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

interface SeasonRankBadgeProps {
  user: User
}

interface RankData {
  rank: number
  manaEarned: number
}

export function SeasonRankBadge({ user }: SeasonRankBadgeProps) {
  const [data, setData] = useState<RankData | null>(null)

  useEffect(() => {
    async function fetchRank() {
      const supabase = createClient()

      // Get active/upcoming season
      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .in("status", ["active", "upcoming"])
        .order("start_date", { ascending: false })
        .limit(1)
        .single()

      if (!season) return

      // Get player's mana earned this season
      const { data: entry } = await supabase
        .from("season_entries")
        .select("season_score")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .single()

      if (!entry) return

      const manaEarned = entry.season_score ?? 0

      // Count players ranked above this player
      const { count } = await supabase
        .from("season_entries")
        .select("*", { count: "exact", head: true })
        .eq("season_id", season.id)
        .gt("season_score", manaEarned)

      setData({ rank: (count ?? 0) + 1, manaEarned })
    }

    fetchRank()
  }, [user.id])

  if (!data) return null

  // Show "Unranked" if player has no scored predictions yet
  if (data.manaEarned === 0) {
    return (
      <div className="hidden sm:flex flex-col items-center px-3 py-1 rounded-md bg-purple-950/40 border border-purple-500/20">
        <span className="font-display text-xs text-[#9D84D4] leading-tight">Unranked</span>
      </div>
    )
  }

  return (
    <div className="hidden sm:flex flex-col items-center px-3 py-1 rounded-md bg-purple-950/40 border border-purple-500/20">
      <span className="font-display text-xs text-[#9D84D4] leading-tight">#{data.rank}</span>
      <span className="font-display text-[10px] text-muted-foreground leading-tight">
        {data.manaEarned.toLocaleString()} mana
      </span>
    </div>
  )
}
