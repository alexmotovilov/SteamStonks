import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, Trophy, Users, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  active: "bg-success/20 text-success border-success/50",
  scoring: "bg-warning/20 text-warning border-warning/50",
  completed: "bg-muted text-muted-foreground border-border",
}

export default async function SeasonsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // Get all seasons
  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .in("status", ["upcoming", "active", "scoring", "completed"])
    .order("start_date", { ascending: false })

  // Get user's entries
  const { data: userEntries } = await supabase
    .from("season_entries")
    .select("season_id")
    .eq("user_id", user?.id || "")

  const userEntrySet = new Set(userEntries?.map(e => e.season_id) || [])

  // Get participant counts
  const { data: allEntries } = await supabase
    .from("season_entries")
    .select("season_id")

  const entryCountMap = allEntries?.reduce((acc, entry) => {
    acc[entry.season_id] = (acc[entry.season_id] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Trophy className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Seasons</h1>
          <p className="text-muted-foreground">
            Join a season to start making predictions and competing for prizes
          </p>
        </div>
      </div>

      {/* Active/Upcoming Seasons */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Available Seasons</h2>
        
        {seasons?.filter(s => s.status === "active" || s.status === "upcoming").length === 0 ? (
          <Card className="border-border">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No active seasons</h3>
              <p className="text-muted-foreground">Check back soon for new competitions</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {seasons?.filter(s => s.status === "active" || s.status === "upcoming").map((season) => {
              const isJoined = userEntrySet.has(season.id)
              const participantCount = entryCountMap[season.id] || 0
              
              return (
                <Card key={season.id} className="border-border hover:border-primary/30 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-foreground flex items-center gap-2">
                          {season.name}
                          <Badge className={statusColors[season.status]}>
                            {season.status === "active" ? "Open" : "Coming Soon"}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                          {season.description || "Predict the success of upcoming game releases"}
                        </CardDescription>
                      </div>
                      {isJoined && (
                        <Badge className="bg-success/20 text-success border-success/50">
                          Joined
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {participantCount} participant{participantCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="text-sm text-foreground font-medium">
                          {season.entry_fee_points} points entry
                        </span>
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/seasons/${season.id}`}>
                          {isJoined ? "View" : "Details"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Past Seasons */}
      {seasons?.filter(s => s.status === "completed" || s.status === "scoring").length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground">Past Seasons</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {seasons?.filter(s => s.status === "completed" || s.status === "scoring").map((season) => (
              <Card key={season.id} className="border-border opacity-75">
                <CardHeader className="pb-2">
                  <CardTitle className="text-foreground text-lg flex items-center gap-2">
                    {season.name}
                    <Badge className={statusColors[season.status]}>
                      {season.status === "scoring" ? "Scoring" : "Completed"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/seasons/${season.id}`}>View Results</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
