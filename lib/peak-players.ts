import type { SupabaseClient } from "@supabase/supabase-js"

export interface PeakPlayerResult {
  peak: number | null
  partial: boolean
  snapshotCount: number
}

/**
 * Compute the 24-hour peak player count for a set of games by querying the
 * game_snapshots table.
 *
 * Returns a Map keyed by game_id with the MAX(player_count) over the last
 * 24 hours (filtered by captured_at > NOW() - INTERVAL '24 hours').
 *
 * If fewer than 24 snapshots exist for a game in that window, the returned
 * peak still comes from the available snapshots but `partial` is set to true
 * so the UI can label it as "peak (partial)".
 */
export async function get24hPeakForGames(
  supabase: SupabaseClient,
  gameIds: string[],
): Promise<Map<string, PeakPlayerResult>> {
  const result = new Map<string, PeakPlayerResult>()

  if (gameIds.length === 0) {
    return result
  }

  // Initialize every requested game with a null result so callers always get an entry
  for (const id of gameIds) {
    result.set(id, { peak: null, partial: true, snapshotCount: 0 })
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from("game_snapshots")
    .select("game_id, player_count, captured_at")
    .in("game_id", gameIds)
    .gte("captured_at", since)
    .not("player_count", "is", null)

  if (error || !data) {
    return result
  }

  // Aggregate in JS: MAX(player_count) and COUNT(*) per game
  for (const row of data as Array<{ game_id: string; player_count: number | null }>) {
    if (row.player_count == null) continue
    const existing = result.get(row.game_id) ?? { peak: null, partial: true, snapshotCount: 0 }
    const nextPeak = existing.peak == null ? row.player_count : Math.max(existing.peak, row.player_count)
    const nextCount = existing.snapshotCount + 1
    result.set(row.game_id, {
      peak: nextPeak,
      // Fewer than 24 snapshots in the 24h window = partial
      partial: nextCount < 24,
      snapshotCount: nextCount,
    })
  }

  return result
}

/**
 * Convenience wrapper for a single game.
 */
export async function get24hPeakForGame(
  supabase: SupabaseClient,
  gameId: string,
): Promise<PeakPlayerResult> {
  const map = await get24hPeakForGames(supabase, [gameId])
  return map.get(gameId) ?? { peak: null, partial: true, snapshotCount: 0 }
}
