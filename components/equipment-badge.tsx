"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const EQUIPMENT_IMAGES: Record<string, string> = {
  seers_spectacles:   "/equipment/seers-spectacles.png",
  arcanum_esoterica:  "/equipment/arcanum-esoterica.png",
  clockwork_familiar: "/equipment/clockwork-familiar.png",
}

const EQUIPMENT_THEME: Record<string, { bg: string; border: string; text: string }> = {
  seers_spectacles:   { bg: "bg-emerald-950/40", border: "border-emerald-500/20", text: "text-emerald-400" },
  arcanum_esoterica:  { bg: "bg-cyan-950/40",    border: "border-cyan-500/20",    text: "text-cyan-300"   },
  clockwork_familiar: { bg: "bg-amber-950/40",   border: "border-amber-500/20",   text: "text-amber-400"  },
}

interface BadgeData {
  slug: string
  tierScore: number
  rank: number
  manaEarned: number
}

export function EquipmentBadge({ user }: { user: SupabaseUser }) {
  const [data, setData] = useState<BadgeData | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()

      if (!season) return

      const { data: entry } = await supabase
        .from("season_entries")
        .select("equipment_id, equipment_tier_score, season_score")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .single()

      if (!entry?.equipment_id) return

      const manaEarned = entry.season_score ?? 0

      const { count } = await supabase
        .from("season_entries")
        .select("*", { count: "exact", head: true })
        .eq("season_id", season.id)
        .gt("season_score", manaEarned)

      setData({
        slug:       entry.equipment_id as string,
        tierScore:  entry.equipment_tier_score ?? 0,
        rank:       (count ?? 0) + 1,
        manaEarned,
      })
    }
    load()
  }, [user.id])

  if (!data) return null

  const tier  = data.tierScore <= 1 ? "I" : data.tierScore <= 4 ? "II" : "III"
  const image = EQUIPMENT_IMAGES[data.slug]
  const theme = EQUIPMENT_THEME[data.slug] ?? { bg: "bg-purple-950/40", border: "border-purple-500/20", text: "text-purple-300" }
  const showRank = data.manaEarned > 0

  return (
    <div className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md border ${theme.bg} ${theme.border}`}>
      {/* Equipment: image + tier */}
      {image && (
        <img src={image} alt={data.slug} width={18} height={18} className="rounded object-cover shrink-0" />
      )}
      <span className={`font-display text-[10px] leading-none ${theme.text}`}>Tier {tier}</span>

      {/* Divider */}
      {showRank && <div className="w-px h-3 bg-white/20" />}

      {/* Rank + mana earned */}
      {showRank && (
        <div className="flex flex-col items-center gap-px">
          <span className="font-display text-[10px] text-[#9D84D4] leading-none">#{data.rank}</span>
          <span className="font-display text-[8px] text-muted-foreground leading-none">
            {data.manaEarned.toLocaleString()} pts
          </span>
        </div>
      )}
    </div>
  )
}
