"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Zap } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export function SeasonPointsBadge({ user }: { user: SupabaseUser }) {
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()

      if (!season) return

      const { data: preds } = await supabase
        .from("predictions")
        .select("final_points")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .not("final_points", "is", null)

      const total = (preds ?? []).reduce((sum, p) => sum + (p.final_points ?? 0), 0)
      setPoints(total)
    }

    fetch()
  }, [user.id])

  if (points === null) return null

  return (
    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary">
      <Zap className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-foreground">
        {points.toLocaleString()} pts
      </span>
    </div>
  )
}
