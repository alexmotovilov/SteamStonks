import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Shield, Gamepad2, Users, Trophy, Calendar, FileCheck } from "lucide-react"

export default async function AdminPage() {
  const supabase = await createClient()

  // Get stats
  const { count: usersCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })

  const { count: gamesCount } = await supabase
    .from("games")
    .select("*", { count: "exact", head: true })

  const { count: pendingNominations } = await supabase
    .from("game_nominations")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  const { count: predictionsCount } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true })

  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .single()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage seasons, games, and nominations
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{usersCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Games in Catalog</CardTitle>
            <Gamepad2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{gamesCount || 0}</div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Predictions</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{predictionsCount || 0}</div>
          </CardContent>
        </Card>

        <Card className={`border-border ${pendingNominations ? "border-warning/50" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Nominations</CardTitle>
            <FileCheck className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{pendingNominations || 0}</div>
            {pendingNominations ? (
              <p className="text-xs text-warning">Requires attention</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Active Season */}
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-foreground">Active Season</CardTitle>
            </div>
            <Button asChild size="sm">
              <Link href="/admin/seasons">Manage Seasons</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeSeason ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{activeSeason.name}</h3>
                  <p className="text-sm text-muted-foreground">{activeSeason.description}</p>
                </div>
                <Badge className="bg-success/20 text-success border-success/50">Active</Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Start Date</span>
                  <div className="font-medium text-foreground">
                    {new Date(activeSeason.start_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">End Date</span>
                  <div className="font-medium text-foreground">
                    {new Date(activeSeason.end_date).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Entry Fee (tokens)</span>
                  <div className="font-medium text-foreground">
                    {activeSeason.entry_fee_tokens} tokens
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No active season</p>
              <Button asChild>
                <Link href="/admin/seasons/new">Create Season</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Review Nominations
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Approve or reject community game nominations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/nominations">
                View Nominations
                {pendingNominations ? (
                  <Badge variant="secondary" className="ml-2">{pendingNominations}</Badge>
                ) : null}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-primary" />
              Manage Games
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Add, edit, or update game information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/games">Manage Games</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Manage Users
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              View and manage user accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/admin/users">View Users</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
