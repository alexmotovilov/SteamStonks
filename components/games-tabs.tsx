"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { GameCard, type PredictionData } from "@/components/game-card"
import Link from "next/link"
import { Gamepad2 } from "lucide-react"

type GameRow = {
  id: string
  steam_appid: number
  name: string
  header_image_url: string | null
  release_date: string | null
  release_date_estimated: boolean
  genres: string[] | null
  developer: string | null
  is_released: boolean
  season_id: string | null
  release_time_override?: string | null
  seasons?: {
    id: string
    name: string
    status: string
  } | null
}

interface GamesTabsProps {
  activeGames: GameRow[]
  pastGames: GameRow[]
  allGames: GameRow[]
  predMap: Record<string, PredictionData>
  currentSeasonId: string | null
}

function EmptyState({ message, showNominate = false }: { message: string; showNominate?: boolean }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
        <CardTitle className="text-lg text-foreground mb-2">No Games Here</CardTitle>
        <CardDescription className="text-center text-muted-foreground mb-4">
          {message}
        </CardDescription>
        {showNominate && (
          <Button asChild>
            <Link href="/games/nominate">Nominate a Game</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function GamesTabs({ activeGames, pastGames, allGames, predMap, currentSeasonId }: GamesTabsProps) {
  return (
    <Tabs defaultValue="active" className="space-y-6">
      <TabsList className="bg-secondary">
        <TabsTrigger value="active" className="data-[state=active]:bg-background">
          Active
        </TabsTrigger>
        <TabsTrigger value="past" className="data-[state=active]:bg-background">
          Past
        </TabsTrigger>
        <TabsTrigger value="all" className="data-[state=active]:bg-background">
          All
        </TabsTrigger>
      </TabsList>

      {/* Active — unreleased games in active season, closest release first */}
      <TabsContent value="active" className="space-y-4">
        {activeGames.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                seasonId={currentSeasonId ?? undefined}
                prediction={predMap[game.id] ?? null}
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No upcoming games in the active season." showNominate />
        )}
      </TabsContent>

      {/* Past — released games in active season, most recently released first */}
      <TabsContent value="past" className="space-y-4">
        {pastGames.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pastGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                seasonId={currentSeasonId ?? undefined}
                prediction={predMap[game.id] ?? null}
                dimmed
              />
            ))}
          </div>
        ) : (
          <EmptyState message="No released games in the active season yet." />
        )}
      </TabsContent>

      {/* All — every game across all seasons */}
      <TabsContent value="all" className="space-y-4">
        {allGames.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allGames.map((game) => {
              const isPast = game.seasons?.status &&
                ["completed", "scoring"].includes(game.seasons.status)
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  seasonId={isPast ? game.season_id ?? undefined : currentSeasonId ?? undefined}
                  prediction={!isPast ? predMap[game.id] ?? null : null}
                  dimmed={!!isPast}
                />
              )
            })}
          </div>
        ) : (
          <EmptyState message="No games have been added yet. Be the first to nominate one!" showNominate />
        )}
      </TabsContent>
    </Tabs>
  )
}
