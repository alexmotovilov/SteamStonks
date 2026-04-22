import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, ArrowLeft, Users, Trophy, Gamepad2, Play, CheckCircle, Clock } from "lucide-react"
import { SeasonStatusActions } from "@/components/admin/season-status-actions"
import { ManualSnapshotButton } from "@/components/admin/manual-snapshot-button"

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

  // Get participant count
  const { count: participantCount } = await supabase
    .from("season_entries")
    .select("*", { count: "exact", head: true })
    .eq("season_id", id)

  // Get games for this season
  const { data: games, count: gameCount } = await supabase
    .from("games")
    .select("*", { count: "exact" })
    .order("release_date", { ascending: true })

  // Get prediction count
  const { count: predictionCount } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true })
    .eq("season_id", id)

  // Calculate prize pool (entry fee * participants)
  const prizePool = (season.entry_fee_points || 0) * (participantCount || 0)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="icon">
            <Link href="/admin/seasons">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">{season.name}</h1>
              <Badge className={statusColors[season.status]}>
                {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground">{season.description || "No description"}</p>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/seasons/${id}/edit`}>Edit Season</Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Games</CardTitle>
            <Gamepad2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{gameCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Predictions</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{predictionCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Prize Pool</CardTitle>
            <Trophy className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{prizePool.toLocaleString()} pts</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Season Details */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Season Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium text-foreground">
                  {new Date(season.start_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium text-foreground">
                  {new Date(season.end_date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Prediction Lock</p>
                <p className="font-medium text-foreground">
                  {season.prediction_lock_date
                    ? new Date(season.prediction_lock_date).toLocaleString()
                    : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entry Fee</p>
                <p className="font-medium text-foreground">{season.entry_fee_points} points</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Slug</p>
              <p className="font-mono text-sm text-foreground">{season.slug}</p>
            </div>
          </CardContent>
        </Card>

        {/* Status Management */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Status Management
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Change the season status to control availability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeasonStatusActions seasonId={season.id} currentStatus={season.status} />
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Manual recovery — use if the automatic snapshot failed or needs to be re-taken.
              </p>
              <ManualSnapshotButton
                seasonId={season.id}
                seasonName={season.name}
                currentStatus={season.status}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Games in Season */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              Games ({gameCount || 0})
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/games">Manage Games</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {games && games.length > 0 ? (
            <div className="space-y-3">
              {games.slice(0, 10).map((game) => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border"
                >
                  <div className="flex items-center gap-3">
                    {game.header_image_url && (
                      <img
                        src={game.header_image_url}
                        alt={game.name}
                        className="w-16 h-9 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium text-foreground">{game.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {game.release_date
                          ? new Date(game.release_date).toLocaleDateString()
                          : "TBA"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={game.is_released ? "default" : "secondary"}>
                    {game.is_released ? "Released" : "Upcoming"}
                  </Badge>
                </div>
              ))}
              {(gameCount || 0) > 10 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {(gameCount || 0) - 10} more games...
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gamepad2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No games added to this season yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
