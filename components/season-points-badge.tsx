"use client"

import { useEffect, useState } from "react"

interface SeasonPointsBadgeProps {
  manaBalance: number | null
}

export function SeasonPointsBadge({ manaBalance }: SeasonPointsBadgeProps) {
  const [balance, setBalance] = useState<number | null>(manaBalance)

  useEffect(() => {
    setBalance(manaBalance)
  }, [manaBalance])

  if (balance === null) return null

  return (
    <div className="hidden sm:flex items-center relative" style={{ width: 76, height: 76 }}>
      <img
        src="/icons/mana-flask-mini.png"
        alt="Mana"
        style={{ width: 80, height: 80, objectFit: "contain", WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)", maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)" }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center gap-0.5 text-xs font-bold text-cyan-200"
        style={{ paddingTop: "30px", transform: "translateX(-5px)", textShadow: "0 0 8px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)" }}
      >
        <img
          src="/icons/mana-icon.png"
          alt=""
          style={{ width: 11, height: 11, objectFit: "contain", filter: "drop-shadow(0 0 1px rgba(0,0,0,0.5)) drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }}
        />
        {balance.toLocaleString()}
      </span>
    </div>
  )
}
