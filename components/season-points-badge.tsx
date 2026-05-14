"use client"

import { useEffect, useState } from "react"
import { ManaIcon } from "@/components/mana-icon"

interface SeasonPointsBadgeProps {
  manaBalance: number | null
}

export function SeasonPointsBadge({ manaBalance }: SeasonPointsBadgeProps) {
  const [balance, setBalance] = useState<number | null>(manaBalance)

  // Sync whenever the server layout re-renders (e.g. after router.refresh())
  useEffect(() => {
    setBalance(manaBalance)
  }, [manaBalance])

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
