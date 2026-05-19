"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  seasons?: {
    id: string
    name: string
    status: string
  } | null
}

type SeasonRow = {
  id: string
  name: string
  status: string
}

interface GamesTabsProps {
  currentSeason: SeasonRow | null
  currentSeasonGames: GameRow[]
  pastSeasonGames: GameRow[]
  allGames: GameRow[]
  predMap: Record<string, PredictionData>
  defaultTab: string
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

export function GamesTabs({
  currentSeason,
  currentSeasonGames,
  pastSeasonGames,
  allGames,
  predMap,
  defaultTab,
}: GamesTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className="space-y-6">
      <TabsList className="bg-secondary">
        {currentSeason && (
          <TabsTrigger value="current" className="data-[state=active]:bg-background">
            {currentSeason.status === "active" ? "Active Season" : "Upcoming Season"}
            {currentSeasonGames.length > 0 && (
              <Badge variant="secondary" className="ml-2 scale-75">
                {currentSeasonGames.length}
              </Badge>
            )}
          </TabsTrigger>
        )}
        {pastSeasonGames.length > 0 && (
          <TabsTrigger value="past" className="data-[state=active]:bg-background">
            Past Seasons
            <Badge variant="outline" className="ml-2 scale-75 opacity-70">
              {pastSeasonGames.length}
            </Badge>
          </TabsTrigger>
        )}
        <TabsTrigger value="all" className="data-[state=active]:bg-background">
          All ({allGames.length})
        </TabsTrigger>
      </TabsList>

      {/* Current Season Tab */}
      {currentSeason && (
        <TabsContent value="current" className="space-y-4">
          {currentSeasonGames.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {currentSeasonGames.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  seasonId={currentSeason.id}
                  prediction={predMap[game.id] ?? null}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              message="No games have been added to this season yet."
              showNominate
            />
          )}
        </TabsContent>
      )}

      {/* Past Seasons Tab */}
      {pastSeasonGames.length > 0 && (
        <TabsContent value="past" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            These games are from completed seasons. Predictions are closed but you can view results.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pastSeasonGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                seasonId={game.season_id ?? undefined}
                dimmed
              />
            ))}
          </div>
        </TabsContent>
      )}

      {/* All Tab */}
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
                  seasonId={isPast ? game.season_id ?? undefined : currentSeason?.id}
                  prediction={!isPast ? predMap[game.id] ?? null : null}
                  dimmed={!!isPast}
                />
              )
            })}
          </div>
        ) : (
          <EmptyState
            message="No games have been added yet. Be the first to nominate one!"
            showNominate
          />
        )}
      </TabsContent>
    </Tabs>
  )
}
