"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Search, Trash2, RefreshCw, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Game {
  id: string
  steam_appid: number
  name: string
  ticker_symbol: string | null
  header_image_url: string | null
  header_image_position: string | null
  release_date: string | null
  release_time_override: string | null
  is_released: boolean
  peak_24h_player_count: number | null
  peak_player_count: number | null
  review_score_positive: number | null
  review_score_negative: number | null
  season_id: string | null
}

interface Season {
  id: string
  name: string
  status: string
}

interface SteamSearchResult {
  appid: number
  name: string
}

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [steamSearchQuery, setSteamSearchQuery] = useState("")
  const [steamResults, setSteamResults] = useState<SteamSearchResult[]>([])
  const [searchingSteam, setSearchingSteam] = useState(false)
  const [addingGame, setAddingGame] = useState<number | null>(null)
  const [assigningGame, setAssigningGame] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, string>>({})
  const supabase = createClient()

  useEffect(() => {
    fetchGames()
    fetchSeasons()
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

  async function fetchSeasons() {
    const { data } = await supabase
      .from("seasons")
      .select("id, name, status")
      .order("start_date", { ascending: false })

    if (data) setSeasons(data)
  }

  async function assignSeason(gameId: string, seasonId: string | null) {
    setAssigningGame(gameId)
    const { error } = await supabase
      .from("games")
      .update({ season_id: seasonId, updated_at: new Date().toISOString() })
      .eq("id", gameId)

    if (!error) {
      setGames(games.map((g) =>
        g.id === gameId ? { ...g, season_id: seasonId } : g
      ))
    } else {
      console.error("Failed to assign season:", error)
    }
    setAssigningGame(null)
  }

  async function searchSteam() {
    if (!steamSearchQuery.trim()) return

    setSearchingSteam(true)
    try {
      const res = await fetch(`/api/steam/search?q=${encodeURIComponent(steamSearchQuery)}`)
      const data = await res.json()
      setSteamResults(data.games || data.results || [])
    } catch (err) {
      console.error("Steam search failed:", err)
    }
    setSearchingSteam(false)
  }

  async function addGameFromSteam(appid: number, name: string) {
    setAddingGame(appid)
    try {
      const res = await fetch(`/api/steam/game/${appid}`)
      const gameData = await res.json()

      if (gameData.error) {
        alert("Failed to fetch game details from Steam")
        return
      }

      let releaseDate = null
      if (gameData.release_date && typeof gameData.release_date === "string") {
        try {
          const parsed = new Date(gameData.release_date)
          if (!isNaN(parsed.getTime())) {
            releaseDate = parsed.toISOString().split("T")[0]
          }
        } catch {
          console.log("[v0] Could not parse release date:", gameData.release_date)
        }
      }

      const { error } = await supabase.from("games").insert({
        steam_appid: appid,
        name: gameData.name || name,
        header_image_url: gameData.header_image,
        release_date: releaseDate,
        is_released: !gameData.coming_soon,
        developer: gameData.developers?.[0],
        publisher: gameData.publishers?.[0],
        genres: gameData.genres || [],
        peak_24h_player_count: gameData.player_count || null,
        review_score_positive: gameData.reviews?.positive || null,
        review_score_negative: gameData.reviews?.negative || null,
        last_snapshot_at: new Date().toISOString(),
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
    if (!confirm("Are you sure you want to delete this game? This will also delete all predictions and snapshots for it.")) return

    const res = await fetch(`/api/admin/games/${id}`, { method: "DELETE" })
    if (res.ok) {
      setGames(games.filter((g) => g.id !== id))
    } else {
      const body = await res.json().catch(() => ({}))
      alert("Delete failed: " + (body.error ?? res.statusText))
    }
  }

  async function refreshGameData(game: Game) {
    try {
      const res = await fetch(`/api/steam/game/${game.steam_appid}`)
      const gameData = await res.json()

      if (gameData.error) return

      let releaseDate = game.release_date
      if (gameData.release_date && typeof gameData.release_date === "string") {
        try {
          const parsed = new Date(gameData.release_date)
          if (!isNaN(parsed.getTime())) {
            releaseDate = parsed.toISOString().split("T")[0]
          }
        } catch {
          // Keep existing release date
        }
      }

      const { error } = await supabase
        .from("games")
        .update({
          peak_24h_player_count: gameData.player_count || null,
          review_score_positive: gameData.reviews?.positive || null,
          review_score_negative: gameData.reviews?.negative || null,
          is_released: !gameData.coming_soon,
          release_date: releaseDate,
          last_snapshot_at: new Date().toISOString(),
        })
        .eq("id", game.id)

      if (!error) fetchGames()
    } catch (err) {
      console.error("Failed to refresh game data:", err)
    }
  }

  async function setTickerSymbol(gameId: string, value: string | null) {
    const { error } = await supabase
      .from("games")
      .update({ ticker_symbol: value || null, updated_at: new Date().toISOString() })
      .eq("id", gameId)
    if (!error) {
      setGames(games.map(g => g.id === gameId ? { ...g, ticker_symbol: value || null } : g))
    }
  }

  async function setImagePosition(gameId: string, value: string) {
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, header_image_position: value } : g))
    await supabase
      .from("games")
      .update({ header_image_position: value })
      .eq("id", gameId)
  }

  async function setReleaseOverride(gameId: string, value: string | null) {
    const { error } = await supabase
      .from("games")
      .update({ release_time_override: value, updated_at: new Date().toISOString() })
      .eq("id", gameId)
    if (!error) {
      setGames(games.map(g => g.id === gameId ? { ...g, release_time_override: value } : g))
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

  const getSeasonName = (seasonId: string | null) => {
    if (!seasonId) return null
    return seasons.find((s) => s.id === seasonId)?.name ?? null
  }

  return (
    <div className="container mx-auto space-y-6">
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
                <Button onClick={searchSteam} disabled={searchingSteam}>
                  {searchingSteam ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
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
                {steamResults.length === 0 && steamSearchQuery && !searchingSteam && (
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
          <CardDescription>All games available for predictions. Use the Season column to assign games to an active season.</CardDescription>
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
                  <TableHead>Season</TableHead>
                  <TableHead>Peak Players</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Launch Override (UTC)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGames.map((game) => {
                  const reviewScore = getReviewScore(game.review_score_positive, game.review_score_negative)
                  const isAssigning = assigningGame === game.id

                  return (
                    <TableRow key={game.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {game.header_image_url && (
                            <div
                              className="relative rounded overflow-hidden cursor-crosshair shrink-0"
                              style={{ width: 96, height: 54 }}
                              title="Click to set image crop position"
                              onClick={e => {
                                const rect = e.currentTarget.getBoundingClientRect()
                                const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
                                const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
                                setImagePosition(game.id, `${x}% ${y}%`)
                              }}
                            >
                              <img
                                src={game.header_image_url}
                                alt={game.name}
                                className="w-full h-full"
                                style={{ objectFit: "cover", objectPosition: game.header_image_position ?? "50% 50%" }}
                              />
                              {/* Crosshair showing current anchor */}
                              {(() => {
                                const parts = (game.header_image_position ?? "50% 50%").split(" ")
                                return (
                                  <div
                                    className="absolute w-2.5 h-2.5 rounded-full border-2 border-white pointer-events-none"
                                    style={{
                                      left: `calc(${parts[0]} - 5px)`,
                                      top: `calc(${parts[1] ?? "50%"} - 5px)`,
                                      boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
                                      background: "rgba(255,255,255,0.25)",
                                    }}
                                  />
                                )
                              })()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{game.name}</p>
                            {game.release_date && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(game.release_date).toLocaleDateString("en-US", { timeZone: "UTC" })}
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
                        <Select
                          value={game.season_id ?? "unassigned"}
                          onValueChange={(value) =>
                            assignSeason(game.id, value === "unassigned" ? null : value)
                          }
                          disabled={isAssigning || seasons.find(s => s.id === game.season_id)?.status === "completed"}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue>
                              {isAssigning ? (
                                <span className="text-muted-foreground">Saving...</span>
                              ) : game.season_id ? (
                                getSeasonName(game.season_id) ?? (
                                  <span className="text-muted-foreground italic">Unknown season</span>
                                )
                              ) : (
                                <span className="text-muted-foreground">Unassigned</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">
                              <span className="text-muted-foreground">Unassigned</span>
                            </SelectItem>
                            {seasons.filter(s => s.status !== "completed").map((season) => (
                              <SelectItem key={season.id} value={season.id}>
                                <div className="flex items-center gap-2">
                                  {season.name}
                                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                                    {season.status}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                            {seasons.filter(s => s.status !== "completed").length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                No active seasons
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {game.peak_player_count?.toLocaleString() || "-"}
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
                      <TableCell>
                        <input
                          type="text"
                          maxLength={5}
                          placeholder="auto"
                          className="text-xs bg-transparent border border-border rounded px-1 py-0.5 text-foreground w-16 uppercase"
                          title="Ticker symbol (max 5 chars) — leave blank to auto-derive from game name"
                          value={game.ticker_symbol ?? ""}
                          onChange={e => setTickerSymbol(game.id, e.target.value.toUpperCase())}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <input
                            type="datetime-local"
                            className="text-xs bg-transparent border border-border rounded px-1 py-0.5 text-foreground w-44"
                            title="Exact UTC launch time — overrides release_date for countdown and is_released check"
                            value={
                              game.id in pendingOverrides
                                ? pendingOverrides[game.id]
                                : game.release_time_override ? game.release_time_override.slice(0, 16) : ""
                            }
                            onChange={e => setPendingOverrides(p => ({ ...p, [game.id]: e.target.value }))}
                          />
                          {game.id in pendingOverrides && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-xs"
                              onClick={() => {
                                const val = pendingOverrides[game.id]
                                setReleaseOverride(game.id, val ? val + ":00.000Z" : null)
                                setPendingOverrides(p => { const n = { ...p }; delete n[game.id]; return n })
                              }}
                            >
                              OK
                            </Button>
                          )}
                        </div>
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
