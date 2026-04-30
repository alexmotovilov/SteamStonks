"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Lock, Loader2, Target, Trophy, CheckCircle2, XCircle,
  AlertTriangle, Zap, Package, FlaskConical, GripVertical,
  Info, Star, ChevronUp, ChevronDown
} from "lucide-react"
import {
  computePlayersWindow,
  computeReviewsWindow,
  resolveBoosterEffects,
  resolveEquipmentEffects,
  calculateEarlyLockMana,
  type BoosterEffects,
  type EquipmentTierEffect,
} from "@/lib/scoring"
import { distributionToGradient, computeAuguryDistribution } from "@/lib/ladder-scoring"

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  item_id: string
  quantity: number
  items: {
    slug: string
    name: string
    image_url: string | null
    effects: Record<string, number>
    description: string
  }
}

interface ExistingPrediction {
  id: string
  players_midpoint: number | null
  reviews_midpoint: number | null
  players_window_low: number | null
  players_window_high: number | null
  reviews_window_low: number | null
  reviews_window_high: number | null
  early_locked_at: string | null
  is_locked: boolean
  locked_at: string | null
  result: "perfect" | "partial" | "failed" | null
  players_correct: boolean | null
  reviews_correct: boolean | null
  actual_player_count: number | null
  actual_review_score: number | null
  final_points: number | null
  scored_at: string | null
  applied_boosters: string[]
  applied_rites: Record<string, string>
  mana_players: number | null
  mana_reviews: number | null
  mana_both_bonus: number | null
  mana_early_lock: number | null
  mana_boosters: number | null
  mana_equipment: number | null
  mana_first_prediction: number | null
  drops_awarded: number | null
}

interface LadderGame {
  id: string
  name: string
  header_image_url: string | null
  is_released: boolean
}

interface PredictionFormProps {
  gameId: string
  gameName: string
  seasonId: string
  seasonStatus: string
  existingPrediction: ExistingPrediction | null
  isReleased: boolean
  releaseDate: string | null
  predictionLockDate: string | null
  snapshotPlayerCount?: number | null
  snapshotReviewPositive?: number | null
  snapshotReviewNegative?: number | null
  snapshotCapturedAt?: string | null
  // Equipment context
  equipmentSlug: string | null
  equipmentTierScore: number
  // Ladder context (all released games this season in order added)
  ladderGames: LadderGame[]
  existingLadder: string[] // ordered array of game IDs
  lockedLadderGameIds: string[]
  // Inventory for booster selection
  inventory: InventoryItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYERS_MAX = 2000000 // slider upper bound
const PLAYERS_STEP = 1000

// ─── Main component ───────────────────────────────────────────────────────────

export function PredictionForm({
  gameId,
  gameName,
  seasonId,
  seasonStatus,
  existingPrediction,
  isReleased,
  releaseDate,
  predictionLockDate,
  snapshotPlayerCount,
  snapshotReviewPositive,
  snapshotReviewNegative,
  snapshotCapturedAt,
  equipmentSlug,
  equipmentTierScore,
  ladderGames,
  existingLadder,
  lockedLadderGameIds,
  inventory,
}: PredictionFormProps) {
  const router = useRouter()
  const supabase = createClient()

  // ── Lock state ──────────────────────────────────────────────────────────────
  const isSeasonClosed = seasonStatus === "scoring" || seasonStatus === "completed"
  const isPredictionLockPassed = predictionLockDate ? new Date(predictionLockDate) < new Date() : false
  const isEarlyLocked = !!existingPrediction?.early_locked_at && !existingPrediction?.is_locked
  // Sliders and boosters are frozen once early locked OR hard locked OR released OR season closed
  const isLocked = isSeasonClosed || existingPrediction?.is_locked || isEarlyLocked || isReleased

  // ── Ladder initialisation ───────────────────────────────────────────────────
  // Start from existing saved order, then append any season games not yet in it
  const initialiseLadder = () => {
    const existing = existingLadder.length > 0 ? [...existingLadder] : []
    const allIds = ladderGames.map(g => g.id)
    // Append any games not yet in the saved ladder
    for (const id of allIds) {
      if (!existing.includes(id)) existing.push(id)
    }
    return existing.slice(0, 9)
  }

  // ── Prediction state ────────────────────────────────────────────────────────
  const [playersMidpoint, setPlayersMidpoint] = useState(
    existingPrediction?.players_midpoint ?? 50000
  )
  const [reviewsMidpoint, setReviewsMidpoint] = useState(
    existingPrediction?.reviews_midpoint ?? 75
  )

  // ── Booster state ───────────────────────────────────────────────────────────
  const [appliedBoosters, setAppliedBoosters] = useState<string[]>(
    existingPrediction?.applied_boosters ?? []
  )
  const [showBoosterPanel, setShowBoosterPanel] = useState(false)

  // ── Release countdown ──────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState<string | null>(null)

  useEffect(() => {
    if (!releaseDate || isReleased) return

    function updateCountdown() {
      const diff = new Date(releaseDate!).getTime() - Date.now()
      if (diff <= 0) {
        setCountdown(null)
        return
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      setCountdown(
        days > 0
          ? `${days}d ${hours}h ${mins}m until release`
          : `${hours}h ${mins}m until release`
      )
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000)
    return () => clearInterval(interval)
  }, [releaseDate, isReleased])

  // ── Augury heatmap state ────────────────────────────────────────────────────
  const [auguryGradientPlayers, setAuguryGradientPlayers] = useState<string | null>(null)
  const [auguryGradientReviews, setAuguryGradientReviews] = useState<string | null>(null)
  const [auguryExpiry, setAuguryExpiry] = useState<number | null>(null)
  const [auguryRunning, setAuguryRunning] = useState(false)

  // ── Ladder state ────────────────────────────────────────────────────────────
  const [ladder, setLadder] = useState<string[]>(initialiseLadder)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  // ── Saving state ────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Derived window sizes ────────────────────────────────────────────────────
  const boosters = resolveBoosterEffects(appliedBoosters)
  const equipment = resolveEquipmentEffects(equipmentSlug, equipmentTierScore)

  const playersWindow = computePlayersWindow(
    playersMidpoint,
    boosters.players_window_pct_delta + equipment.players_window_pct
  )
  const reviewsWindow = computeReviewsWindow(
    reviewsMidpoint,
    boosters.reviews_window_flat_delta + equipment.reviews_window_flat
  )

  // ── Early lock mana preview ─────────────────────────────────────────────────
  const earlyLockMana = calculateEarlyLockMana(
    existingPrediction?.early_locked_at ?? new Date().toISOString(),
    releaseDate ? new Date(releaseDate) : null
  )

  // ── Max booster slots ───────────────────────────────────────────────────────
  const baseSlots = 2
  const extraSlots = equipment.extra_booster_slots +
    (existingPrediction?.applied_rites?.["sigil_of_multiplicity"] ? 1 : 0)
  const maxSlots = baseSlots + extraSlots

  // ── Augury timer ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!auguryExpiry) return
    const interval = setInterval(() => {
      if (Date.now() >= auguryExpiry) {
        setAuguryGradientPlayers(null)
        setAuguryGradientReviews(null)
        setAuguryExpiry(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [auguryExpiry])

  // ── Snapshot review score ───────────────────────────────────────────────────
  const snapshotReviewScore =
    snapshotReviewPositive != null && snapshotReviewNegative != null &&
    snapshotReviewPositive + snapshotReviewNegative > 0
      ? Math.round((snapshotReviewPositive / (snapshotReviewPositive + snapshotReviewNegative)) * 100)
      : null

  // ── Result state ────────────────────────────────────────────────────────────
  const isScored = !!existingPrediction?.scored_at
  const result = existingPrediction?.result

  // ── Ladder game display ─────────────────────────────────────────────────────
  // Only show released games in ladder (first game gets rank 1 automatically)
  const releasedGames = ladderGames.filter(g => g.is_released)

  // Ladder fully initialised at useState time via initialiseLadder() — no useEffect needed

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleDragStart(index: number) {
    dragItem.current = index
  }

  function handleDragEnter(index: number) {
    dragOverItem.current = index
  }

  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return

    // Cannot drag locked games or released games
    const dragGameId = ladder[dragItem.current]
    const dragGame = ladderGames.find(g => g.id === dragGameId)
    if (lockedLadderGameIds.includes(dragGameId) || dragGame?.is_released) return

    const newLadder = [...ladder]
    const draggedGame = newLadder.splice(dragItem.current, 1)[0]
    newLadder.splice(dragOverItem.current, 0, draggedGame)

    setLadder(newLadder)
    dragItem.current = null
    dragOverItem.current = null
  }

  function moveLadderItem(index: number, direction: "up" | "down") {
    const gameId = ladder[index]
    const moveGame = ladderGames.find(g => g.id === gameId)
    if (lockedLadderGameIds.includes(gameId) || moveGame?.is_released) return

    const newLadder = [...ladder]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= newLadder.length) return

    ;[newLadder[index], newLadder[targetIndex]] = [newLadder[targetIndex], newLadder[index]]
    setLadder(newLadder)
  }

  function toggleBooster(slug: string) {
    if (isLocked) return
    setAppliedBoosters(prev => {
      if (prev.includes(slug)) return prev.filter(s => s !== slug)
      if (prev.length >= maxSlots) return prev
      // Can't apply same booster twice
      return [...prev, slug]
    })
  }

  async function performRitualOfAugury() {
    if (auguryRunning) return
    setAuguryRunning(true)
    setError(null)

    try {
      // Deduct 10 mana via API
      const res = await fetch("/api/rites/augury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game_id: gameId, season_id: seasonId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Ritual failed")

      // Generate gradients from distribution data
      const playersGradient = distributionToGradient(
        computeAuguryDistribution(data.players_midpoints, 0, PLAYERS_MAX)
      )
      const reviewsGradient = distributionToGradient(
        computeAuguryDistribution(data.reviews_midpoints, 0, 100)
      )

      setAuguryGradientPlayers(playersGradient)
      setAuguryGradientReviews(reviewsGradient)
      setAuguryExpiry(Date.now() + 2 * 60 * 1000) // 2 minutes
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ritual of Augury failed")
    } finally {
      setAuguryRunning(false)
    }
  }

  async function handleSavePrediction() {
    if (isLocked) return
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("You must be logged in")

      // Compute windows to store
      const pWindow = playersWindow
      const rWindow = reviewsWindow

      const payload = {
        user_id:             user.id,
        game_id:             gameId,
        season_id:           seasonId,
        prediction_type:     "week_one",
        players_midpoint:    playersMidpoint,
        reviews_midpoint:    reviewsMidpoint,
        players_window_low:  pWindow.low,
        players_window_high: pWindow.high,
        reviews_window_low:  rWindow.low,
        reviews_window_high: rWindow.high,
        applied_boosters:    appliedBoosters,
        updated_at:          new Date().toISOString(),
      }

      if (existingPrediction) {
        const { error: e } = await supabase
          .from("predictions")
          .update(payload)
          .eq("id", existingPrediction.id)
        if (e) throw e
      } else {
        const { error: e } = await supabase
          .from("predictions")
          .insert(payload)
        if (e) throw e
      }

      // Save ladder ranking
      if (ladder.length > 0) {
        await supabase
          .from("ladder_rankings")
          .upsert(
            {
              user_id:      user.id,
              season_id:    seasonId,
              ranked_games: ladder.slice(0, 8),
              updated_at:   new Date().toISOString(),
            },
            { onConflict: "user_id,season_id" }
          )
      }

      setSuccess("Prediction saved!")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  async function handleEarlyLock() {
    if (!existingPrediction || isLocked || isEarlyLocked) return
    setSaving(true)
    setError(null)

    try {
      const { error: e } = await supabase
        .from("predictions")
        .update({ early_locked_at: new Date().toISOString() })
        .eq("id", existingPrediction.id)
      if (e) throw e

      setSuccess("Early lock applied! You'll earn a time bonus.")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to early lock")
    } finally {
      setSaving(false)
    }
  }

  // Deadline lock handled automatically on game release

  // ── Mana reward preview ─────────────────────────────────────────────────────
  const previewMana = (() => {
    let total = earlyLockMana + boosters.mana_total_reward + equipment.mana_total_reward
    // Best case: both correct
    total += 50 + boosters.mana_players_bonus - boosters.mana_players_penalty + equipment.mana_players_bonus
    total += 50 + boosters.mana_reviews_bonus - boosters.mana_reviews_penalty + equipment.mana_reviews_bonus
    total += 50 + equipment.mana_both_bonus
    return total
  })()

  // ── Augury timer remaining ──────────────────────────────────────────────────
  const augurySecondsLeft = auguryExpiry
    ? Math.max(0, Math.ceil((auguryExpiry - Date.now()) / 1000))
    : 0

  // ── Result overlay ──────────────────────────────────────────────────────────
  if (isScored && result) {
    return (
      <ScoredPredictionCard
        result={result}
        gameName={gameName}
        existingPrediction={existingPrediction!}
        snapshotPlayerCount={snapshotPlayerCount}
        snapshotReviewScore={snapshotReviewScore}
      />
    )
  }

  return (
    <TooltipProvider>
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Target className="h-5 w-5 text-primary" />
                {gameName}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Predict week-one performance · Rank in the season ladder
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEarlyLocked && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  Early Locked
                </Badge>
              )}
              {isLocked && (
                <Badge variant="secondary">
                  <Lock className="h-3 w-3 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="border-success/50 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">{success}</AlertDescription>
            </Alert>
          )}

          {/* ── Peak Players Slider ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                24h Peak Player Count (1 week after release)
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Drag to set your predicted midpoint.</p>
                  <p>Window auto-sizes to ±10% of your prediction.</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Custom slider with heatmap overlay */}
            <div className="relative pt-1 pb-1">
              {/* Heatmap overlay */}
              {auguryGradientPlayers && (
                <div
                  className="absolute inset-x-0 top-1 h-3 rounded-full opacity-60 pointer-events-none"
                  style={{ background: auguryGradientPlayers }}
                />
              )}
              {/* Window range indicator */}
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute h-full bg-primary/30 rounded-full border-l-2 border-r-2 border-primary transition-all"
                  style={{
                    left:  `${(playersWindow.low  / PLAYERS_MAX) * 100}%`,
                    right: `${100 - (playersWindow.high / PLAYERS_MAX) * 100}%`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={PLAYERS_MAX}
                step={PLAYERS_STEP}
                value={playersMidpoint}
                disabled={isLocked}
                onChange={e => setPlayersMidpoint(parseInt(e.target.value))}
                className="absolute inset-x-0 top-0 w-full opacity-0 h-5 cursor-pointer disabled:cursor-default"
              />
              {/* Midpoint diamond marker */}
              <div
                className="absolute top-0 w-4 h-4 -mt-0.5 -ml-2 bg-primary rotate-45 rounded-sm border-2 border-background transition-all pointer-events-none"
                style={{ left: `${(playersMidpoint / PLAYERS_MAX) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">0</span>
              <div className="text-center">
                <div className="font-mono font-bold text-foreground text-sm">
                  {playersMidpoint.toLocaleString()}
                </div>
                <div className="text-muted-foreground">
                  Window: {playersWindow.low.toLocaleString()} – {playersWindow.high.toLocaleString()}
                </div>
              </div>
              <span className="text-muted-foreground">2M</span>
            </div>
          </div>

          {/* ── Review Score Slider ─────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                % Positive Reviews (1 week after release)
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Default window: ±{3 + boosters.reviews_window_flat_delta + equipment.reviews_window_flat}%</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="relative pt-1 pb-1">
              {auguryGradientReviews && (
                <div
                  className="absolute inset-x-0 top-1 h-3 rounded-full opacity-60 pointer-events-none"
                  style={{ background: auguryGradientReviews }}
                />
              )}
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute h-full bg-primary/30 rounded-full border-l-2 border-r-2 border-primary transition-all"
                  style={{
                    left:  `${reviewsWindow.low}%`,
                    right: `${100 - reviewsWindow.high}%`,
                  }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={reviewsMidpoint}
                disabled={isLocked}
                onChange={e => setReviewsMidpoint(parseInt(e.target.value))}
                className="absolute inset-x-0 top-0 w-full opacity-0 h-5 cursor-pointer disabled:cursor-default"
              />
              <div
                className="absolute top-0 w-4 h-4 -mt-0.5 -ml-2 bg-primary rotate-45 rounded-sm border-2 border-background transition-all pointer-events-none"
                style={{ left: `${reviewsMidpoint}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">0%</span>
              <div className="text-center">
                <div className="font-mono font-bold text-foreground text-sm">
                  {reviewsMidpoint}%
                </div>
                <div className="text-muted-foreground">
                  Window: {reviewsWindow.low}% – {reviewsWindow.high}%
                </div>
              </div>
              <span className="text-muted-foreground">100%</span>
            </div>
          </div>

          {/* ── Mana Preview ────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Max possible reward</span>
            </div>
            <span className="font-bold text-primary">+{previewMana} mana</span>
          </div>

          {/* ── Season Ladder ────────────────────────────────────────────────── */}
          {ladderGames.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Season Ladder — Highest Peak Players
                </label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Drag games to rank them by predicted highest all-time peak player count. Locked positions cannot be moved. Max 8 games.</p>
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="space-y-1.5">
                {ladder.slice(0, 9).map((gId, index) => {
                  const game = ladderGames.find(g => g.id === gId)
                  const isPending = !game?.is_released
                  if (!game) return null
                  // Lock position if explicitly locked OR if the game has already released
                  const isLockedPos = lockedLadderGameIds.includes(gId) || !!game?.is_released
                  const isExcluded = index === 8 // 9th slot is excluded
                  const isCurrentGame = gId === gameId

                  return (
                    <div
                      key={gId}
                      draggable={!isLockedPos && !isExcluded && !isSeasonClosed}
                      onDragStart={() => handleDragStart(index)}
                      onDragEnter={() => handleDragEnter(index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                        isExcluded
                          ? "opacity-30 border-dashed border-border"
                          : isLockedPos
                          ? "border-border/30 bg-muted/20 opacity-60"
                          : isCurrentGame
                          ? "border-primary/50 bg-primary/5 cursor-grab active:cursor-grabbing"
                          : "border-border bg-secondary/20 cursor-grab active:cursor-grabbing"
                      }`}
                    >
                      <div className="flex items-center gap-2 w-6 shrink-0">
                        {isExcluded ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <span className={`text-xs font-bold ${isLockedPos ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {game.header_image_url && (
                        <img
                          src={game.header_image_url}
                          alt={game.name}
                          className={`w-12 h-6 object-cover rounded ${isLockedPos ? "grayscale" : ""}`}
                        />
                      )}

                      <span className={`text-sm flex-1 truncate ${
                        isLockedPos
                          ? "text-muted-foreground/60"
                          : isCurrentGame
                          ? "text-primary font-medium"
                          : "text-foreground"
                      }`}>
                        {game.name}
                        {isExcluded && (
                          <span className="ml-2 text-xs text-muted-foreground">(excluded from top 8)</span>
                        )}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {isLockedPos ? (
                          <Lock className="h-3 w-3 text-muted-foreground/40" />
                        ) : !isExcluded && !isSeasonClosed ? (
                          <>
                            <button
                              onClick={() => moveLadderItem(index, "up")}
                              disabled={index === 0}
                              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => moveLadderItem(index, "down")}
                              disabled={index >= ladder.length - 1}
                              className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <GripVertical className="h-4 w-4 text-muted-foreground/50" />
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Boosters ─────────────────────────────────────────────────────── */}
          {!isSeasonClosed && (
            <div className="space-y-2">
              <button
                onClick={() => setShowBoosterPanel(p => !p)}
                className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                <Package className="h-4 w-4" />
                Boosters ({appliedBoosters.length}/{maxSlots} applied)
                <span className="text-muted-foreground text-xs ml-auto">
                  {showBoosterPanel ? "Hide" : "Select"}
                </span>
              </button>

              {/* Applied booster chips */}
              {appliedBoosters.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {appliedBoosters.map(slug => {
                    const item = inventory.find(i => i.items.slug === slug)
                    return (
                      <Badge key={slug} variant="outline" className="gap-1 text-xs">
                        {item?.items.image_url && (
                          <img src={item.items.image_url} alt="" className="w-3 h-3 object-contain" />
                        )}
                        {item?.items.name ?? slug}
                        {!isLocked && (
                          <button
                            onClick={() => toggleBooster(slug)}
                            className="ml-1 text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </button>
                        )}
                      </Badge>
                    )
                  })}
                </div>
              )}

              {showBoosterPanel && !isLocked && (
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-border bg-secondary/20">
                  {inventory.filter(i => i.items && i.quantity > 0).map(inv => {
                    const isApplied = appliedBoosters.includes(inv.items.slug)
                    const canApply = !isApplied && appliedBoosters.length < maxSlots

                    return (
                      <button
                        key={inv.item_id}
                        onClick={() => toggleBooster(inv.items.slug)}
                        disabled={!canApply && !isApplied}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                          isApplied
                            ? "border-primary bg-primary/10"
                            : canApply
                            ? "border-border hover:border-primary/50 bg-background"
                            : "border-border opacity-40 cursor-not-allowed bg-background"
                        }`}
                      >
                        {inv.items.image_url && (
                          <img src={inv.items.image_url} alt="" className="w-8 h-8 object-contain rounded" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-foreground truncate">{inv.items.name}</div>
                          <div className="text-xs text-muted-foreground">×{inv.quantity}</div>
                        </div>
                      </button>
                    )
                  })}
                  {inventory.filter(i => i.quantity > 0).length === 0 && (
                    <p className="col-span-2 text-xs text-muted-foreground text-center py-2">
                      No boosters in inventory
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Rites ────────────────────────────────────────────────────────── */}
          {!isSeasonClosed && existingPrediction && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <FlaskConical className="h-4 w-4" />
                Rites
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Ritual of Augury */}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={auguryRunning || !!auguryExpiry || isLocked}
                  onClick={performRitualOfAugury}
                  className="text-xs"
                >
                  {auguryRunning ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Star className="mr-1 h-3 w-3" />
                  )}
                  Ritual of Augury (10 mana)
                  {auguryExpiry && augurySecondsLeft > 0 && (
                    <span className="ml-1 text-primary">{augurySecondsLeft}s</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Action Buttons ────────────────────────────────────────────────── */}
          {!isSeasonClosed && (
            <div className="flex flex-col gap-2">
              {/* Save button — hidden once early or hard locked */}
              {!isLocked && (
                <Button onClick={handleSavePrediction} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {existingPrediction ? "Update Prediction" : "Save Prediction"}
                </Button>
              )}

              {/* Early lock row — button + countdown side by side */}
              {existingPrediction && !isEarlyLocked && !isReleased && !isSeasonClosed && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleEarlyLock}
                    disabled={saving}
                    className="flex-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Early Lock (+{earlyLockMana} mana)
                  </Button>
                  {countdown && (
                    <div className="text-xs text-muted-foreground text-right shrink-0">
                      {countdown}
                    </div>
                  )}
                </div>
              )}

              {/* Early locked state */}
              {isEarlyLocked && (
                <div className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Zap className="h-4 w-4" />
                    Early locked · +{earlyLockMana} mana bonus
                  </div>
                  {countdown && (
                    <div className="text-xs text-muted-foreground">{countdown}</div>
                  )}
                </div>
              )}

              {/* Hard locked by release */}
              {isReleased && existingPrediction && (
                <p className="text-xs text-muted-foreground text-center">
                  <Lock className="inline h-3 w-3 mr-1" />
                  Locked on release · awaiting scoring
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}

// ─── Scored prediction card ───────────────────────────────────────────────────

function ScoredPredictionCard({
  result,
  gameName,
  existingPrediction,
  snapshotPlayerCount,
  snapshotReviewScore,
}: {
  result: "perfect" | "partial" | "failed"
  gameName: string
  existingPrediction: ExistingPrediction
  snapshotPlayerCount?: number | null
  snapshotReviewScore?: number | null
}) {
  const totalMana = existingPrediction.final_points ?? 0
  const isPerfect = result === "perfect"
  const isPartial = result === "partial"

  return (
    <Card className={`border ${
      isPerfect ? "border-success/50" : isPartial ? "border-warning/50" : "border-border"
    }`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${
            isPerfect ? "bg-success/20" : isPartial ? "bg-warning/20" : "bg-muted"
          }`}>
            {isPerfect
              ? <Trophy className="h-5 w-5 text-success" />
              : isPartial
              ? <CheckCircle2 className="h-5 w-5 text-warning" />
              : <XCircle className="h-5 w-5 text-muted-foreground" />
            }
          </div>
          <div>
            <CardTitle className="text-foreground text-base">{gameName}</CardTitle>
            <CardDescription className={
              isPerfect ? "text-success" : isPartial ? "text-warning" : "text-muted-foreground"
            }>
              {isPerfect ? "Perfect!" : isPartial ? "Partial Hit" : "Missed"} · +{totalMana} mana
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Metric results */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className={`p-2 rounded-lg border ${
            existingPrediction.players_correct ? "border-success/30 bg-success/5" : "border-border bg-secondary/20"
          }`}>
            <div className="text-xs text-muted-foreground mb-1">Peak Players</div>
            <div className="font-mono font-bold text-foreground">
              {(snapshotPlayerCount ?? existingPrediction.actual_player_count)?.toLocaleString() ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Predicted: {existingPrediction.players_window_low?.toLocaleString()}–{existingPrediction.players_window_high?.toLocaleString()}
            </div>
          </div>
          <div className={`p-2 rounded-lg border ${
            existingPrediction.reviews_correct ? "border-success/30 bg-success/5" : "border-border bg-secondary/20"
          }`}>
            <div className="text-xs text-muted-foreground mb-1">Review Score</div>
            <div className="font-mono font-bold text-foreground">
              {(snapshotReviewScore ?? existingPrediction.actual_review_score)?.toFixed(1) ?? "—"}%
            </div>
            <div className="text-xs text-muted-foreground">
              Predicted: {existingPrediction.reviews_window_low}%–{existingPrediction.reviews_window_high}%
            </div>
          </div>
        </div>

        {/* Mana breakdown */}
        <div className="space-y-1 text-xs text-muted-foreground">
          {(existingPrediction.mana_players ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Players correct</span>
              <span className="text-success">+{existingPrediction.mana_players}</span>
            </div>
          )}
          {(existingPrediction.mana_reviews ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Reviews correct</span>
              <span className="text-success">+{existingPrediction.mana_reviews}</span>
            </div>
          )}
          {(existingPrediction.mana_both_bonus ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Both correct bonus</span>
              <span className="text-success">+{existingPrediction.mana_both_bonus}</span>
            </div>
          )}
          {(existingPrediction.mana_early_lock ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Early lock bonus</span>
              <span className="text-amber-400">+{existingPrediction.mana_early_lock}</span>
            </div>
          )}
          {(existingPrediction.mana_boosters ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Booster bonus</span>
              <span className="text-primary">+{existingPrediction.mana_boosters}</span>
            </div>
          )}
          {(existingPrediction.mana_equipment ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>Equipment bonus</span>
              <span className="text-primary">+{existingPrediction.mana_equipment}</span>
            </div>
          )}
          {(existingPrediction.mana_first_prediction ?? 0) > 0 && (
            <div className="flex justify-between">
              <span>First prediction bonus</span>
              <span className="text-primary">+{existingPrediction.mana_first_prediction}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-medium text-foreground">
            <span>Total mana earned</span>
            <span className="text-primary">+{totalMana}</span>
          </div>
          {(existingPrediction.drops_awarded ?? 0) > 0 && (
            <div className="flex justify-between text-amber-400">
              <span>Loot drops</span>
              <span>+{existingPrediction.drops_awarded} item{(existingPrediction.drops_awarded ?? 0) !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
