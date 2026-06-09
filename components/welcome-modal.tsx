"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export function WelcomeModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem("prognos_guide_modal_dismissed")
    if (!dismissed) setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem("prognos_guide_modal_dismissed", "true")
    setShow(false)
  }

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-[rgba(10,10,20,0.98)] border border-purple-500/25 rounded-2xl p-8 w-full max-w-lg shadow-2xl flex flex-col gap-5">

        <div className="text-center">
          <img src="/icons/game-name-logo.png" alt="Prognos" className="h-16 mx-auto mb-4" />
          <h2 className="font-display text-2xl text-foreground tracking-wide mb-2">
            Welcome to Prognos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed font-body">
            Prognos is a prediction competition for upcoming Steam games.
            Forecast player counts and review scores, earn mana, and
            climb the season leaderboard.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: "🎯", title: "Set predictions", text: "Use the sliders to forecast each game's week-one player count and review score." },
            { icon: "⚗️", title: "Apply boosters & rites", text: "Use items from your inventory to widen windows or earn bonus mana." },
            { icon: "🏆", title: "Earn score", text: "Accurate predictions earn mana and season score. Compete on the leaderboard." },
          ].map(({ icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="font-display text-sm text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground font-body mt-0.5">{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <Link
            href="/guide"
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl font-display text-sm tracking-wide text-center bg-purple-500/12 text-purple-300 border border-purple-500/25 hover:bg-purple-500/20 transition-colors"
          >
            Read the full guide →
          </Link>
          <button
            onClick={dismiss}
            className="w-full py-2 font-display text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Got it, take me to the games
          </button>
        </div>
      </div>
    </div>
  )
}
