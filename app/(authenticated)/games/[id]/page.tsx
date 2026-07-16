import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { PredictionFormClient as PredictionForm } from "@/components/prediction-form-client"
import { PredictionTabletShell } from "@/components/prediction-tablet-shell"

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

  // Get all booster item definitions so every booster is always visible (qty 0 = out of stock)
  const { data: allBoosters } = await supabase
    .from("items")
    .select("id, slug, name, image_url, effects, description")
    .eq("item_type", "booster")

  const { data: ownedInventory } = user
    ? await supabase
        .from("inventory")
        .select("item_id, quantity")
        .eq("user_id", user.id)
    : { data: [] }

  const ownedMap = new Map((ownedInventory ?? []).map(i => [i.item_id, i.quantity]))
  const inventory = (allBoosters ?? []).map(item => ({
    item_id: item.id,
    quantity: ownedMap.get(item.id) ?? 0,
    items: {
      slug: item.slug,
      name: item.name,
      image_url: item.image_url,
      effects: item.effects,
      description: item.description,
    },
  }))

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

  // Fetch all games this player has AO-marked this season (for showing stars on other tiles)
  const { data: aoMarkedPreds } = user && seasonId
    ? await supabase
        .from("predictions")
        .select("game_id")
        .eq("user_id", user.id)
        .eq("season_id", seasonId)
        .eq("ao_marked", true)
    : { data: [] }

  const aoMarkedGameIds = (aoMarkedPreds ?? []).map(p => p.game_id).filter(Boolean) as string[]

  // Get all game IDs where the player has made a prediction this season
  const { data: playerPredictions } = user && seasonId
    ? await supabase
        .from("predictions")
        .select("game_id")
        .eq("user_id", user.id)
        .eq("season_id", seasonId)
    : { data: [] }

  const predictedGameIds = (playerPredictions ?? []).map(p => p.game_id).filter(Boolean) as string[]

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
        weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
      })
    : "TBA"

  const hasJoinedSeason = !!seasonEntry
  const canPredict = !!user && hasJoinedSeason && seasonData?.status === "active"

  return (
    <PredictionTabletShell
      gameName={game.name}
      developer={game.developer}
      releaseDate={releaseDate}
    >
      {seasonData && (canPredict || existingPrediction) ? (
        <PredictionForm
          gameId={game.id}
          gameName={game.name}
          seasonId={seasonData.id}
          seasonStatus={seasonData.status}
          existingPrediction={existingPrediction ?? null}
          isReleased={game.is_released || (() => {
            const t = game.release_time_override
              ? new Date(game.release_time_override)
              : game.release_date ? new Date(game.release_date) : null
            return t !== null && t <= new Date()
          })()}
          releaseDate={game.release_date}
          predictionLockDate={seasonData.prediction_lock_date}
          snapshotPlayerCount={weekOneSnapshot?.player_count}
          snapshotReviewPositive={weekOneSnapshot?.review_positive}
          snapshotReviewNegative={weekOneSnapshot?.review_negative}
          snapshotCapturedAt={weekOneSnapshot?.captured_at}
          equipmentSlug={seasonEntry?.equipment_id ?? null}
          equipmentTierScore={seasonEntry?.equipment_tier_score ?? 0}
          ladderGames={(seasonGames ?? []) as { id: string; name: string; header_image_url: string | null; is_released: boolean; release_date: string | null }[]}
          existingLadder={(ladderRanking?.ranked_games as string[]) ?? []}
          lockedLadderGameIds={(ladderRanking?.locked_game_ids as string[]) ?? []}
          aoMarkCount={aoMarkCount}
          aoMarkedGameIds={aoMarkedGameIds}
          predictedGameIds={predictedGameIds}
          inventory={(inventory ?? []) as unknown as { item_id: string; quantity: number; items: { slug: string; name: string; image_url: string | null; effects: Record<string, number>; description: string } }[]}
        />
      ) : !user ? (
        <div className="text-center py-12 font-body text-muted-foreground">
          <Link href="/auth/login" className="text-cyan-400 hover:underline">Sign in</Link> to make predictions.
        </div>
      ) : user && !hasJoinedSeason && seasonData?.status === "active" ? (
        <div className="text-center py-12 font-body text-muted-foreground">
          <Link href={`/seasons/${seasonData.id}`} className="text-cyan-400 hover:underline">Join the season</Link> to make predictions.
        </div>
      ) : seasonData ? (
        <div className="text-center py-12 font-body text-muted-foreground">
          Predictions are closed for this season.
        </div>
      ) : null}
    </PredictionTabletShell>
  )
}
