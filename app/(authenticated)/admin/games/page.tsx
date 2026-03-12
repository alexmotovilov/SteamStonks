"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Plus, Search, Trash2, RefreshCw, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Game {
  id: string
  steam_appid: number
  name: string
  header_image_url: string | null
  release_date: string | null
  is_released: boolean
  current_player_count: number | null
  review_score_positive: number | null
  review_score_negative: number | null
}

interface SteamSearchResult {
  appid: number
  name: string
}

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [steamSearchQuery, setSteamSearchQuery] = useState("")
  const [steamResults, setSteamResults] = useState<SteamSearchResult[]>([])
  const [searchingStea, setSearchingSteam] = useState(false)
  const [addingGame, setAddingGame] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchGames()
  }, [])

  async function fetchGames() {
    setLoading(true)
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("created_at", { ascending: false })

    if (!error && data) {
      setGames(data)
    }
    setLoading(false)
  }

  async function searchSteam() {
    if (!steamSearchQuery.trim()) return
    
    setSearchingSteam(true)
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(steamSearchQuery)}`)
      const data = await res.json()
      setSteamResults(data.results || [])
    } catch (err) {
      console.error("Steam search failed:", err)
    }
    setSearchingSteam(false)
  }

  async function addGameFromSteam(appid: number, name: string) {
    setAddingGame(appid)
    try {
      // Fetch detailed game info from Steam
      const res = await fetch(`/api/steam/game/${appid}`)
      const gameData = await res.json()

      if (gameData.error) {
        alert("Failed to fetch game details from Steam")
        return
      }

      // Insert into database
      const { error } = await supabase.from("games").insert({
        steam_appid: appid,
        name: gameData.name || name,
        header_image_url: gameData.header_image,
        release_date: gameData.release_date?.date ? new Date(gameData.release_date.date).toISOString().split("T")[0] : null,
        is_released: !gameData.release_date?.coming_soon,
        developer: gameData.developers?.[0],
        publisher: gameData.publishers?.[0],
        genres: gameData.genres?.map((g: { description: string }) => g.description) || [],
      })

      if (error) {
        if (error.code === "23505") {
          alert("This game is already in the database")
        } else {
          alert("Failed to add game: " + error.message)
        }
      } else {
        fetchGames()
        setSteamResults([])
        setSteamSearchQuery("")
        setDialogOpen(false)
      }
    } catch (err) {
      console.error("Failed to add game:", err)
      alert("Failed to add game")
    }
    setAddingGame(null)
  }

  async function deleteGame(id: string) {
    if (!confirm("Are you sure you want to delete this game? This will also delete all predictions for it.")) return

    const { error } = await supabase.from("games").delete().eq("id", id)
    if (!error) {
      setGames(games.filter((g) => g.id !== id))
    }
  }

  async function refreshGameData(game: Game) {
    try {
      const res = await fetch(`/api/steam/game/${game.steam_appid}`)
      const gameData = await res.json()

      if (gameData.error) return

      const { error } = await supabase
        .from("games")
        .update({
          current_player_count: gameData.player_count,
          review_score_positive: gameData.review_positive,
          review_score_negative: gameData.review_negative,
          last_snapshot_at: new Date().toISOString(),
        })
        .eq("id", game.id)

      if (!error) fetchGames()
    } catch (err) {
      console.error("Failed to refresh game data:", err)
    }
  }

  const filteredGames = games.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.steam_appid.toString().includes(searchQuery)
  )

  const getReviewScore = (positive: number | null, negative: number | null) => {
    if (!positive && !negative) return null
    const total = (positive || 0) + (negative || 0)
    if (total === 0) return null
    return Math.round(((positive || 0) / total) * 100)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Games</h1>
          <p className="text-muted-foreground">Add and manage Steam games for predictions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Game
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Game from Steam</DialogTitle>
              <DialogDescription>Search for a game on Steam to add it to the prediction pool</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search Steam games..."
                  value={steamSearchQuery}
                  onChange={(e) => setSteamSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchSteam()}
                />
                <Button onClick={searchSteam} disabled={searchingStea}>
                  {searchingStea ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {steamResults.map((result) => (
                  <div
                    key={result.appid}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div>
                      <p className="font-medium">{result.name}</p>
                      <p className="text-sm text-muted-foreground">AppID: {result.appid}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => addGameFromSteam(result.appid, result.name)}
                      disabled={addingGame === result.appid}
                    >
                      {addingGame === result.appid ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
                {steamResults.length === 0 && steamSearchQuery && !searchingStea && (
                  <p className="text-center text-muted-foreground py-4">No results found</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Games ({games.length})</CardTitle>
          <CardDescription>All games available for predictions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Filter games..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading games...</div>
          ) : filteredGames.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No games match your filter" : "No games added yet. Add your first game!"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Game</TableHead>
                  <TableHead>AppID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Players</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGames.map((game) => {
                  const reviewScore = getReviewScore(game.review_score_positive, game.review_score_negative)
                  return (
                    <TableRow key={game.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {game.header_image_url && (
                            <img
                              src={game.header_image_url}
                              alt={game.name}
                              className="w-16 h-8 object-cover rounded"
                            />
                          )}
                          <div>
                            <p className="font-medium">{game.name}</p>
                            {game.release_date && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(game.release_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`https://store.steampowered.com/app/${game.steam_appid}`}
                          target="_blank"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          {game.steam_appid}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={game.is_released ? "default" : "secondary"}>
                          {game.is_released ? "Released" : "Upcoming"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {game.current_player_count?.toLocaleString() || "-"}
                      </TableCell>
                      <TableCell>
                        {reviewScore !== null ? (
                          <span className={reviewScore >= 70 ? "text-green-500" : reviewScore >= 40 ? "text-yellow-500" : "text-red-500"}>
                            {reviewScore}%
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => refreshGameData(game)}
                            title="Refresh data from Steam"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteGame(game.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
