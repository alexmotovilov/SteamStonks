"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

interface StipendBannerProps {
  claimable: boolean
  seasonId: string
  locked?: boolean
}

export function StipendBanner({ claimable, seasonId, locked = false }: StipendBannerProps) {
  const router = useRouter()
  const [localClaimed, setLocalClaimed] = useState(!claimable)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hovering, setHovering] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (hovering) {
      document.body.classList.add("chest-hovered")
    } else {
      document.body.classList.remove("chest-hovered")
    }
    return () => document.body.classList.remove("chest-hovered")
  }, [hovering])

  async function handleCollect() {
    if (localClaimed || claiming || locked) return
    setAnimating(true)
    setTimeout(() => setAnimating(false), 700)
    setClaiming(true)
    setError(null)
    const res = await fetch("/api/vendor/stipend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season_id: seasonId }),
    })
    if (res.ok) {
      setLocalClaimed(true)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? "Failed to collect stipend")
    }
    setClaiming(false)
  }

  return (
    <>
      <style>{`
        .vendor-blur {
          transition: filter 0.3s ease;
        }
        body.chest-hovered .vendor-blur {
          filter: blur(3px);
        }
        @keyframes collectFlyUp {
          0%   { opacity: 1; transform: translateY(0)    scale(1);    }
          25%  { opacity: 1; transform: translateY(-8px) scale(1.18); }
          100% { opacity: 0; transform: translateY(-60px) scale(1.35); }
        }
        /* Locked chest hover shakes the Free Entry panel to link the two.
           Only offsets via transform — the panel's horizontal centering comes
           from Tailwind's translate property (v4), which composes with this. */
        @keyframes freeEntryShake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: translateX(-5px) rotate(-2deg); }
          30% { transform: translateX(5px) rotate(2deg); }
          45% { transform: translateX(-4px) rotate(-1.5deg); }
          60% { transform: translateX(3px) rotate(1deg); }
          75% { transform: translateX(-2px) rotate(-0.5deg); }
        }
        body.chest-hovered .free-entry-panel {
          animation: freeEntryShake 0.6s ease-in-out;
        }
      `}</style>
      <div className="flex flex-col items-center gap-1.5">
        <div
          className="relative"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {/* Empty label on hover when claimed */}
          {localClaimed && hovering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span
                className="font-display text-2xl text-amber-200/70"
                style={{ textShadow: "0 0 2px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1), 1px 1px 0px rgba(0,0,0,1), -1px -1px 0px rgba(0,0,0,1), 1px -1px 0px rgba(0,0,0,1), -1px 1px 0px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,1), 0 0 28px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.9)", transform: "translateY(-36px)" }}
              >
                Empty.
              </span>
            </div>
          )}
          {/* Hover label + click fly-up animation */}
          {!localClaimed && !locked && (hovering || animating) && (
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              style={{ animation: animating ? "collectFlyUp 0.65s ease-out forwards" : "none" }}
            >
              <div
                className="flex items-center gap-1 font-display text-xl text-amber-300"
                style={{
                  transform: "translateY(-19px)",
                  textShadow: "0 0 2px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1), 1px 1px 0px rgba(0,0,0,1), -1px -1px 0px rgba(0,0,0,1), 1px -1px 0px rgba(0,0,0,1), -1px 1px 0px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,1), 0 0 28px rgba(0,0,0,1), 0 0 40px rgba(0,0,0,0.9)",
                }}
              >
                <span>Collect</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/mana-icon.png" alt="mana" width={20} height={20} className="shrink-0" style={{ filter: "drop-shadow(0 0 3px rgba(0,0,0,0.9)) drop-shadow(0 0 6px rgba(0,0,0,0.7))" }} />
                <span>+15.</span>
              </div>
            </div>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localClaimed ? "/free-mana-empty.png" : "/free-mana-full.png"}
            alt={localClaimed ? "Stipend already collected" : "Collect weekly mana stipend"}
            width={317}
            height={317}
            onClick={handleCollect}
            className={[
              "hidden md:block select-none transition-all duration-300",
              !localClaimed && !claiming && !locked
                ? "cursor-pointer hover:scale-105 hover:drop-shadow-[0_0_18px_rgba(34,211,238,0.55)] active:scale-95"
                : "",
              claiming ? "opacity-60 cursor-wait" : "",
              locked ? "grayscale opacity-70 cursor-default" : "",
            ].join(" ")}
            draggable={false}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localClaimed ? "/free-mana-empty.png" : "/free-mana-full.png"}
            alt={localClaimed ? "Stipend already collected" : "Collect weekly mana stipend"}
            width={317}
            height={317}
            onClick={handleCollect}
            className={[
              "md:hidden select-none transition-all duration-300",
              !localClaimed && !claiming && !locked
                ? "cursor-pointer hover:scale-105 hover:drop-shadow-[0_0_18px_rgba(34,211,238,0.55)] active:scale-95"
                : "",
              claiming ? "opacity-60 cursor-wait" : "",
              locked ? "grayscale opacity-70 cursor-default" : "",
            ].join(" ")}
            style={{ width: "100%", height: "auto" }}
            draggable={false}
          />
        </div>
        {error && (
          <p className="text-[10px] text-red-400 font-body text-center">{error}</p>
        )}
      </div>
    </>
  )
}
