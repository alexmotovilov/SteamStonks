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

interface GoblinCtx {
  firstGameBothInRange: boolean
  firstGameBothOutOfRange: boolean
  hasUnread: boolean
  hasUnclaimed: boolean
}

const GOBLIN_QUOTES: { priority: number; condition: (ctx: GoblinCtx) => boolean; text: string }[] = [
  { priority: 10, condition: ctx => ctx.firstGameBothInRange,    text: "Hey! Things are looking up, boss! Don't forget to buy me and the boys a drink!" },
  { priority: 10, condition: ctx => ctx.firstGameBothOutOfRange, text: "Oh, don't worry about that. I'm sure the readout is broken." },
  { priority: 8,  condition: ctx => ctx.hasUnclaimed,            text: "Looks like we're holding onto something for you. Whatever it is, can I have half?" },
  { priority: 8,  condition: ctx => ctx.hasUnread,               text: "Something came in while you were out! Hold on, I'm sure it's here. Somewhere." },
  { priority: 1,  condition: () => true,                         text: "Tick, tick, tick... waiting for the numbers to come in, boss." },
]

function pickGoblinQuote(ctx: GoblinCtx): string {
  return [...GOBLIN_QUOTES].sort((a, b) => b.priority - a.priority).find(q => q.condition(ctx))?.text ?? "..."
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

// Shared position for the board image and goblin — both use this as their base
const BOARD_TOP  = "calc(64px + 20vh - 30px)"
const BOARD_LEFT = "25vw"
const BOARD_WIDTH = "calc(42vw * 1.19)"
// Base CSS transform (centering) shared by board and goblin
const BOARD_BASE_TRANSFORM = "translate(calc(-50% + 40px), calc(-50% + 75px))"

// ─── Independent row positions — adjust each freely ───────────────
const ROW_POSITIONS: React.CSSProperties[] = [
  { top: "calc(64px + 5vh + 17px)",   left: "175px" },  // Row 1 (nearest)
  { top: "calc(64px + 13vh + 9.5px)", left: "175px" },  // Row 2
  { top: "calc(64px + 21vh + 2px)",   left: "175px" },  // Row 3
]

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

export function ScoringCountdownPanel({
  games,
  hasUnread = false,
  hasUnclaimed = false,
}: {
  games: CountdownGame[]
  hasUnread?: boolean
  hasUnclaimed?: boolean
}) {
  const [now, setNow] = useState(Date.now())
  const [active, setActive] = useState<CountdownGame[]>(games)
  const [boardHovered, setBoardHovered] = useState(false)

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setActive(prev => prev.filter(g => new Date(g.scoring_at).getTime() > t))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const firstGame = active[0] ?? null
  const goblinCtx: GoblinCtx = {
    firstGameBothInRange: firstGame != null && inPlayersRange(firstGame) && inReviewsRange(firstGame),
    firstGameBothOutOfRange: firstGame != null
      && firstGame.peak_players != null && firstGame.latest_review_pct != null
      && !inPlayersRange(firstGame) && !inReviewsRange(firstGame),
    hasUnread,
    hasUnclaimed,
  }
  const goblinQuote = pickGoblinQuote(goblinCtx)

  return (
    <>
      {/* Goblin — behind board (z:51). Slides up to hide behind board when not hovered. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/scoring-countdown-goblin.png"
        alt=""
        style={{
          position: "fixed",
          top: BOARD_TOP,
          left: BOARD_LEFT,
          width: BOARD_WIDTH,
          height: "auto",
          zIndex: 51,
          pointerEvents: "none",
          transform: boardHovered
            ? `translate(calc(-50% + 40px), calc(-50% + 85px))`
            : `translate(calc(-50% + 40px), calc(-50% + 85px - 220px))`,
          opacity: boardHovered ? 1 : 0,
          transition: boardHovered
            ? "transform 0.5s cubic-bezier(0.34, 1.15, 0.64, 1), opacity 0.15s ease-out"
            : "transform 0.28s ease-in, opacity 0.1s ease-in 0.18s",
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.95))",
        }}
      />

      {/* Scoring countdown board — above goblin (z:52) */}
      <style>{`
        @keyframes boardShake {
          0%   { transform: translate(0,    0)   rotate(0deg);   }
          18%  { transform: translate(5px,  2px) rotate(0.5deg); }
          36%  { transform: translate(-4px, 0px) rotate(-0.4deg);}
          54%  { transform: translate(3px,  1px) rotate(0.3deg); }
          72%  { transform: translate(-2px, 0px) rotate(-0.15deg);}
          100% { transform: translate(0,    0)   rotate(0deg);   }
        }
        @keyframes debrisFall1 {
          0%   { transform: translateY(0)     rotate(0deg);    opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(130vh) rotate(160deg);  opacity: 0; }
        }
        @keyframes debrisFall2 {
          0%   { transform: translateY(0)     rotate(0deg);    opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(130vh) rotate(-220deg); opacity: 0; }
        }
        @keyframes debrisFall3 {
          0%   { transform: translateY(0)     rotate(0deg);    opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(130vh) rotate(90deg);   opacity: 0; }
        }
        @keyframes debrisFall4 {
          0%   { transform: translateY(0)     rotate(0deg);    opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(130vh) rotate(-130deg); opacity: 0; }
        }
        @keyframes debrisFall5 {
          0%   { transform: translateY(0)     rotate(0deg);    opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(130vh) rotate(280deg);  opacity: 0; }
        }
        @keyframes debrisFall6 {
          0%   { transform: translateY(0)     rotate(0deg);    opacity: 0; }
          8%   { opacity: 1; }
          100% { transform: translateY(130vh) rotate(-180deg); opacity: 0; }
        }
      `}</style>
      {/* Debris pieces — same canvas coords as board, invisible by default, fall on hover (z:54) */}
      {[
        { src: "/goblin-debris1.png", anim: "debrisFall1", delay: "0.05s", dur: "1.0s" },
        { src: "/goblin-debris2.png", anim: "debrisFall2", delay: "0.22s", dur: "0.85s" },
        { src: "/goblin-debris3.png", anim: "debrisFall3", delay: "0.08s", dur: "0.92s" },
        { src: "/goblin-debris4.png", anim: "debrisFall4", delay: "0.32s", dur: "0.88s" },
        { src: "/goblin-debris5.png", anim: "debrisFall5", delay: "0.14s", dur: "1.02s" },
        { src: "/goblin-debris6.png", anim: "debrisFall6", delay: "0.40s", dur: "0.82s" },
      ].map(({ src, anim, delay, dur }) => (
        <div
          key={src}
          style={{
            position: "fixed",
            top: BOARD_TOP,
            left: BOARD_LEFT,
            transform: BOARD_BASE_TRANSFORM,
            zIndex: 51,
            pointerEvents: "none",
            lineHeight: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            style={{
              width: BOARD_WIDTH,
              height: "auto",
              display: "block",
              opacity: 0,
              animation: boardHovered
                ? `${anim} ${dur} ease-in ${delay} forwards`
                : "none",
            }}
          />
        </div>
      ))}

      {/* Outer div: fixed position + centering transform */}
      <div style={{ position: "fixed", top: BOARD_TOP, left: BOARD_LEFT, transform: BOARD_BASE_TRANSFORM, zIndex: 52, pointerEvents: "none", lineHeight: 0 }}>
        {/* Inner div: shake animation (simple offsets, no base transform conflict) */}
        <div style={{ animation: boardHovered ? "boardShake 0.4s ease-out 0s" : "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/scoring-countdown.png"
            alt=""
            style={{
              width: BOARD_WIDTH,
              height: "auto",
              display: "block",
              filter: "drop-shadow(0 4px 5px rgba(0,0,0,0.5)) drop-shadow(0 6px 9px rgba(0,0,0,0.4))",
              WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 7%)",
              maskImage: "linear-gradient(to bottom, transparent 0%, black 7%)",
            }}
          />
        </div>
      </div>

      {/* Transparent hover zone — explicitly positioned to match board's visual bounds (z:53) */}
      <div
        style={{
          position: "fixed",
          top: "calc(64px + 4vh)",
          left: "40px",
          width: BOARD_WIDTH,
          height: "20vh",
          zIndex: 53,
          cursor: "default",
        }}
        onMouseEnter={() => setBoardHovered(true)}
        onMouseLeave={() => setBoardHovered(false)}
      />

      {/* Ticker rows */}
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
              animation: boardHovered ? "boardShake 0.4s ease-out 0s" : "none",
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
                {(ms != null ? formatCountdown(ms) : "DD:HH:MM:SS").split(":").map((part, j) => (
                  <span key={j}>
                    {j > 0 && <span style={{ margin: "0 8.5px", opacity: 0.55 }}>:</span>}
                    {part}
                  </span>
                ))}
              </span>
            </div>
          </div>
        )
      })}

      {/* Goblin speech bubble — hidden for now */}
      <div
        style={{
          position: "fixed",
          top: "calc(64px + 26vh)",
          left: "calc(25vw + 80px)",
          zIndex: 56,
          pointerEvents: "none",
          width: "230px",
          display: "none",
        }}
      >
        <div
          className="relative rounded-xl border px-4 py-3 text-sm font-body text-white text-center"
          style={{
            backdropFilter: "blur(4px)",
            borderColor: "#C4A882",
            backgroundColor: "rgba(196,168,130,0.25)",
          }}
        >
          {goblinQuote}
          <div
            className="absolute bottom-0 translate-y-full"
            style={{
              left: "18%",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "10px solid #C4A882",
            }}
          />
        </div>
      </div>
    </>
  )
}
