import { createClient } from "@/lib/supabase/server"
import { GameCard } from "@/components/game-card"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { Search, Plus, Gamepad2 } from "lucide-react"

export default async function GamesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get active/upcoming season (the one players are currently participating in)
  const { data: currentSeason } = await supabase
    .from("seasons")
    .select("*")
    .in("status", ["active", "upcoming"])
    .order("start_date", { ascending: false })
    .limit(1)
    .single()

  // Get all games with their season's status so we can categorise them
  const { data: games } = await supabase
    .from("games")
    .select(`
      *,
      seasons:season_id (
        id,
        name,
        status
      )
    `)
    .order("release_date", { ascending: true })

  // Get user's predictions for the current season
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select("game_id")
    .eq("user_id", user?.id || "")
    .eq("season_id", currentSeason?.id || "")

  const predictedGameIds = new Set(userPredictions?.map((p) => p.game_id) || [])

  // Categorise games
  // Current season: games assigned to the active/upcoming season
  const currentSeasonGames = games?.filter(
    (g) => g.season_id && g.seasons?.status &&
      ["active", "upcoming"].includes(g.seasons.status)
  ) || []

  // Past season: games assigned to completed/scoring seasons
  const pastSeasonGames = games?.filter(
    (g) => g.season_id && g.seasons?.status &&
      ["completed", "scoring"].includes(g.seasons.status)
  ) || []

  // Unassigned: games with no season
  const unassignedGames = games?.filter((g) => !g.season_id) || []

  // All tab shows everything
  const allGames = games || []

  // Default to current season tab if there is one, otherwise all
  const defaultTab = currentSeason ? "current" : "all"

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Games</h1>
          <p className="text-muted-foreground">
            Browse games and make your predictions
          </p>
        </div>
        <Button asChild>
          <Link href="/games/nominate">
            <Plus className="mr-2 h-4 w-4" />
            Nominate a Game
          </Link>
        </Button>
      </div>

      {/* Active Season Banner */}
      {currentSeason && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge>{currentSeason.status === "active" ? "Active Season" : "Upcoming Season"}</Badge>
              <span className="text-lg font-semibold text-foreground">{currentSeason.name}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Make predictions for games in this season. Predictions lock when the game releases.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Search (UI only for now) */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search games..."
          className="pl-10 bg-input border-border"
          disabled
        />
      </div>

      {/* Games Tabs */}
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
                    hasPrediction={predictedGameIds.has(game.id)}
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
                  seasonId={game.season_id}
                  hasPrediction={false}
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
                    seasonId={isPast ? game.season_id : currentSeason?.id}
                    hasPrediction={!isPast && predictedGameIds.has(game.id)}
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
    </div>
  )
}
