import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Users, ThumbsUp, ExternalLink } from "lucide-react"
import { PredictionForm } from "@/components/prediction-form"

interface GamePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ season?: string }>
}

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { id } = await params
  const { season } = await searchParams
  
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Get game details
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single()

  if (!game) {
    notFound()
  }

  // Get active season if not specified
  let seasonId = season
  if (!seasonId) {
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .eq("status", "active")
      .single()
    seasonId = activeSeason?.id
  }

  // Get season details
  const { data: seasonData } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId || "")
    .single()

  // Get existing predictions for this user/game/season
  const { data: existingPredictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", user?.id || "")
    .eq("game_id", id)
    .eq("season_id", seasonId || "")

  const weekOnePrediction = existingPredictions?.find((p) => p.prediction_type === "week_one")
  const seasonEndPrediction = existingPredictions?.find((p) => p.prediction_type === "season_end")

  // Get historical snapshots for scoring (week_after_release and season_end)
  const { data: weekOneSnapshot } = await supabase
    .from("game_snapshots")
    .select("*")
    .eq("game_id", id)
    .eq("snapshot_type", "week_after_release")
    .order("captured_at", { ascending: false })
    .limit(1)
    .single()

  const { data: seasonEndSnapshot } = await supabase
    .from("game_snapshots")
    .select("*")
    .eq("game_id", id)
    .eq("snapshot_type", "season_end")
    .order("captured_at", { ascending: false })
    .limit(1)
    .single()

  // Calculate review percentage
  const reviewPercentage = game.review_score_positive && game.review_score_negative
    ? Math.round((game.review_score_positive / (game.review_score_positive + game.review_score_negative)) * 100)
    : null

  const releaseDate = game.release_date
    ? new Date(game.release_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBA"

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back Button */}
      <Button asChild variant="ghost" size="sm">
        <Link href="/games">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Games
        </Link>
      </Button>

      {/* Game Header */}
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <Card className="overflow-hidden border-border">
          <div className="relative aspect-[460/215]">
            {game.header_image_url ? (
              <Image
                src={game.header_image_url}
                alt={game.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                <span className="text-muted-foreground">No Image</span>
              </div>
            )}
          </div>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{game.name}</h1>
                {game.developer && (
                  <p className="text-muted-foreground">{game.developer}</p>
                )}
              </div>
              {game.is_released ? (
                <Badge className="bg-success text-success-foreground">Released</Badge>
              ) : (
                <Badge variant="secondary">Upcoming</Badge>
              )}
            </div>

            {game.genres && game.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(game.genres || [])
                  .filter((g: string | null): g is string => g !== null && g !== undefined && typeof g === "string" && g.trim().length > 0)
                  .map((genre: string, index: number) => (
                    <Badge key={`genre-${game.id}-${index}`} variant="outline">{genre}</Badge>
                  ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-xs text-muted-foreground">Release Date</div>
                  <div className="text-sm font-medium text-foreground">{releaseDate}</div>
                </div>
              </div>
              
              {game.is_released && (
                <>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">24h Peak Players</div>
                      <div className="text-sm font-medium text-foreground">
                        {game.peak_24h_player_count?.toLocaleString() || "N/A"}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Review Score</div>
                      <div className="text-sm font-medium text-foreground">
                        {reviewPercentage ? `${reviewPercentage}% Positive` : "N/A"}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <a
              href={`https://store.steampowered.com/app/${game.steam_appid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on Steam
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Season Info Sidebar */}
        <Card className="h-fit border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Season Info</CardTitle>
            <CardDescription className="text-muted-foreground">
              {seasonData ? seasonData.name : "No active season"}
            </CardDescription>
          </CardHeader>
          {seasonData && (
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary">{seasonData.status}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ends</span>
                <span className="text-foreground">
                  {new Date(seasonData.end_date).toLocaleDateString()}
                </span>
              </div>
              {seasonData.prediction_lock_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Predictions Lock</span>
                  <span className="text-foreground">
                    {new Date(seasonData.prediction_lock_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Prediction Forms */}
      {seasonData && (
        <div className="grid md:grid-cols-2 gap-6">
          {(seasonData.status === "active" || weekOnePrediction) && (
            <PredictionForm
              type="week_one"
              gameId={game.id}
              gameName={game.name}
              seasonId={seasonData.id}
              seasonStatus={seasonData.status}
              existingPrediction={weekOnePrediction}
              isReleased={game.is_released}
              predictionLockDate={seasonData.prediction_lock_date}
              snapshotPlayerCount={weekOneSnapshot?.player_count}
              snapshotReviewPositive={weekOneSnapshot?.review_positive}
              snapshotReviewNegative={weekOneSnapshot?.review_negative}
              snapshotCapturedAt={weekOneSnapshot?.captured_at}
            />
          )}
          {(seasonData.status === "active" || seasonEndPrediction) && (
            <PredictionForm
              type="season_end"
              gameId={game.id}
              gameName={game.name}
              seasonId={seasonData.id}
              seasonStatus={seasonData.status}
              existingPrediction={seasonEndPrediction}
              isReleased={game.is_released}
              predictionLockDate={seasonData.prediction_lock_date}
              snapshotPlayerCount={seasonEndSnapshot?.player_count}
              snapshotReviewPositive={seasonEndSnapshot?.review_positive}
              snapshotReviewNegative={seasonEndSnapshot?.review_negative}
              snapshotCapturedAt={seasonEndSnapshot?.captured_at}
            />
          )}
          {seasonData.status !== "active" && !weekOnePrediction && !seasonEndPrediction && (
            <div className="md:col-span-2 text-center py-8 text-muted-foreground">
              No predictions were made for this game during the season.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
