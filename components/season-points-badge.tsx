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

  // All sizes in vh — scales with viewport, immune to zoom reflow.
  // Reference: 76×76px container at 1080px viewport height = 7vh.
  return (
    <div className="hidden sm:flex items-center relative" style={{ width: "9.3vh", height: "9.3vh" }}>
      <span
        className="absolute inset-0 flex items-end justify-center flex-col font-bold text-cyan-200"
        style={{ paddingBottom: "1.5vh", transform: "translate(calc(-0.7vh - 21px), 19px)" }}
      >
        <span className="flex items-center" style={{ gap: "0.3vh", fontSize: "1.5vh", textShadow: "0 0 8px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)" }}>
          <img
            src="/icons/mana-icon.png"
            alt=""
            style={{
              width: "1.3vh",
              height: "1.3vh",
              objectFit: "contain",
              filter: "drop-shadow(0 0 1px rgba(0,0,0,0.5)) drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
            }}
          />
          {balance.toLocaleString()}
        </span>
      </span>
    </div>
  )
}
