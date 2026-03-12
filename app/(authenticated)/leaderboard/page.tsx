import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Target, TrendingUp, Crown } from "lucide-react"

export default async function LeaderboardPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()

  // Get active season
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .single()

  // Get all seasons for tabs
  const { data: allSeasons } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false })
    .limit(5)

  // Get leaderboard for active season
  const { data: leaderboard } = await supabase
    .from("leaderboards")
    .select(`
      *,
      profiles:user_id (
        display_name,
        avatar_url,
        username
      )
    `)
    .eq("season_id", activeSeason?.id || "")
    .order("total_points", { ascending: false })
    .limit(100)

  // Get user's position
  const userEntry = leaderboard?.find((entry) => entry.user_id === user?.id)

  function getRankIcon(rank: number) {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />
      case 3:
        return <Medal className="h-5 w-5 text-amber-600" />
      default:
        return null
    }
  }

  function getRankStyle(rank: number) {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-yellow-500/20 to-transparent border-yellow-500/50"
      case 2:
        return "bg-gradient-to-r from-gray-400/20 to-transparent border-gray-400/50"
      case 3:
        return "bg-gradient-to-r from-amber-600/20 to-transparent border-amber-600/50"
      default:
        return "border-border"
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
        <p className="text-muted-foreground">
          See how you stack up against other predictors
        </p>
      </div>

      {/* Season Tabs */}
      <Tabs defaultValue={activeSeason?.id || "none"} className="space-y-6">
        <TabsList className="bg-secondary">
          {allSeasons?.map((season) => (
            <TabsTrigger
              key={season.id}
              value={season.id}
              className="data-[state=active]:bg-background"
            >
              {season.name}
              {season.status === "active" && (
                <Badge className="ml-2 scale-75" variant="default">Live</Badge>
              )}
            </TabsTrigger>
          ))}
          {!allSeasons?.length && (
            <TabsTrigger value="none" className="data-[state=active]:bg-background">
              No Seasons
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeSeason?.id || "none"} className="space-y-6">
          {/* User's Position Card */}
          {userEntry && (
            <Card className="border-primary/50 bg-gradient-to-r from-primary/10 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-foreground">Your Position</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold text-primary">
                      #{userEntry.rank || "?"}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {userEntry.total_points?.toLocaleString() || 0} points
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {userEntry.predictions_made || 0} predictions made
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                    <div className="text-lg font-medium text-foreground">
                      {userEntry.accuracy_rate ? `${userEntry.accuracy_rate}%` : "N/A"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Prize Pool Info */}
          {activeSeason && (
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <CardTitle className="text-foreground">Prize Pool</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  Top 10 players win prizes at season end
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <Crown className="h-6 w-6 mx-auto mb-1 text-yellow-500" />
                    <div className="text-xs text-muted-foreground">1st Place</div>
                    <div className="text-sm font-medium text-foreground">Gaming PC</div>
                  </div>
                  <div className="p-3 rounded-lg bg-gray-400/10 border border-gray-400/30">
                    <Medal className="h-6 w-6 mx-auto mb-1 text-gray-400" />
                    <div className="text-xs text-muted-foreground">2nd Place</div>
                    <div className="text-sm font-medium text-foreground">Peripherals</div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-600/10 border border-amber-600/30">
                    <Medal className="h-6 w-6 mx-auto mb-1 text-amber-600" />
                    <div className="text-xs text-muted-foreground">3rd Place</div>
                    <div className="text-sm font-medium text-foreground">$200 Gift Card</div>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary border border-border col-span-2 sm:col-span-2">
                    <Target className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">4th-10th</div>
                    <div className="text-sm font-medium text-foreground">Steam Gift Cards</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leaderboard Table */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Rankings</CardTitle>
              <CardDescription className="text-muted-foreground">
                {leaderboard?.length || 0} players competing this season
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard && leaderboard.length > 0 ? (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => {
                    const rank = index + 1
                    const profile = entry.profiles as { display_name: string | null; avatar_url: string | null; username: string | null } | null
                    const isCurrentUser = entry.user_id === user?.id

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border ${getRankStyle(rank)} ${
                          isCurrentUser ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <div className="w-12 text-center">
                          {getRankIcon(rank) || (
                            <span className="text-lg font-bold text-muted-foreground">
                              {rank}
                            </span>
                          )}
                        </div>
                        
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {profile?.display_name?.slice(0, 2).toUpperCase() || "??"}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {profile?.display_name || "Anonymous"}
                            {isCurrentUser && (
                              <Badge variant="outline" className="ml-2 scale-75">You</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.predictions_made || 0} predictions
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-foreground">
                            {entry.total_points?.toLocaleString() || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">points</div>
                        </div>

                        {entry.accuracy_rate && (
                          <div className="text-right hidden sm:block">
                            <div className="flex items-center gap-1 text-sm">
                              <TrendingUp className="h-3 w-3 text-success" />
                              <span className="text-foreground">{entry.accuracy_rate}%</span>
                            </div>
                            <div className="text-xs text-muted-foreground">accuracy</div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium text-foreground mb-2">No Rankings Yet</p>
                  <p className="text-muted-foreground">
                    Be the first to make predictions and climb the leaderboard!
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Placeholder for other seasons */}
        {allSeasons?.filter((s) => s.id !== activeSeason?.id).map((season) => (
          <TabsContent key={season.id} value={season.id}>
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-foreground mb-2">{season.name}</p>
                <p className="text-muted-foreground">
                  {season.status === "completed" 
                    ? "Season completed. Rankings archived."
                    : "Season not started yet."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
