// Shared logic for taking season_end snapshots
// Called by both the steam-collector cron and the admin manual trigger

import { SupabaseClient } from "@supabase/supabase-js"
import { getPlayerCount, getReviewSummary } from "@/lib/steam"

export interface SeasonSnapshotResult {
  seasonId: string
  gamesSnapshotted: number
  gamesFailed: number
  alreadySnapshotted: string[]
}

/**
 * Derives the true 24h peak player count for a game by querying
 * the max player_count from game_snapshots in the last 24 hours.
 * Falls back to the current reading if no snapshots exist.
 */
export async function get24hPeakFromSnapshots(
  supabase: SupabaseClient,
  gameId: string,
  currentPlayerCount: number | null
): Promise<number | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data } = await supabase
    .from("game_snapshots")
    .select("player_count")
    .eq("game_id", gameId)
    .gte("captured_at", since)
    .not("player_count", "is", null)
    .order("player_count", { ascending: false })
    .limit(1)
    .single()

  // Return the max from the last 24h, or fall back to current reading
  return data?.player_count ?? currentPlayerCount
}

/**
 * Takes a season_end snapshot for every game in the season.
 * Skips games that already have a season_end snapshot.
 * Flips the season status to "scoring" on success.
 */
export async function takeSeasonEndSnapshots(
  supabase: SupabaseClient,
  seasonId: string
): Promise<SeasonSnapshotResult> {
  const result: SeasonSnapshotResult = {
    seasonId,
    gamesSnapshotted: 0,
    gamesFailed: 0,
    alreadySnapshotted: [],
  }

  // Get all games in this season
  const { data: games, error: gamesError } = await supabase
    .from("games")
    .select("id, steam_appid, name, peak_player_count")
    .eq("season_id", seasonId)

  if (gamesError || !games || games.length === 0) {
    console.error("[Season Snapshot] Failed to fetch games for season:", seasonId, gamesError)
    return result
  }

  for (const game of games) {
    try {
      // Skip if a season_end snapshot already exists for this game
      const { data: existing } = await supabase
        .from("game_snapshots")
        .select("id")
        .eq("game_id", game.id)
        .eq("snapshot_type", "season_end")
        .limit(1)
        .single()

      if (existing) {
        result.alreadySnapshotted.push(game.name)
        continue
      }

      // Fetch fresh data from Steam
      const [playerCount, reviews] = await Promise.all([
        getPlayerCount(game.steam_appid),
        getReviewSummary(game.steam_appid),
      ])

      // Derive true 24h peak from hourly snapshots collected over the last 24h
      const peak24h = await get24hPeakFromSnapshots(supabase, game.id, playerCount)

      // Insert the season_end snapshot
      // player_count = true 24h peak derived from hourly snapshots
      const { error: insertError } = await supabase.from("game_snapshots").insert({
        game_id: game.id,
        snapshot_type: "season_end",
        player_count: peak24h,
        review_positive: reviews?.total_positive ?? null,
        review_negative: reviews?.total_negative ?? null,
      })

      if (insertError) {
        console.error(`[Season Snapshot] Failed to insert snapshot for ${game.name}:`, insertError)
        result.gamesFailed++
        continue
      }

      // Update the game row with the latest review data
      if (reviews) {
        await supabase
          .from("games")
          .update({
            review_score_positive: reviews.total_positive,
            review_score_negative: reviews.total_negative,
            updated_at: new Date().toISOString(),
          })
          .eq("id", game.id)
      }

      result.gamesSnapshotted++
      console.log(`[Season Snapshot] Snapshotted ${game.name}: ${peak24h} players (24h peak)`)

      // Small delay to avoid Steam rate limiting
      await new Promise((resolve) => setTimeout(resolve, 300))
    } catch (err) {
      console.error(`[Season Snapshot] Error processing ${game.name}:`, err)
      result.gamesFailed++
    }
  }

  // Flip season to "scoring" only if all games succeeded (none failed)
  if (result.gamesFailed === 0 && result.gamesSnapshotted > 0) {
    const { error: statusError } = await supabase
      .from("seasons")
      .update({ status: "scoring", updated_at: new Date().toISOString() })
      .eq("id", seasonId)

    if (statusError) {
      console.error("[Season Snapshot] Failed to update season status:", statusError)
    } else {
      console.log(`[Season Snapshot] Season ${seasonId} moved to scoring`)
    }
  } else if (result.gamesFailed > 0) {
    console.warn(
      `[Season Snapshot] ${result.gamesFailed} games failed — season status NOT updated. Re-run to retry.`
    )
  }

  return result
}