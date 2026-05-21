"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface Props {
  user: SupabaseUser
  href: string
  className: string
  children: React.ReactNode
}

export function PendingPredictionsIndicator({ user, href, className, children }: Props) {
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()

      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()

      if (!season) return

      // Games are linked via season_id column directly on the games table
      const { data: unreleasedGames } = await supabase
        .from("games")
        .select("id")
        .eq("season_id", season.id)
        .eq("is_released", false)

      if (!unreleasedGames?.length) return

      const unreleasedIds = unreleasedGames.map(g => g.id)

      const { data: predictions } = await supabase
        .from("predictions")
        .select("game_id")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .in("game_id", unreleasedIds)

      const predicted = new Set((predictions ?? []).map(p => p.game_id))
      setHasPending(unreleasedIds.some(id => !predicted.has(id)))
    }

    check()
  }, [user.id])

  if (!hasPending) {
    return <Link href={href} className={className}>{children}</Link>
  }

  return (
    <Link
      href={href}
      className={`${className} rounded px-2 py-0.5`}
      style={{
        outline: "1.5px solid rgba(34,197,94,0.5)",
        outlineOffset: "2px",
        animation: "pulse-border 2s ease-in-out infinite",
      }}
    >
      {children}
    </Link>
  )
}
