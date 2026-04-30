import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getPlayerCount, getReviewSummary, calculateReviewPercentage } from "@/lib/steam"
import { get24hPeakFromSnapshots, takeSeasonEndSnapshots } from "@/lib/season-snapshot"

// Use service role for cron jobs (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * Cron job to collect Steam player counts and review data.
 * Runs hourly via Vercel Cron.
 *
 * Also handles:
 * - Deriving true 24h peak from hourly snapshots
 * - Auto-triggering season_end snapshots when a season's end_date passes
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/steam-collector",
 *     "schedule": "0 * * * *"
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify this is a legitimate cron request
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const results = {
      processed: 0,
      errors: 0,
      snapshots: [] as Array<{ game: string; players: number | null; peak24h: number | null; reviews: number | null }>,
      seasonsSnapshotted: [] as string[],
    }

    // ─── 1. Collect hourly snapshots for all games ───────────────────────

    const { data: games, error: gamesError } = await supabase
      .from("games")
      .select("id, steam_appid, name, release_date, is_released, peak_player_count, seasons!inner(status)")
      .in("seasons.status", ["upcoming", "active"])
      .order("last_snapshot_at", { ascending: true, nullsFirst: true })
      .limit(50)

    if (gamesError) {
      console.error("[Steam Collector] Failed to fetch games:", gamesError)
      return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 })
    }

    for (const game of games || []) {
      try {
        const playerCount = await getPlayerCount(game.steam_appid)
        const reviews = await getReviewSummary(game.steam_appid)
        const reviewPercentage = reviews
          ? calculateReviewPercentage(reviews.total_positive, reviews.total_negative)
          : null

        const snapshotType = determineSnapshotType(game.release_date, game.is_released)

        // Insert hourly snapshot with current reading
        const { error: snapshotError } = await supabase.from("game_snapshots").insert({
          game_id: game.id,
          snapshot_type: snapshotType,
          player_count: playerCount,
          review_positive: reviews?.total_positive ?? null,
          review_negative: reviews?.total_negative ?? null,
        })

        if (snapshotError) {
          console.error(`[Steam Collector] Failed to insert snapshot for ${game.name}:`, snapshotError)
          results.errors++
          continue
        }

        // Derive true 24h peak from the last 24h of hourly snapshots
        // (now includes the snapshot we just inserted)
        const peak24h = await get24hPeakFromSnapshots(supabase, game.id, playerCount)

        const updateData: Record<string, unknown> = {
          last_snapshot_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Correctly derived from hourly snapshots, not just the current reading
          peak_24h_player_count: peak24h,
        }

        if (playerCount !== null) {
          // Update all-time peak if current reading is higher
          if (!game.peak_player_count || playerCount > game.peak_player_count) {
            updateData.peak_player_count = playerCount
          }
        }

        if (reviews) {
          updateData.review_score_positive = reviews.total_positive
          updateData.review_score_negative = reviews.total_negative
        }

        // Mark game as released if its release date has passed
        if (!game.is_released && game.release_date) {
          if (new Date(game.release_date) <= new Date()) {
            updateData.is_released = true

            // Auto-lock this game's ladder position for all players who have it ranked
            const { data: affectedLadders } = await supabase
              .from("ladder_rankings")
              .select("user_id, season_id, ranked_games, locked_game_ids")
              .contains("ranked_games", JSON.stringify([game.id]))

            for (const ladder of affectedLadders ?? []) {
              const alreadyLocked = (ladder.locked_game_ids ?? []).includes(game.id)
              if (!alreadyLocked) {
                await supabase.rpc("lock_ladder_game", {
                  p_user_id:   ladder.user_id,
                  p_season_id: ladder.season_id,
                  p_game_id:   game.id,
                })
              }
            }

            console.log(`[Steam Collector] ${game.name} released — ladder positions locked for ${affectedLadders?.length ?? 0} players`)
          }
        }

        await supabase.from("games").update(updateData).eq("id", game.id)

        results.processed++
        results.snapshots.push({
          game: game.name,
          players: playerCount,
          peak24h,
          reviews: reviewPercentage,
        })

        await new Promise((resolve) => setTimeout(resolve, 200))
      } catch (err) {
        console.error(`[Steam Collector] Error processing ${game.name}:`, err)
        results.errors++
      }
    }

    // ─── 2. Auto-trigger season_end snapshots for expired seasons ────────
    //
    // Find seasons whose end_date has passed but are still "active".
    // We only do this once — takeSeasonEndSnapshots flips them to "scoring"
    // on success, so they won't be picked up on subsequent cron runs.

    const { data: expiredSeasons } = await supabase
      .from("seasons")
      .select("id, name")
      .eq("status", "active")
      .lte("end_date", new Date().toISOString())

    for (const season of expiredSeasons || []) {
      try {
        console.log(`[Steam Collector] Season "${season.name}" has ended — taking season_end snapshots`)
        const snapshotResult = await takeSeasonEndSnapshots(supabase, season.id)

        if (snapshotResult.gamesSnapshotted > 0 || snapshotResult.alreadySnapshotted.length > 0) {
          results.seasonsSnapshotted.push(season.name)
        }

        console.log(`[Steam Collector] Season "${season.name}" snapshot result:`, snapshotResult)
      } catch (err) {
        console.error(`[Steam Collector] Error snapshotting season "${season.name}":`, err)
        results.errors++
      }
    }

    console.log(
      `[Steam Collector] Completed: ${results.processed} games processed, ` +
      `${results.seasonsSnapshotted.length} seasons snapshotted, ` +
      `${results.errors} errors`
    )

    return NextResponse.json({
      message: "Collection complete",
      ...results,
    })
  } catch (error) {
    console.error("[Steam Collector] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Determines the snapshot type based on days since release.
 * Returns "week_after_release" during the days 6-8 window,
 * otherwise "daily" for released games and "daily" for unreleased ones.
 */
function determineSnapshotType(
  releaseDate: string | null,
  isReleased: boolean
): "daily" | "week_after_release" {
  if (!releaseDate || !isReleased) return "daily"

  const daysSinceRelease = Math.floor(
    (Date.now() - new Date(releaseDate).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysSinceRelease >= 6 && daysSinceRelease <= 8) return "week_after_release"

  return "daily"
}
