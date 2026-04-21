"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Search, Loader2, Check, ArrowLeft, ExternalLink } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

interface SearchResult {
  appid: number
  name: string
  header_image: string | null
  release_date: string | null
  coming_soon: boolean
}

export default function NominateGamePage() {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedGame, setSelectedGame] = useState<SearchResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (query.length < 2) return

    setSearching(true)
    setError(null)
    setResults([])

    try {
      const response = await fetch(`/api/steam/search?q=${encodeURIComponent(query)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Search failed")
      }

      setResults(data.games || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setSearching(false)
    }
  }

  async function handleNominate() {
    if (!selectedGame) return

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error("You must be logged in to nominate games")
      }

      // Ensure profile exists (for users created before the auto-profile trigger)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single()

      if (!profile) {
        // Create profile for existing user
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: user.id,
            display_name: user.email?.split("@")[0] || "Player",
            username: `${user.email?.split("@")[0] || "player"}_${user.id.substring(0, 4)}`,
          })
        
        if (profileError) {
          throw new Error("Failed to create profile. Please try again.")
        }
      }

      // Get active season
      const { data: activeSeason } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()

      // Check if already nominated
      const { data: existing } = await supabase
        .from("game_nominations")
        .select("id")
        .eq("steam_appid", selectedGame.appid)
        .eq("season_id", activeSeason?.id || null)
        .single()

      if (existing) {
        throw new Error("This game has already been nominated for this season")
      }

      // Submit nomination
      const { error: insertError } = await supabase
        .from("game_nominations")
        .insert({
          steam_appid: selectedGame.appid,
          game_name: selectedGame.name,
          nominated_by: user.id,
          season_id: activeSeason?.id || null,
          status: "pending",
        })

      if (insertError) {
        throw new Error(insertError.message)
      }

      setSuccess(true)
      setTimeout(() => {
        router.push("/games")
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit nomination")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-success/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-success/10 p-4 mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <CardTitle className="text-xl text-foreground mb-2">Nomination Submitted!</CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              {selectedGame?.name} has been submitted for review. 
              You&apos;ll be able to make predictions once approved.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/games">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nominate a Game</h1>
          <p className="text-muted-foreground">
            Search for a Steam game to nominate for prediction
          </p>
        </div>
      </div>

      {/* Search */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Search Steam</CardTitle>
          <CardDescription className="text-muted-foreground">
            Find an upcoming or recently released game to add to this season
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by game name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 bg-input border-border text-foreground"
              />
            </div>
            <Button type="submit" disabled={searching || query.length < 2}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Search Results</CardTitle>
            <CardDescription className="text-muted-foreground">
              Select a game to nominate
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((game) => (
              <button
                key={game.appid}
                onClick={() => setSelectedGame(game)}
                className={`w-full flex items-center gap-4 p-3 rounded-lg border transition-colors text-left ${
                  selectedGame?.appid === game.appid
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-secondary"
                }`}
              >
                {game.header_image && (
                  <Image
                    src={game.header_image}
                    alt={game.name}
                    width={120}
                    height={45}
                    className="rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{game.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {game.release_date || "Release date TBA"}
                  </div>
                </div>
                {game.coming_soon && (
                  <Badge variant="secondary">Upcoming</Badge>
                )}
                {selectedGame?.appid === game.appid && (
                  <Check className="h-5 w-5 text-primary shrink-0" />
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Selected Game Confirmation */}
      {selectedGame && (
        <Card className="border-primary/50">
          <CardHeader>
            <CardTitle className="text-foreground">Confirm Nomination</CardTitle>
            <CardDescription className="text-muted-foreground">
              Review the game details before submitting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              {selectedGame.header_image && (
                <Image
                  src={selectedGame.header_image}
                  alt={selectedGame.name}
                  width={184}
                  height={69}
                  className="rounded"
                />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground">{selectedGame.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {selectedGame.release_date || "Release date TBA"}
                </p>
                <a
                  href={`https://store.steampowered.com/app/${selectedGame.appid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  View on Steam
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedGame(null)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleNominate}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Nomination"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
