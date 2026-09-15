"use client"

import { useState, useEffect, useRef } from "react"

interface Slide {
  tag: string
  tagColor: string
  title: string
  body: string
  image?: string
}

const SLIDES: Slide[] = [
  {
    tag: "TIP",
    tagColor: "#f59e0b",
    title: "Scrying the Peak",
    body: "Your week one player count prediction targets the highest concurrent player count in the 7 days after launch. Use obtained boosters to modify your predictive range as you see fit and remember, the weekend spike will count!",
  },
  {
    tag: "TIP",
    tagColor: "#f59e0b",
    title: "Early Lock Bonus",
    body: "Lock in your week one predictions up to 14 days before release to earn a guaranteed reward of a maximum +25 mana. The earlier you commit, the greater the reward. You can undo an early lock by using the rite of Temporal Translocation",
  },
  {
    tag: "TIP",
    tagColor: "#f59e0b",
    title: "The Season Ladder",
    body: "Rank your top 8 picks by their predicted all-time player peak by the end of the season. Your ladder can earn you up to +1100 mana at the end of the season. Use the rite of Auspicious Omens to push those rewards even further. ",
  },
  {
    tag: "TIP",
    tagColor: "#f59e0b",
    title: "Booster Stacking",
    body: "You can slot up to two different boosters per prediction. The Sigil of Multiplicity rite can unlock an additional booster slot for a prediction.",
  },
  {
    tag: "TIP",
    tagColor: "#f59e0b",
    title: "Equipment Mastery",
    body: "Your equipment stays with you the entire season and levels up on every Perfect or Partial prediction. Reach Tier III to unlock the strongest passive bonuses.",
  },
  {
    tag: "TIP",
    tagColor: "#f59e0b",
    title: "Ritual of Augury",
    body: "Spend 10 mana to reveal a heatmap of crowd predictions on your sliders for 2 minutes. Use the wisdom of many or defy it.",
  },
]

const INTERVAL_MS = 15000
const FADE_MS     = 500

// Board width scales with the viewport (like the tiles / scoring board), but is
// also capped by a vh term so it can't grow too tall on short viewports (e.g. a
// dev window with devtools open) and clip under the rolodex. On a full-height
// display the vw governs; when vertical space is tight the vh cap takes over.
const BOARD_W_VW     = 34   // width knob (governs on full-height displays)
const BOARD_W_VH_CAP = 57   // height cap knob (bites only on short viewports)
const FONT_RATIO     = 15 / 576  // body-text-to-width ratio (raise numerator for larger text)
// Text is tied to the same min() so it stays proportional to the *rendered*
// board width under either regime; inner sizes are em off this base.
const BOARD_WIDTH_CSS = `min(${BOARD_W_VW}vw, ${BOARD_W_VH_CAP}vh)`
const FONT_BASE_CSS   = `min(${(BOARD_W_VW * FONT_RATIO).toFixed(3)}vw, ${(BOARD_W_VH_CAP * FONT_RATIO).toFixed(3)}vh)`

export function CrystalBulletinBoard({
  tabletSrc = "/crystal-tablet.png",
  top = "calc(64px + 28vh + 65px - 12px)",
  left,
  right,
  width = BOARD_WIDTH_CSS,
  className,
}: {
  tabletSrc?: string
  top?: string
  left?: string
  right?: string
  width?: string
  className?: string
}) {
  const [current, setCurrent]   = useState(0)
  const [visible, setVisible]   = useState(0)   // which slide is actually shown
  const [fading,  setFading]    = useState(false)
  const [progress, setProgress] = useState(0)   // 0–1
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef    = useRef<number>(Date.now())

  function resetProgress() {
    startRef.current = Date.now()
    setProgress(0)
  }

  function restartTimer() {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(advance, INTERVAL_MS)
  }

  function goTo(idx: number) {
    if (idx === current || fading) return
    setFading(true)
    setTimeout(() => {
      setVisible(idx)
      setCurrent(idx)
      setFading(false)
      resetProgress()
      restartTimer()
    }, FADE_MS)
  }

  function advance() {
    setFading(true)
    setTimeout(() => {
      setCurrent(prev => {
        const next = (prev + 1) % SLIDES.length
        setVisible(next)
        return next
      })
      setFading(false)
      resetProgress()
    }, FADE_MS)
  }

  useEffect(() => {
    timerRef.current = setInterval(advance, INTERVAL_MS)
    progressRef.current = setInterval(() => {
      setProgress(Math.min((Date.now() - startRef.current) / INTERVAL_MS, 1))
    }, 50)
    return () => {
      if (timerRef.current)    clearInterval(timerRef.current)
      if (progressRef.current) clearInterval(progressRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const slide = SLIDES[visible]

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        top,
        left,
        right,
        width,
        zIndex: 15,
        pointerEvents: "none",
      }}
    >
      {/* Tablet background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={tabletSrc} alt="" style={{ width: "100%", display: "block", opacity: 0.72 }} />

      {/* Content overlay — inset to the glowing inner panel */}
      <div
        style={{
          position: "absolute",
          top: "17%", left: "9%", right: "9%", bottom: "13%",
          background: "rgba(0, 8, 20, 0.58)",
          fontSize: FONT_BASE_CSS,
          padding: "0.9em 1.9em",
          display: "flex",
          flexDirection: "column",
          gap: "0.3em",
          overflow: "hidden",
          pointerEvents: "auto",
          WebkitMaskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent), linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
          WebkitMaskComposite: "source-in",
          maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent), linear-gradient(to bottom, transparent, black 8%, black 92%, transparent)",
          maskComposite: "intersect",
        }}
      >
        {/* Slide content */}
        <div
          style={{
            flex: 1,
            opacity: fading ? 0 : 1,
            transition: `opacity ${FADE_MS}ms ease`,
            display: "flex",
            flexDirection: "column",
            gap: "0.3em",
            minHeight: 0,
          }}
        >
          {/* Tag + title row */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.52em" }}>
            <span
              className="font-display"
              style={{
                fontSize: "0.74em",
                letterSpacing: "0.12em",
                color: slide.tagColor,
                border: `1px solid ${slide.tagColor}55`,
                borderRadius: "0.22em",
                padding: "0.07em 0.37em",
                lineHeight: 1.6,
                flexShrink: 0,
              }}
            >
              {slide.tag}
            </span>
            <span
              className="font-display"
              style={{
                fontSize: "0.96em",
                color: "rgba(200,240,255,0.90)",
                letterSpacing: "0.04em",
                lineHeight: 1.3,
                textShadow: "0 0 8px rgba(103,232,249,0.4)",
              }}
            >
              {slide.title}
            </span>
          </div>

          {/* Body */}
          <p
            className="font-body"
            style={{
              margin: 0,
              fontSize: "1em",
              color: "rgba(180,225,240,0.78)",
              lineHeight: 1.55,
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}
          >
            {slide.body}
          </p>

          {/* Optional image */}
          {slide.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slide.image}
              alt=""
              style={{ width: "100%", borderRadius: "2px", marginTop: "2px", objectFit: "cover" }}
            />
          )}
        </div>

        {/* Footer: dots + progress bar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.37em" }}>
          {/* Dot indicators */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.37em" }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width:  i === current ? "1.04em" : "0.37em",
                  height: "0.37em",
                  borderRadius: "0.22em",
                  border: "none",
                  background: i === current
                    ? "rgba(103,232,249,0.80)"
                    : "rgba(103,232,249,0.25)",
                  padding: 0,
                  cursor: "pointer",
                  transition: "width 0.3s ease, background 0.3s ease",
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ height: "0.15em", background: "rgba(103,232,249,0.12)", borderRadius: "0.07em", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                background: "rgba(103,232,249,0.50)",
                borderRadius: "0.07em",
                transition: "width 0.05s linear",
                boxShadow: "0 0 4px rgba(103,232,249,0.6)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
