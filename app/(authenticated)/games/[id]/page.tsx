import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Users, ThumbsUp, ExternalLink } from "lucide-react"
import { PredictionFormClient as PredictionForm } from "@/components/prediction-form-client"

interface GamePageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ season?: string }>
}

export default async function GamePage({ params, searchParams }: GamePageProps) {
  const { id } = await params
  const { season } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", id)
    .single()

  if (!game) notFound()

  // Resolve season
  let seasonId = season
  if (!seasonId) {
    const { data: activeSeason } = await supabase
      .from("seasons")
      .select("id")
      .in("status", ["active", "upcoming"])
      .order("start_date", { ascending: false })
      .limit(1)
      .single()
    seasonId = activeSeason?.id
  }

  const { data: seasonData } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", seasonId ?? "")
    .single()

  // Get existing week-one prediction
  const { data: existingPrediction } = user && seasonId
    ? await supabase
        .from("predictions")
        .select("*")
        .eq("user_id", user.id)
        .eq("game_id", id)
        .eq("season_id", seasonId)
        .eq("prediction_type", "week_one")
        .single()
    : { data: null }

  // Get week_after_release snapshot
  const { data: weekOneSnapshot } = await supabase
    .from("game_snapshots")
    .select("player_count, review_positive, review_negative, captured_at")
    .eq("game_id", id)
    .eq("snapshot_type", "week_after_release")
    .order("captured_at", { ascending: false })
    .limit(1)
    .single()

  // Get player's season entry for equipment context
  const { data: seasonEntry } = user && seasonId
    ? await supabase
        .from("season_entries")
        .select("equipment_id, equipment_tier_score")
        .eq("user_id", user.id)
        .eq("season_id", seasonId)
        .single()
    : { data: null }

  // Get player's inventory (boosters only)
  const { data: inventory } = user
    ? await supabase
        .from("inventory")
        .select("item_id, quantity, items(slug, name, image_url, effects, description)")
        .eq("user_id", user.id)
        .gt("quantity", 0)
    : { data: [] }

  // Get ALL games in this season for the ladder (released + unreleased)
  // The current game needs to appear even if not yet released so player can position it
  const { data: seasonGames } = seasonId
    ? await supabase
        .from("games")
        .select("id, name, header_image_url, is_released, release_date")
        .eq("season_id", seasonId)
        .order("release_date", { ascending: true })
    : { data: [] }

  // Get player's existing ladder ranking
  const { data: ladderRanking } = user && seasonId
    ? await supabase
        .from("ladder_rankings")
        .select("ranked_games, locked_game_ids")
        .eq("user_id", user.id)
        .eq("season_id", seasonId)
        .single()
    : { data: null }

  const reviewPercentage = game.review_score_positive && game.review_score_negative
    ? Math.round((game.review_score_positive / (game.review_score_positive + game.review_score_negative)) * 100)
    : null

  const releaseDate = game.release_date
    ? new Date(game.release_date).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric",
      })
    : "TBA"

  const hasJoinedSeason = !!seasonEntry
  const canPredict = !!user && hasJoinedSeason && seasonData?.status === "active"

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link href="/games">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Games
        </Link>
      </Button>

      {/* Game Header */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-6">
        <Card className="overflow-hidden border-border">
          <div className="relative aspect-[460/215]">
            {game.header_image_url ? (
              <Image src={game.header_image_url} alt={game.name} fill className="object-cover" priority />
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
                {game.developer && <p className="text-muted-foreground">{game.developer}</p>}
              </div>
              {game.is_released
                ? <Badge className="bg-success text-success-foreground">Released</Badge>
                : <Badge variant="secondary">Upcoming</Badge>
              }
            </div>

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
                      <div className="text-xs text-muted-foreground">24h Peak</div>
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
                        {reviewPercentage ? `${reviewPercentage}%` : "N/A"}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <a
              href={`https://store.steampowered.com/app/${game.steam_appid}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View on Steam <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Season Info */}
        <Card className="h-fit border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Season Info</CardTitle>
            <CardDescription className="text-muted-foreground">
              {seasonData ? seasonData.name : "No active season"}
            </CardDescription>
          </CardHeader>
          {seasonData && (
            <CardContent className="space-y-3 text-sm">
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
              {!user && (
                <Button asChild size="sm" className="w-full mt-2">
                  <Link href="/auth/login">Sign in to Predict</Link>
                </Button>
              )}
              {user && !hasJoinedSeason && seasonData.status === "active" && (
                <Button asChild size="sm" className="w-full mt-2">
                  <Link href={`/seasons/${seasonData.id}`}>Join Season to Predict</Link>
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Prediction Form */}
      {seasonData && (canPredict || existingPrediction) && (
        <PredictionForm
          gameId={game.id}
          gameName={game.name}
          seasonId={seasonData.id}
          seasonStatus={seasonData.status}
          existingPrediction={existingPrediction ?? null}
          isReleased={game.is_released}
          releaseDate={game.release_date}
          predictionLockDate={seasonData.prediction_lock_date}
          snapshotPlayerCount={weekOneSnapshot?.player_count}
          snapshotReviewPositive={weekOneSnapshot?.review_positive}
          snapshotReviewNegative={weekOneSnapshot?.review_negative}
          snapshotCapturedAt={weekOneSnapshot?.captured_at}
          equipmentSlug={seasonEntry?.equipment_id ?? null}
          equipmentTierScore={seasonEntry?.equipment_tier_score ?? 0}
          ladderGames={(seasonGames ?? []) as { id: string; name: string; header_image_url: string | null; is_released: boolean }[]}
          existingLadder={(ladderRanking?.ranked_games as string[]) ?? []}
          lockedLadderGameIds={(ladderRanking?.locked_game_ids as string[]) ?? []}
          inventory={(inventory ?? []) as unknown as { item_id: string; quantity: number; items: { slug: string; name: string; image_url: string | null; effects: Record<string, number>; description: string } }[]}
        />
      )}

      {seasonData && !canPredict && !existingPrediction && (
        <div className="text-center py-8 text-muted-foreground">
          {seasonData.status !== "active"
            ? "Predictions are closed for this season."
            : "Join the season to make predictions."}
        </div>
      )}
    </div>
  )
}
