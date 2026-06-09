import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Trophy, Target, TrendingUp, ArrowRight, Calendar, Users } from "lucide-react"
import { DashboardLadder } from "@/components/dashboard-ladder"

// ─── Equipment card ────────────────────────────────────────────────────────────

const EQUIPMENT_IMAGES: Record<string, string> = {
  seers_spectacles:   "/equipment/seers-spectacles.png",
  arcanum_esoterica:  "/equipment/arcanum-esoterica.png",
  clockwork_familiar: "/equipment/clockwork-familiar.png",
}

const EQUIPMENT_TIERS: Record<string, { t0: string; t3: string; t6: string; color: string }> = {
  seers_spectacles: {
    t0: "Players window +3% · Reviews window +1",
    t3: "Players window +5% · Reviews window +2",
    t6: "Players window +10% · Reviews window +5",
    color: "text-emerald-400",
  },
  arcanum_esoterica: {
    t0: "+15 mana for partial · +30 mana for perfect",
    t3: "+25 mana for partial · +75 mana for perfect",
    t6: "+25 mana for partial · +75 mana for perfect · +50 mana total reward",
    color: "text-cyan-300",
  },
  clockwork_familiar: {
    t0: "+1 drop for partial · +2 drops for perfect",
    t3: "+1 drop for partial · +2 drops for perfect · +1 booster slot",
    t6: "+1 booster slot · +2 drops total reward",
    color: "text-amber-400",
  },
}

function EquipmentCard({ slug, tierScore }: { slug: string; tierScore: number }) {
  const eq = EQUIPMENT_TIERS[slug]
  if (!eq) return null

  const activeTier = tierScore <= 1 ? 0 : tierScore <= 4 ? 1 : 2
  const image = EQUIPMENT_IMAGES[slug]
  const tierLabel = ["I", "II", "III"][activeTier]

  const rows = [
    { label: "Tier I",   text: eq.t0, tier: 0 },
    { label: "Tier II",  text: eq.t3, tier: 1 },
    { label: "Tier III", text: eq.t6, tier: 2 },
  ]

  const predictionsToNext = tierScore <= 1
    ? `${2 - tierScore} successful prediction${2 - tierScore !== 1 ? "s" : ""} to Tier II`
    : tierScore <= 4
    ? `${5 - tierScore} successful prediction${5 - tierScore !== 1 ? "s" : ""} to Tier III`
    : "Max tier reached"

  return (
    <Card className="border-purple-500/20 bg-purple-950/10 overflow-hidden">
      {image && (
        <div className="aspect-square w-1/2 mx-auto overflow-hidden">
          <img src={image} alt={slug} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-foreground font-display">
            {slug.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
          </CardTitle>
          <span className="font-display text-xs text-purple-400 bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 rounded shrink-0">
            Tier {tierLabel}
          </span>
        </div>

        <div className="space-y-0.5">
          {rows.map(({ label, text, tier }) => {
            const isActive = tier === activeTier
            const isPast   = tier < activeTier
            return (
              <div
                key={tier}
                className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs ${isActive ? "bg-white/[0.06]" : ""}`}
              >
                <span className={`mt-0.5 text-[10px] shrink-0 ${isActive ? eq.color : "text-muted-foreground/50"}`}>
                  {isActive ? "●" : isPast ? "✓" : "○"}
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`font-display text-[9px] tracking-widest uppercase mr-2 ${
                    isActive ? "text-foreground" : "text-muted-foreground/70"
                  }`}>
                    {label}
                  </span>
                  <span className={isActive ? eq.color : isPast ? "text-muted-foreground" : "text-muted-foreground/70"}>
                    {text}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-xs text-muted-foreground font-body text-center pt-1 border-t border-border">
          {predictionsToNext}
        </div>
      </CardContent>
    </Card>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single()

  // Get current active season
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .single()

  // Get user's predictions count for active season
  const { count: predictionsCount } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user?.id)
    .eq("season_id", activeSeason?.id || "")

  // Sum final_points directly from predictions — always current,
  // doesn't depend on the leaderboard cron having run
  const { data: scoredPredictions } = await supabase
    .from("predictions")
    .select("final_points")
    .eq("user_id", user?.id)
    .eq("season_id", activeSeason?.id || "")
    .not("final_points", "is", null)

  const totalPoints = (scoredPredictions ?? []).reduce(
    (sum, p) => sum + (p.final_points ?? 0), 0
  )
  const scoredCount = scoredPredictions?.length ?? 0

  // Check if user has joined the active season
  const { data: seasonEntry } = await supabase
    .from("season_entries")
    .select("*")
    .eq("user_id", user?.id)
    .eq("season_id", activeSeason?.id || "")
    .single()

  // Get user's rank from leaderboard (best effort — may lag behind scoring)
  const { data: leaderboardEntry } = await supabase
    .from("leaderboards")
    .select("rank")
    .eq("user_id", user?.id)
    .eq("season_id", activeSeason?.id || "")
    .single()

  // Get total players in season
  const { count: totalPlayers } = await supabase
    .from("season_entries")
    .select("*", { count: "exact", head: true })
    .eq("season_id", activeSeason?.id || "")

  // Get player's ladder ranking for active season
  const { data: ladderRanking } = user && activeSeason
    ? await supabase
        .from("ladder_rankings")
        .select("ranked_games, locked_game_ids")
        .eq("user_id", user.id)
        .eq("season_id", activeSeason.id)
        .single()
    : { data: null }

  const ladderGameIds = ((ladderRanking?.ranked_games as string[]) ?? []).slice(0, 8)

  const { data: ladderGamesRaw } = ladderGameIds.length > 0
    ? await supabase
        .from("games")
        .select("id, name, header_image_url, is_released")
        .in("id", ladderGameIds)
    : { data: [] }

  // Preserve ranked order
  const ladderGameMap = Object.fromEntries((ladderGamesRaw ?? []).map(g => [g.id, g]))
  const ladderGames = ladderGameIds.map(id => ladderGameMap[id]).filter(Boolean)

  // AO-marked game IDs for this player/season
  const { data: aoMarkedPreds } = user && activeSeason
    ? await supabase
        .from("predictions")
        .select("game_id")
        .eq("user_id", user.id)
        .eq("season_id", activeSeason.id)
        .eq("ao_marked", true)
    : { data: [] }

  const aoGameIds = new Set((aoMarkedPreds ?? []).map(p => p.game_id))

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back to the circle, {profile?.display_name || "Player"}
        </h1>
        <p className="text-muted-foreground">
          {"We await your omens."}
        </p>
      </div>

      {/* Season Banner */}
      {activeSeason ? (
        <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Badge className="mb-2">Active Season</Badge>
                <CardTitle className="text-2xl text-foreground">{activeSeason.name}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {activeSeason.description || "Make your predictions count!"}
                </CardDescription>
              </div>
              {!seasonEntry ? (
                <Button asChild size="lg">
                  <Link href={`/seasons/${activeSeason.id}`}>
                    Join Season
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline" size="lg">
                  <Link href="/games">
                    Make Predictions
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Ends {new Date(activeSeason.end_date).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>{totalPlayers || 0} players</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">No Active Season</CardTitle>
            <CardDescription className="text-muted-foreground">
              {"There's no active season right now. Check back soon for the next competition!"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Three-column layout: equipment | stats | ladder */}
      <div className="grid gap-5 lg:grid-cols-3 items-start">

        {/* Left — Equipment card */}
        <div>
          {activeSeason && seasonEntry?.equipment_id ? (
            <EquipmentCard
              slug={seasonEntry.equipment_id as string}
              tierScore={seasonEntry.equipment_tier_score ?? 0}
            />
          ) : (
            <Card className="border-border h-full">
              <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground font-body text-center h-full">
                {activeSeason ? "Join the season to equip an artifact." : "No active season."}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Center — Stats */}
        <div className="space-y-3">

          {/* Season Score */}
          <Card className="border-amber-500/20 bg-amber-950/20">
            <CardHeader className="flex flex-row items-center justify-between p-4 pb-1">
              <CardTitle className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">Season Score</CardTitle>
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-3 pt-0">
              <div className="text-2xl font-bold text-amber-400">{totalPoints.toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground mt-0.5">total mana earned</p>
            </CardContent>
          </Card>

          {/* Leaderboard Ranking */}
          <Link href="/archives" className="block group">
            <Card className="border-purple-500/20 bg-purple-950/10 transition-colors group-hover:border-purple-500/40">
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-1">
                <CardTitle className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">Leaderboard</CardTitle>
                <TrendingUp className="h-3.5 w-3.5 text-[#9D84D4]" />
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="text-2xl font-bold text-[#9D84D4]">
                  {leaderboardEntry?.rank ? `#${leaderboardEntry.rank}` : "—"}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {leaderboardEntry?.rank ? `of ${totalPlayers || 0}` : "unranked"}
                </p>
                <span className="mt-2 inline-flex items-center text-[10px] font-display tracking-wide text-purple-400 border border-purple-500/40 group-hover:border-purple-500/70 group-hover:bg-purple-950/40 transition-colors px-2 py-0.5 rounded">View Rankings →</span>
              </CardContent>
            </Card>
          </Link>

          {/* Predictions Made */}
          <Link href="/games" className="block group">
            <Card className="border-border transition-colors group-hover:border-border/80">
              <CardHeader className="flex flex-row items-center justify-between p-4 pb-1">
                <CardTitle className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">Predictions</CardTitle>
                <Target className="h-3.5 w-3.5 text-primary" />
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="text-2xl font-bold text-foreground">{predictionsCount || 0}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">this season</p>
                <span className="mt-2 inline-flex items-center text-[10px] font-display tracking-wide text-muted-foreground border border-border group-hover:border-border/60 group-hover:bg-white/[0.04] transition-colors px-2 py-0.5 rounded">View Predictions →</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Right — Season Ladder (vertical 1–8) */}
        <DashboardLadder
          games={ladderGames}
          aoGameIds={[...aoGameIds]}
        />
      </div>
    </div>
  )
}
