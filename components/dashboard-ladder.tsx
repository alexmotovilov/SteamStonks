"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface LadderGame {
  id: string
  name: string
  header_image_url: string | null
  is_released: boolean
}

export function DashboardLadder({
  games,
  aoGameIds,
}: {
  games: LadderGame[]
  aoGameIds: string[]
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const aoSet = new Set(aoGameIds)
  const count = games.length
  const baseHeight = Math.max(40, 104 - (count - 1) * 8)

  return (
    <Card className="border-purple-500/20 bg-purple-950/[0.08]">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground tracking-widest uppercase">Season Ladder</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 pt-0">
        {games.length === 0 ? (
          <p className="text-xs text-muted-foreground font-body text-center py-4">
            No ladder set — visit a game's prediction card to rank it.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {games.map((game, idx) => {
              const isAo = aoSet.has(game.id)
              const isHovered = hoveredIdx === idx

              return (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="flex items-center gap-2"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                >
                  <span className="font-display text-[10px] text-muted-foreground/60 w-4 shrink-0 text-right leading-none">
                    {idx + 1}
                  </span>
                  <div
                    className="relative w-full rounded overflow-hidden border border-white/8 bg-secondary"
                    style={{
                      maxHeight: isHovered ? "300px" : `${baseHeight}px`,
                      transition: "max-height 0.25s ease",
                    }}
                  >
                    {game.header_image_url && (
                      <img
                        src={game.header_image_url}
                        alt={game.name}
                        className={`w-full h-auto block transition-transform duration-200 ${isHovered ? "scale-105" : "scale-100"} ${game.is_released ? "grayscale opacity-60" : ""}`}
                      />
                    )}
                    {isAo && (
                      <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-black/80 border border-amber-400 flex items-center justify-center shadow-[0_0_4px_rgba(251,191,36,0.5)]">
                        <span className="text-[7px] text-violet-400 leading-none">★</span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
