import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MailboxClient } from "@/components/mailbox-client"
import { ScoringCountdownPanel } from "@/components/scoring-countdown-panel"

function deriveTicker(name: string): string {
  const clean = name.replace(/[™®©]/g, "").trim()
  const words = clean.split(/[\s\-:]+/).filter(Boolean)
  const initials = words.map(w => w[0]).join("").toUpperCase()
  if (initials.length >= 4) return initials.slice(0, 4)
  // Fewer than 4 words — fill remaining chars from the first word
  return (initials + words[0].slice(1).toUpperCase()).slice(0, 4)
}

function getScoringTime(releaseDate: string, releaseTimeOverride: string | null): Date {
  const base = releaseTimeOverride ? new Date(releaseTimeOverride) : new Date(releaseDate)
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + 7)
  d.setUTCHours(7, 0, 0, 0)
  return d
}

export default async function MailboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  // Get the active season so we only show predictions from it.
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .single()

  // Upcoming games with unscored predictions for this user in the active season.
  // Use games!game_id to disambiguate — predictions has two FKs to games
  // (game_id and ladder_red_slot_game_id added in migration 018).
  const { data: pendingRaw } = await supabase
    .from("predictions")
    .select("game_id, players_window_low, players_window_high, reviews_window_low, reviews_window_high, games!game_id(id, name, ticker_symbol, release_date, release_time_override, is_released, peak_player_count, review_score_positive, review_score_negative)")
    .eq("user_id", user.id)
    .eq("season_id", activeSeason?.id ?? "")
    .is("result", null)
    .order("game_id")

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
      const isReleased = g.is_released || new Date(g.release_date) <= new Date()
      if (!isReleased) return false
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

  // Fetch snapshot data for live stats
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

      // Take the best of both sources: snapshots record every 30-min interval so
      // the true peak (stored in games.peak_player_count by the cron) can exceed
      // any individual snapshot row if the spike occurred between captures.
      const snapPeak = snaps.length > 0
        ? Math.max(...snaps.map((s: any) => s.player_count ?? 0))
        : 0
      const peak_players = Math.max(snapPeak, gs?.peak_player_count ?? 0) || null

      const p0 = snaps[0]?.player_count ?? null
      const p1 = snaps[1]?.player_count ?? null
      const player_trend = (p0 != null && p1 != null)
        ? p0 > p1 ? "up" : p0 < p1 ? "down" : "flat"
        : null

      const r0 = snaps.length > 0
        ? reviewPct(snaps[0])
        : (() => {
            const pos = gs?.review_score_positive, neg = gs?.review_score_negative
            if (pos == null || neg == null || pos + neg === 0) return null
            return (pos / (pos + neg)) * 100
          })()
      const r1 = reviewPct(snaps[1])
      const review_trend = (r0 != null && r1 != null)
        ? r0 > r1 ? "up" : r0 < r1 ? "down" : "flat"
        : null
      return { ...g, ...(predWindows[g.id] ?? {}), peak_players, player_trend, latest_review_pct: r0, review_trend }
    })
  }

  const { data: messages } = await supabase
    .from("mail_messages")
    .select(`
      id, subject, body, created_at, expires_at,
      message_type, metadata, mana_reward, mana_claimed_at, prediction_id, season_id,
      mail_reads!left(read_at, claimed_at, deleted_at),
      mail_attachments(quantity, items:item_id(id, name, slug, image_url)),
      mail_mystery_drops(id, drop_count, revealed_at, revealed_items)
    `)
    .eq("is_published", true)
    .or(`target.eq.all,target_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  const visibleMessages = (messages ?? []).filter((m: any) => {
    const reads = Array.isArray(m.mail_reads) ? m.mail_reads[0] : m.mail_reads
    return !reads?.deleted_at
  })

  const hasUnread = visibleMessages.some((m: any) => {
    const reads = Array.isArray(m.mail_reads) ? m.mail_reads[0] : m.mail_reads
    return !reads?.read_at
  })

  const hasUnclaimed = visibleMessages.some((m: any) => {
    const reads = Array.isArray(m.mail_reads) ? m.mail_reads[0] : m.mail_reads
    const hasManaReward = m.mana_reward != null && !reads?.claimed_at
    const hasAttachments = Array.isArray(m.mail_attachments) && m.mail_attachments.length > 0 && !reads?.claimed_at
    const hasUnrevealedDrops = Array.isArray(m.mail_mystery_drops) && m.mail_mystery_drops.some((d: any) => !d.revealed_at)
    return hasManaReward || hasAttachments || hasUnrevealedDrops
  })

  return (
    <>
    <ScoringCountdownPanel games={enrichedGames} hasUnread={hasUnread} hasUnclaimed={hasUnclaimed} />

    <div style={{
      position: "fixed",
      top: "calc(64px + 5vh + 15px)",
      bottom: "calc(5vh - 23px + 75px)",
      right: "calc(4vw + 15px)",
      left: "5vw",
      padding: "1rem 1.5rem",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
    }}>
      <div style={{ width: "40vw", marginLeft: "auto", flexShrink: 0 }}>
        <MailboxClient messages={visibleMessages as any} />
      </div>
    </div>
    </>
  )
}
