"use client"

import { useRef, useState, useCallback, useLayoutEffect, useEffect } from "react"
import type { PredictionData } from "./game-card"
import { PerfectMoteOverlay } from "./perfect-mote-overlay"

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
const TILE_W = 252
const TILE_H = Math.round(TILE_W * (660 / 988)) // 168
const GAP = 6
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

  const [stampJitter, setStampJitter] = useState<Record<string, { status: { dx: number; dy: number; rot: number }; score: { dx: number; dy: number; rot: number }; result: { dx: number; dy: number; rot: number } }>>({})
  useEffect(() => {
    const rand = (n: number) => (Math.random() * 2 - 1) * n
    setStampJitter(Object.fromEntries(games.map(g => [
      g.id,
      {
        status: { dx: rand(5), dy: rand(5), rot: rand(5) },
        result: { dx: rand(5), dy: rand(5), rot: rand(5) },
        score:  { dx: Math.random() * 5, dy: Math.random() * 5, rot: rand(7) },
      }
    ])))
  }, [])

  const [shimmerKeys, setShimmerKeys] = useState<Record<string, number>>({})
  useEffect(() => {
    const g = games[centeredIdx]
    if (g) setShimmerKeys(prev => ({ ...prev, [g.id]: (prev[g.id] ?? 0) + 1 }))
  }, [centeredIdx])

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
      <style>{`
        .mgr-scroll::-webkit-scrollbar { display: none; }
        @keyframes shimmer-partial {
          0%   { background-position: -150% 50%; }
          50%  { background-position: 200% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes shimmer-perfect {
          0%   { background-position: -150% 50%; }
          50%  { background-position: 200% 50%; }
          100% { background-position: 200% 50%; }
        }
      `}</style>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onClick={handleContainerClick}
        className="mgr-scroll"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: "calc(156px + 38vw)",
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
                    top: "12%", left: "12%", right: "12%", bottom: "10%",
                    width: "76%", height: "78%",
                    objectFit: "cover",
                    objectPosition: game.header_image_position ?? "50% 50%",
                    borderRadius: 3,
                    border: "2px solid rgba(200,210,225,0.75)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.8)",
                    opacity: isExpanded ? 1 : 0,
                    transition: "opacity 0.28s ease",
                  }}
                />
              )}

              {/* Shimmer overlay — partial (green) or perfect (purple) */}
              {(pred?.result === "partial" || pred?.result === "perfect") && (
                <div
                  key={shimmerKeys[game.id] ?? 0}
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: pred.result === "perfect"
                      ? "linear-gradient(110deg, transparent 30%, rgba(168,85,247,0.55) 45%, rgba(232,210,255,0.35) 52%, rgba(168,85,247,0.55) 59%, transparent 74%)"
                      : "linear-gradient(110deg, transparent 30%, rgba(52,211,153,0.45) 45%, rgba(200,255,230,0.30) 52%, rgba(52,211,153,0.45) 59%, transparent 74%)",
                    backgroundSize: "300% 100%",
                    animation: `${pred.result === "perfect" ? "shimmer-perfect" : "shimmer-partial"} 3.5s ease-in-out ${idx * 0.4}s 1 forwards`,
                    opacity: isExpanded ? 0 : 1,
                    transition: "opacity 0.18s ease",
                    pointerEvents: "none",
                    mixBlendMode: "screen",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                    WebkitMaskComposite: "destination-in",
                    maskImage: "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                    maskComposite: "intersect",
                  } as React.CSSProperties}
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

              {/* Score stamp — center-left, between title and date, only after scoring */}
              {pred?.final_points != null && (() => {
                const j = stampJitter[game.id]?.score ?? { dx: 0, dy: 0, rot: 0 }
                const digits = String(pred.final_points).split("")
                return (
                  <div
                    style={{
                      position: "absolute",
                      top: `calc(11% + 20px + ${j.dy}px)`,
                      left: `calc(10% + 10px + ${j.dx}px)`,
                      transform: `translateY(-50%) rotate(${j.rot}deg)`,
                      display: "flex",
                      alignItems: "center",
                      opacity: isExpanded ? 0 : 0.88,
                      transition: "opacity 0.18s ease",
                      pointerEvents: "none",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/text/plus-stamp.png" style={{ height: "24px", display: "block", marginRight: "-4px" }} alt="+" />
                    {digits.map((d, di) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={di} src={`/text/${d}-stamp.png`} style={{ height: "24px", display: "block", marginRight: "-8px" }} alt={d} />
                    ))}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/text/ss-stamp.png" style={{ height: "24px", display: "block", marginLeft: "7px" }} alt="ss" />
                  </div>
                )
              })()}

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

              {/* Status stamp — bottom-right corner of letter, hides when expanded */}
              {(status.label === "Released" || status.label === "Awaiting Scores") && (() => {
                const j = stampJitter[game.id]?.status ?? { dx: 0, dy: 0, rot: 0 }
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={status.label === "Released" ? "/released-stamp.png" : "/launch-stamp.png"}
                    alt={status.label === "Released" ? "Released" : "Launched"}
                    style={{
                      position: "absolute",
                      bottom: `calc(9% - 15px + ${j.dy}px)`,
                      right: `calc(10% - ${j.dx}px)`,
                      width: "43.7%",
                      opacity: isExpanded ? 0 : 0.88,
                      transition: "opacity 0.18s ease",
                      pointerEvents: "none",
                      transform: `rotate(${-8 + j.rot}deg)`,
                    }}
                  />
                )
              })()}

              {/* Result stamp — center of letter; perfect wraps mote overlay */}
              {pred?.result && (() => {
                const j = stampJitter[game.id]?.result ?? { dx: 0, dy: 0, rot: 0 }
                const baseLeft = pred.result === "failed" ? 70 : pred.result === "partial" ? 66 : 58
                const baseRot = pred.result === "perfect" ? -1 : pred.result === "partial" ? 12 : 23
                return (
                  <div
                    style={{
                      position: "absolute",
                      top: `calc(50% - ${pred.result === "perfect" ? 27 : 30}px + ${j.dy}px)`,
                      left: `calc(50% + ${baseLeft + j.dx}px)`,
                      width: pred.result === "partial" ? "59.9%" : pred.result === "failed" ? "52.9%" : "70.5%",
                      transform: `translate(-50%, -50%) rotate(${baseRot + j.rot}deg)`,
                      opacity: isExpanded ? 0 : 0.88,
                      transition: "opacity 0.18s ease",
                      pointerEvents: "none",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        pred.result === "perfect" ? "/perfect-stamp.png"
                        : pred.result === "partial" ? "/partial-stamp.png"
                        : "/miss-stamp.png"
                      }
                      alt={pred.result}
                      style={{ width: "100%", display: "block" }}
                    />
                    {pred.result === "perfect" && (
                      <PerfectMoteOverlay
                        delay={idx * 0.4}
                        shimmerKey={shimmerKeys[game.id] ?? 0}
                        visible
                      />
                    )}
                  </div>
                )
              })()}

              {/* Expanded overlay — gradient + info at bottom, fades in when expanded */}
              <div
                style={{
                  position: "absolute",
                  top: "12%", left: "12%", right: "12%", bottom: "10%",
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
