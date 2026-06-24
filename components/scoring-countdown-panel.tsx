"use client"

import { useState, useEffect } from "react"

interface CountdownGame {
  id: string
  name: string
  ticker: string
  scoring_at: string
  peak_players: number | null
  player_trend: "up" | "down" | "flat" | null
  latest_review_pct: number | null
  review_trend: "up" | "down" | "flat" | null
  players_window_low: number | null
  players_window_high: number | null
  reviews_window_low: number | null
  reviews_window_high: number | null
}

function inPlayersRange(g: CountdownGame): boolean {
  return g.peak_players != null && g.players_window_low != null && g.players_window_high != null
    && g.peak_players >= g.players_window_low && g.peak_players <= g.players_window_high
}

function inReviewsRange(g: CountdownGame): boolean {
  return g.latest_review_pct != null && g.reviews_window_low != null && g.reviews_window_high != null
    && g.latest_review_pct >= g.reviews_window_low && g.latest_review_pct <= g.reviews_window_high
}

function formatPeak(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return String(n)
}

function trendIcon(trend: "up" | "down" | "flat" | null): string {
  return trend === "down" ? "▼" : "▲"
}

function trendColor(trend: "up" | "down" | "flat" | null): string {
  if (trend === "up") return "#34d399"
  if (trend === "down") return "#f87171"
  return "#94a3b8"
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00:00"
  const s = Math.floor(ms / 1000)
  const dd = Math.floor(s / 86400)
  const hh = Math.floor((s % 86400) / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return [dd, hh, mm, ss].map(n => String(n).padStart(2, "0")).join(":")
}

// ─── Independent row positions — adjust each freely ───────────────
const ROW_POSITIONS: React.CSSProperties[] = [
  { top: "calc(64px + 5vh + 17px)",   left: "175px" },  // Row 1 (nearest)
  { top: "calc(64px + 13vh + 9.5px)", left: "175px" },  // Row 2
  { top: "calc(64px + 21vh + 2px)",   left: "175px" },  // Row 3
]

// ─── Single combined panel style ───────────────────────────────
const ROW_PANEL_STYLE: React.CSSProperties = {
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  background: "rgba(0,0,0,0.58)",
  borderRadius: 6,
  padding: "5px 14px",
  display: "flex",
  alignItems: "center",
  gap: "14px",
}

export function ScoringCountdownPanel({ games }: { games: CountdownGame[] }) {
  const [now, setNow] = useState(Date.now())
  const [active, setActive] = useState<CountdownGame[]>(games)

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setActive(prev => prev.filter(g => new Date(g.scoring_at).getTime() > t))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {ROW_POSITIONS.map((pos, i) => {
        const game = active[i]
        const ms = game ? new Date(game.scoring_at).getTime() - now : null
        return (
          <div
            key={i}
            style={{
              position: "fixed",
              ...pos,
              display: "flex",
              gap: "8px",
              zIndex: 55,
              pointerEvents: "none",
            }}
          >
            <div style={ROW_PANEL_STYLE}>
              {game ? (
                <span className="font-display text-sm tabular-nums" style={{ letterSpacing: "0.44em" }}>
                  <span style={{ color: "#f59e0b", letterSpacing: "0.08em", marginRight: "6px" }}>{game.ticker}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)", marginRight: "6px", letterSpacing: 0 }}>|</span>
                  <span style={{ color: trendColor(game.player_trend) }}>{trendIcon(game.player_trend)}</span>
                  <span style={{ color: inPlayersRange(game) ? "#34d399" : "rgba(255,255,255,0.85)" }}>
                    {formatPeak(game.peak_players)}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 6px" }}>,</span>
                  <span style={{ color: trendColor(game.review_trend) }}>{trendIcon(game.review_trend)}</span>
                  <span style={{ color: inReviewsRange(game) ? "#34d399" : "rgba(255,255,255,0.85)" }}>
                    {game.latest_review_pct != null ? `${Math.round(game.latest_review_pct)}%` : "—"}
                  </span>
                </span>
              ) : (
                <span className="font-display text-sm tabular-nums" style={{ letterSpacing: "0.44em" }}>
                  <span style={{ color: "#f59e0b", letterSpacing: "0.08em", marginRight: "6px" }}>TICK</span>
                  <span style={{ color: "rgba(255,255,255,0.2)", marginRight: "6px", letterSpacing: 0 }}>|</span>
                  <span style={{ color: "#94a3b8" }}>▲</span>
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>0000.0K</span>
                  <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 6px" }}>,</span>
                  <span style={{ color: "#94a3b8" }}>▲</span>
                  <span style={{ color: "rgba(255,255,255,0.85)" }}>00%</span>
                </span>
              )}
              <span style={{ color: "rgba(255,255,255,0.15)", letterSpacing: 0 }}>|</span>
              <span className="font-display text-sm text-cyan-300 tabular-nums" style={{ letterSpacing: 0 }}>
                {(ms != null ? formatCountdown(ms) : "DD:HH:MM:SS").split(":").map((part, i) => (
                  <span key={i}>
                    {i > 0 && <span style={{ margin: "0 8.5px", opacity: 0.55 }}>:</span>}
                    {part}
                  </span>
                ))}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}
