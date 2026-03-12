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

  // Get active season
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .single()

  // Get all games
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("release_date", { ascending: true })

  // Get user's predictions for the active season
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select("game_id")
    .eq("user_id", user?.id || "")
    .eq("season_id", activeSeason?.id || "")

  const predictedGameIds = new Set(userPredictions?.map((p) => p.game_id) || [])

  // Separate games into upcoming and released
  const upcomingGames = games?.filter((g) => !g.is_released) || []
  const releasedGames = games?.filter((g) => g.is_released) || []

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

      {/* Season Info */}
      {activeSeason && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge>Active Season</Badge>
              <span className="text-lg font-semibold text-foreground">{activeSeason.name}</span>
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
      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-background">
            Upcoming ({upcomingGames.length})
          </TabsTrigger>
          <TabsTrigger value="released" className="data-[state=active]:bg-background">
            Released ({releasedGames.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-background">
            All ({games?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {upcomingGames.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {upcomingGames.map((game) => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  seasonId={activeSeason?.id}
                  hasPrediction={predictedGameIds.has(game.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg text-foreground mb-2">No Upcoming Games</CardTitle>
                <CardDescription className="text-center text-muted-foreground mb-4">
                  No games have been added for prediction yet. Be the first to nominate one!
                </CardDescription>
                <Button asChild>
                  <Link href="/games/nominate">Nominate a Game</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="released" className="space-y-4">
          {releasedGames.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {releasedGames.map((game) => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  seasonId={activeSeason?.id}
                  hasPrediction={predictedGameIds.has(game.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg text-foreground mb-2">No Released Games</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Games will appear here after they release.
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {games && games.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {games.map((game) => (
                <GameCard 
                  key={game.id} 
                  game={game} 
                  seasonId={activeSeason?.id}
                  hasPrediction={predictedGameIds.has(game.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg text-foreground mb-2">No Games Yet</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Nominate your first game to get started.
                </CardDescription>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
