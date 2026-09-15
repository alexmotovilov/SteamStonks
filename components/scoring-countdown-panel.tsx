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
const BOARD_TOP   = "calc(64px + 20vh - 30px)"
const BOARD_WIDTH = "calc(42vw * 1.19)"
// Base CSS transform (centering) shared by board and goblin
const BOARD_BASE_TRANSFORM = "translate(calc(-50% - 5px), calc(-50% + 75px))"

// Ticker row width as a fraction of the viewport (vw) so it scales with the
// board (also vw-based) — the row stays a constant fraction of the board at
// every resolution, fixing the "bunched in the centre on large displays" issue.
// NOTE: vw is in CSS pixels, which are affected by OS/browser display scaling,
// so this won't equal a fixed physical px width. It's the single knob for the
// row's width — tune it visually; whatever looks right at one resolution holds
// at all of them because it's proportional to the board (~49.98vw wide).
const ROW_WIDTH_VW = 36

// Base readout font size, in vw, derived from the row width so text scales with
// the board and keeps the original 14px-at-466px text-to-row ratio. All desktop
// readout sizes/spacing are expressed in em off this base, so tuning ROW_WIDTH_VW
// (or this ratio) rescales the whole readout proportionally.
const FONT_BASE_VW = ROW_WIDTH_VW * (14 / 466)

function makeBoardPositions(vwOffset: number) {
  const base = 25 + vwOffset
  return {
    boardLeft:   `${base}vw`,
    // Center the rows on the board's center (boardLeft - 5px) by offsetting half
    // the row width instead of translateX, so we don't clobber the boardShake transform.
    rowLeft:     `calc(${base - ROW_WIDTH_VW / 2}vw - 5px)`,
    hoverLeft:   vwOffset === 0 ? "-5px" : `calc(${vwOffset}vw - 5px)`,
    goblinLeft:  `calc(${base}vw + 35px)`,
    spawnPoints: [
      { left: `${1  + vwOffset}vw`, top: "calc(64px + 27vh)" },
      { left: `${6  + vwOffset}vw`, top: "calc(64px + 25vh)" },
      { left: `${11 + vwOffset}vw`, top: "calc(64px + 28vh)" },
      { left: `${16 + vwOffset}vw`, top: "calc(64px + 26vh)" },
      { left: `${20 + vwOffset}vw`, top: "calc(64px + 27vh)" },
      { left: `${25 + vwOffset}vw`, top: "calc(64px + 25vh)" },
      { left: `${29 + vwOffset}vw`, top: "calc(64px + 28vh)" },
      { left: `${34 + vwOffset}vw`, top: "calc(64px + 26vh)" },
      { left: `${38 + vwOffset}vw`, top: "calc(64px + 27vh)" },
      { left: `${43 + vwOffset}vw`, top: "calc(64px + 25vh)" },
    ],
  }
}

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

// ─── Independent row tops — adjust each freely ────────────────────
const ROW_TOPS = [
  "calc(64px + 5vh + 17px - 10px)",
  "calc(64px + 13vh + 9.5px - 10px)",
  "calc(64px + 21vh + 2px - 10px)",
]

// CRT phosphor-screen readout styling
const CRT_FONT  = "var(--font-crt), 'VT323', monospace"
const CRT_GREEN = "#7dff9b"                        // light phosphor green
const CRT_DIM   = "rgba(125,255,155,0.35)"         // dim green for separators
const CRT_GLOW  = "0 0 6px rgba(125,255,155,0.55)" // phosphor bloom

const ROW_PANEL_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "1em",
  width: `${ROW_WIDTH_VW}vw`,
  fontSize: `${FONT_BASE_VW}vw`,
  fontFamily: CRT_FONT,
  textShadow: CRT_GLOW,
}

// Compact range value formatter (no zero-padding) — e.g. 12.5K, 1.20M, 87
function fmtRangeNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M"
  if (n >= 1000) return (n / 1000).toFixed(1) + "K"
  return String(Math.round(n))
}

function playersRangeStr(g: CountdownGame): string | null {
  if (g.players_window_low == null || g.players_window_high == null) return null
  return `${fmtRangeNum(g.players_window_low)}–${fmtRangeNum(g.players_window_high)}`
}

function reviewsRangeStr(g: CountdownGame): string | null {
  if (g.reviews_window_low == null || g.reviews_window_high == null) return null
  return `${Math.round(g.reviews_window_low)}–${Math.round(g.reviews_window_high)}%`
}

// Green glowing frame drawn around a metric when it lands inside its range.
// The transparent-bordered variant keeps identical box metrics so the number
// doesn't shift when the frame toggles on/off.
const FRAMED_NUM: React.CSSProperties = {
  color: CRT_GREEN,
  border: `1px solid ${CRT_GREEN}`,
  borderRadius: "0.21em",
  padding: "0 0.29em",
  boxShadow: "0 0 6px rgba(125,255,155,0.45), inset 0 0 5px rgba(125,255,155,0.22)",
}
const UNFRAMED_NUM: React.CSSProperties = {
  color: CRT_GREEN,
  border: "1px solid transparent",
  padding: "0 0.29em",
}

function ScoringCountdownPanelBase({
  games,
  hasUnread = false,
  hasUnclaimed = false,
  mobile = false,
  vwOffset = 0,
}: {
  games: CountdownGame[]
  hasUnread?: boolean
  hasUnclaimed?: boolean
  mobile?: boolean
  vwOffset?: number
}) {
  const { boardLeft, rowLeft, hoverLeft, goblinLeft, spawnPoints: SPAWN_POINTS } = makeBoardPositions(vwOffset)
  const ROW_POSITIONS: React.CSSProperties[] = ROW_TOPS.map(top => ({ top, left: rowLeft }))
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

  if (mobile) {
    return (
      <div style={{
        position: "fixed",
        top: 156,
        left: "50%",
        transform: "translateX(-50%)",
        width: "110vw",
        zIndex: 19,
        pointerEvents: "none",
      }}>
        <div style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/scoring-countdown.png"
            alt=""
            style={{ width: "100%", height: "auto", display: "block", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.7))", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%)", maskImage: "linear-gradient(to bottom, transparent 0%, black 10%)" }}
          />
          <div style={{
            position: "absolute",
            top: "5%",
            left: "8%",
            right: "8%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}>
            {active.length === 0 ? (
              <div style={{ textAlign: "center", color: CRT_DIM, fontSize: 14, fontFamily: CRT_FONT, textShadow: CRT_GLOW }}>
                No pending scores
              </div>
            ) : active.slice(0, 3).map((game, i) => {
              const ms = now != null ? new Date(game.scoring_at).getTime() - now : null
              return (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "1px 7px",
                  fontFamily: CRT_FONT,
                  textShadow: CRT_GLOW,
                }}>
                  <span className="tabular-nums" style={{ color: CRT_GREEN, fontSize: 13, letterSpacing: 0, marginLeft: 24 }}>
                    {game.ticker.slice(0, 4).padEnd(4)}
                  </span>
                  <span style={{ color: CRT_DIM, fontSize: 11 }}>|</span>
                  <span style={{ color: trendColor(game.player_trend), fontSize: 10 }}>{trendIcon(game.player_trend)}</span>
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <span className="tabular-nums" style={{ ...(inPlayersRange(game) ? FRAMED_NUM : UNFRAMED_NUM), fontSize: 13, letterSpacing: 0 }}>
                      {formatPeak(game.peak_players)}
                    </span>
                    {playersRangeStr(game) && (
                      <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: -3, fontSize: 10, color: CRT_DIM, whiteSpace: "nowrap" }}>
                        {playersRangeStr(game)}
                      </span>
                    )}
                  </span>
                  <span style={{ color: CRT_DIM, fontSize: 11 }}>|</span>
                  <span style={{ color: trendColor(game.review_trend), fontSize: 10 }}>{trendIcon(game.review_trend)}</span>
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <span className="tabular-nums" style={{ ...(inReviewsRange(game) ? FRAMED_NUM : UNFRAMED_NUM), fontSize: 13, letterSpacing: 0 }}>
                      {formatReview(game.latest_review_pct)}
                    </span>
                    {reviewsRangeStr(game) && (
                      <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: -3, fontSize: 10, color: CRT_DIM, whiteSpace: "nowrap" }}>
                        {reviewsRangeStr(game)}
                      </span>
                    )}
                  </span>
                  <span style={{ position: "relative", marginLeft: "auto", marginRight: 24, display: "inline-block" }}>
                    <span style={{ position: "relative", top: 3, fontSize: 8, color: CRT_DIM, letterSpacing: 1, whiteSpace: "nowrap" }}>RESULTS IN</span>
                    <span className="tabular-nums" style={{ position: "absolute", top: "100%", right: 0, marginTop: -4, color: CRT_GREEN, fontSize: 13, letterSpacing: 0, whiteSpace: "nowrap" }}>
                      {ms != null ? formatCountdown(ms) : "——:——:——:——"}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

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
          left: boardLeft,
          width: BOARD_WIDTH,
          height: "auto",
          zIndex: 51,
          pointerEvents: "none",
          transform: boardHovered
            ? `translate(calc(-50% - 40px), calc(-50% + 85px))`
            : `translate(calc(-50% - 40px), calc(-50% + 85px - 220px))`,
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
          left: boardLeft,
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
      <div style={{ position: "fixed", top: BOARD_TOP, left: boardLeft, transform: BOARD_BASE_TRANSFORM, width: BOARD_WIDTH, zIndex: 52, pointerEvents: "none", lineHeight: 0 }}>
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
          left: hoverLeft,
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
              <span className="tabular-nums" style={{ letterSpacing: 0, display: "flex", alignItems: "center", gap: "0.43em" }}>
                {/* ticker */}
                <span style={{ color: CRT_GREEN }}>{game.ticker.slice(0, 4).padEnd(4)}</span>
                <span style={{ color: CRT_DIM }}>|</span>

                {/* players peak + range */}
                <span style={{ display: "inline-block", width: "1.14em", textAlign: "center", color: trendColor(game.player_trend) }}>{trendIcon(game.player_trend)}</span>
                <span style={{ position: "relative", display: "inline-block" }}>
                  <span style={inPlayersRange(game) ? FRAMED_NUM : UNFRAMED_NUM}>{formatPeak(game.peak_players)}</span>
                  {playersRangeStr(game) && (
                    <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "0.14em", fontSize: "0.857em", color: CRT_DIM, whiteSpace: "nowrap" }}>
                      {playersRangeStr(game)}
                    </span>
                  )}
                </span>

                <span style={{ display: "inline-block", width: "0.57em" }} />

                {/* reviews pct + range */}
                <span style={{ display: "inline-block", width: "1.14em", textAlign: "center", color: trendColor(game.review_trend) }}>{trendIcon(game.review_trend)}</span>
                <span style={{ position: "relative", display: "inline-block" }}>
                  <span style={inReviewsRange(game) ? FRAMED_NUM : UNFRAMED_NUM}>{formatReview(game.latest_review_pct)}</span>
                  {reviewsRangeStr(game) && (
                    <span style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: "0.14em", fontSize: "0.857em", color: CRT_DIM, whiteSpace: "nowrap" }}>
                      {reviewsRangeStr(game)}
                    </span>
                  )}
                </span>
              </span>
              <span style={{ position: "relative", marginLeft: "auto", display: "inline-block" }}>
                <span style={{ fontSize: "0.786em", color: CRT_DIM, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>RESULTS IN</span>
                <span className="tabular-nums" style={{ position: "absolute", top: "100%", right: 0, marginTop: "-0.07em", letterSpacing: 0, color: CRT_GREEN, whiteSpace: "nowrap" }}>
                  {Array.from(ms != null ? formatCountdown(ms) : "DD:HH:MM:SS").map((ch, i) => (
                    <span key={i} style={{
                      display: "inline-block",
                      width: ch === ":" ? "0.71em" : "0.93em",
                      textAlign: "center",
                      opacity: ch === ":" ? 0.55 : 1,
                    }}>
                      {ch}
                    </span>
                  ))}
                </span>
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
          left: goblinLeft,
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

type PanelProps = { games: CountdownGame[]; hasUnread?: boolean; hasUnclaimed?: boolean; mobile?: boolean }

// Games page — board on the left (default position)
export function ScoringCountdownPanel(props: PanelProps) {
  return <ScoringCountdownPanelBase {...props} vwOffset={0} />
}

// Mailbox page — board on the right column
export function ScoringCountdownPanelMailbox(props: PanelProps) {
  return <ScoringCountdownPanelBase {...props} vwOffset={50} />
}
