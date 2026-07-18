import { createClient } from "@/lib/supabase/server"
import { type PredictionData } from "@/components/game-card"
import { GamesPageClient } from "@/components/games-page-client"
import { NoScroll } from "@/components/no-scroll"
import { ScoringCountdownPanel } from "@/components/scoring-countdown-panel"
import { CrystalBulletinBoard } from "@/components/crystal-bulletin-board"

function deriveTicker(name: string): string {
  const clean = name.replace(/[™®©]/g, "").trim()
  const words = clean.split(/[\s\-:]+/).filter(Boolean)
  const initials = words.map(w => w[0]).join("").toUpperCase()
  if (initials.length >= 4) return initials.slice(0, 4)
  return (initials + words[0].slice(1).toUpperCase()).slice(0, 4)
}

function getScoringTime(releaseDate: string, releaseTimeOverride: string | null): Date {
  const base = releaseTimeOverride ? new Date(releaseTimeOverride) : new Date(releaseDate)
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + 7)
  d.setUTCHours(7, 0, 0, 0)
  return d
}

export default async function GamesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: currentSeason } = await supabase
    .from("seasons")
    .select("*")
    .in("status", ["active", "upcoming"])
    .order("start_date", { ascending: false })
    .limit(1)
    .single()

  const { data: games } = await supabase
    .from("games")
    .select("id, name, header_image_url, header_image_position, release_date, release_time_override, is_released, season_id")
    .eq("season_id", currentSeason?.id ?? "")
    .order("release_date", { ascending: true })

  const { data: userPredictions } = await supabase
    .from("predictions")
    .select(`
      game_id,
      players_midpoint,
      reviews_midpoint,
      players_window_low,
      players_window_high,
      reviews_window_low,
      reviews_window_high,
      early_locked_at,
      is_locked,
      result,
      players_correct,
      reviews_correct,
      final_points,
      scored_at,
      actual_player_count,
      actual_review_score,
      ao_marked
    `)
    .eq("user_id", user?.id ?? "")
    .eq("season_id", currentSeason?.id ?? "")

  const predMap: Record<string, PredictionData> = Object.fromEntries(
    (userPredictions ?? []).map((p) => [p.game_id, p as PredictionData])
  )

  // --- Scoring countdown data (mirrors mailbox page logic) ---
  const { data: pendingRaw } = user && currentSeason
    ? await supabase
        .from("predictions")
        .select("game_id, players_window_low, players_window_high, reviews_window_low, reviews_window_high, games!game_id(id, name, ticker_symbol, release_date, release_time_override, is_released, peak_player_count, review_score_positive, review_score_negative)")
        .eq("user_id", user.id)
        .eq("season_id", currentSeason.id)
        .is("result", null)
        .order("game_id")
    : { data: [] }

  const seen = new Set<string>()
  const predWindows: Record<string, { players_window_low: number | null; players_window_high: number | null; reviews_window_low: number | null; reviews_window_high: number | null }> = {}
  const gameStats: Record<string, { peak_player_count: number | null; review_score_positive: number | null; review_score_negative: number | null }> = {}
  const scoringGames = (pendingRaw ?? [])
    .map((p: any) => {
      if (p.games?.id && !predWindows[p.games.id]) {
        predWindows[p.games.id] = {
          players_window_low: p.players_window_low ?? null,
          players_window_high: p.players_window_high ?? null,
          reviews_window_low: p.reviews_window_low ?? null,
          reviews_window_high: p.reviews_window_high ?? null,
        }
        gameStats[p.games.id] = {
          peak_player_count: p.games.peak_player_count ?? null,
          review_score_positive: p.games.review_score_positive ?? null,
          review_score_negative: p.games.review_score_negative ?? null,
        }
      }
      return p.games
    })
    .filter((g: any) => {
      if (!g?.release_date || seen.has(g.id)) return false
      const launchTime = g.release_time_override ? new Date(g.release_time_override) : new Date(g.release_date)
      if (!g.is_released && launchTime > new Date()) return false
      seen.add(g.id)
      return true
    })
    .map((g: any) => ({
      id: g.id,
      name: g.name,
      ticker: (g.ticker_symbol ?? deriveTicker(g.name)) as string,
      release_date: g.release_date as string,
      scoring_at: getScoringTime(g.release_date, g.release_time_override ?? null).toISOString(),
    }))
    .sort((a: any, b: any) => new Date(a.scoring_at).getTime() - new Date(b.scoring_at).getTime())
    .slice(0, 3)

  const scoringGameIds = scoringGames.map((g: any) => g.id)
  let enrichedGames: any[] = scoringGames.map((g: any) => ({
    ...g,
    ...(predWindows[g.id] ?? {}),
    peak_players: null,
    player_trend: null,
    latest_review_pct: null,
    review_trend: null,
  }))

  if (scoringGameIds.length > 0) {
    const { data: snapData } = await supabase
      .from("game_snapshots")
      .select("game_id, player_count, review_positive, review_negative, captured_at")
      .in("game_id", scoringGameIds)
      .not("player_count", "is", null)
      .order("captured_at", { ascending: false })

    const byGame: Record<string, any[]> = {}
    for (const s of snapData ?? []) {
      if (!byGame[s.game_id]) byGame[s.game_id] = []
      byGame[s.game_id].push(s)
    }

    function reviewPct(s: any): number | null {
      const pos = s?.review_positive, neg = s?.review_negative
      if (pos == null || neg == null || pos + neg === 0) return null
      return (pos / (pos + neg)) * 100
    }

    enrichedGames = scoringGames.map((g: any) => {
      const snaps = byGame[g.id] ?? []
      const gs = gameStats[g.id]
      const snapPeak = snaps.length > 0 ? Math.max(...snaps.map((s: any) => s.player_count ?? 0)) : 0
      const peak_players = Math.max(snapPeak, gs?.peak_player_count ?? 0) || null
      const p0 = snaps[0]?.player_count ?? null
      const p1 = snaps[1]?.player_count ?? null
      const player_trend = (p0 != null && p1 != null) ? p0 > p1 ? "up" : p0 < p1 ? "down" : "flat" : null
      const r0 = snaps.length > 0
        ? reviewPct(snaps[0])
        : (() => {
            const pos = gs?.review_score_positive, neg = gs?.review_score_negative
            if (pos == null || neg == null || pos + neg === 0) return null
            return (pos / (pos + neg)) * 100
          })()
      const r1 = reviewPct(snaps[1])
      const review_trend = (r0 != null && r1 != null) ? r0 > r1 ? "up" : r0 < r1 ? "down" : "flat" : null
      return { ...g, ...(predWindows[g.id] ?? {}), peak_players, player_trend, latest_review_pct: r0, review_trend }
    })
  }

  return (
    <>
      <NoScroll />
      <ScoringCountdownPanel games={enrichedGames} hasUnread={false} hasUnclaimed={false} />
      <CrystalBulletinBoard left="55px" />
      <GamesPageClient
        games={games ?? []}
        predMap={predMap}
        currentSeasonId={currentSeason?.id ?? null}
      />
    </>
  )
}
