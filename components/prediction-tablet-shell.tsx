"use client"

import Link from "next/link"
import { ArrowLeft, X } from "lucide-react"

export function PredictionTabletShell({
  gameName,
  developer,
  releaseDate,
  onClose,
  children,
}: {
  gameName: string
  developer?: string | null
  releaseDate?: string
  onClose?: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, overflow: "hidden", background: "#000" }}
      onClick={onClose}
    >
      {/* Tablet image — natural size, centered, faded at top and bottom */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 1,
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/prediction-tablet.png"
          alt=""
          draggable={false}
          style={{ height: "100vh", width: "auto", display: "block", userSelect: "none", filter: "brightness(1.5) contrast(1.05)" }}
        />
      </div>

      {/* Purple radial overlay — sits above tablet image, below content */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          background: "radial-gradient(ellipse 80% 70% at center, rgba(80, 30, 140, 0.45) 0%, rgba(40, 10, 80, 0.2) 50%, transparent 75%)",
          pointerEvents: "none",
        }}
      />

      {/* Content — above tablet, spans full viewport */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          zIndex: 3,
        }}
      >
        {/* Top bar */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            padding: "14px 24px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          {onClose ? (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 font-display text-xs tracking-wide text-muted-foreground/70 hover:text-foreground transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          ) : (
            <Link
              href="/games"
              className="inline-flex items-center gap-1.5 font-display text-xs tracking-wide text-muted-foreground/70 hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Games
            </Link>
          )}
          <span className="text-white/15 select-none shrink-0">·</span>
          <span className="font-display text-xs text-foreground/80 truncate">{gameName}</span>
          {developer && (
            <>
              <span className="text-white/15 select-none shrink-0">·</span>
              <span className="font-body text-[10px] text-muted-foreground/50 truncate">{developer}</span>
            </>
          )}
          {releaseDate && (
            <>
              <span className="text-white/15 select-none shrink-0">·</span>
              <span className="font-body text-[10px] text-muted-foreground/40 shrink-0">{releaseDate}</span>
            </>
          )}
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "0 24px 32px",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: "900px" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
