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
import { Slider } from "@/components/ui/slider"
import { Lock, Loader2, Target, TrendingUp, CheckCircle2, XCircle, Trophy } from "lucide-react"

interface PredictionFormProps {
  type: "week_one" | "season_end"
  gameId: string
  gameName: string
  seasonId: string
  existingPrediction?: {
    id: string
    player_count_min: number | null
    player_count_max: number | null
    review_score_min: number | null
    review_score_max: number | null
    is_locked: boolean
    locked_at: string | null
    actual_player_count: number | null
    actual_review_score: number | null
    final_points: number | null
    scored_at: string | null
  } | null
  isReleased: boolean
  predictionLockDate?: string | null
  // Live game data for showing preliminary results before formal scoring
  livePlayerCount?: number | null
  liveReviewPositive?: number | null
  liveReviewNegative?: number | null
}

export function PredictionForm({
  type,
  gameId,
  gameName,
  seasonId,
  existingPrediction,
  isReleased,
  predictionLockDate,
  livePlayerCount,
  liveReviewPositive,
  liveReviewNegative,
}: PredictionFormProps) {
  const [playerCountMin, setPlayerCountMin] = useState(
    existingPrediction?.player_count_min ?? 1000
  )
  const [playerCountMax, setPlayerCountMax] = useState(
    existingPrediction?.player_count_max ?? 50000
  )
  const [reviewScoreRange, setReviewScoreRange] = useState([
    existingPrediction?.review_score_min ?? 60,
    existingPrediction?.review_score_max ?? 85,
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  // Week 1 predictions lock when the game releases
  // Season End predictions lock at the admin-set prediction lock date
  const isPredictionLockDatePassed = predictionLockDate 
    ? new Date(predictionLockDate) < new Date() 
    : false
  
  const isLocked = existingPrediction?.is_locked || 
    (type === "week_one" && isReleased) || 
    (type === "season_end" && isPredictionLockDatePassed)
  
  // Determine if prediction has been formally scored
  const isFormallyScored = existingPrediction?.scored_at !== null && existingPrediction?.scored_at !== undefined
  
  // Calculate live review score percentage from positive/negative counts
  const liveReviewScore = (liveReviewPositive !== null && liveReviewPositive !== undefined && 
    liveReviewNegative !== null && liveReviewNegative !== undefined &&
    (liveReviewPositive + liveReviewNegative) > 0)
    ? (liveReviewPositive / (liveReviewPositive + liveReviewNegative)) * 100
    : null
  
  // Use formal scored data if available, otherwise use live data for Week 1 predictions on released games
  const actualPlayerCount = isFormallyScored 
    ? existingPrediction?.actual_player_count 
    : (type === "week_one" && isReleased && existingPrediction) ? livePlayerCount : null
  const actualReviewScore = isFormallyScored 
    ? existingPrediction?.actual_review_score 
    : (type === "week_one" && isReleased && existingPrediction) ? liveReviewScore : null
  
  // Show results if formally scored OR if it's a Week 1 prediction on a released game with live data
  const showResults = isFormallyScored || 
    (type === "week_one" && isReleased && existingPrediction && 
     actualPlayerCount !== null && actualReviewScore !== null)
  
  // Check if predictions were within range
  const playerCountCorrect = actualPlayerCount !== null && actualPlayerCount !== undefined &&
    existingPrediction?.player_count_min !== null && existingPrediction?.player_count_max !== null &&
    actualPlayerCount >= existingPrediction.player_count_min && 
    actualPlayerCount <= existingPrediction.player_count_max
  
  const reviewScoreCorrect = actualReviewScore !== null && actualReviewScore !== undefined &&
    existingPrediction?.review_score_min !== null && existingPrediction?.review_score_max !== null &&
    actualReviewScore >= existingPrediction.review_score_min && 
    actualReviewScore <= existingPrediction.review_score_max
  
  const bothCorrect = playerCountCorrect && reviewScoreCorrect
  const partialCorrect = playerCountCorrect || reviewScoreCorrect
  const finalPoints = existingPrediction?.final_points ?? 0
  const isPreliminary = !isFormallyScored && showResults
  
  const title = type === "week_one" ? "Week 1 Prediction" : "Season End Prediction"
  const description =
    type === "week_one"
      ? "Predict metrics 1 week after release"
      : "Predict metrics at end of season"

  // Calculate multiplier based on range narrowness
  const playerRangeMultiplier = Math.max(1, 2 - (playerCountMax - playerCountMin) / 100000)
  const reviewRangeMultiplier = Math.max(1, 2 - (reviewScoreRange[1] - reviewScoreRange[0]) / 50)
  const estimatedMultiplier = ((playerRangeMultiplier + reviewRangeMultiplier) / 2).toFixed(2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLocked) return

    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in to make predictions")
      }

      // Validate ranges
      if (playerCountMin >= playerCountMax) {
        throw new Error("Player count max must be greater than min")
      }
      if (reviewScoreRange[0] >= reviewScoreRange[1]) {
        throw new Error("Review score max must be greater than min")
      }

      const predictionData = {
        user_id: user.id,
        game_id: gameId,
        season_id: seasonId,
        prediction_type: type,
        player_count_min: playerCountMin,
        player_count_max: playerCountMax,
        review_score_min: reviewScoreRange[0],
        review_score_max: reviewScoreRange[1],
        updated_at: new Date().toISOString(),
      }

      if (existingPrediction) {
        const { error: updateError } = await supabase
          .from("predictions")
          .update(predictionData)
          .eq("id", existingPrediction.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from("predictions")
          .insert(predictionData)

        if (insertError) throw insertError
      }

      setSuccess(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prediction")
    } finally {
      setSaving(false)
    }
  }

  async function handleLockPrediction() {
    if (!existingPrediction || isLocked) return

    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      
      const { error: lockError } = await supabase
        .from("predictions")
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
        })
        .eq("id", existingPrediction.id)

      if (lockError) throw lockError

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock prediction")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id={`prediction-${type}-${gameId}`} className={`border-border relative overflow-hidden ${isLocked && !showResults ? "opacity-75" : ""}`}>
      {/* Result Overlay for Scored Predictions */}
      {showResults && (
        <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-[2px] ${
          bothCorrect 
            ? "bg-success/20" 
            : partialCorrect 
              ? "bg-warning/20" 
              : "bg-destructive/20"
        }`}>
          <div className={`rounded-full p-4 ${
            bothCorrect 
              ? "bg-success/30" 
              : partialCorrect 
                ? "bg-warning/30" 
                : "bg-destructive/30"
          }`}>
            {bothCorrect ? (
              <Trophy className="h-12 w-12 text-success" />
            ) : partialCorrect ? (
              <CheckCircle2 className="h-12 w-12 text-warning" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
          </div>
          <p className={`mt-3 text-lg font-bold ${
            bothCorrect 
              ? "text-success" 
              : partialCorrect 
                ? "text-warning" 
                : "text-destructive"
          }`}>
            {bothCorrect ? "Perfect!" : partialCorrect ? "Partial" : "Missed"}
          </p>
          {isPreliminary ? (
            <p className="text-sm text-muted-foreground mt-1">
              Preliminary Result
            </p>
          ) : (
            <p className="text-2xl font-bold text-foreground mt-1">
              +{finalPoints} pts
            </p>
          )}
          <div className="mt-3 text-xs text-muted-foreground text-center px-4">
            <p>Actual: {actualPlayerCount?.toLocaleString() ?? "N/A"} players</p>
            <p>Review: {actualReviewScore?.toFixed(1) ?? "N/A"}% positive</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-3 text-xs"
            onClick={() => {
              const card = document.getElementById(`prediction-${type}-${gameId}`)
              card?.classList.toggle("show-details")
            }}
          >
            View Details
          </Button>
        </div>
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Target className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            <CardDescription className="text-muted-foreground">{description}</CardDescription>
          </div>
          {isLocked && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Locked
            </Badge>
          )}
          {existingPrediction && !isLocked && (
            <Badge className="bg-success/20 text-success border-success/50">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-success/50 bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Prediction saved successfully!
              </AlertDescription>
            </Alert>
          )}

          {/* Player Count Prediction */}
          <div className="space-y-4">
            <Label className="text-foreground">Peak Concurrent Players</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Minimum</Label>
                <Input
                  type="number"
                  value={playerCountMin}
                  onChange={(e) => setPlayerCountMin(parseInt(e.target.value) || 0)}
                  disabled={isLocked}
                  min={0}
                  className="bg-input border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Maximum</Label>
                <Input
                  type="number"
                  value={playerCountMax}
                  onChange={(e) => setPlayerCountMax(parseInt(e.target.value) || 0)}
                  disabled={isLocked}
                  min={0}
                  className="bg-input border-border text-foreground"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Range: {playerCountMin.toLocaleString()} - {playerCountMax.toLocaleString()} players
            </p>
          </div>

          {/* Review Score Prediction */}
          <div className="space-y-4">
            <Label className="text-foreground">
              Review Score (% Positive): {reviewScoreRange[0]}% - {reviewScoreRange[1]}%
            </Label>
            <Slider
              value={reviewScoreRange}
              onValueChange={setReviewScoreRange}
              min={0}
              max={100}
              step={1}
              disabled={isLocked}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0% (Overwhelmingly Negative)</span>
              <span>100% (Overwhelmingly Positive)</span>
            </div>
          </div>

          {/* Multiplier Preview */}
          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-sm text-muted-foreground">Estimated Multiplier</span>
              </div>
              <span className="text-lg font-bold text-primary">{estimatedMultiplier}x</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Narrower ranges earn higher multipliers. Lock early for additional bonuses.
            </p>
          </div>

          {/* Action Buttons */}
          {!isLocked && (
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : existingPrediction ? (
                  "Update Prediction"
                ) : (
                  "Save Prediction"
                )}
              </Button>
              {existingPrediction && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLockPrediction}
                  disabled={saving}
                >
                  <Lock className="mr-2 h-4 w-4" />
                  Lock In
                </Button>
              )}
            </div>
          )}

          {isLocked && existingPrediction?.locked_at && (
            <p className="text-xs text-muted-foreground text-center">
              Locked on {new Date(existingPrediction.locked_at).toLocaleDateString()}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
