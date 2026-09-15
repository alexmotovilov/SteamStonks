"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  currentSeasonId: string | null
  onSelect?: (gameId: string) => void
  isPanelOpen?: boolean
}

// Card widths in vw units
const CARD_VW     = 14   // default
const CARD_HOV_VW = 15.5 // hover — subtle enlarge
const CARD_EXP_VW = 20   // clicked/expanded — full
const RISE_VH     = 5
const SPREAD_VW   = 1.2

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

export function GamesRolodex({ games, predMap, currentSeasonId, onSelect, isPanelOpen = false }: Props) {
  const router = useRouter()
  const [hoveredId, setHoveredId]   = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [stampJitter, setStampJitter] = useState<Record<string, { status: { dx: number; dy: number; rot: number }; result: { dx: number; dy: number; rot: number }; score: { dx: number; dy: number; rot: number } }>>({})
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

  // When panel opens, collapse any expanded tile
  useEffect(() => {
    if (isPanelOpen) setExpandedId(null)
  }, [isPanelOpen])

  const expandedIdx = games.findIndex(g => g.id === expandedId)
  const hoveredIdx  = games.findIndex(g => g.id === hoveredId)
  // Spread is driven by whichever is active
  const activeIdx = expandedIdx >= 0 ? expandedIdx : hoveredIdx

  const N = games.length

  // ── Pagination (offset measured in tiles) ────────────────────
  const PER_PAGE = 5
  const STEP_VW  = 14.5                  // horizontal spacing between tiles
  const FADE_VW  = 5                     // soft fade / breathing room on each side
  const VIEW_VW  = PER_PAGE * STEP_VW + 2 * FADE_VW  // window incl. fade margins
  const fadePct  = (FADE_VW / VIEW_VW) * 100
  const maxOffset = Math.max(0, N - PER_PAGE)
  const [offset, setOffset] = useState(0)
  useEffect(() => { setOffset(o => Math.min(o, maxOffset)) }, [maxOffset])
  const trackVw = Math.max(VIEW_VW, 2 * FADE_VW + N * STEP_VW)
  const atStart = offset <= 0
  const atEnd   = offset >= maxOffset

  function moveBy(delta: number) {
    setOffset(o => Math.max(0, Math.min(maxOffset, o + delta)))
    setExpandedId(null)
  }

  const navBtn = (onClick: () => void, disabled: boolean, icon: string, alt: string) => (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "default" : "pointer",
        background: "none", border: "none", padding: 0,
        marginTop: "-16px",
        pointerEvents: disabled ? "none" : "auto",
        transition: "transform 0.1s",
      }}
      onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.88)" }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/icons/${icon}`} alt={alt} style={{ width: 89, height: 89, objectFit: "contain", display: "block" }} draggable={false} />
    </button>
  )

  return (
    <>
      <style>{`
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
      {/* Backdrop — click off to collapse */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 34, pointerEvents: expandedId ? "auto" : "none" }}
        onClick={() => setExpandedId(null)}
      />
      {/* Stone backdrop — the base the tiles are laid against */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/gametile-backdrop.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          position: "fixed",
          bottom: "15px",
          left: "50%",
          transform: "translateX(-50%)",
          width: `${VIEW_VW}vw`,
          height: "auto",
          zIndex: 33,
          pointerEvents: "none",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          maskImage: "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      />
      {/* Left buttons — anchored to the left margin, stacked vertically */}
      <div style={{ position: "fixed", left: "16px", bottom: "20px", height: "80vh", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "calc(5vh - 40px)", gap: "0px", zIndex: 36, pointerEvents: "auto" }}>
        {navBtn(() => moveBy(-1),        atStart, "left.png",        "Back one tile")}
        {navBtn(() => moveBy(-PER_PAGE), atStart, "double-left.png", "Back a page")}
      </div>

      {/* Right buttons — anchored to the right margin, stacked vertically */}
      <div style={{ position: "fixed", right: "16px", bottom: "20px", height: "80vh", display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: "calc(5vh - 40px)", gap: "0px", zIndex: 36, pointerEvents: "auto" }}>
        {navBtn(() => moveBy(1),        atEnd, "right.png",        "Forward one tile")}
        {navBtn(() => moveBy(PER_PAGE), atEnd, "double-right.png", "Forward a page")}
      </div>

      {/* Tiles viewport — centered; clips to 6 tiles, track slides */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          width: `${VIEW_VW}vw`,
          height: "80vh",
          overflow: "hidden",
          zIndex: 35,
          pointerEvents: "none",
          WebkitMaskImage: `linear-gradient(to right, transparent 0%, black ${fadePct}%, black ${100 - fadePct}%, transparent 100%)`,
          maskImage: `linear-gradient(to right, transparent 0%, black ${fadePct}%, black ${100 - fadePct}%, transparent 100%)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: `${trackVw}vw`,
            height: "100%",
            transform: `translateX(-${offset * STEP_VW}vw)`,
            transition: "transform 0.45s ease",
          }}
        >
        {games.map((game, i) => {
          const isHov = hoveredId === game.id
          const isExp = expandedId === game.id
          const pred  = predMap[game.id] ?? null
          const ranges = predDisplay(pred)
          const status = gameStatus(game)
          // A launched game the player never predicted on: greyed + static.
          const isInactive = status.label !== "Upcoming" && !pred

          let resultColor = "#67e8f9"
          let resultLabel: string | null = null
          if (pred?.result === "perfect") { resultColor = "#34d399"; resultLabel = "Perfect" }
          else if (pred?.result === "partial") { resultColor = "#f59e0b"; resultLabel = "Partial" }
          else if (pred?.result === "failed") { resultColor = "#6b7280"; resultLabel = "Missed" }

          // Neighbors each move by half the active card's extra visual width
          const activeExtraVw = expandedIdx >= 0 ? CARD_EXP_VW - CARD_VW : CARD_HOV_VW - CARD_VW
          let spreadX = 0
          if (activeIdx >= 0) {
            if (i < activeIdx) spreadX = -(activeExtraVw / 2)
            else if (i > activeIdx) spreadX = activeExtraVw / 2
          }

          // Enlarge via transform scale (not width) so all card content — text
          // included — scales uniformly and never re-wraps to a different line count.
          const scaleFactor = isExp ? CARD_EXP_VW / CARD_VW : isHov ? CARD_HOV_VW / CARD_VW : 1
          const riseY = isExp ? -RISE_VH : 0

          // Shaped shadow that follows the parchment's torn silhouette
          const dropShadow = isExp
            ? "drop-shadow(0 12px 16px rgba(0,0,0,0.6)) drop-shadow(0 5px 8px rgba(0,0,0,0.45))"
            : isHov
            ? "drop-shadow(0 8px 12px rgba(0,0,0,0.55)) drop-shadow(0 4px 6px rgba(0,0,0,0.42))"
            : "drop-shadow(0 5px 9px rgba(0,0,0,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.38))"

          return (
            <div
              key={game.id}
              style={{
                position: "absolute",
                left: `${FADE_VW + i * STEP_VW}vw`,
                bottom: 0,
                zIndex: isExp ? 100 : isHov ? 50 : N - i,
                transform: `translateX(${spreadX}vw) translateY(${riseY}vh)`,
                transition: "transform 0.32s ease, filter 0.32s ease",
                pointerEvents: isPanelOpen ? "none" : "auto",
                filter: isPanelOpen ? "grayscale(1) blur(2px)" : isInactive ? `grayscale(1) ${dropShadow}` : dropShadow,
              }}
            >
              <div
                style={{ display: "block" }}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isPanelOpen || isInactive) return
                  if (isExp) {
                    onSelect ? onSelect(game.id) : router.push(`/games/${game.id}${currentSeasonId ? `?season=${currentSeasonId}` : ""}`)
                  } else {
                    setExpandedId(game.id)
                  }
                }}
              >
                <div
                  onMouseEnter={() => {
                    setHoveredId(game.id)
                    if (expandedId && expandedId !== game.id) setExpandedId(null)
                  }}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: "relative",
                    width: `${CARD_VW}vw`,
                    transform: `scale(${scaleFactor})`,
                    transformOrigin: "center bottom",
                    transition: "transform 0.32s ease, filter 0.3s ease",
                    cursor: isInactive ? "default" : "pointer",
                    overflow: "hidden",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 2%, black 98%, transparent 100%)",
                    maskImage: "linear-gradient(to right, transparent 0%, black 2%, black 98%, transparent 100%)",
                  }}
                >
                  {/* Letter parchment */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/letter-background.png"
                    alt=""
                    style={{ width: "100%", height: "auto", display: "block" }}
                    draggable={false}
                  />

                  {/* Game image — fades in when expanded */}
                  {game.header_image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.header_image_url}
                      alt=""
                      style={{
                        position: "absolute",
                        top: "12%", left: "12%", right: "12%", bottom: "10%",
                        width: "76%",
                        height: "78%",
                        objectFit: "cover",
                        objectPosition: game.header_image_position ?? "50% 50%",
                        borderRadius: "4px",
                        border: "2px solid rgba(200,210,225,0.75)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.8)",
                        opacity: isExp ? 1 : 0,
                        transition: "opacity 0.32s ease",
                      }}
                    />
                  )}

                  {/* Shimmer overlay — partial or perfect, hides when expanded */}
                  {(pred?.result === "partial" || pred?.result === "perfect") && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: pred.result === "perfect"
                          ? "linear-gradient(110deg, transparent 30%, rgba(168,85,247,0.55) 45%, rgba(232,210,255,0.35) 52%, rgba(168,85,247,0.55) 59%, transparent 74%)"
                          : "linear-gradient(110deg, transparent 30%, rgba(52,211,153,0.45) 45%, rgba(200,255,230,0.30) 52%, rgba(52,211,153,0.45) 59%, transparent 74%)",
                        backgroundSize: "300% 100%",
                        animation: `${pred.result === "perfect" ? "shimmer-perfect" : "shimmer-partial"} 3.5s ease-in-out ${i * 0.4}s 1 forwards`,
                        opacity: isExp ? 0 : 1,
                        transition: "opacity 0.2s ease",
                        pointerEvents: "none",
                        mixBlendMode: "screen",
                        WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                        WebkitMaskComposite: "destination-in",
                        maskImage: "linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
                        maskComposite: "intersect",
                      } as React.CSSProperties}
                    />
                  )}

                  {/* Game title */}
                  <div
                    className="font-display"
                    style={{
                      position: "absolute",
                      top: "calc(18% + 17px)", left: "10%", right: "10%",
                      fontSize: "1.0vw",
                      color: "#1c0e05",
                      lineHeight: 1.3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                      overflow: "hidden",
                      textShadow: "0 1px 3px rgba(255,210,140,0.6), 0 0 8px rgba(255,200,100,0.25)",
                      opacity: isExp ? 0 : 1,
                      transition: "opacity 0.2s ease",
                      pointerEvents: "none",
                    }}
                  >
                    {game.name}
                  </div>

                  {/* Score stamp */}
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
                          opacity: isExp ? 0 : 0.88,
                          transition: "opacity 0.2s ease",
                          pointerEvents: "none",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/text/plus-stamp.png" style={{ height: "1.41vw", display: "block", marginRight: "-0.4vw" }} alt="+" />
                        {digits.map((d, di) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={di} src={`/text/${d}-stamp.png`} style={{ height: "1.41vw", display: "block", marginRight: "-0.5vw" }} alt={d} />
                        ))}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/text/ss-stamp.png" style={{ height: "1.41vw", display: "block", marginLeft: "0.4vw" }} alt="ss" />
                      </div>
                    )
                  })()}

                  {/* Release date */}
                  {fmtDate(game.release_date) && (
                    <div
                      className="font-body"
                      style={{
                        position: "absolute",
                        bottom: "20%", left: "10%",
                        fontSize: "0.68vw",
                        color: "#3d2010",
                        textShadow: "0 1px 2px rgba(255,210,140,0.4)",
                        opacity: isExp ? 0 : 1,
                        transition: "opacity 0.2s ease",
                        pointerEvents: "none",
                      }}
                    >
                      {fmtDate(game.release_date)}
                    </div>
                  )}

                  {/* Status stamp */}
                  {(status.label === "Released" || status.label === "Released · Awaiting Scores") && (() => {
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
                          opacity: isExp ? 0 : 0.88,
                          transition: "opacity 0.2s ease",
                          pointerEvents: "none",
                          transform: `rotate(${-8 + j.rot}deg)`,
                        }}
                      />
                    )
                  })()}

                  {/* Result stamp — perfect wraps mote overlay */}
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
                          opacity: isExp ? 0 : 0.88,
                          transition: "opacity 0.2s ease",
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
                          <PerfectMoteOverlay delay={i * 0.4} visible />
                        )}
                      </div>
                    )
                  })()}

                  {/* Expanded info panel — fades in on click */}
                  <div
                    style={{
                      position: "absolute",
                      left: "12%", right: "12%", bottom: "10%",
                      borderRadius: "0 0 4px 4px",
                      background: "linear-gradient(to bottom, transparent 0%, rgba(4,3,2,0.88) 35%, rgba(4,3,2,0.97) 100%)",
                      padding: "18% 7% 5%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      gap: "1px",
                      opacity: isExp ? 1 : 0,
                      transition: "opacity 0.32s ease",
                      pointerEvents: "none",
                    }}
                  >
                    <div
                      className="font-display"
                      style={{
                        fontSize: "0.88vw",
                        color: "#f5e6c8",
                        lineHeight: 1.1,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical" as const,
                        overflow: "hidden",
                        textShadow: "0 1px 6px rgba(0,0,0,1)",
                      }}
                    >
                      {game.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {fmtDate(game.release_date) && (
                        <span className="font-body" style={{ fontSize: "0.56vw", color: "rgba(245,230,200,0.5)" }}>
                          {fmtDate(game.release_date)}
                        </span>
                      )}
                      <span className="font-display" style={{ fontSize: "0.56vw", color: status.color }}>{status.label}</span>
                    </div>
                    <div style={{ marginTop: "2px", paddingTop: "2px", borderTop: "1px solid rgba(196,168,130,0.18)" }}>
                      {resultLabel ? (
                        <div className="font-display" style={{ fontSize: "0.7vw", color: resultColor }}>
                          {resultLabel}
                          {pred?.final_points ? (
                            <span className="font-body" style={{ fontSize: "0.6vw", marginLeft: "3px", color: "#67e8f9" }}>
                              +{pred.final_points}
                            </span>
                          ) : null}
                        </div>
                      ) : ranges ? (
                        <div className="font-body" style={{ fontSize: "0.6vw", color: "rgba(103,232,249,0.70)" }}>
                          <span style={{ color: "rgba(245,230,200,0.45)" }}>Your Prognos: </span>{ranges}
                        </div>
                      ) : (
                        <div className="font-body" style={{ fontSize: "0.54vw", color: "rgba(245,230,200,0.35)" }}>
                          No prediction yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </>
  )
}
