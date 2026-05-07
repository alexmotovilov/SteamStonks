"use client"

import { useRef, useCallback } from "react"

interface GemSliderProps {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  windowLow: number
  windowHigh: number
  auguryGradient?: string | null
  formatValue?: (v: number) => string
  step?: number
  logScale?: boolean  // use logarithmic mapping for better low-value precision
}

// Internal slider range for log scale (0–1000 positions)
const LOG_STEPS = 1000

function toLogPos(value: number, min: number, max: number): number {
  const logMin = Math.log10(Math.max(min, 1))
  const logMax = Math.log10(max)
  return ((Math.log10(Math.max(value, min)) - logMin) / (logMax - logMin)) * LOG_STEPS
}

function fromLogPos(pos: number, min: number, max: number): number {
  const logMin = Math.log10(Math.max(min, 1))
  const logMax = Math.log10(max)
  return Math.round(Math.pow(10, logMin + (pos / LOG_STEPS) * (logMax - logMin)))
}

const SVG_W = 600
const SVG_H = 64
const TRACK_Y = 28
const TRACK_H = 4
const GEM_W = 30   // full width of trilliant
const GEM_H = 34   // full height of trilliant
const TICK_H = 26
const TICK_W = 2

function toSvgX(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * SVG_W
}

function fromSvgX(svgX: number, min: number, max: number): number {
  return (svgX / SVG_W) * (max - min) + min
}

// Trilliant gem — curved sides, pointed corners, point down
// Path defined in a 120×120 local space, centered and scaled via transform
function GemShape({ cx, cy }: { cx: number; cy: number }) {
  // Scale from 120×120 space to GEM_W × GEM_H, centered on cx,cy
  const sx = GEM_W / 120
  const sy = GEM_H / 120
  const tx = cx - 60 * sx
  const ty = cy - 17  // offset so top edge sits above track center

  const t = `translate(${tx}, ${ty}) scale(${sx}, ${sy})`

  // Curved trilliant path (120×120 space, point down)
  // Top-left(6,22), Top-right(114,22), Bottom-point(60,118)
  const outline = "M 60,6 C 63,6 106,12 114,22 C 118,27 112,56 108,66 C 104,76 88,98 79,108 C 72,116 65,118 60,118 C 55,118 48,116 41,108 C 32,98 16,76 12,66 C 8,56 2,27 6,22 C 14,12 57,6 60,6 Z"

  return (
    <g transform={t}>
      {/* Base fill */}
      <path d={outline} fill="url(#gemGrad)" />

      {/* Main facets */}
      <polygon points="60,6 20,20 60,42 100,20" fill="#d1fae5" fillOpacity={0.22} />
      <polygon points="6,22 12,66 41,108 60,118 60,58 20,20" fill="#166534" fillOpacity={0.52} />
      <polygon points="114,22 108,66 79,108 60,118 60,58 100,20" fill="#15803d" fillOpacity={0.36} />
      <polygon points="20,20 100,20 60,58" fill="#bbf7d0" fillOpacity={0.14} />

      {/* Girdle sub-facets */}
      <polygon points="20,20 8,44 28,68 60,58" fill="#14532d" fillOpacity={0.38} />
      <polygon points="8,44 12,66 28,68" fill="#052e16" fillOpacity={0.42} />
      <polygon points="100,20 112,44 92,68 60,58" fill="#166534" fillOpacity={0.28} />
      <polygon points="112,44 108,66 92,68" fill="#052e16" fillOpacity={0.38} />

      {/* Bottom facets */}
      <polygon points="28,68 12,66 41,108 60,118 60,80" fill="#052e16" fillOpacity={0.48} />
      <polygon points="92,68 108,66 79,108 60,118 60,80" fill="#14532d" fillOpacity={0.44} />
      <polygon points="28,68 92,68 60,80" fill="#052e16" fillOpacity={0.22} />
      <polygon points="48,88 60,80 72,88 60,118" fill="#052e16" fillOpacity={0.5} />
      <polygon points="28,68 60,80 48,88" fill="#166534" fillOpacity={0.22} />
      <polygon points="92,68 60,80 72,88" fill="#15803d" fillOpacity={0.18} />

      {/* Star facets near table */}
      <polygon points="60,6 40,14 60,30 80,14" fill="#f0fdf4" fillOpacity={0.3} />
      <polygon points="40,14 20,20 38,32 60,30" fill="#ecfdf5" fillOpacity={0.18} />
      <polygon points="80,14 100,20 82,32 60,30" fill="#d1fae5" fillOpacity={0.14} />
      <polygon points="38,32 82,32 60,30" fill="#ffffff" fillOpacity={0.12} />

      {/* Top highlight */}
      <polygon points="56,6 64,6 62,18 58,18" fill="#ffffff" fillOpacity={0.28} />

      {/* Extra inner facets */}
      <polygon points="38,32 28,68 60,58" fill="#4ade80" fillOpacity={0.08} />
      <polygon points="82,32 92,68 60,58" fill="#22c55e" fillOpacity={0.06} />
      <polygon points="20,20 8,44 6,22" fill="#a7f3d0" fillOpacity={0.16} />
      <polygon points="100,20 112,44 114,22" fill="#6ee7b7" fillOpacity={0.12} />

      {/* Gold outline */}
      <path d={outline} fill="none" stroke="#d97706" strokeWidth={2.2} strokeLinejoin="round" />

      {/* Internal facet lines */}
      <line x1={60} y1={6}   x2={60}  y2={58}  stroke="#d97706" strokeWidth={0.9} strokeOpacity={0.5} />
      <line x1={20} y1={20}  x2={60}  y2={58}  stroke="#d97706" strokeWidth={0.75} strokeOpacity={0.45} />
      <line x1={100} y1={20} x2={60}  y2={58}  stroke="#d97706" strokeWidth={0.75} strokeOpacity={0.45} />
      <line x1={60} y1={58}  x2={60}  y2={118} stroke="#d97706" strokeWidth={0.7} strokeOpacity={0.4} />
      <line x1={20} y1={20}  x2={100} y2={20}  stroke="#d97706" strokeWidth={0.65} strokeOpacity={0.38} />
      <line x1={8}  y1={44}  x2={112} y2={44}  stroke="#d97706" strokeWidth={0.55} strokeOpacity={0.32} />
      <line x1={28} y1={68}  x2={92}  y2={68}  stroke="#d97706" strokeWidth={0.55} strokeOpacity={0.32} />
      <line x1={20} y1={20}  x2={8}   y2={44}  stroke="#d97706" strokeWidth={0.5} strokeOpacity={0.3} />
      <line x1={100} y1={20} x2={112} y2={44}  stroke="#d97706" strokeWidth={0.5} strokeOpacity={0.3} />
      <line x1={8}  y1={44}  x2={28}  y2={68}  stroke="#d97706" strokeWidth={0.5} strokeOpacity={0.28} />
      <line x1={112} y1={44} x2={92}  y2={68}  stroke="#d97706" strokeWidth={0.5} strokeOpacity={0.28} />
      <line x1={28} y1={68}  x2={60}  y2={80}  stroke="#d97706" strokeWidth={0.45} strokeOpacity={0.25} />
      <line x1={92} y1={68}  x2={60}  y2={80}  stroke="#d97706" strokeWidth={0.45} strokeOpacity={0.25} />
      <line x1={28} y1={68}  x2={48}  y2={88}  stroke="#d97706" strokeWidth={0.45} strokeOpacity={0.25} />
      <line x1={92} y1={68}  x2={72}  y2={88}  stroke="#d97706" strokeWidth={0.45} strokeOpacity={0.25} />
      <line x1={48} y1={88}  x2={72}  y2={88}  stroke="#d97706" strokeWidth={0.4} strokeOpacity={0.22} />
      <line x1={60} y1={80}  x2={60}  y2={118} stroke="#d97706" strokeWidth={0.4} strokeOpacity={0.28} />
      <line x1={40} y1={14}  x2={60}  y2={30}  stroke="#d97706" strokeWidth={0.4} strokeOpacity={0.22} />
      <line x1={80} y1={14}  x2={60}  y2={30}  stroke="#d97706" strokeWidth={0.4} strokeOpacity={0.22} />
      <line x1={38} y1={32}  x2={82}  y2={32}  stroke="#d97706" strokeWidth={0.4} strokeOpacity={0.22} />
      <line x1={38} y1={32}  x2={60}  y2={58}  stroke="#d97706" strokeWidth={0.35} strokeOpacity={0.2} />
      <line x1={82} y1={32}  x2={60}  y2={58}  stroke="#d97706" strokeWidth={0.35} strokeOpacity={0.2} />
    </g>
  )
}

export function GemSlider({
  min,
  max,
  value,
  onChange,
  disabled = false,
  windowLow,
  windowHigh,
  auguryGradient,
  formatValue,
  step = 1,
  logScale = false,
}: GemSliderProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  // Convert values to SVG x positions, accounting for log scale
  const valToSvg = (v: number) => logScale
    ? (toLogPos(v, min, max) / LOG_STEPS) * SVG_W
    : toSvgX(v, min, max)

  const gemX  = valToSvg(value)
  const lowX  = valToSvg(windowLow)
  const highX = valToSvg(windowHigh)

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (disabled || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - rect.left) / rect.width) * SVG_W
    const pct = Math.max(0, Math.min(SVG_W, svgX))
    const raw = logScale
      ? fromLogPos((pct / SVG_W) * LOG_STEPS, min, max)
      : fromSvgX(pct, min, max)
    const snapped = logScale ? raw : Math.round(raw / step) * step
    onChange(Math.max(min, Math.min(max, snapped)))
  }

  return (
    <div className="relative select-none" style={{ userSelect: "none" }}>
      <svg
        ref={svgRef}
        width="100%"
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        onClick={handleSvgClick}
        className={disabled ? "cursor-default" : "cursor-pointer"}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="gemGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#d1fae5" stopOpacity={0.98} />
            <stop offset="18%"  stopColor="#86efac" stopOpacity={0.92} />
            <stop offset="50%"  stopColor="#16a34a" stopOpacity={0.93} />
            <stop offset="82%"  stopColor="#14532d" stopOpacity={0.97} />
            <stop offset="100%" stopColor="#052e16" stopOpacity={1.0} />
          </linearGradient>
        </defs>

        {/* Track background */}
        <rect x={0} y={TRACK_Y} width={SVG_W} height={TRACK_H} rx={2} fill="#1f2937" />

        {/* Green range bar */}
        <rect
          x={lowX}
          y={TRACK_Y}
          width={Math.max(0, highX - lowX)}
          height={TRACK_H}
          fill="#16a34a"
        />

        {/* Gold tick — left */}
        <rect
          x={lowX - TICK_W / 2}
          y={TRACK_Y - 5}
          width={TICK_W}
          height={22}
          fill="#d97706"
        />
        {/* Small round gem — left termination */}
        <circle cx={lowX} cy={TRACK_Y + 17} r={4} fill="url(#gemGrad)" stroke="#d97706" strokeWidth={0.8} />
        <circle cx={lowX} cy={TRACK_Y + 17} r={2} fill="#bbf7d0" fillOpacity={0.4} />

        {/* Gold tick — right */}
        <rect
          x={highX - TICK_W / 2}
          y={TRACK_Y - 5}
          width={TICK_W}
          height={22}
          fill="#d97706"
        />
        {/* Small round gem — right termination */}
        <circle cx={highX} cy={TRACK_Y + 17} r={4} fill="url(#gemGrad)" stroke="#d97706" strokeWidth={0.8} />
        <circle cx={highX} cy={TRACK_Y + 17} r={2} fill="#bbf7d0" fillOpacity={0.4} />

        {/* Augury heatmap — rendered as a rect with inline style */}
        {auguryGradient && (
          <rect
            x={0}
            y={TRACK_Y - 6}
            width={SVG_W}
            height={TRACK_H + 12}
            fillOpacity={0.45}
            style={{ fill: auguryGradient }}
          />
        )}

        {/* Gem */}
        <GemShape cx={gemX} cy={TRACK_Y} />
      </svg>

      {/* Native range input — invisible, sits on top for drag/keyboard */}
      <input
        type="range"
        min={logScale ? 0 : min}
        max={logScale ? LOG_STEPS : max}
        step={logScale ? 1 : step}
        value={logScale ? toLogPos(value, min, max) : value}
        disabled={disabled}
        onChange={e => {
          const raw = logScale
            ? fromLogPos(Number(e.target.value), min, max)
            : Number(e.target.value)
          onChange(raw)
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: disabled ? "default" : "pointer",
          margin: 0,
        }}
        aria-label={formatValue ? formatValue(value) : String(value)}
      />
    </div>
  )
}
