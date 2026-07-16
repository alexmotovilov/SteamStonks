"use client"

import { useState, useEffect, useRef } from "react"

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

function playersExceededRange(g: CountdownGame): boolean {
  return g.peak_players != null && g.players_window_high != null
    && g.peak_players > g.players_window_high
}

function inReviewsRange(g: CountdownGame): boolean {
  return g.latest_review_pct != null && g.reviews_window_low != null && g.reviews_window_high != null
    && g.latest_review_pct >= g.reviews_window_low && g.latest_review_pct <= g.reviews_window_high
}

function formatPeak(n: number | null): string {
  if (n == null) return "————.—K"  // 7 chars: ————.—K
  if (n >= 10_000_000) {
    const mStr = (n / 1_000_000).toFixed(1)
    const [i, d] = mStr.split(".")
    return i.padStart(4, "0") + "." + d + "M"
  }
  const kStr = (n / 1000).toFixed(1)
  const [i, d] = kStr.split(".")
  return i.padStart(4, "0") + "." + d + "K"
}

function formatReview(pct: number | null): string {
  if (pct == null) return "  — "  // 4 chars: ··—·
  return String(Math.round(pct)).padStart(3) + "%"
}

// Renders each character in str in a fixed-width inline-block cell so
// all characters occupy stable horizontal positions regardless of content.
function fixedChars(str: string, color: string, w = 12, ns = "") {
  return Array.from(str).map((ch, i) => (
    <span key={`${ns}${i}`} style={{ display: "inline-block", width: w, textAlign: "center", color }}>
      {ch}
    </span>
  ))
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

// ─── Debris sources and spawn points ──────────────────────────────
const DEBRIS_SRCS = [
  "/goblin-debris1.png",
  "/goblin-debris2.png",
  "/goblin-debris3.png",
  "/goblin-debris4.png",
  "/goblin-debris5.png",
  "/goblin-debris6.png",
]

// Piece center within each 1212×588 overlay, used as transform-origin for rotation
const DEBRIS_ORIGINS: Record<string, string> = {
  "/goblin-debris1.png": "17% 50%",
  "/goblin-debris2.png": "51% 42%",
  "/goblin-debris3.png": "43% 53%",
  "/goblin-debris4.png": "53% 33%",
  "/goblin-debris5.png": "77% 48%",
  "/goblin-debris6.png": "59% 36%",
}

const DEBRIS_END_TRANSFORMS = [
  "translate(0, 110vh)",
  "translate(0, 118vh)",
  "translate(0, 122vh)",
  "translate(0, 115vh)",
  "translate(0, 108vh)",
  "translate(0, 112vh)",
  "translate(0, 120vh)",
  "translate(0, 116vh)",
  "translate(0, 119vh)",
  "translate(0, 106vh)",
]

// Spin amounts per slot — alternating direction, some multi-spin
const DEBRIS_ROTATIONS = [
  "rotate(360deg)",
  "rotate(-360deg)",
  "rotate(540deg)",
  "rotate(-360deg)",
  "rotate(720deg)",
  "rotate(-540deg)",
  "rotate(360deg)",
  "rotate(-360deg)",
  "rotate(540deg)",
  "rotate(-720deg)",
]

const SPAWN_POINTS = [
  { left: "3vw",  top: "calc(64px + 27vh)" },
  { left: "8vw",  top: "calc(64px + 25vh)" },
  { left: "13vw", top: "calc(64px + 28vh)" },
  { left: "18vw", top: "calc(64px + 26vh)" },
  { left: "22vw", top: "calc(64px + 27vh)" },
  { left: "27vw", top: "calc(64px + 25vh)" },
  { left: "31vw", top: "calc(64px + 28vh)" },
  { left: "36vw", top: "calc(64px + 26vh)" },
  { left: "40vw", top: "calc(64px + 27vh)" },
  { left: "45vw", top: "calc(64px + 25vh)" },
]

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
  width: "466px",
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
  const [now, setNow] = useState<number | null>(null)
  const [active, setActive] = useState<CountdownGame[]>(games)
  const [boardHovered, setBoardHovered] = useState(false)
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const animRef      = useRef<number>(0)
  const hoverZoneRef = useRef<HTMLDivElement>(null)
  const debrisRefs        = useRef<(HTMLImageElement | null)[]>([])
  const debrisWrapperRefs = useRef<(HTMLDivElement | null)[]>([])
  const debrisAnims       = useRef<Animation[]>([])

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setActive(prev => prev.filter(g => new Date(g.scoring_at).getTime() > t))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Cancel in-flight animations only on unmount
  useEffect(() => () => {
    cancelAnimationFrame(animRef.current)
    debrisAnims.current.forEach(a => { try { a.cancel() } catch { /**/ } })
  }, [])

  function triggerDebris() {
    // Cancel any still-running set before starting a new one
    debrisAnims.current.forEach(a => { try { a.cancel() } catch { /**/ } })
    debrisAnims.current = []

    const srcs = [...DEBRIS_SRCS]
    for (let i = srcs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [srcs[i], srcs[j]] = [srcs[j], srcs[i]]
    }

    SPAWN_POINTS.forEach((_, i) => {
      const wrapper = debrisWrapperRefs.current[i]
      const el      = debrisRefs.current[i]
      if (!wrapper || !el) return
      const src = srcs[i % srcs.length]
      el.src = src
      el.style.transformOrigin = DEBRIS_ORIGINS[src] ?? "50% 50%"
      const delay    = Math.random() * 420
      const duration = 820 + Math.random() * 200
      // Outer wrapper: fall straight down + fade
      const wrapAnim = wrapper.animate(
        [
          { transform: "translate(0,0)", opacity: 0, offset: 0 },
          { transform: "translate(0,0)", opacity: 1, offset: 0.06 },
          { transform: DEBRIS_END_TRANSFORMS[i], opacity: 0, offset: 1 },
        ],
        { duration, delay, fill: "forwards", easing: "ease-in" },
      )
      // Inner img: spin around the piece's own center
      const imgAnim = el.animate(
        [
          { transform: "rotate(0deg)", offset: 0 },
          { transform: DEBRIS_ROTATIONS[i], offset: 1 },
        ],
        { duration, delay, fill: "forwards", easing: "linear" },
      )
      debrisAnims.current.push(wrapAnim, imgAnim)
    })
  }

  function triggerSparks() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    cancelAnimationFrame(animRef.current)
    canvas.width  = window.innerWidth
    canvas.height = window.innerHeight

    const rect = hoverZoneRef.current?.getBoundingClientRect()
    const spawnXMin = rect ? rect.left   : window.innerWidth  * 0.03
    const spawnXMax = rect ? rect.right  : window.innerWidth  * 0.47
    const spawnY    = rect ? rect.bottom : window.innerHeight * 0.26 + 64
    const spawnYTop = rect ? rect.top    : window.innerHeight * 0.06 + 64

    type Spark = {
      x: number; y: number; px: number; py: number
      vx: number; vy: number
      life: number; decay: number
      size: number; hue: number; lightness: number
      startFrame: number
    }

    // Burst sparks — explode outward from bottom edge of board
    const burstSparks: Spark[] = Array.from({ length: 70 }, () => {
      const angle = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.6
      const speed = 2 + Math.random() * 8
      const x     = spawnXMin + Math.random() * (spawnXMax - spawnXMin)
      return {
        x, y: spawnY + (Math.random() - 0.5) * 12,
        px: x, py: spawnY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.2,
        decay: 0.016 + Math.random() * 0.020,
        size: 1.5 + Math.random() * 3,
        hue: 28 + Math.random() * 38,
        lightness: 70 + Math.random() * 30,
        startFrame: 0,
      }
    })

    // Rain sparks — fall downward with the debris, staggered across the fall duration
    const rainSparks: Spark[] = Array.from({ length: 100 }, () => {
      const x = spawnXMin + Math.random() * (spawnXMax - spawnXMin)
      const y = spawnYTop + Math.random() * (spawnY - spawnYTop)
      return {
        x, y,
        px: x, py: y,
        vx: (Math.random() - 0.5) * 1.8,
        vy: 1.5 + Math.random() * 5,
        life: 0.65 + Math.random() * 0.6,
        decay: 0.009 + Math.random() * 0.011,
        size: 0.7 + Math.random() * 1.8,
        hue: 22 + Math.random() * 55,
        lightness: 65 + Math.random() * 35,
        startFrame: Math.floor(Math.random() * 38),
      }
    })

    const allSparks = [...burstSparks, ...rainSparks]
    let frameCount = 0

    function frame() {
      if (!ctx) return
      ctx.clearRect(0, 0, canvas!.width, canvas!.height)
      frameCount++
      let alive = false
      ctx.globalCompositeOperation = "lighter"

      for (const s of allSparks) {
        if (frameCount < s.startFrame) { alive = true; continue }
        if (s.life <= 0) continue
        alive = true
        s.px = s.x; s.py = s.y
        s.x  += s.vx; s.y  += s.vy
        s.vy += 0.18; s.vx *= 0.97; s.vy *= 0.97
        s.life -= s.decay
        const alpha = Math.max(0, s.life)
        ctx.globalAlpha = alpha * 0.8
        ctx.strokeStyle = `hsl(${s.hue}, 100%, ${s.lightness}%)`
        ctx.lineWidth   = Math.max(0, s.size * s.life)
        ctx.lineCap     = "round"
        ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke()
        ctx.globalAlpha = alpha
        ctx.fillStyle   = `hsl(${s.hue + 20}, 100%, 95%)`
        ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(0, s.size * 0.6 * s.life), 0, Math.PI * 2); ctx.fill()
      }

      ctx.globalCompositeOperation = "source-over"
      ctx.globalAlpha = 1
      if (alive) animRef.current = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, canvas!.width, canvas!.height)
    }

    animRef.current = requestAnimationFrame(frame)
  }

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
      {/* Spark canvas — full viewport, pointer-events none, below debris (z:50) */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 50,
          pointerEvents: "none",
        }}
      />

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
      {/* Debris — wrapper mirrors the board's exact position/transform so each 1212×588
           overlay renders at full board size with its piece at the correct location.
           aspectRatio matches the source images so -50% in BOARD_BASE_TRANSFORM
           resolves to the same value as it does on the board <img>. */}
      <div
        style={{
          position: "fixed",
          top: BOARD_TOP,
          left: BOARD_LEFT,
          transform: BOARD_BASE_TRANSFORM,
          width: BOARD_WIDTH,
          aspectRatio: "1212 / 588",
          zIndex: 51,
          pointerEvents: "none",
          lineHeight: 0,
        }}
      >
        {SPAWN_POINTS.map((_, i) => (
          <div
            key={i}
            ref={el => { debrisWrapperRefs.current[i] = el }}
            style={{ position: "absolute", top: 0, left: 0, width: BOARD_WIDTH, opacity: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={el => { debrisRefs.current[i] = el }}
              src={DEBRIS_SRCS[i % DEBRIS_SRCS.length]}
              alt=""
              style={{ width: "100%", height: "auto", display: "block" }}
            />
          </div>
        ))}
      </div>

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
        ref={hoverZoneRef}
        style={{
          position: "fixed",
          top: "calc(64px + 4vh)",
          left: "40px",
          width: BOARD_WIDTH,
          height: "20vh",
          zIndex: 53,
          cursor: "default",
        }}
        onMouseEnter={() => { setBoardHovered(true); triggerSparks(); triggerDebris() }}
        onMouseLeave={() => setBoardHovered(false)}
      />

      {/* Ticker rows */}
      {ROW_POSITIONS.map((pos, i) => {
        const game = active[i]
        if (!game) return null
        const ms = now != null ? new Date(game.scoring_at).getTime() - now : null
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
              <span className="font-display text-sm tabular-nums" style={{ letterSpacing: 0 }}>
                {fixedChars(game.ticker.slice(0, 4).padEnd(4), "#f59e0b", 14, "tk")}
                {fixedChars(" | ", "rgba(255,255,255,0.2)", 12, "s1")}
                <span style={{ display: "inline-block", width: 16, textAlign: "center", color: trendColor(game.player_trend), position: "relative", left: "-10px" }}>{trendIcon(game.player_trend)}</span>
                {fixedChars(formatPeak(game.peak_players), inPlayersRange(game) ? "#34d399" : playersExceededRange(game) ? "#f87171" : "rgba(255,255,255,0.85)", 12, "pk")}
                <span style={{ display: "inline-block", width: 15 }} />
                {fixedChars(trendIcon(game.review_trend), trendColor(game.review_trend), 16, "rt")}
                {fixedChars(formatReview(game.latest_review_pct), inReviewsRange(game) ? "#34d399" : "rgba(255,255,255,0.85)", 12, "rv")}
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)", letterSpacing: 0 }}>|</span>
              <span className="font-display text-sm text-cyan-300 tabular-nums" style={{ letterSpacing: 0, marginLeft: "auto" }}>
                {Array.from(ms != null ? formatCountdown(ms) : "DD:HH:MM:SS").map((ch, i) => (
                  <span key={i} style={{
                    display: "inline-block",
                    width: ch === ":" ? 10 : 13,
                    textAlign: "center",
                    opacity: ch === ":" ? 0.55 : 1,
                  }}>
                    {ch}
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
