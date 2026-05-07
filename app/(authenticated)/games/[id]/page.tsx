import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Users, ThumbsUp } from "lucide-react"
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

  // Get player's AO mark count this season
  const { data: aoRites } = user && seasonId
    ? await supabase
        .from("rite_history")
        .select("id")
        .eq("user_id", user.id)
        .eq("season_id", seasonId)
        .eq("rite_slug", "auspicious_omens")
    : { data: [] }

  const aoMarkCount = (aoRites ?? []).length

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

      {/* Game Header — compact two-column card */}
      <Card className="overflow-hidden border-border">
        <div className="flex gap-0">
          {/* Left — clickable image links to Steam */}
          <a
            href={`https://store.steampowered.com/app/${game.steam_appid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="relative shrink-0 w-48 sm:w-64 block group"
            title="View on Steam"
          >
            {game.header_image_url ? (
              <Image src={game.header_image_url} alt={game.name} fill className="object-cover transition-opacity group-hover:opacity-80" priority />
            ) : (
              <div className="absolute inset-0 bg-secondary flex items-center justify-center">
                <span className="text-muted-foreground text-xs">No Image</span>
              </div>
            )}
            {/* Steam hover overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <span className="font-display text-[10px] text-white tracking-widest uppercase">View on Steam</span>
            </div>
          </a>

          {/* Right — game info */}
          <CardContent className="flex-1 p-4 flex flex-col justify-between min-h-[120px]">
            {/* Top row — name + badges */}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-lg text-foreground leading-tight">{game.name}</h1>
                  {game.developer && (
                    <p className="text-xs text-muted-foreground mt-0.5">{game.developer}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {game.is_released
                    ? <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] font-display">Released</Badge>
                    : <Badge variant="secondary" className="text-[10px] font-display">Upcoming</Badge>
                  }
                  {seasonData && (
                    <Badge variant="outline" className="text-[10px] font-display border-purple-500/30 text-purple-400">
                      {seasonData.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Release date + stats row */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{releaseDate}</span>
                </div>
                {game.is_released && (
                  <>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{game.peak_24h_player_count?.toLocaleString() || "N/A"} peak</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" />
                      <span>{reviewPercentage ? `${reviewPercentage}%` : "N/A"} positive</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bottom — join prompt if needed */}
            {!user && (
              <Button asChild size="sm" variant="outline" className="mt-3 w-fit text-xs font-display">
                <Link href="/auth/login">Sign in to Predict</Link>
              </Button>
            )}
            {user && !hasJoinedSeason && seasonData?.status === "active" && (
              <Button asChild size="sm" variant="outline" className="mt-3 w-fit text-xs font-display">
                <Link href={`/seasons/${seasonData.id}`}>Join Season to Predict</Link>
              </Button>
            )}
          </CardContent>
        </div>
      </Card>

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
          aoMarkCount={aoMarkCount}
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
