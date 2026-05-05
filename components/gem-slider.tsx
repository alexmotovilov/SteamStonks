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
const SVG_H = 56
const TRACK_Y = 28
const TRACK_H = 4
const GEM_HW = 7    // half-width
const GEM_HT = 16   // half-height
const TICK_H = 26
const TICK_W = 2

function toSvgX(value: number, min: number, max: number): number {
  return ((value - min) / (max - min)) * SVG_W
}

function fromSvgX(svgX: number, min: number, max: number): number {
  return (svgX / SVG_W) * (max - min) + min
}

function GemShape({ cx, cy }: { cx: number; cy: number }) {
  const top = cy - GEM_HT
  const bot = cy + GEM_HT
  const left  = cx - GEM_HW
  const right = cx + GEM_HW

  return (
    <g>
      {/* Main body */}
      <polygon
        points={`${cx},${top} ${right},${cy} ${cx},${bot} ${left},${cy}`}
        fill="url(#gemGrad)"
      />
      {/* Left-top face */}
      <polygon points={`${left},${cy} ${cx},${top} ${cx},${cy}`} fill="#166534" fillOpacity={0.7} />
      {/* Right-top face */}
      <polygon points={`${right},${cy} ${cx},${top} ${cx},${cy}`} fill="#4ade80" fillOpacity={0.4} />
      {/* Left-bottom face */}
      <polygon points={`${left},${cy} ${cx},${bot} ${cx},${cy}`} fill="#052e16" fillOpacity={0.7} />
      {/* Right-bottom face */}
      <polygon points={`${right},${cy} ${cx},${bot} ${cx},${cy}`} fill="#166534" fillOpacity={0.55} />
      {/* Inner highlight */}
      <polygon
        points={`${cx},${top + 4} ${cx + GEM_HW * 0.65},${cy} ${cx},${cy - 4} ${cx - GEM_HW * 0.65},${cy}`}
        fill="#bbf7d0"
        fillOpacity={0.22}
      />
      {/* Gold outline */}
      <polygon
        points={`${cx},${top} ${right},${cy} ${cx},${bot} ${left},${cy}`}
        fill="none"
        stroke="#d97706"
        strokeWidth={1.2}
      />
      {/* Vertical facet line */}
      <line x1={cx} y1={top} x2={cx} y2={bot} stroke="#4ade80" strokeWidth={0.5} strokeOpacity={0.35} />
      {/* Horizontal facet line */}
      <line x1={left} y1={cy} x2={right} y2={cy} stroke="#4ade80" strokeWidth={0.5} strokeOpacity={0.25} />
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
            <stop offset="0%"   stopColor="#bbf7d0" stopOpacity={0.9} />
            <stop offset="28%"  stopColor="#4ade80" stopOpacity={0.85} />
            <stop offset="68%"  stopColor="#16a34a" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#052e16" stopOpacity={0.95} />
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
          y={TRACK_Y - (TICK_H - TRACK_H) / 2}
          width={TICK_W}
          height={TICK_H}
          fill="#d97706"
        />

        {/* Gold tick — right */}
        <rect
          x={highX - TICK_W / 2}
          y={TRACK_Y - (TICK_H - TRACK_H) / 2}
          width={TICK_W}
          height={TICK_H}
          fill="#d97706"
        />

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
