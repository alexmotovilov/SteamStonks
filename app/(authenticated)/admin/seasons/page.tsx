import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Calendar, Plus, Users, Gamepad2, Trophy } from "lucide-react"

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  active: "bg-success/20 text-success border-success/50",
  scoring: "bg-warning/20 text-warning border-warning/50",
  completed: "bg-muted text-muted-foreground border-border",
}

export default async function AdminSeasonsPage() {
  const supabase = await createClient()

  const { data: seasons } = await supabase
    .from("seasons")
    .select("*")
    .order("start_date", { ascending: false })

  // Get entry counts for each season
  const seasonIds = seasons?.map(s => s.id) || []
  const { data: entryCounts } = await supabase
    .from("season_entries")
    .select("season_id")
    .in("season_id", seasonIds)

  const entryCountMap = entryCounts?.reduce((acc, entry) => {
    acc[entry.season_id] = (acc[entry.season_id] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Season Management</h1>
            <p className="text-muted-foreground">Create and manage seasonal competitions</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/admin/seasons/new">
            <Plus className="mr-2 h-4 w-4" />
            Create Season
          </Link>
        </Button>
      </div>

      {/* Seasons List */}
      {seasons && seasons.length > 0 ? (
        <div className="grid gap-4">
          {seasons.map((season) => (
            <Card key={season.id} className="border-border hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-3">
                      {season.name}
                      <Badge className={statusColors[season.status]}>
                        {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-muted-foreground mt-1">
                      {season.description || "No description"}
                    </CardDescription>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/seasons/${season.id}`}>Manage</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Dates: </span>
                      <span className="text-foreground">
                        {new Date(season.start_date).toLocaleDateString()} - {new Date(season.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Entries: </span>
                      <span className="text-foreground">{entryCountMap[season.id] || 0}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Entry Fee (tokens): </span>
                      <span className="text-foreground">{season.entry_fee_tokens} tokens</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gamepad2 className="h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <span className="text-muted-foreground">Lock Date: </span>
                      <span className="text-foreground">
                        {season.prediction_lock_date 
                          ? new Date(season.prediction_lock_date).toLocaleDateString()
                          : "Not set"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No seasons yet</h3>
            <p className="text-muted-foreground mb-4">Create your first season to get started</p>
            <Button asChild>
              <Link href="/admin/seasons/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Season
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
