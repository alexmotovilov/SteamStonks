import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { Target, Lock, CheckCircle2, Clock, Gamepad2 } from "lucide-react"

export default async function PredictionsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Get active season
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .single()

  // Get user's predictions with game details
  const { data: predictions } = await supabase
    .from("predictions")
    .select(`
      *,
      games:game_id (
        id,
        name,
        header_image_url,
        steam_appid,
        is_released,
        release_date
      ),
      seasons:season_id (
        name,
        status
      )
    `)
    .eq("user_id", user?.id || "")
    .order("created_at", { ascending: false })

  // Group predictions by game
  const groupedPredictions = predictions?.reduce((acc, pred) => {
    const gameId = pred.game_id
    if (!acc[gameId]) {
      acc[gameId] = {
        game: pred.games,
        season: pred.seasons,
        predictions: [],
      }
    }
    acc[gameId].predictions.push(pred)
    return acc
  }, {} as Record<string, { game: typeof predictions[0]["games"]; season: typeof predictions[0]["seasons"]; predictions: typeof predictions }>)

  const gameGroups = Object.values(groupedPredictions || {})

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Predictions</h1>
          <p className="text-muted-foreground">
            Track all your predictions across seasons
          </p>
        </div>
        <Button asChild>
          <Link href="/games">
            <Target className="mr-2 h-4 w-4" />
            Make New Prediction
          </Link>
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Predictions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{predictions?.length || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Locked In</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {predictions?.filter((p) => p.is_locked).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Scored</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {predictions?.filter((p) => p.final_points !== null).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Predictions List */}
      {gameGroups.length > 0 ? (
        <div className="space-y-4">
          {gameGroups.map(({ game, season, predictions: gamePredictions }) => (
            <Card key={game?.id} className="border-border overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {/* Game Image */}
                {game?.header_image_url && (
                  <div className="relative w-full sm:w-48 h-32 sm:h-auto shrink-0">
                    <Image
                      src={game.header_image_url}
                      alt={game.name || "Game"}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                
                {/* Content */}
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">
                        {game?.name || "Unknown Game"}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{season?.name || "Unknown Season"}</span>
                        {game?.is_released ? (
                          <Badge className="bg-success/20 text-success border-success/50 scale-90">
                            Released
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="scale-90">
                            Upcoming
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/games/${game?.id}`}>View Game</Link>
                    </Button>
                  </div>

                  {/* Prediction Cards */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {gamePredictions.map((prediction) => (
                      <div
                        key={prediction.id}
                        className={`p-3 rounded-lg border ${
                          prediction.is_locked
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-secondary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">
                            {prediction.prediction_type === "week_one"
                              ? "Week 1"
                              : "Season End"}
                          </span>
                          {prediction.is_locked ? (
                            <Lock className="h-4 w-4 text-primary" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Players</span>
                            <span className="text-foreground">
                              {prediction.player_count_min?.toLocaleString()} - {prediction.player_count_max?.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Reviews</span>
                            <span className="text-foreground">
                              {prediction.review_score_min}% - {prediction.review_score_max}%
                            </span>
                          </div>
                        </div>

                        {prediction.final_points !== null && (
                          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Points Earned</span>
                            <span className="font-bold text-primary">
                              +{prediction.final_points}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg text-foreground mb-2">No Predictions Yet</CardTitle>
            <CardDescription className="text-center text-muted-foreground mb-4">
              You haven&apos;t made any predictions. Browse games to start competing!
            </CardDescription>
            <Button asChild>
              <Link href="/games">Browse Games</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
