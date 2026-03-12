"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Link from "next/link"
import { ArrowLeft, Check, X, ExternalLink, Loader2 } from "lucide-react"

interface Nomination {
  id: string
  steam_appid: number
  game_name: string
  status: string
  created_at: string
  profiles: {
    display_name: string | null
  } | null
}

export default function NominationsPage() {
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadNominations()
  }, [])

  async function loadNominations() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("game_nominations")
      .select(`
        *,
        profiles:nominated_by (
          display_name
        )
      `)
      .order("created_at", { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setNominations(data || [])
    }
    setLoading(false)
  }

  async function handleApprove(nomination: Nomination) {
    setProcessing(nomination.id)
    setError(null)

    try {
      const supabase = createClient()

      // Fetch game details from Steam
      const response = await fetch(`/api/steam/game/${nomination.steam_appid}`)
      const gameData = await response.json()

      if (!response.ok) {
        throw new Error(gameData.error || "Failed to fetch game details")
      }

      // Add game to catalog
      const { error: gameError } = await supabase.from("games").insert({
        steam_appid: nomination.steam_appid,
        name: gameData.name,
        header_image_url: gameData.header_image,
        release_date: gameData.release_date || null,
        genres: gameData.genres || [],
        developer: gameData.developers?.[0] || null,
        publisher: gameData.publishers?.[0] || null,
        is_released: !gameData.coming_soon,
        current_player_count: gameData.player_count,
        review_score_positive: gameData.reviews?.positive,
        review_score_negative: gameData.reviews?.negative,
      })

      if (gameError && !gameError.message.includes("duplicate")) {
        throw gameError
      }

      // Update nomination status
      const { error: updateError } = await supabase
        .from("game_nominations")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", nomination.id)

      if (updateError) throw updateError

      // Refresh list
      loadNominations()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve nomination")
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject(nominationId: string) {
    setProcessing(nominationId)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("game_nominations")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", nominationId)

      if (updateError) throw updateError

      loadNominations()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject nomination")
    } finally {
      setProcessing(null)
    }
  }

  const pendingNominations = nominations.filter((n) => n.status === "pending")
  const approvedNominations = nominations.filter((n) => n.status === "approved")
  const rejectedNominations = nominations.filter((n) => n.status === "rejected")

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Game Nominations</h1>
          <p className="text-muted-foreground">
            Review and approve community game nominations
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="bg-secondary">
          <TabsTrigger value="pending" className="data-[state=active]:bg-background">
            Pending ({pendingNominations.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-background">
            Approved ({approvedNominations.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="data-[state=active]:bg-background">
            Rejected ({rejectedNominations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </CardContent>
            </Card>
          ) : pendingNominations.length > 0 ? (
            pendingNominations.map((nomination) => (
              <Card key={nomination.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{nomination.game_name}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>App ID: {nomination.steam_appid}</span>
                        <span>By: {nomination.profiles?.display_name || "Unknown"}</span>
                        <span>{new Date(nomination.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`https://store.steampowered.com/app/${nomination.steam_appid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(nomination.id)}
                        disabled={processing === nomination.id}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(nomination)}
                        disabled={processing === nomination.id}
                      >
                        {processing === nomination.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No pending nominations</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedNominations.length > 0 ? (
            approvedNominations.map((nomination) => (
              <Card key={nomination.id} className="border-success/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{nomination.game_name}</h3>
                      <div className="text-sm text-muted-foreground">
                        Nominated by {nomination.profiles?.display_name || "Unknown"}
                      </div>
                    </div>
                    <Badge className="bg-success/20 text-success border-success/50">Approved</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No approved nominations</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          {rejectedNominations.length > 0 ? (
            rejectedNominations.map((nomination) => (
              <Card key={nomination.id} className="border-destructive/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{nomination.game_name}</h3>
                      <div className="text-sm text-muted-foreground">
                        Nominated by {nomination.profiles?.display_name || "Unknown"}
                      </div>
                    </div>
                    <Badge variant="destructive">Rejected</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No rejected nominations</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
