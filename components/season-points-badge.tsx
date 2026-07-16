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
      <img
        src="/icons/mana-flask-mini.png"
        alt="Mana"
        style={{
          width: "9.9vh",
          height: "9.9vh",
          objectFit: "contain",
          WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-bold text-cyan-200"
        style={{
          paddingTop: "3.7vh",
          transform: "translateX(-0.7vh)",
          fontSize: "1.5vh",
          gap: "0.3vh",
          textShadow: "0 0 8px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1)",
        }}
      >
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
    </div>
  )
}
