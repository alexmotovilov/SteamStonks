import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MailboxClient } from "@/components/mailbox-client"
import { ScoringCountdownPanel } from "@/components/scoring-countdown-panel"

function deriveTicker(name: string): string {
  const clean = name.replace(/[™®©]/g, "").trim()
  const words = clean.split(/[\s\-:]+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map(w => w[0]).join("").slice(0, 5).toUpperCase()
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

  // Upcoming games with unscored predictions for this user
  const { data: pendingRaw } = await supabase
    .from("predictions")
    .select("game_id, players_window_low, players_window_high, reviews_window_low, reviews_window_high, games!inner(id, name, ticker_symbol, release_date, release_time_override, is_released)")
    .eq("user_id", user.id)
    .is("result", null)
    .order("game_id")

  const seen = new Set<string>()
  const predWindows: Record<string, { players_window_low: number | null; players_window_high: number | null; reviews_window_low: number | null; reviews_window_high: number | null }> = {}
  const scoringGames = (pendingRaw ?? [])
    .map((p: any) => {
      if (p.games?.id && !predWindows[p.games.id]) {
        predWindows[p.games.id] = {
          players_window_low: p.players_window_low ?? null,
          players_window_high: p.players_window_high ?? null,
          reviews_window_low: p.reviews_window_low ?? null,
          reviews_window_high: p.reviews_window_high ?? null,
        }
      }
      return p.games
    })
    .filter((g: any) => g?.is_released && g?.release_date && !seen.has(g.id) && seen.add(g.id))
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
      const sinceRelease = snaps.filter((s: any) => new Date(s.captured_at) >= new Date(g.release_date))
      const peak_players = sinceRelease.length > 0
        ? Math.max(...sinceRelease.map((s: any) => s.player_count ?? 0))
        : null
      const p0 = snaps[0]?.player_count ?? null
      const p1 = snaps[1]?.player_count ?? null
      const player_trend = (p0 != null && p1 != null)
        ? p0 > p1 ? "up" : p0 < p1 ? "down" : "flat"
        : null
      const r0 = reviewPct(snaps[0])
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
