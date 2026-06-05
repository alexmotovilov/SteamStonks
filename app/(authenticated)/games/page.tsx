import { createClient } from "@/lib/supabase/server"
import { type PredictionData } from "@/components/game-card"
import { GamesTabs } from "@/components/games-tabs"
import { EQUIPMENT_IMAGES } from "@/components/join-season-button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search, Plus } from "lucide-react"

const EQUIPMENT_NAMES: Record<string, string> = {
  seers_spectacles:   "Seer's Spectacles",
  arcanum_esoterica:  "Arcanum Esoterica",
  clockwork_familiar: "Clockwork Familiar",
}

export default async function GamesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get active/upcoming season (the one players are currently participating in)
  const { data: currentSeason } = await supabase
    .from("seasons")
    .select("*")
    .in("status", ["active", "upcoming"])
    .order("start_date", { ascending: false })
    .limit(1)
    .single()

  // Get all games with their season's status so we can categorise them
  const { data: games } = await supabase
    .from("games")
    .select(`
      *,
      seasons:season_id (
        id,
        name,
        status
      )
    `)
    .order("release_date", { ascending: false })

  // Get user's predictions for the current season (full data for prediction band)
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
    .eq("user_id", user?.id || "")
    .eq("season_id", currentSeason?.id || "")

  const predMap: Record<string, PredictionData> = Object.fromEntries(
    (userPredictions || []).map((p) => [p.game_id, p as PredictionData])
  )

  // Fetch season entry for equipment indicator
  const { data: seasonEntry } = user && currentSeason
    ? await supabase
        .from("season_entries")
        .select("equipment_id, equipment_tier_score")
        .eq("user_id", user.id)
        .eq("season_id", currentSeason.id)
        .single()
    : { data: null }

  // Categorise games
  const currentSeasonGames = games?.filter(
    (g) => g.season_id && g.seasons?.status &&
      ["active", "upcoming"].includes(g.seasons.status)
  ) || []

  const pastSeasonGames = games?.filter(
    (g) => g.season_id && g.seasons?.status &&
      ["completed", "scoring"].includes(g.seasons.status)
  ) || []

  const allGames = games || []

  const defaultTab = currentSeason ? "current" : "all"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Games</h1>
          <p className="text-muted-foreground">
            Browse games and make your predictions
          </p>
        </div>
        <Button asChild>
          <Link href="/games/nominate">
            <Plus className="mr-2 h-4 w-4" />
            Nominate a Game
          </Link>
        </Button>
      </div>

      {/* Active Season Banner */}
      {currentSeason && (
        <Card className="border-primary/50">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Badge>{currentSeason.status === "active" ? "Active Season" : "Upcoming Season"}</Badge>
              <span className="text-lg font-semibold text-foreground">{currentSeason.name}</span>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Make predictions for games in this season. Predictions lock when the game releases.
            </p>
            {seasonEntry?.equipment_id && (
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {EQUIPMENT_IMAGES[seasonEntry.equipment_id] && (
                  <img
                    src={EQUIPMENT_IMAGES[seasonEntry.equipment_id]}
                    alt={EQUIPMENT_NAMES[seasonEntry.equipment_id] ?? seasonEntry.equipment_id}
                    className="w-5 h-5 rounded object-cover"
                  />
                )}
                <span className="font-display text-[10px] text-muted-foreground">
                  {EQUIPMENT_NAMES[seasonEntry.equipment_id] ?? seasonEntry.equipment_id}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="font-body text-[10px]">
                  Tier {(seasonEntry.equipment_tier_score ?? 0) <= 1 ? 1 : (seasonEntry.equipment_tier_score ?? 0) <= 4 ? 2 : 3}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search (UI only for now) */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search games..."
          className="pl-10 bg-input border-border"
          disabled
        />
      </div>

      {/* Games Tabs — client component to avoid Radix ID hydration mismatch */}
      <GamesTabs
        currentSeason={currentSeason}
        currentSeasonGames={currentSeasonGames}
        pastSeasonGames={pastSeasonGames}
        allGames={allGames}
        predMap={predMap}
        defaultTab={defaultTab}
      />
    </div>
  )
}
