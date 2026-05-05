import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import Image from "next/image"
import { Target, Lock, CheckCircle2, XCircle, Clock, Gamepad2, Zap } from "lucide-react"
import { ManaIcon } from "@/components/mana-icon"

export default async function PredictionsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: predictions } = await supabase
    .from("predictions")
    .select(`
      *,
      games:game_id (
        id,
        name,
        header_image_url,
        steam_appid,
        is_released,
        release_date
      ),
      seasons:season_id (
        id,
        name,
        status
      )
    `)
    .eq("user_id", user?.id || "")
    .order("created_at", { ascending: false })

  // Group by game
  const grouped = (predictions ?? []).reduce((acc, pred) => {
    const key = `${pred.game_id}-${pred.season_id}`
    if (!acc[key]) {
      acc[key] = { game: pred.games, season: pred.seasons, prediction: pred }
    }
    return acc
  }, {} as Record<string, { game: any; season: any; prediction: any }>)

  const groups: Array<{ game: any; season: any; prediction: any }> = Object.values(grouped)

  const totalMana = (predictions ?? []).reduce((sum, p) => sum + (p.final_points ?? 0), 0)
  const scored    = (predictions ?? []).filter(p => p.scored_at).length
  const perfect   = (predictions ?? []).filter(p => p.result === "perfect").length
  const partial   = (predictions ?? []).filter(p => p.result === "partial").length

  function ResultBadge({ result }: { result: string | null }) {
    if (!result) return null
    if (result === "perfect") return (
      <Badge className="bg-success/20 text-success border-success/50 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Perfect
      </Badge>
    )
    if (result === "partial") return (
      <Badge className="bg-warning/20 text-warning border-warning/50 gap-1">
        <CheckCircle2 className="h-3 w-3" /> Partial
      </Badge>
    )
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <XCircle className="h-3 w-3" /> Missed
      </Badge>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Predictions</h1>
          <p className="text-muted-foreground">Track all your predictions across seasons</p>
        </div>
        <Button asChild>
          <Link href="/games">
            <Target className="mr-2 h-4 w-4" />
            Make Prediction
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{predictions?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/20 bg-cyan-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-1">
              <ManaIcon size={14} /> Mana Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-300">{totalMana.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Perfect</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{perfect}</div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Partial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{partial}</div>
          </CardContent>
        </Card>
      </div>

      {/* Predictions list */}
      {groups.length > 0 ? (
        <div className="space-y-4">
          {groups.map(({ game, season, prediction }) => (
            <Card key={`${game?.id}-${season?.id}`} className="border-border overflow-hidden">
              <div className="flex flex-col sm:flex-row">
                {game?.header_image_url && (
                  <div className="relative w-full sm:w-48 h-28 sm:h-auto shrink-0">
                    <Image src={game.header_image_url} alt={game.name ?? ""} fill className="object-cover" />
                  </div>
                )}
                <div className="flex-1 p-4 space-y-3">
                  {/* Game header */}
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{game?.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{season?.name}</span>
                        <Badge variant="secondary" className="scale-90">
                          {season?.status}
                        </Badge>
                        {game?.is_released
                          ? <Badge className="bg-success/20 text-success border-success/50 scale-90">Released</Badge>
                          : <Badge variant="outline" className="scale-90">Upcoming</Badge>
                        }
                      </div>
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/games/${game?.id}`}>View</Link>
                    </Button>
                  </div>

                  {/* Week-one prediction */}
                  <div className={`p-3 rounded-lg border ${
                    prediction.result === "perfect" ? "border-success/30 bg-success/5"
                    : prediction.result === "partial" ? "border-warning/30 bg-warning/5"
                    : prediction.result === "failed"  ? "border-border bg-secondary/20"
                    : prediction.is_locked ? "border-primary/30 bg-primary/5"
                    : "border-border bg-secondary/20"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Week-One Prediction</span>
                        {prediction.early_locked_at && !prediction.is_locked && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                            Early Locked
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <ResultBadge result={prediction.result} />
                        {!prediction.scored_at && prediction.is_locked && (
                          <Lock className="h-4 w-4 text-primary" />
                        )}
                        {!prediction.scored_at && !prediction.is_locked && (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {/* Players */}
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground">Peak Players</div>
                        <div className={`font-mono font-medium ${
                          prediction.players_correct === true ? "text-emerald-400"
                          : prediction.players_correct === false ? "text-muted-foreground line-through"
                          : "text-foreground"
                        }`}>
                          {prediction.players_midpoint?.toLocaleString() ?? "—"}
                        </div>
                        <div className="text-xs text-emerald-600">
                          {prediction.players_window_low?.toLocaleString()} – {prediction.players_window_high?.toLocaleString()}
                        </div>
                        {prediction.actual_player_count != null && (
                          <div className="text-xs text-muted-foreground">
                            Actual: {prediction.actual_player_count.toLocaleString()}
                          </div>
                        )}
                      </div>

                      {/* Reviews */}
                      <div className="space-y-0.5">
                        <div className="text-xs text-muted-foreground">Review Score</div>
                        <div className={`font-mono font-medium ${
                          prediction.reviews_correct === true ? "text-emerald-400"
                          : prediction.reviews_correct === false ? "text-muted-foreground line-through"
                          : "text-foreground"
                        }`}>
                          {prediction.reviews_midpoint != null ? `${prediction.reviews_midpoint}%` : "—"}
                        </div>
                        <div className="text-xs text-emerald-600">
                          {prediction.reviews_window_low}% – {prediction.reviews_window_high}%
                        </div>
                        {prediction.actual_review_score != null && (
                          <div className="text-xs text-muted-foreground">
                            Actual: {Number(prediction.actual_review_score).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Applied boosters */}
                    {prediction.applied_boosters?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {prediction.applied_boosters.map((slug: string) => (
                          <Badge key={slug} variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                            {slug.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Mana earned */}
                    {prediction.final_points != null && (
                      <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <ManaIcon size={14} />
                          <span>Mana earned</span>
                        </div>
                        <span className="font-bold text-cyan-300">+{prediction.final_points}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Gamepad2 className="h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle className="text-lg text-foreground mb-2">No Predictions Yet</CardTitle>
            <CardDescription className="text-center text-muted-foreground mb-4">
              You haven&apos;t made any predictions yet. Browse games to start competing!
            </CardDescription>
            <Button asChild>
              <Link href="/games">Browse Games</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
