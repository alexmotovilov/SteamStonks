import { createClient } from "@/lib/supabase/server"
import { type PredictionData } from "@/components/game-card"
import { GamesTabs } from "@/components/games-tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search, Plus } from "lucide-react"

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

  const allGames = games || []

  // Active: unreleased games in the active season, closest release date first
  const activeGames = allGames
    .filter(g => g.season_id === currentSeason?.id && !g.is_released)
    .sort((a, b) => {
      if (!a.release_date) return 1
      if (!b.release_date) return -1
      return new Date(a.release_date).getTime() - new Date(b.release_date).getTime()
    })

  // Past: released games in the active season, most recently released first
  const pastGames = allGames
    .filter(g => g.season_id === currentSeason?.id && g.is_released)
    .sort((a, b) => {
      if (!a.release_date) return 1
      if (!b.release_date) return -1
      return new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
    })

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
        activeGames={activeGames}
        pastGames={pastGames}
        allGames={allGames}
        predMap={predMap}
        currentSeasonId={currentSeason?.id ?? null}
      />
    </div>
  )
}
