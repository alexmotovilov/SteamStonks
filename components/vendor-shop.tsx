"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ManaIcon } from "@/components/mana-icon"
import { StipendBanner } from "@/components/stipend-banner"
import { VendorCountdown } from "@/components/vendor-countdown"

// ---------------------------------------------------------------------------
// Gargoyle quote system
// ---------------------------------------------------------------------------
interface GargoyleCtx {
  stipendClaimable: boolean  // player has an uncollected weekly stipend
  anyPurchased: boolean      // at least one item bought this week
  allExhausted: boolean      // every item is at its weekly purchase limit
  canAffordAny: boolean      // player can afford at least one available item
  manaBalance: number        // current spendable mana
  noItems: boolean           // vendor has no items listed this cycle
}

const GARGOYLE_QUOTES: { priority: number; condition: (ctx: GargoyleCtx) => boolean; text: string }[] = [
  // ── Priority 10: most specific compound states ──────────────────────────
  {
    priority: 10,
    condition: ctx => ctx.noItems,
    text: "What are you doing here? Come back when there's something to buy.",
  },
  {
    priority: 10,
    condition: ctx => ctx.allExhausted && !ctx.stipendClaimable,
    text: "You've cleared me out. Come back next week — I may have restocked by then.",
  },
  {
    priority: 10,
    condition: ctx => ctx.allExhausted && ctx.stipendClaimable,
    text: "Stock's gone. Though your stipend is still waiting. Take it and be on your way.",
  },
  // ── Priority 8: stipend-aware ────────────────────────────────────────────
  {
    priority: 8,
    condition: ctx => ctx.stipendClaimable && ctx.anyPurchased,
    text: "Back again? I told you, no refunds. Now, what do you fancy?",
  },
  {
    priority: 8,
    condition: ctx => ctx.stipendClaimable && !ctx.anyPurchased,
    text: "Take your handout and go... unless you're looking to make a purchase?",
  },
  // ── Priority 6: purchase state ───────────────────────────────────────────
  {
    priority: 6,
    condition: ctx => ctx.anyPurchased && ctx.canAffordAny,
    text: "Back for more already? I knew you couldn't resist.",
  },
  {
    priority: 6,
    condition: ctx => !ctx.canAffordAny && !ctx.allExhausted && !ctx.noItems,
    text: "Don't just stand there gawking. Either buy something or leave.",
  },
  // ── Priority 4: mana-based ───────────────────────────────────────────────
  {
    priority: 4,
    condition: ctx => ctx.manaBalance >= 150,
    text: "Flush with mana, are we? I have just the thing for someone of your... means.",
  },
  {
    priority: 4,
    condition: ctx => ctx.manaBalance < 20,
    text: "Scraping the barrel? Perhaps fate will smile upon you this week.",
  },
  // ── Priority 1: fallback ─────────────────────────────────────────────────
  {
    priority: 1,
    condition: () => true,
    text: "Browse my wares, traveller. These enchantments don't sell themselves.",
  },
]

function pickGargoyleQuote(ctx: GargoyleCtx): string {
  return [...GARGOYLE_QUOTES]
    .sort((a, b) => b.priority - a.priority)
    .find(q => q.condition(ctx))?.text ?? "..."
}

interface VendorItem {
  id: string
  slug: string
  name: string
  description: string
  image_url: string | null
  vendor_price: number
  vendor_weekly_limit: number
  effects: Record<string, number>
}

export interface InventoryItem {
  item_id: string
  quantity: number
  items: {
    slug: string
    name: string
    image_url: string | null
    effects: Record<string, number>
    description: string
    item_type?: string
  }
}

interface VendorShopProps {
  items: VendorItem[]
  purchasedCounts: Record<string, number>
  manaBalance: number
  seasonId: string
  vendorWeek: number
  vendorCycle: "A" | "B"
  stipendClaimable?: boolean
  inventory?: InventoryItem[]
}

function BoosterBagCounter({ inventory }: { inventory: InventoryItem[] }) {
  const [hovering, setHovering] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (hovering) document.body.classList.add("bag-hovered")
    else document.body.classList.remove("bag-hovered")
    return () => document.body.classList.remove("bag-hovered")
  }, [hovering])

  return (
    <>
      {/* Contact shadow under the bag */}
      <div
        className="absolute pointer-events-none chest-blur"
        style={{
          right: "175px",
          bottom: "338px",
          width: "170px",
          height: "13px",
          background: "rgba(0,0,0,0.92)",
          borderRadius: "50%",
          filter: "blur(10px)",
          zIndex: 4,
        }}
      />
      <div
        className="absolute chest-blur"
        style={{ right: "170px", bottom: "352px", zIndex: 5, cursor: hovering ? "none" : "default" }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/booster-bag-closed.png"
          alt="Booster inventory"
          width={202}
          className={[
            "select-none pointer-events-none transition-transform duration-200",
            hovering ? "scale-110" : "",
            "-rotate-[5deg]",
          ].join(" ")}
          draggable={false}
        />
      </div>

      {hovering && typeof document !== "undefined" && createPortal(
        <div
          className="fixed pointer-events-none"
          style={{ left: mousePos.x - 200, top: mousePos.y - 290, zIndex: 9999 }}
        >
          <div className="relative" style={{ width: "255px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/booster-bag.png"
              alt=""
              className="w-full pointer-events-none select-none"
              draggable={false}
            />
            {/* Content inset to match the bag's dark interior */}
            <div className="absolute flex flex-col items-center" style={{ inset: "8% 10% 12% 10%" }}>
              {/* "Your Stock" label */}
              <div className="w-full flex items-center justify-center mb-1" style={{ paddingTop: "2px", transform: "translateX(-15px)" }}>
                <div className="px-2 rounded border border-amber-500/30 bg-black/40" style={{ padding: "1px 8px" }}>
                  <span className="font-display text-[11px] text-amber-300/80" style={{ display: "inline-block", letterSpacing: "0.2em" }}>Inventory</span>
                </div>
              </div>
              {inventory.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70 font-body text-center w-32 leading-relaxed mt-6">
                  No boosters
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5" style={{ transform: "scale(0.85) translateX(-13px)", marginTop: "-27px" }}>
                  {inventory.slice(0, 8).map(inv => (
                    <div key={inv.item_id}>
                      <BoosterDisplayTile inv={inv} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function BoosterDisplayTile({ inv }: { inv: InventoryItem }) {
  const [hovering, setHovering] = useState(false)
  if (!inv.items) return null
  const outOfStock = inv.quantity <= 0
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className={`w-[88px] flex flex-col items-center gap-1 p-1.5 rounded-xl border border-white/7 bg-[rgba(25,15,5,0.7)] ${outOfStock ? "opacity-40" : ""}`}>
        <div className="relative w-[70px] h-[70px] mx-auto">
          <div className="w-full h-full rounded-lg overflow-hidden border border-white/6 bg-purple-950/20 flex items-center justify-center">
            {inv.items.image_url
              ? <img src={inv.items.image_url} alt={inv.items.name} className="w-full h-full object-cover" />
              : <span className="text-2xl opacity-50">⚗</span>
            }
          </div>
          <div className={`absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-black/90 border flex items-center justify-center z-10 ${outOfStock ? "border-red-500/60" : "border-amber-500/60"}`}>
            <span className={`font-display text-[9px] leading-none ${outOfStock ? "text-red-400" : "text-amber-300"}`}>×{inv.quantity}</span>
          </div>
        </div>
      </div>

      {hovering && (
        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50 w-40 bg-[rgba(10,10,25,0.98)] border border-amber-500/25 rounded-xl p-2.5 shadow-2xl pointer-events-none">
          <div className="absolute bottom-[-6px] left-1/2 w-3 h-3 bg-[rgba(10,10,25,0.98)] border-r border-b border-amber-500/25" style={{ transform: "translateX(-50%) rotate(45deg)" }} />
          <div className="font-display text-[10px] text-amber-300 mb-1">{inv.items.name}</div>
          <div className="text-[9px] text-muted-foreground leading-relaxed">{inv.items.description}</div>
        </div>
      )}
    </div>
  )
}

export function VendorShop({ items, purchasedCounts, manaBalance, seasonId, stipendClaimable, inventory }: VendorShopProps) {
  const router = useRouter()
  const [localMana, setLocalMana] = useState(manaBalance)
  const [localPurchased, setLocalPurchased] = useState<Record<string, number>>(purchasedCounts)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [chestHovering, setChestHovering] = useState(false)

  useEffect(() => {
    if (chestHovering) document.body.classList.add("chest-hovered")
    else document.body.classList.remove("chest-hovered")
    return () => document.body.classList.remove("chest-hovered")
  }, [chestHovering])

  async function handlePurchase(item: VendorItem) {
    setConfirmingSlug(null)
    setPurchasing(item.slug)
    setErrors(prev => ({ ...prev, [item.slug]: "" }))
    const res = await fetch("/api/vendor/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ season_id: seasonId, item_slug: item.slug }),
    })
    if (res.ok) {
      setLocalMana(prev => prev - item.vendor_price)
      setLocalPurchased(prev => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))
      router.refresh()
    } else {
      const data = await res.json()
      setErrors(prev => ({ ...prev, [item.slug]: data.error ?? "Purchase failed" }))
    }
    setPurchasing(null)
  }

  const hoveredItem = hoveredSlug && !confirmingSlug ? items.find(i => i.slug === hoveredSlug) ?? null : null

  // Quote is fixed for the lifetime of this page visit — picked once at mount from initial props
  const [gargoyleQuote] = useState(() => pickGargoyleQuote({
    stipendClaimable: stipendClaimable ?? false,
    anyPurchased: Object.values(purchasedCounts).some(n => n > 0),
    allExhausted: items.length > 0 && items.every(item => (purchasedCounts[item.id] ?? 0) >= item.vendor_weekly_limit),
    canAffordAny: items.some(item => manaBalance >= item.vendor_price && (purchasedCounts[item.id] ?? 0) < item.vendor_weekly_limit),
    manaBalance,
    noItems: items.length === 0,
  }))

  const [scale, setScale] = useState(1)
  useEffect(() => {
    function update() { setScale(Math.min(1, window.innerWidth / 1173)) }
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  const chestMotesRef = useRef<HTMLCanvasElement>(null)
  const chestMotesDesktopRef = useRef<HTMLCanvasElement>(null)

  function runChestMotes(canvas: HTMLCanvasElement) {
    const syncSize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(canvas)

    type Mote = { x: number; y: number; vx: number; vy: number; alpha: number; alphaDir: number; alphaSpeed: number; holdFrames: number; size: number; hue: number; lightness: number }

    const spawnMote = (w: number, h: number): Mote => {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.15 + Math.random() * 0.35
      return {
        x: w / 2 + (Math.random() - 0.5) * w * 0.15,
        y: h / 2 + (Math.random() - 0.5) * h * 0.15,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0,
        alphaDir: 1,
        alphaSpeed: 0.012 + Math.random() * 0.016,
        holdFrames: Math.floor(Math.random() * 40),
        size: 0.8 + Math.random() * 1.8,
        hue: 188 + Math.random() * 4,
        lightness: 80 + Math.random() * 15,
      }
    }

    const motes: Mote[] = Array.from({ length: 18 }, () => spawnMote(canvas.offsetWidth, canvas.offsetHeight))

    let rafId: number
    const draw = () => {
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const m of motes) {
        if (m.holdFrames > 0) { m.holdFrames--; }
        else {
          m.alpha += m.alphaDir * m.alphaSpeed
          if (m.alpha >= 1) { m.alpha = 1; m.alphaDir = -1; m.holdFrames = 40 + Math.floor(Math.random() * 120) }
          if (m.alpha <= 0) { m.alpha = 0; m.alphaDir = 1; m.holdFrames = 20 + Math.floor(Math.random() * 60) }
        }
        m.x += m.vx
        m.y += m.vy
        if (m.x < 0 || m.x > canvas.width || m.y < 0 || m.y > canvas.height) {
          Object.assign(m, spawnMote(canvas.width, canvas.height))
        }
        ctx.save()
        ctx.globalAlpha = m.alpha * 0.8
        ctx.shadowBlur = m.size * 9
        ctx.shadowColor = `hsl(${m.hue}, 100%, 75%)`
        ctx.fillStyle = `hsl(${m.hue}, 100%, ${m.lightness}%)`
        ctx.beginPath()
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }
      rafId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(rafId); ro.disconnect() }
  }

  useEffect(() => {
    if (!stipendClaimable) return
    const canvas = chestMotesRef.current
    if (!canvas) return
    return runChestMotes(canvas)
  }, [stipendClaimable])

  useEffect(() => {
    if (!stipendClaimable) return
    const canvas = chestMotesDesktopRef.current
    if (!canvas) return
    return runChestMotes(canvas)
  }, [stipendClaimable])

  return (
    <div>
      <style>{`
        body.bag-hovered .bag-blur { filter: blur(3px); }
        body.chest-hovered .chest-blur { filter: blur(3px); }
      `}</style>

      {/* Desktop layout */}
      <div
        className="hidden md:flex flex-col items-center justify-end gap-4 pb-12 w-full"
        style={{ position: "fixed", top: "8vh", left: 0, right: 0, bottom: 0, zIndex: 6 }}
      >
        <div style={{ transform: `translateY(115px) scale(${scale})`, transformOrigin: "top center", position: "relative", zIndex: 10 }}>
      {/* Vendor item grid */}
      <div className="relative flex justify-center">
        <div className="bag-blur chest-blur pointer-events-none" style={{ lineHeight: 0 }}>
          <img
            src="/shopkeep.png"
            alt=""
            className="select-none"
            style={{ width: "1173px", maxWidth: "100%", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 83%, transparent 90%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)", WebkitMaskComposite: "destination-in", maskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 83%, transparent 90%), linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)", maskComposite: "intersect" }}
            draggable={false}
          />
        </div>
        {/* Gargoyle speech bubble — hidden */}
        {inventory && <BoosterBagCounter inventory={inventory} />}
        {stipendClaimable !== undefined && (
          <>
            {/* Contact shadow — dark oval on the stone counter surface */}
            <div
              className="absolute pointer-events-none bag-blur"
              style={{
                left: "112px",
                bottom: "352px",
                width: "280px",
                height: "36px",
                background: "rgba(0,0,0,0.92)",
                borderRadius: "50%",
                filter: "blur(10px)",
                zIndex: 4,
              }}
            />
            <div
              className="absolute left-[90px] bottom-[350px] bag-blur"
              style={{ zIndex: 5 }}
              onMouseEnter={() => setChestHovering(true)}
              onMouseLeave={() => setChestHovering(false)}
            >
              <StipendBanner claimable={stipendClaimable} seasonId={seasonId} />
            </div>
            {stipendClaimable && (
              <canvas
                ref={chestMotesDesktopRef}
                style={{ position: "absolute", left: "60px", bottom: "340px", width: "350px", height: "300px", zIndex: 6, pointerEvents: "none" }}
              />
            )}
          </>
        )}
        <div className="bag-blur chest-blur absolute bottom-[110px] left-0 right-0 flex flex-wrap justify-center gap-[185px]">
        {items.map(item => {
          const bought = localPurchased[item.id] ?? 0
          const exhausted = bought >= item.vendor_weekly_limit
          const canAfford = localMana >= item.vendor_price
          const isBuying = purchasing === item.slug
          const remaining = item.vendor_weekly_limit - bought
          const isConfirming = confirmingSlug === item.slug

          return (
            <div
              key={item.id}
              className="relative flex flex-col items-center gap-2 w-[188px]"
              onMouseEnter={() => setHoveredSlug(item.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
              onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
            >
              {/* Purchase confirmation popout */}
              {isConfirming && (
                <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 bg-[rgba(10,10,25,0.98)] border border-amber-500/30 rounded-xl p-3 shadow-2xl flex flex-col items-center gap-2.5">
                  <div className="absolute bottom-[-6px] left-1/2 w-3 h-3 bg-[rgba(10,10,25,0.98)] border-r border-b border-amber-500/30" style={{ transform: "translateX(-50%) rotate(45deg)" }} />
                  <div className="font-display text-[10px] text-foreground text-center leading-snug">
                    Purchase {item.name}?
                  </div>
                  <div className="flex items-center gap-1">
                    <img src="/icons/mana-icon.png" alt="mana" width={12} height={12} className="shrink-0" />
                    <span className="font-display text-[11px] text-cyan-300">{item.vendor_price}</span>
                  </div>
                  <div className="flex gap-1.5 w-full">
                    <button
                      onClick={() => handlePurchase(item)}
                      className="flex-1 py-1.5 rounded-lg font-display text-[10px] border border-amber-500/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmingSlug(null)}
                      className="flex-1 py-1.5 rounded-lg font-display text-[10px] border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Clickable frame wrapping image + name */}
              <div
                className={`relative px-4 pt-4 pb-0 flex flex-col items-center gap-3 rounded-xl border w-full select-none
                  transition-transform duration-150
                  ${exhausted
                    ? "border-white/10 opacity-50 cursor-not-allowed"
                    : !canAfford
                    ? "border-white/10 opacity-60 cursor-not-allowed"
                    : isBuying
                    ? "border-amber-500/30 cursor-wait"
                    : "border-transparent cursor-pointer hover:scale-[1.04] active:scale-[0.96]"
                  }`}
                style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,1)) drop-shadow(0 4px 24px rgba(0,0,0,1))" }}
                onClick={!exhausted && !isBuying && purchasing === null && canAfford ? () => setConfirmingSlug(item.slug) : undefined}
              >
                <div className="relative w-[95px] h-[95px]">
                  <div className={`w-full h-full rounded-xl overflow-hidden border transition-all duration-200 ${
                    exhausted ? "border-white/10 grayscale" : "border-slate-400/20"
                  }`}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-amber-950/30 flex items-center justify-center text-3xl opacity-50">⚗</div>
                    }
                  </div>
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/90 border border-cyan-500/50 z-10 whitespace-nowrap">
                    <img src="/icons/mana-icon.png" alt="mana" width={13} height={13} className="shrink-0" />
                    <span className="font-display text-[12px] leading-none text-cyan-300">{item.vendor_price}</span>
                  </div>
                  <div className={`absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-black/90 border flex items-center justify-center z-10 ${exhausted ? "border-red-500/60" : "border-cyan-500/60"}`}>
                    <span className={`font-display text-[9px] leading-none ${exhausted ? "text-red-400" : "text-cyan-300"}`}>×{exhausted ? 0 : remaining}</span>
                  </div>
                </div>

                <div className={`font-display text-sm text-center min-h-[46px] w-full flex flex-col items-center justify-center ${exhausted || !canAfford ? "text-muted-foreground" : "text-amber-300"}`}>
                  {item.name}
                </div>

                {isBuying && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
              </div>

              {errors[item.slug] && (
                <div className="text-[10px] text-red-400 text-center font-body w-full">{errors[item.slug]}</div>
              )}
            </div>
          )
        })}
        </div>
      </div>

      {/* Cursor-following tooltip for vendor items */}
      {hoveredItem && !purchasing && (
        <div
          className="fixed z-[9999] w-52 bg-[rgba(10,10,25,0.98)] border border-amber-500/30 rounded-xl p-3 shadow-2xl pointer-events-none flex flex-col gap-1.5"
          style={{ left: mousePos.x + 14, top: mousePos.y - 10 }}
        >
          <div className="font-display text-[11px] text-amber-300">{hoveredItem.name}</div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">{hoveredItem.description}</div>
          <div className="flex items-center gap-1 mt-1">
            <img src="/icons/mana-icon.png" alt="mana" width={12} height={12} className="shrink-0" />
            <span className="font-display text-[10px] text-cyan-300">{hoveredItem.vendor_price} mana</span>
          </div>
        </div>
      )}
        </div>{/* /scale wrapper */}
      </div>{/* /desktop flex */}

      {/* Mobile layout */}
      <div className="md:hidden" style={{ position: "fixed", inset: 0, overflow: "hidden", paddingTop: "140px", zIndex: 3 }}>

        {/* Restock sign — centered above shopkeep */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
          <div style={{ position: "relative", width: "55%" }}>
            <img src="/restock-sign.png" alt="" style={{ width: "100%", height: "auto", display: "block" }} draggable={false} />
            <div style={{ position: "absolute", top: "calc(58% + 6px)", left: "calc(50% + 52px)", transform: "translate(-50%, -50%)" }}>
              <VendorCountdown />
            </div>
          </div>
        </div>

        {/* Shopkeep illustration — aspect-ratio container, chest + items overlaid */}
        <div style={{ width: "100%", overflowX: "clip", overflowY: "visible", marginTop: "125px", position: "relative", zIndex: 3 }}>
        <div style={{ position: "relative", width: "110%", aspectRatio: "1351 / 742", marginLeft: "-5%" }}>
          <img
            src="/shopkeep.png"
            alt=""
            className="select-none"
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
              WebkitMaskComposite: "destination-in",
              maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%), linear-gradient(to bottom, black 0%, black 85%, transparent 100%)",
              maskComposite: "intersect",
            }}
            draggable={false}
          />

          {/* Cyan motes confined to chest area — only when chest is full */}
          {stipendClaimable && (
            <canvas
              ref={chestMotesRef}
              style={{ position: "absolute", left: "20px", bottom: "calc(35% + 50px)", width: "37.5%", height: "55%", zIndex: 3, pointerEvents: "none" }}
            />
          )}

          {/* Chest contact shadow */}
          {stipendClaimable !== undefined && (
            <div style={{
              position: "absolute",
              left: "calc(6% + 45px)",
              bottom: "calc(54% + 6px)",
              width: "18.6%",
              height: "6px",
              background: "rgba(0,0,0,0.92)",
              borderRadius: "50%",
              filter: "blur(6px)",
              zIndex: 4,
              pointerEvents: "none",
            }} />
          )}


          {/* Chest — on the counter, left side */}
          {stipendClaimable !== undefined && (
            <div style={{ position: "absolute", left: "calc(7.7% + 5px)", bottom: "calc(54% + 3px)", width: "29.3%", zIndex: 2 }}>
              <StipendBanner claimable={stipendClaimable} seasonId={seasonId} />
            </div>
          )}

          {/* Vendor item tiles — on the stone panels */}
          {items.length > 0 && (
            <div style={{ position: "absolute", bottom: "calc(10% - 5px)", left: 0, right: 0, display: "flex", justifyContent: "center", gap: "72px", zIndex: 2 }}>
              {items.map(item => {
                const bought = localPurchased[item.id] ?? 0
                const exhausted = bought >= item.vendor_weekly_limit
                const canAfford = localMana >= item.vendor_price
                const isBuying = purchasing === item.slug
                const remaining = item.vendor_weekly_limit - bought
                const isConfirming = confirmingSlug === item.slug
                return (
                  <div key={item.id} style={{ position: "relative", width: "70px" }}>
                    <div style={{ position: "relative", width: "70px", height: "70px" }}>
                      <div
                        style={{ width: "70px", height: "70px" }}
                        className={`rounded-xl border overflow-hidden select-none transition-transform duration-150 ${exhausted ? "border-white/10 opacity-50 cursor-not-allowed" : !canAfford ? "border-white/10 opacity-60 cursor-not-allowed" : isBuying ? "border-amber-500/30 cursor-wait" : "border-amber-500/20 cursor-pointer active:scale-95"}`}
                        onClick={!exhausted && !isBuying && purchasing === null && canAfford ? () => setConfirmingSlug(item.slug) : undefined}
                      >
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} className={`w-full h-full object-cover ${exhausted ? "grayscale" : ""}`} />
                          : <div className="w-full h-full bg-amber-950/30 flex items-center justify-center text-xl opacity-50">⚗</div>
                        }
                        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-0.5 pt-2" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)" }}>
                          <div className="flex items-center gap-0.5">
                            <img src="/icons/mana-icon.png" alt="mana" width={10} height={10} className="shrink-0" />
                            <span className="font-display text-[10px] text-cyan-300">{item.vendor_price}</span>
                          </div>
                        </div>
                        {isBuying && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-3 w-3 animate-spin text-amber-400" /></div>}
                      </div>
                      {/* Stock badge — relative to image tile, not full card */}
                      <div className={`absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-black/90 border flex items-center justify-center z-10 ${exhausted ? "border-red-500/60" : "border-cyan-500/60"}`}>
                        <span className={`font-display text-[9px] leading-none ${exhausted ? "text-red-400" : "text-cyan-300"}`}>×{exhausted ? 0 : remaining}</span>
                      </div>
                    </div>
                    <div className={`font-display text-[10px] text-center mt-1 leading-tight line-clamp-2 ${exhausted || !canAfford ? "text-muted-foreground" : "text-amber-300/80"}`}>{item.name}</div>
                    {errors[item.slug] && <div className="text-[10px] text-red-400 text-center font-body mt-0.5">{errors[item.slug]}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        </div>{/* /overflow wrapper */}

        {/* Mobile purchase confirmation — fixed centered overlay */}
        {confirmingSlug && (() => {
          const item = items.find(i => i.slug === confirmingSlug)
          if (!item) return null
          return (
            <>
              <div className="fixed inset-0 z-40" style={{ backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }} onClick={() => setConfirmingSlug(null)} />
              <div className="fixed z-50 bg-[rgba(10,10,25,0.98)] border border-amber-500/30 rounded-xl p-4 shadow-2xl flex flex-col items-center gap-3" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "200px" }}>
                <div className="font-display text-[11px] text-foreground text-center leading-snug">Purchase {item.name}?</div>
                <div className="flex items-center gap-1">
                  <img src="/icons/mana-icon.png" alt="mana" width={13} height={13} className="shrink-0" />
                  <span className="font-display text-[12px] text-cyan-300">{item.vendor_price} mana</span>
                </div>
                <div className="flex gap-2 w-full">
                  <button onClick={() => handlePurchase(item)} className="flex-1 py-2 rounded-lg font-display text-[11px] border border-amber-500/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 transition-colors cursor-pointer">Confirm</button>
                  <button onClick={() => setConfirmingSlug(null)} className="flex-1 py-2 rounded-lg font-display text-[11px] border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors cursor-pointer">Cancel</button>
                </div>
              </div>
            </>
          )
        })()}

        {/* Inventory — fixed to bottom of viewport */}
        {inventory && inventory.filter(i => i.quantity > 0).length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 px-4 pt-3 pb-10 space-y-2 z-20" style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(5,3,14,0.95) 20%)" }}>
            <div className="font-display text-[10px] text-amber-300/60 uppercase tracking-widest">Your Stock</div>
            <div className="grid grid-cols-4 gap-2">
              {inventory.filter(i => i.quantity > 0).map(inv => (
                <BoosterDisplayTile key={inv.item_id} inv={inv} />
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

export function BoosterStockOverlay({ inventory }: { inventory: InventoryItem[] }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ transform: hovered ? "scale(1)" : "scale(0.75)", transformOrigin: "top left", transition: "transform 0.25s ease-out" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <BoosterStock inventory={inventory} />
    </div>
  )
}

export function BoosterStock({ inventory }: { inventory: InventoryItem[] }) {
  return (
    <div className="flex flex-col items-center gap-4" style={{ transform: "translateY(-25px)" }}>
      <div className="relative" style={{ width: "357px", transform: "translateX(-135px)" }}>
        <img
          src="/booster-bag.png"
          alt=""
          className="w-full pointer-events-none select-none"
          style={{ transform: "rotate(0deg)" }}
          draggable={false}
        />
        <div className="absolute inset-0 flex items-center justify-center z-10">
          {inventory.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/70 font-body text-center w-36 leading-relaxed">
              No boosters — earn drops or purchase from the shop.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2" style={{ transform: "scale(1.2)" }}>
              {inventory.slice(0, 8).map(inv => (
                <div key={inv.item_id}>
                  <BoosterDisplayTile inv={inv} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
