import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Trophy, Target, Gamepad2, TrendingUp, Calendar, Users, ArrowRight, Coins } from "lucide-react"
import { ManaIcon } from "@/components/mana-icon"

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

  // Get upcoming games count for active season
  const { count: upcomingGames } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true })
    .eq("is_released", false)

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back to the circle, {profile?.display_name || "Player"}
        </h1>
        <p className="text-muted-foreground">
          {"We await your prophecies."}
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

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">

        {/* Season Points — primary stat, shown prominently */}
        <Card className="border-cyan-500/20 bg-cyan-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Season Mana</CardTitle>
            <ManaIcon size={20} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-300">
              {totalPoints.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {scoredCount > 0
                ? `From ${scoredCount} scored prediction${scoredCount !== 1 ? "s" : ""}`
                : activeSeason ? "No scored predictions yet" : "No active season"}
            </p>
          </CardContent>
        </Card>

        {/* Season Rank */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Season Rank</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {leaderboardEntry?.rank ? `#${leaderboardEntry.rank}` : "--"}
            </div>
            <p className="text-xs text-muted-foreground">
              {leaderboardEntry?.rank
                ? `Out of ${totalPlayers || 0} players`
                : "Rankings update daily"}
            </p>
          </CardContent>
        </Card>

        {/* Predictions Made */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Predictions Made</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {predictionsCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              This season
            </p>
          </CardContent>
        </Card>

        {/* Token Balance */}
        <Card className="border-amber-500/20 bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Token Balance</CardTitle>
            <Coins className="h-4 w-4 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-300">
              {profile?.token_balance?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for season entry
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Browse Games</CardTitle>
            <CardDescription className="text-muted-foreground">
              Explore upcoming releases and make your predictions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/games">
                <Gamepad2 className="mr-2 h-4 w-4" />
                View Games
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Leaderboard</CardTitle>
            <CardDescription className="text-muted-foreground">
              See how you stack up against other players
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/leaderboard">
                <Trophy className="mr-2 h-4 w-4" />
                View Rankings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
