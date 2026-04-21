"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Trophy, Target, TrendingUp, Calendar, Loader2, Check } from "lucide-react"

interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  points_balance: number
  is_admin: boolean
  created_at: string
}

interface Stats {
  totalPredictions: number
  predictionsScored: number
  seasonsJoined: number
  bestRank: number | null
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [username, setUsername] = useState("")

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
        setDisplayName(profileData.display_name || "")
        setUsername(profileData.username || "")
      }

      // Load stats
      const { count: predictionsCount } = await supabase
        .from("predictions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)

      const { count: scoredCount } = await supabase
        .from("predictions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("scored_at", "is", null)

      const { count: seasonsCount } = await supabase
        .from("season_entries")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)

      const { data: bestRankData } = await supabase
        .from("leaderboards")
        .select("rank")
        .eq("user_id", user.id)
        .not("rank", "is", null)
        .order("rank", { ascending: true })
        .limit(1)
        .single()

      setStats({
        totalPredictions: predictionsCount || 0,
        predictionsScored: scoredCount || 0,
        seasonsJoined: seasonsCount || 0,
        bestRank: bestRankData?.rank || null,
      })

      setLoading(false)
    }

    loadProfile()
  }, [])

  async function handleSave() {
    if (!profile) return
    
    setSaving(true)
    setSaved(false)

    const supabase = createClient()
    
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        username: username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
      })
      .eq("id", profile.id)

    setSaving(false)

    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="container py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Profile not found.</p>
      </div>
    )
  }

  const initials = profile.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : "??"

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="container py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Profile</h1>
        <p className="text-muted-foreground">Manage your account and view your stats</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Profile Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your display name and username</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{profile.display_name || "Player"}</p>
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
                {profile.is_admin && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">
                    Admin
                  </span>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                />
                <p className="text-xs text-muted-foreground">
                  Only lowercase letters, numbers, and underscores
                </p>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : saved ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Points Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                <span className="text-3xl font-bold text-foreground">
                  {profile.points_balance.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Target className="h-4 w-4" />
                  <span className="text-sm">Predictions</span>
                </div>
                <span className="font-medium text-foreground">{stats?.totalPredictions || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Scored</span>
                </div>
                <span className="font-medium text-foreground">{stats?.predictionsScored || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">Seasons</span>
                </div>
                <span className="font-medium text-foreground">{stats?.seasonsJoined || 0}</span>
              </div>
              {stats?.bestRank && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="h-4 w-4" />
                    <span className="text-sm">Best Rank</span>
                  </div>
                  <span className="font-medium text-foreground">#{stats.bestRank}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Member since {memberSince}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
