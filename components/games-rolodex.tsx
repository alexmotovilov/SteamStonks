"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { PredictionData } from "./game-card"

type RolodexGame = {
  id: string
  name: string
  header_image_url: string | null
  release_date: string | null
  release_time_override?: string | null
  is_released: boolean
}

interface Props {
  games: RolodexGame[]
  predMap: Record<string, PredictionData>
  currentSeasonId: string | null
  onSelect?: (gameId: string) => void
}

// Card widths in vw units — drives height naturally via letter image aspect ratio
const CARD_VW     = 14   // default card width (vw)
const CARD_HOV_VW = 20   // expanded card width (vw)
const RISE_VH     = 5    // how far hovered card rises (vh)
const SPREAD_VW   = 1.2  // how far adjacent cards spread (vw)

function fmtDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

function gameStatus(game: RolodexGame): { label: string; color: string } {
  const now = new Date()
  const launchTime = game.release_time_override
    ? new Date(game.release_time_override)
    : game.release_date ? new Date(game.release_date) : null
  const isReleased = game.is_released || (launchTime !== null && launchTime <= now)
  if (!isReleased) return { label: "Upcoming", color: "rgba(251,191,36,0.65)" }
  const msSince = launchTime ? now.getTime() - launchTime.getTime() : Infinity
  if (msSince < 7 * 24 * 60 * 60 * 1000) return { label: "Released · Awaiting Scores", color: "#67e8f9" }
  return { label: "Released", color: "#34d399" }
}

function formatPlayerCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}

function predDisplay(pred: PredictionData | null): string | null {
  if (!pred) return null
  const { players_window_low, players_window_high, reviews_window_low, reviews_window_high } = pred
  if (players_window_low == null || players_window_high == null || reviews_window_low == null || reviews_window_high == null) return null
  const playerRange = `${formatPlayerCount(players_window_low)}–${formatPlayerCount(players_window_high)}`
  const reviewRange = `${Math.round(reviews_window_low)}%–${Math.round(reviews_window_high)}%`
  return `${playerRange} / ${reviewRange}`
}

export function GamesRolodex({ games, predMap, currentSeasonId, onSelect }: Props) {
  const router = useRouter()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoveredIdx = games.findIndex(g => g.id === hoveredId)

  const N = games.length

  // Fit all cards in 92vw; cap step so cards always fit without overflow
  const stepVw = N > 1
    ? Math.min(CARD_VW - 1, (92 - CARD_HOV_VW) / (N - 1))
    : CARD_HOV_VW
  const totalVw = N > 1 ? (N - 1) * stepVw + CARD_HOV_VW : CARD_HOV_VW

  return (
    <>
      <style>{`
        @keyframes rolodex-shimmer {
          0%   { background-position: -1200px 0; }
          100% { background-position: 1200px 0; }
        }
      `}</style>
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          width: `${totalVw}vw`,
          transform: "translateX(-50%)",
          height: "80vh",
          zIndex: 35,
          pointerEvents: "none",
        }}
      >
        {games.map((game, i) => {
          const isHov = hoveredId === game.id
          const pred  = predMap[game.id] ?? null
          const ranges = predDisplay(pred)
          const hasPred = pred !== null
          const status = gameStatus(game)

          // Result display for scored predictions (expanded panel)
          let resultColor = "#67e8f9"
          let resultLabel: string | null = null
          if (pred?.result === "perfect") { resultColor = "#34d399"; resultLabel = "Perfect" }
          else if (pred?.result === "partial") { resultColor = "#f59e0b"; resultLabel = "Partial" }
          else if (pred?.result === "failed") { resultColor = "#6b7280"; resultLabel = "Missed" }

          let spreadX = 0
          if (hoveredIdx >= 0) {
            if (i < hoveredIdx) spreadX = -SPREAD_VW
            else if (i > hoveredIdx) spreadX = SPREAD_VW
          }

          // No-prediction tiles get a shimmer sweep; tiles with a prediction are plain dark
          const panelExtra: React.CSSProperties = hasPred
            ? { background: "rgba(8,6,4,0.62)" }
            : {
                background: "linear-gradient(to right, rgba(8,6,4,0.62) 8%, rgba(196,168,80,0.10) 18%, rgba(8,6,4,0.62) 33%)",
                backgroundSize: "1200px 100%",
                animation: "rolodex-shimmer 2.8s linear infinite",
              }

          return (
            <div
              key={game.id}
              style={{
                position: "absolute",
                left: `${i * stepVw}vw`,
                bottom: 0,
                zIndex: isHov ? 100 : N - i,
                transform: `translateX(${spreadX}vw) translateY(${isHov ? -RISE_VH : 0}vh)`,
                transition: "transform 0.32s ease",
                pointerEvents: "auto",
              }}
            >
              <div
                style={{ display: "block" }}
                onClick={() => onSelect ? onSelect(game.id) : router.push(`/games/${game.id}${currentSeasonId ? `?season=${currentSeasonId}` : ""}`)}
              >
                <div
                  onMouseEnter={() => setHoveredId(game.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: "relative",
                    width: `${isHov ? CARD_HOV_VW : CARD_VW}vw`,
                    transition: "width 0.32s ease, box-shadow 0.32s ease",
                    boxShadow: isHov
                      ? "0 24px 56px rgba(0,0,0,0.95), 0 0 20px rgba(196,168,130,0.10)"
                      : "0 8px 24px rgba(0,0,0,0.80)",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {/* Letter parchment — drives card height via aspect ratio */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/letter-background.png"
                    alt=""
                    style={{ width: "100%", height: "auto", display: "block" }}
                    draggable={false}
                  />

                  {/* Game image — inset to same footprint as text panel, fades in on hover */}
                  {game.header_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.header_image_url}
                      alt=""
                      style={{
                        position: "absolute",
                        top: "9%", left: "8%", right: "8%", bottom: "7%",
                        width: "84%",
                        height: "84%",
                        objectFit: "cover",
                        borderRadius: "4px",
                        border: "1px solid rgba(196,168,130,0.3)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.8)",
                        opacity: isHov ? 1 : 0,
                        transition: "opacity 0.32s ease",
                      }}
                    />
                  )}

                  {/* Collapsed: text panel fills the inset area */}
                  <div
                    style={{
                      position: "absolute",
                      top: "9%", left: "8%", right: "8%", bottom: "7%",
                      ...panelExtra,
                      backdropFilter: "blur(2px)",
                      WebkitBackdropFilter: "blur(2px)",
                      borderRadius: "4px",
                      padding: "6% 7%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      overflow: "hidden",
                      opacity: isHov ? 0 : 1,
                      transition: "opacity 0.2s ease",
                      pointerEvents: "none",
                    }}
                  >
                    {/* Title — always 2 lines tall for visual parity */}
                    <div
                      className="font-display"
                      style={{
                        fontSize: "1.0vw",
                        color: "#f5e6c8",
                        lineHeight: 1.3,
                        minHeight: "2.6em",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                        textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                      }}
                    >
                      {game.name}
                    </div>
                    {/* Release Date */}
                    {fmtDate(game.release_date) && (
                      <div className="font-body" style={{ fontSize: "0.68vw", color: "rgba(245,230,200,0.45)" }}>
                        {fmtDate(game.release_date)}
                      </div>
                    )}
                    {/* Status */}
                    <div>
                      <span className="font-display" style={{ fontSize: "0.65vw", color: status.color }}>{status.label}</span>
                    </div>
                  </div>

                  {/* Expanded: text overlay at bottom of image, fades in on hover */}
                  <div
                    style={{
                      position: "absolute",
                      left: "8%", right: "8%", bottom: "7%",
                      borderRadius: "0 0 4px 4px",
                      background: "linear-gradient(to bottom, transparent 0%, rgba(4,3,2,0.88) 35%, rgba(4,3,2,0.97) 100%)",
                      padding: "14% 7% 6%",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      opacity: isHov ? 1 : 0,
                      transition: "opacity 0.32s ease",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      className="font-display"
                      style={{
                        fontSize: "1.1vw",
                        color: "#f5e6c8",
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                        textShadow: "0 1px 6px rgba(0,0,0,1)",
                      }}
                    >
                      {game.name}
                    </div>
                    {fmtDate(game.release_date) && (
                      <div className="font-body" style={{ fontSize: "0.68vw", color: "rgba(245,230,200,0.5)" }}>
                        {fmtDate(game.release_date)}
                      </div>
                    )}
                    <div>
                      <span className="font-display" style={{ fontSize: "0.68vw", color: status.color }}>{status.label}</span>
                    </div>
                    <div style={{ marginTop: "5px", paddingTop: "5px", borderTop: "1px solid rgba(196,168,130,0.18)" }}>
                      {resultLabel ? (
                        <div className="font-display" style={{ fontSize: "0.85vw", color: resultColor }}>
                          {resultLabel}
                          {pred?.final_points ? (
                            <span className="font-body" style={{ fontSize: "0.72vw", marginLeft: "4px", color: "#67e8f9" }}>
                              +{pred.final_points}
                            </span>
                          ) : null}
                        </div>
                      ) : ranges ? (
                        <div className="font-body" style={{ fontSize: "0.72vw", color: "rgba(103,232,249,0.70)" }}>
                          <span style={{ color: "rgba(245,230,200,0.45)" }}>Your Prognos: </span>{ranges}
                        </div>
                      ) : (
                        <div className="font-body" style={{ fontSize: "0.62vw", color: "rgba(245,230,200,0.35)" }}>
                          No prediction yet
                        </div>
                      )}
                      <div className="font-body" style={{ fontSize: "0.62vw", marginTop: "3px", color: "rgba(245,230,200,0.28)" }}>
                        Click to open →
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
