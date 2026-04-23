import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, Trophy, Users, Gamepad2, ArrowLeft, Target, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { JoinSeasonButton } from "@/components/join-season-button"

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  active: "bg-success/20 text-success border-success/50",
  scoring: "bg-warning/20 text-warning border-warning/50",
  completed: "bg-muted text-muted-foreground border-border",
}

export default async function SeasonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", id)
    .single()

  if (!season) {
    notFound()
  }

  const { data: { user } } = await supabase.auth.getUser()

  // Check if user has joined
  const { data: userEntry } = await supabase
    .from("season_entries")
    .select("*")
    .eq("season_id", id)
    .eq("user_id", user?.id || "")
    .single()

  const isJoined = !!userEntry

  // Get user's token balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("id", user?.id || "")
    .single()

  // Get participant count
  const { count: participantCount } = await supabase
    .from("season_entries")
    .select("*", { count: "exact", head: true })
    .eq("season_id", id)

  // Get games for this season
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("release_date", { ascending: true })
    .limit(20)

  // Get user's predictions for this season
  const { data: userPredictions } = await supabase
    .from("predictions")
    .select("game_id")
    .eq("season_id", id)
    .eq("user_id", user?.id || "")

  const predictedGameIds = new Set(userPredictions?.map(p => p.game_id) || [])

  // Get top leaderboard entries
  const { data: leaderboard } = await supabase
    .from("leaderboards")
    .select(`
      total_points,
      rank,
      profiles (
        id,
        display_name,
        username
      )
    `)
    .eq("season_id", id)
    .order("rank", { ascending: true })
    .limit(10)

  const canJoin = season.status === "active" && !isJoined && (profile?.token_balance || 0) >= season.entry_fee_tokens

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/seasons">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">{season.name}</h1>
            <Badge className={statusColors[season.status]}>
              {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
            </Badge>
            {isJoined && (
              <Badge className="bg-success/20 text-success border-success/50">
                Joined
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{season.description}</p>
        </div>
        {canJoin && (
          <JoinSeasonButton 
            seasonId={season.id} 
            entryFee={season.entry_fee_tokens}
            currentBalance={profile?.token_balance || 0}
          />
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duration</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">
              {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{participantCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Entry Fee (tokens)</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{season.entry_fee_tokens} tokens</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prediction Lock</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">
              {season.prediction_lock_date 
                ? new Date(season.prediction_lock_date).toLocaleDateString()
                : "End of season"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Games to Predict */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              Games to Predict
            </h2>
            {isJoined && (
              <Button asChild size="sm">
                <Link href="/games">Browse All Games</Link>
              </Button>
            )}
          </div>

          {!isJoined ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">Join to make predictions</h3>
                <p className="text-muted-foreground mb-4">
                  Spend tokens to unlock predictions and compete for prizes
                </p>
                {canJoin && (
                  <JoinSeasonButton 
                    seasonId={season.id} 
                    entryFee={season.entry_fee_tokens}
                    currentBalance={profile?.token_balance || 0}
                  />
                )}
              </CardContent>
            </Card>
          ) : games && games.length > 0 ? (
            <div className="space-y-3">
              {games.map((game) => {
                const hasPrediction = predictedGameIds.has(game.id)
                
                return (
                  <Card key={game.id} className="border-border hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {game.header_image_url && (
                          <img
                            src={game.header_image_url}
                            alt={game.name}
                            className="w-24 h-14 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-foreground truncate">{game.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {game.release_date
                              ? `Releases ${new Date(game.release_date).toLocaleDateString()}`
                              : "Release date TBA"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasPrediction && (
                            <Badge className="bg-success/20 text-success border-success/50">
                              Predicted
                            </Badge>
                          )}
                          <Button asChild size="sm" variant={hasPrediction ? "outline" : "default"}>
                            <Link href={`/games/${game.id}?season=${season.id}`}>
                              {hasPrediction ? "Edit" : "Predict"}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card className="border-border">
              <CardContent className="py-8 text-center">
                <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No games available yet</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Leaderboard */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Leaderboard
          </h2>
          <Card className="border-border">
            <CardContent className="p-0">
              {leaderboard && leaderboard.length > 0 ? (
                <div className="divide-y divide-border">
                  {leaderboard.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 ${
                        entry.profiles?.id === user?.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 text-center font-bold ${
                          entry.rank === 1 ? "text-yellow-500" :
                          entry.rank === 2 ? "text-gray-400" :
                          entry.rank === 3 ? "text-amber-600" :
                          "text-muted-foreground"
                        }`}>
                          {entry.rank}
                        </span>
                        <span className="text-foreground font-medium">
                          {entry.profiles?.display_name || entry.profiles?.username || "Unknown"}
                        </span>
                      </div>
                      <span className="text-primary font-bold">
                        {entry.total_points?.toLocaleString()} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No scores yet</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/leaderboard?season=${season.id}`}>View Full Leaderboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
