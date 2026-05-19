import type { CSSProperties } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "lucide-react"

// --- Types ---

export interface PredictionData {
  game_id: string
  players_midpoint: number | null
  reviews_midpoint: number | null
  players_window_low: number | null
  players_window_high: number | null
  reviews_window_low: number | null
  reviews_window_high: number | null
  early_locked_at: string | null
  is_locked: boolean
  result: string | null
  players_correct: boolean | null
  reviews_correct: boolean | null
  final_points: number | null
  scored_at: string | null
  actual_player_count: number | null
  actual_review_score: number | null
}

interface GameCardProps {
  game: {
    id: string
    steam_appid: number
    name: string
    header_image_url: string | null
    release_date: string | null
    release_date_estimated: boolean
    genres: string[] | null
    developer: string | null
    is_released: boolean
    season_id: string | null
    seasons?: {
      id: string
      name: string
      status: string
    } | null
  }
  seasonId?: string
  prediction?: PredictionData | null
  dimmed?: boolean
}

interface PredictionBandProps {
  prediction: PredictionData | null
  gameId: string
  isReleased: boolean
  releaseDate: string | null
}

// --- Helpers ---

function fmtPlayers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1000) return Math.round(n / 1000) + "K"
  return String(n)
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// --- MetricCol sub-component ---

function MetricCol({
  isCorrect,
  val,
  low,
  high,
  scored,
  locked,
}: {
  isCorrect: boolean | null
  val: string
  low: string
  high: string
  scored: boolean
  locked: boolean
}) {
  const valColor = scored
    ? isCorrect ? "text-emerald-400" : "text-amber-400"
    : locked
    ? "text-amber-400"
    : "text-emerald-400"
  const windowColor = scored
    ? isCorrect ? "text-emerald-700" : "text-amber-800"
    : locked
    ? "text-amber-800"
    : "text-muted-foreground"
  const prefix = scored ? (isCorrect ? "✓" : "✗") : locked ? "⚡" : ""

  return (
    <div>
      <div className={`text-xs font-display ${valColor}`}>
        {prefix}{prefix ? " " : ""}{val}
      </div>
      <div className={`text-[10px] font-body ${windowColor}`}>
        {low}–{high}
      </div>
    </div>
  )
}

// --- PredictionBand ---

function PredictionBand({ prediction, gameId, isReleased, releaseDate }: PredictionBandProps) {
  // No prediction made — check if window is still open
  if (!prediction) {
    if (isReleased) {
      // Prediction window closed, nothing submitted
      return (
        <div className="px-3 py-2 border-t border-border flex items-center justify-between gap-2">
          <span className="text-xs font-display text-muted-foreground">Closed</span>
          <span className="text-[10px] font-body text-muted-foreground/60">prediction window passed</span>
        </div>
      )
    }
    return (
      <div className="px-3 py-2 border-t border-border flex items-center justify-between gap-2">
        <span className="text-xs italic text-muted-foreground font-body">No prediction yet</span>
        <span className="text-xs font-display px-2 py-0.5 rounded border border-[#9D84D4] text-[#9D84D4]">
          Predict →
        </span>
      </div>
    )
  }

  const isScored = !!prediction.scored_at && !!prediction.result
  const result = prediction.result
  // Effectively locked if DB flag is set, game has released, or player early-locked
  const effectivelyLocked = prediction.is_locked || isReleased || !!prediction.early_locked_at

  // Prediction values (what the player submitted)
  const playersVal = prediction.players_midpoint !== null ? fmtPlayers(prediction.players_midpoint) : "—"
  const playersLow = prediction.players_window_low !== null ? fmtPlayers(prediction.players_window_low) : "—"
  const playersHigh = prediction.players_window_high !== null ? fmtPlayers(prediction.players_window_high) : "—"
  const reviewsVal = prediction.reviews_midpoint !== null ? `${prediction.reviews_midpoint}%` : "—"
  const reviewsLow = prediction.reviews_window_low !== null ? `${prediction.reviews_window_low}%` : "—"
  const reviewsHigh = prediction.reviews_window_high !== null ? `${prediction.reviews_window_high}%` : "—"

  // Actual values (shown on scored tiles)
  const actualPlayersVal = prediction.actual_player_count !== null
    ? fmtPlayers(prediction.actual_player_count)
    : playersVal
  const actualReviewsVal = prediction.actual_review_score !== null
    ? `${prediction.actual_review_score}%`
    : reviewsVal

  // State 1 & 2: Scored (perfect / partial)
  if (isScored && (result === "perfect" || result === "partial")) {
    const isPerfect = result === "perfect"
    const bandBg = isPerfect ? "rgba(22,163,74,0.04)" : "rgba(202,138,4,0.04)"
    const bandBorderColor = isPerfect ? "rgba(22,163,74,0.3)" : "rgba(202,138,4,0.3)"
    const statusLabel = isPerfect ? "Perfect!" : "Partial"
    const statusColor = isPerfect ? "text-emerald-400" : "text-amber-400"
    const mana = prediction.final_points ?? 0

    return (
      <div
        className="px-3 py-2 border-t"
        style={{ background: bandBg, borderTopColor: bandBorderColor }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-3">
            <MetricCol
              isCorrect={prediction.players_correct}
              val={actualPlayersVal}
              low={playersLow}
              high={playersHigh}
              scored={true}
              locked={false}
            />
            <MetricCol
              isCorrect={prediction.reviews_correct}
              val={actualReviewsVal}
              low={reviewsLow}
              high={reviewsHigh}
              scored={true}
              locked={false}
            />
          </div>
          <div className="text-right shrink-0">
            <div className={`text-xs font-display ${statusColor}`}>{statusLabel}</div>
            <div className="flex items-center justify-end gap-0.5 mt-0.5">
              <img src="/icons/mana-icon.png" alt="" style={{ width: 11, height: 11 }} />
              <span className="text-[10px] font-display text-cyan-300">+{mana.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // State 3: Scored + failed
  if (isScored) {
    return (
      <div className="px-3 py-2 border-t border-border bg-secondary/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-3">
            <div>
              <div className="text-xs font-display text-muted-foreground">✗ {actualPlayersVal}</div>
              <div className="text-[10px] font-body text-muted-foreground/60">{playersLow}–{playersHigh}</div>
            </div>
            <div>
              <div className="text-xs font-display text-muted-foreground">✗ {actualReviewsVal}</div>
              <div className="text-[10px] font-body text-muted-foreground/60">{reviewsLow}–{reviewsHigh}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-display text-muted-foreground">Missed</div>
            {(prediction.final_points ?? 0) > 0 ? (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                <img src="/icons/mana-icon.png" alt="" style={{ width: 11, height: 11 }} />
                <span className="text-[10px] font-display text-cyan-300">+{(prediction.final_points ?? 0).toLocaleString()}</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-0.5 mt-0.5">
                <img src="/icons/mana-icon.png" alt="" style={{ width: 11, height: 11, opacity: 0.45 }} />
                <span className="text-[10px] font-display text-muted-foreground/60">+0</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // State 4: Locked or released, awaiting score (covers is_locked, isReleased, early_locked_at)
  if (effectivelyLocked) {
    return (
      <div
        className="px-3 py-2 border-t"
        style={{ background: "rgba(251,191,36,0.03)", borderTopColor: "rgba(251,191,36,0.25)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-3">
            <MetricCol
              isCorrect={null}
              val={playersVal}
              low={playersLow}
              high={playersHigh}
              scored={false}
              locked={true}
            />
            <MetricCol
              isCorrect={null}
              val={reviewsVal}
              low={reviewsLow}
              high={reviewsHigh}
              scored={false}
              locked={true}
            />
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs font-display text-amber-400">Locked</div>
            <div className="text-[10px] font-body text-muted-foreground">scoring soon</div>
          </div>
        </div>
      </div>
    )
  }

  // State 5: Saved, upcoming game
  const days = daysUntil(releaseDate)
  return (
    <div className="px-3 py-2 border-t border-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3">
          <MetricCol
            isCorrect={null}
            val={playersVal}
            low={playersLow}
            high={playersHigh}
            scored={false}
            locked={false}
          />
          <MetricCol
            isCorrect={null}
            val={reviewsVal}
            low={reviewsLow}
            high={reviewsHigh}
            scored={false}
            locked={false}
          />
        </div>
        <div className="text-right shrink-0">
          <div className="text-xs font-display text-muted-foreground">Saved</div>
          {days !== null && (
            <div className="text-[10px] font-body text-muted-foreground">{days}d left</div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- GameCard ---

export function GameCard({ game, seasonId, prediction, dimmed }: GameCardProps) {
  const shortDate = game.release_date
    ? new Date(game.release_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null

  let borderStyle: CSSProperties = {}
  if (!dimmed && prediction?.scored_at) {
    if (prediction.result === "perfect") borderStyle = { borderColor: "#16a34a" }
    else if (prediction.result === "partial") borderStyle = { borderColor: "#ca8a04" }
  }

  return (
    <Link href={`/games/${game.id}${seasonId ? `?season=${seasonId}` : ""}`} className="block">
      <Card
        className={`overflow-hidden border bg-card transition-colors group cursor-pointer ${
          dimmed ? "opacity-50 grayscale hover:opacity-70" : "hover:border-primary/50"
        }`}
        style={borderStyle}
      >
        {/* Header Image — 90px tall */}
        <div className="relative h-[90px] overflow-hidden">
          {game.header_image_url ? (
            <Image
              src={game.header_image_url}
              alt={game.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <span className="text-muted-foreground text-xs">No Image</span>
            </div>
          )}
        </div>

        {/* Name + meta row */}
        <div className="px-3 pt-2 pb-2">
          <h3 className="font-display text-sm text-foreground line-clamp-1 mb-1">
            {game.name}
          </h3>
          <div className="flex items-center justify-between gap-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {game.is_released ? (
                <Badge className="text-[10px] px-1.5 py-0 h-4 bg-success text-success-foreground shrink-0">
                  Released
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                  Upcoming
                </Badge>
              )}
              {game.seasons?.name && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/50 shrink-0">
                  {game.seasons.name}
                </Badge>
              )}
            </div>
            {shortDate && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                <Calendar className="h-3 w-3" />
                <span>{shortDate}</span>
              </div>
            )}
          </div>
        </div>

        {/* Prediction Band — hidden for dimmed (past-season) cards */}
        {!dimmed && (
          <PredictionBand
            prediction={prediction ?? null}
            gameId={game.id}
            isReleased={game.is_released}
            releaseDate={game.release_date}
          />
        )}
      </Card>
    </Link>
  )
}
