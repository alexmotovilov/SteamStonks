import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  scoreWeekOnePrediction,
  resolveBoosterEffects,
  resolveEquipmentEffects,
  resolveRiteEffects,
  calculateRankings,
  type WeekOnePrediction,
  type ActualMetrics,
} from "@/lib/scoring"
import { scoreLadder, scoreAuspiciousOmens } from "@/lib/ladder-scoring"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"
export const maxDuration = 300

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === "production" && process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const results = {
      weekOnePredictionsScored: 0,
      ladderRankingsScored: 0,
      errors: 0,
    }

    // ── 1. Score week-one predictions ────────────────────────────────────────

    // Find all released games with unscored locked predictions
    const { data: games } = await supabase
      .from("games")
      .select(`
        id, name, release_date, is_released,
        peak_24h_player_count, peak_player_count,
        review_score_positive, review_score_negative,
        seasons!inner(status)
      `)
      .eq("is_released", true)
      .in("seasons.status", ["active", "scoring"])

    for (const game of games || []) {
      if (!game.release_date) continue

      const releaseDate = new Date(game.release_date)
      const daysSinceRelease = Math.floor(
        (Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Only score after 7 days post-release
      if (daysSinceRelease < 7) continue

      // Week-one player count = highest peak recorded in the 7 days post-release
      // This guarantees weekend peaks are captured regardless of release day
      const sevenDaysAfter = new Date(releaseDate.getTime() + 7 * 24 * 60 * 60 * 1000)

      const { data: weekSnapshots } = await supabase
        .from("game_snapshots")
        .select("player_count, review_positive, review_negative, captured_at")
        .eq("game_id", game.id)
        .gte("captured_at", releaseDate.toISOString())
        .lte("captured_at", sevenDaysAfter.toISOString())
        .not("player_count", "is", null)
        .order("captured_at", { ascending: false })

      if (!weekSnapshots || weekSnapshots.length === 0) {
        console.log(`[Score Calculator] No snapshots in 7-day window for ${game.name}, skipping`)
        continue
      }

      // Peak player count in the 7-day window
      const peakPlayerCount = Math.max(...weekSnapshots.map(s => s.player_count ?? 0))

      // For reviews, use the most recent snapshot in the window
      // (reviews accumulate over time so later = more representative)
      const latestSnapshot = weekSnapshots[0]
      const snapshotReviewTotal = (latestSnapshot.review_positive ?? 0) + (latestSnapshot.review_negative ?? 0)
      const reviewScore = snapshotReviewTotal > 0
        ? Math.round(((latestSnapshot.review_positive ?? 0) / snapshotReviewTotal) * 100)
        : null

      if (reviewScore === null) {
        console.log(`[Score Calculator] No review data for ${game.name}, skipping`)
        continue
      }

      const actual: ActualMetrics = {
        player_count: peakPlayerCount,
        review_score: reviewScore,
      }

      // Get unscored locked week_one predictions for this game
      const { data: predictions } = await supabase
        .from("predictions")
        .select("*")
        .eq("game_id", game.id)
        .eq("prediction_type", "week_one")
        .eq("is_locked", true)
        .is("scored_at", null)

      for (const pred of predictions || []) {
        try {
          // Get player's season entry for equipment and tier score
          const { data: entry } = await supabase
            .from("season_entries")
            .select("equipment_id, equipment_tier_score, first_prediction_bonus_claimed")
            .eq("user_id", pred.user_id)
            .eq("season_id", pred.season_id)
            .single()

          const boosters  = resolveBoosterEffects(pred.applied_boosters ?? [])
          const equipment = resolveEquipmentEffects(entry?.equipment_id ?? null, entry?.equipment_tier_score ?? 0)
          const rites     = resolveRiteEffects(pred.applied_rites ?? {})

          // Check if this is the player's first prediction this season
          const isFirst = !entry?.first_prediction_bonus_claimed

          const scoreResult = scoreWeekOnePrediction(
            pred as WeekOnePrediction,
            actual,
            boosters,
            equipment,
            rites,
            releaseDate,
            isFirst
          )

          // Update prediction with scoring results
          await supabase
            .from("predictions")
            .update({
              result:               scoreResult.result,
              players_correct:      scoreResult.players_correct,
              reviews_correct:      scoreResult.reviews_correct,
              actual_player_count:  scoreResult.actual_player_count,
              actual_review_score:  scoreResult.actual_review_score,
              players_window_low:   scoreResult.players_window_low,
              players_window_high:  scoreResult.players_window_high,
              reviews_window_low:   scoreResult.reviews_window_low,
              reviews_window_high:  scoreResult.reviews_window_high,
              mana_players:         scoreResult.mana_players,
              mana_reviews:         scoreResult.mana_reviews,
              mana_both_bonus:      scoreResult.mana_both_bonus,
              mana_early_lock:      scoreResult.mana_early_lock,
              mana_boosters:        scoreResult.mana_boosters,
              mana_equipment:       scoreResult.mana_equipment,
              mana_first_prediction: scoreResult.mana_first_prediction,
              drops_awarded:        scoreResult.drops_awarded,
              final_points:         scoreResult.final_mana,
              scored_at:            new Date().toISOString(),
            })
            .eq("id", pred.id)

          // Award drops to inventory
          if (scoreResult.drops_awarded > 0) {
            await awardDrops(pred.user_id, pred.id, pred.season_id, scoreResult.drops_awarded)
          }

          // Update season entry atomically via RPC
          const isCorrect = scoreResult.result !== 'failed'
          await supabase.rpc("increment_season_mana", {
            p_user_id:        pred.user_id,
            p_season_id:      pred.season_id,
            p_mana:           scoreResult.final_mana,
            p_tier_increment: isCorrect ? 1 : 0,
            p_claim_first:    isFirst,
          })

          results.weekOnePredictionsScored++
        } catch (err) {
          console.error(`[Score Calculator] Error scoring prediction ${pred.id}:`, err)
          results.errors++
        }
      }
    }

    // ── 2. Score ladder rankings (season end) ─────────────────────────────────

    const { data: scoringSeasons } = await supabase
      .from("seasons")
      .select("id, end_date")
      .eq("status", "scoring")

    for (const season of scoringSeasons || []) {
      // Get all ladder rankings for this season that haven't been scored yet
      const { data: ladders } = await supabase
        .from("ladder_rankings")
        .select("*")
        .eq("season_id", season.id)
        .is("scored_at", null)

      if (!ladders || ladders.length === 0) continue

      // Build actual top 8: rank games by their highest peak_player_count
      const { data: seasonGames } = await supabase
        .from("games")
        .select("id, peak_player_count")
        .eq("season_id", season.id)
        .eq("is_released", true)
        .not("peak_player_count", "is", null)
        .order("peak_player_count", { ascending: false })
        .limit(8)

      const actualTop8 = (seasonGames ?? []).map(g => g.id)

      if (actualTop8.length < 2) continue  // need at least 2 games to score

      for (const ladder of ladders) {
        try {
          const playerLadder: string[] = ladder.ranked_games ?? []
          const ladderResult = scoreLadder(playerLadder, actualTop8)

          // Score Auspicious Omens
          const markedGameIds = (ladder.ranked_games ?? []).filter((_: string, i: number) => {
            // AO marks stored in rite_history — fetch them
            return false // placeholder, resolved below
          })

          // Get AO marks from rite_history
          const { data: aoRites } = await supabase
            .from("rite_history")
            .select("metadata")
            .eq("user_id", ladder.user_id)
            .eq("season_id", season.id)
            .eq("rite_slug", "auspicious_omens")

          const aoMarkedGameIds: string[] = (aoRites ?? [])
            .map(r => r.metadata?.game_id)
            .filter(Boolean)

          const aoResult = scoreAuspiciousOmens(aoMarkedGameIds, actualTop8)

          const totalLadderMana = ladderResult.total_mana + aoResult.total_reward

          await supabase
            .from("ladder_rankings")
            .update({
              binary_mana:    ladderResult.binary_mana,
              sequence_mana:  ladderResult.sequence_mana,
              sequence_length: ladderResult.sequence_length,
              total_mana:     ladderResult.total_mana,
              ao_all_correct: aoResult.all_correct,
              ao_mana_reward: aoResult.total_reward,
              scored_at:      new Date().toISOString(),
            })
            .eq("id", ladder.id)

          // Credit mana to season entry
          if (totalLadderMana > 0) {
            await supabase.rpc("increment_season_mana", {
              p_user_id:       ladder.user_id,
              p_season_id:     season.id,
              p_mana:          totalLadderMana,
              p_tier_increment: 0,
              p_claim_first:   false,
            })
          }

          results.ladderRankingsScored++
        } catch (err) {
          console.error(`[Score Calculator] Error scoring ladder ${ladder.id}:`, err)
          results.errors++
        }
      }
    }

    // ── 3. Update leaderboards ────────────────────────────────────────────────

    await updateLeaderboards()

    return NextResponse.json({
      message: "Scoring complete",
      ...results,
    })
  } catch (error) {
    console.error("[Score Calculator] Unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function awardDrops(
  userId: string,
  predictionId: string,
  seasonId: string,
  count: number
) {
  // Fetch the drop table (ordered by rarity, most rare first)
  const { data: items } = await supabase
    .from("items")
    .select("id, slug, drop_rate")
    .eq("is_droppable", true)
    .not("drop_rate", "is", null)
    .order("drop_rate", { ascending: true }) // lowest rate first = rarest first

  if (!items || items.length === 0) return

  for (let i = 0; i < count; i++) {
    // Roll for an item: iterate from rarest to most common
    // First item where roll <= drop_rate wins
    const roll = Math.random() * 100
    let awarded = items[items.length - 1] // fallback to most common

    for (const item of items) {
      if (roll <= item.drop_rate) {
        awarded = item
        break
      }
    }

    // Add to inventory
    await supabase
      .from("inventory")
      .upsert(
        { user_id: userId, item_id: awarded.id, quantity: 1, updated_at: new Date().toISOString() },
        {
          onConflict: "user_id,item_id",
          ignoreDuplicates: false,
        }
      )

    // Increment quantity
    await supabase.rpc("increment_inventory", {
      p_user_id: userId,
      p_item_id: awarded.id,
    })

    // Log drop
    await supabase.from("drop_history").insert({
      user_id:       userId,
      prediction_id: predictionId,
      season_id:     seasonId,
      item_id:       awarded.id,
      source:        "prediction_players",  // simplified; could be more specific
    })
  }
}

async function updateLeaderboards() {
  const { data: seasons } = await supabase
    .from("seasons")
    .select("id")
    .in("status", ["active", "scoring"])

  for (const season of seasons || []) {
    // Sum prediction_mana_earned per user from season_entries
    const { data: entries } = await supabase
      .from("season_entries")
      .select("user_id, prediction_mana_earned")
      .eq("season_id", season.id)

    if (!entries || entries.length === 0) continue

    const scoreMap = new Map<string, number>()
    for (const entry of entries) {
      scoreMap.set(entry.user_id, entry.prediction_mana_earned ?? 0)
    }

    const rankings = calculateRankings(scoreMap)

    // Get prediction stats per user
    const { data: predStats } = await supabase
      .from("predictions")
      .select("user_id, result, final_points")
      .eq("season_id", season.id)
      .not("scored_at", "is", null)

    const statsByUser = new Map<string, { perfect: number; partial: number; failed: number; week_one_mana: number }>()
    for (const p of predStats || []) {
      const existing = statsByUser.get(p.user_id) ?? { perfect: 0, partial: 0, failed: 0, week_one_mana: 0 }
      if (p.result === 'perfect') existing.perfect++
      if (p.result === 'partial') existing.partial++
      if (p.result === 'failed')  existing.failed++
      existing.week_one_mana += p.final_points ?? 0
      statsByUser.set(p.user_id, existing)
    }

    for (const entry of rankings) {
      const stats = statsByUser.get(entry.userId) ?? { perfect: 0, partial: 0, failed: 0, week_one_mana: 0 }

      await supabase.from("leaderboards").upsert(
        {
          season_id:              season.id,
          user_id:                entry.userId,
          total_points:           entry.totalPoints,
          prediction_mana_earned: entry.totalPoints,
          week_one_mana:          stats.week_one_mana,
          perfect_count:          stats.perfect,
          partial_count:          stats.partial,
          failed_count:           stats.failed,
          predictions_made:       stats.perfect + stats.partial + stats.failed,
          predictions_scored:     stats.perfect + stats.partial + stats.failed,
          rank:                   entry.rank,
          updated_at:             new Date().toISOString(),
        },
        { onConflict: "season_id,user_id" }
      )
    }
  }
}
