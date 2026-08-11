"use client"

import { useState, useCallback, useEffect } from "react"
import { GamesRolodex } from "@/components/games-rolodex"
import { MobileGamesRolodex } from "@/components/mobile-games-rolodex"
import { GamePredictionPanel } from "@/components/game-prediction-panel"
import type { PredictionData } from "@/components/game-card"

interface GamesPageClientProps {
  games: { id: string; name: string; header_image_url: string | null; header_image_position?: string | null; release_date: string | null; release_time_override?: string | null; is_released: boolean }[]
  predMap: Record<string, PredictionData>
  currentSeasonId: string | null
}

export function GamesPageClient({ games, predMap, currentSeasonId }: GamesPageClientProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null)
  const [isPanelDirty, setIsPanelDirty] = useState(false)
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const handleSelectGame = useCallback((gameId: string) => {
    if (selectedGameId === gameId) return
    if (selectedGameId && isPanelDirty) {
      setPendingSwitch(gameId)
      return
    }
    setIsPanelDirty(false)
    setSelectedGameId(gameId)
  }, [selectedGameId, isPanelDirty])

  return (
    <>
      {isMobile ? (
        <MobileGamesRolodex
          games={games}
          predMap={predMap}
          onSelect={handleSelectGame}
        />
      ) : (
        <GamesRolodex
          games={games}
          predMap={predMap}
          currentSeasonId={currentSeasonId}
          onSelect={handleSelectGame}
        />
      )}
      {selectedGameId && currentSeasonId && (
        <GamePredictionPanel
          gameId={selectedGameId}
          seasonId={currentSeasonId}
          onClose={() => { setSelectedGameId(null); setIsPanelDirty(false) }}
          onDirtyChange={setIsPanelDirty}
          pendingSwitchId={pendingSwitch}
          onSwitchConfirm={() => {
            const next = pendingSwitch!
            setPendingSwitch(null)
            setIsPanelDirty(false)
            setSelectedGameId(next)
          }}
          onSwitchCancel={() => setPendingSwitch(null)}
        />
      )}
    </>
  )
}
