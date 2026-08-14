"use client"

import { useRef, useState, useCallback, useLayoutEffect, useEffect } from "react"
import type { PredictionData } from "./game-card"

type RolodexGame = {
  id: string
  name: string
  header_image_url: string | null
  header_image_position?: string | null
  release_date: string | null
  release_time_override?: string | null
  is_released: boolean
}

interface Props {
  games: RolodexGame[]
  predMap: Record<string, PredictionData>
  onSelect: (gameId: string) => void
}

// letter-background.png is 988×660 — match this ratio exactly so it renders without cropping
const TILE_W = 280
const TILE_H = Math.round(TILE_W * (660 / 988)) // 187
const GAP = 12
const SLOT_H = TILE_H + GAP

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
  if (!isReleased) return { label: "Upcoming", color: "rgba(251,191,36,0.75)" }
  const msSince = launchTime ? now.getTime() - launchTime.getTime() : Infinity
  if (msSince < 7 * 24 * 60 * 60 * 1000) return { label: "Awaiting Scores", color: "#67e8f9" }
  return { label: "Released", color: "#34d399" }
}

function fmtCount(n: number) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`
}

export function MobileGamesRolodex({ games, predMap, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [spacer, setSpacer] = useState(0)
  const [centeredIdx, setCenteredIdx] = useState(0)
  const centeredRef = useRef(0)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    setSpacer(Math.max(0, (el.clientHeight - TILE_H) / 2))
    el.scrollTop = 0
  }, [])

  // Collapse expansion whenever the centered tile changes (user scrolled manually)
  useEffect(() => {
    setExpandedIdx(null)
  }, [centeredIdx])

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const idx = Math.max(0, Math.min(games.length - 1, Math.round(el.scrollTop / SLOT_H)))
    if (idx !== centeredRef.current) {
      centeredRef.current = idx
      setCenteredIdx(idx)
    }
  }, [games.length])

  function scrollToIndex(idx: number) {
    containerRef.current?.scrollTo({ top: idx * SLOT_H, behavior: "smooth" })
  }

  function handleTileClick(e: React.MouseEvent, idx: number) {
    e.stopPropagation()
    if (idx !== centeredIdx) {
      // Off-center: scroll to center, collapse any expanded tile
      setExpandedIdx(null)
      scrollToIndex(idx)
    } else if (expandedIdx !== idx) {
      // Center tile, not expanded: expand it
      setExpandedIdx(idx)
    } else {
      // Center tile, already expanded: open prediction sheet
      onSelect(games[idx].id)
    }
  }

  function handleContainerClick() {
    setExpandedIdx(null)
  }

  if (games.length === 0) {
    return (
      <div style={{
        position: "fixed", left: 0, right: 0,
        top: "calc(156px + 53.4vw + 12px)", bottom: 80,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <p style={{ fontFamily: "IM Fell English, serif", fontSize: 14, color: "rgba(255,255,255,0.4)" }}>
          No games this season
        </p>
      </div>
    )
  }

  return (
    <>
      <style>{`.mgr-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={handleContainerClick}
        className="mgr-scroll"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: "calc(156px + 53.4vw + 8px)",
          bottom: 80,
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 88%, transparent 100%)",
        } as React.CSSProperties}
      >
        <div style={{ height: spacer, flexShrink: 0 }} />

        {games.map((game, idx) => {
          const isCenter = idx === centeredIdx
          const isExpanded = idx === expandedIdx
          const pred = predMap[game.id] ?? null
          const result = pred?.result ?? null
          const hasPred = !!pred
          const status = gameStatus(game)

          const lo = pred?.players_window_low
          const hi = pred?.players_window_high
          const rlo = pred?.reviews_window_low
          const rhi = pred?.reviews_window_high
          const predStr = lo != null && hi != null
            ? `${fmtCount(lo)}–${fmtCount(hi)} · ${Math.round(rlo ?? 0)}–${Math.round(rhi ?? 0)}%`
            : null

          let resultColor = "#67e8f9"
          let resultLabel: string | null = null
          if (result === "perfect") { resultColor = "#34d399"; resultLabel = "Perfect" }
          else if (result === "partial") { resultColor = "#f59e0b"; resultLabel = "Partial" }
          else if (result === "failed") { resultColor = "#6b7280"; resultLabel = "Missed" }

          const borderColor = "transparent"

          return (
            <div
              key={game.id}
              onClick={(e) => handleTileClick(e, idx)}
              style={{
                scrollSnapAlign: "center",
                height: TILE_H,
                width: TILE_W,
                marginLeft: "auto",
                marginRight: "auto",
                marginBottom: GAP,
                position: "relative",
                cursor: "pointer",
                zIndex: isCenter ? 10 : 1,
                transition: "transform 0.22s ease, opacity 0.22s ease, box-shadow 0.22s ease",
                transform: isCenter ? "scale(1.03)" : "scale(0.93)",
                opacity: 1,
                borderRadius: 6,
                border: `1px solid ${borderColor}`,
                overflow: "hidden",
              } as React.CSSProperties}
            >
              {/* Letter parchment — fills tile at natural 988×660 ratio, no cropping */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/letter-background.png"
                alt=""
                draggable={false}
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* Game art — fades in when centered, inset to match desktop letter inset */}
              {game.header_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={game.header_image_url}
                  alt=""
                  draggable={false}
                  style={{
                    position: "absolute",
                    top: "9%", left: "8%", right: "8%", bottom: "7%",
                    width: "84%", height: "84%",
                    objectFit: "cover",
                    objectPosition: game.header_image_position ?? "50% 50%",
                    borderRadius: 3,
                    border: "1px solid rgba(196,168,130,0.25)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.8)",
                    opacity: isExpanded ? 1 : 0,
                    transition: "opacity 0.28s ease",
                  }}
                />
              )}

              {/* Game title — upper portion of tile */}
              <div
                style={{
                  position: "absolute",
                  top: "calc(18% + 17px)", left: "10%", right: "10%",
                  fontFamily: "Cinzel, serif",
                  fontSize: 20,
                  color: "#1c0e05",
                  lineHeight: 1.3,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                  textShadow: "0 1px 3px rgba(255,210,140,0.6), 0 0 8px rgba(255,200,100,0.25)",
                  opacity: isExpanded ? 0 : 1,
                  transition: "opacity 0.18s ease",
                  pointerEvents: "none",
                } as React.CSSProperties}
              >
                {game.name}
              </div>

              {/* Release date — bottom left of tile */}
              {fmtDate(game.release_date) && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "20%", left: "10%",
                    fontFamily: "IM Fell English, serif",
                    fontSize: 18,
                    color: "#3d2010",
                    textShadow: "0 1px 2px rgba(255,210,140,0.4)",
                    opacity: isExpanded ? 0 : 1,
                    transition: "opacity 0.18s ease",
                    pointerEvents: "none",
                  }}
                >
                  {fmtDate(game.release_date)}
                </div>
              )}

              {/* Stamps — bottom-right corner of letter, hides when expanded */}
              {(status.label === "Released" || status.label === "Awaiting Scores") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={status.label === "Released" ? "/released-stamp.png" : "/launch-stamp.png"}
                  alt={status.label === "Released" ? "Released" : "Launched"}
                  style={{
                    position: "absolute",
                    bottom: "calc(9% - 15px)",
                    right: "10%",
                    width: "43.7%",
                    opacity: isExpanded ? 0 : 0.88,
                    transition: "opacity 0.18s ease",
                    pointerEvents: "none",
                    transform: "rotate(-8deg)",
                  }}
                />
              )}

              {/* Expanded overlay — gradient + info at bottom, fades in when expanded */}
              <div
                style={{
                  position: "absolute",
                  top: "9%", left: "8%", right: "8%", bottom: "7%",
                  borderRadius: 3,
                  background: "linear-gradient(to bottom, transparent 0%, rgba(4,2,12,0.55) 40%, rgba(4,2,12,0.94) 100%)",
                  padding: "10px 12px 10px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  gap: 3,
                  opacity: isExpanded ? 1 : 0,
                  transition: "opacity 0.28s ease",
                  pointerEvents: "none",
                } as React.CSSProperties}
              >
                <div style={{
                  fontFamily: "Cinzel, serif",
                  fontSize: 13,
                  color: "#f5e6c8",
                  lineHeight: 1.25,
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                  textShadow: "0 1px 6px rgba(0,0,0,1)",
                }}>
                  {game.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {fmtDate(game.release_date) && (
                    <span style={{ fontFamily: "IM Fell English, serif", fontSize: 10, color: "rgba(245,230,200,0.55)" }}>
                      {fmtDate(game.release_date)}
                    </span>
                  )}
                  <span style={{ fontFamily: "Cinzel, serif", fontSize: 10, color: status.color }}>
                    {status.label}
                  </span>
                </div>
                <div style={{ borderTop: "1px solid rgba(196,168,130,0.22)", paddingTop: 4 }}>
                  {resultLabel ? (
                    <span style={{ fontFamily: "Cinzel, serif", fontSize: 11, color: resultColor }}>
                      {resultLabel}
                      {pred?.final_points ? (
                        <span style={{ fontFamily: "IM Fell English, serif", fontSize: 10, marginLeft: 4, color: "#67e8f9" }}>
                          +{pred.final_points}
                        </span>
                      ) : null}
                    </span>
                  ) : predStr ? (
                    <span style={{ fontFamily: "IM Fell English, serif", fontSize: 10, color: "rgba(103,232,249,0.85)" }}>
                      {predStr}
                    </span>
                  ) : (
                    <span style={{ fontFamily: "Cinzel, serif", fontSize: 10, color: "rgba(251,191,36,0.8)" }}>
                      Tap to predict →
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div style={{ height: spacer, flexShrink: 0 }} />
      </div>
    </>
  )
}
