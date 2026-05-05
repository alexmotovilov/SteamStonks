"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ManaIcon } from "@/components/mana-icon"
import type { User as SupabaseUser } from "@supabase/supabase-js"

export function SeasonPointsBadge({ user }: { user: SupabaseUser }) {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetch() {
      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()

      if (!season) return

      const { data: entry } = await supabase
        .from("season_entries")
        .select("mana_balance")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .single()

      if (entry) setBalance(entry.mana_balance ?? 0)
    }

    fetch()
  }, [user.id])

  if (balance === null) return null

  return (
    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-950/40 border border-cyan-500/20">
      <ManaIcon size={16} />
      <span className="text-sm font-medium text-cyan-300">
        {balance.toLocaleString()}
      </span>
    </div>
  )
}
