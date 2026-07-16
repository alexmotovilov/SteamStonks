"use client"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ManaIcon } from "@/components/mana-icon"
import { StipendBanner } from "@/components/stipend-banner"

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
          right: "145px",
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
        style={{ right: "140px", bottom: "345px", zIndex: 5, cursor: hovering ? "none" : "default" }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/booster-bag-closed.png"
          alt="Booster inventory"
          width={184}
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
            <div className="absolute flex items-center justify-center" style={{ inset: "8% 10% 12% 10%" }}>
              {inventory.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/70 font-body text-center w-32 leading-relaxed">
                  No boosters
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5" style={{ transform: "scale(0.85) translateX(-13px)" }}>
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

  return (
    <div className="relative">
      <style>{`
        body.bag-hovered .bag-blur { filter: blur(3px); }
        body.chest-hovered .chest-blur { filter: blur(3px); }
      `}</style>
      {/* Vendor item grid */}
      <div className="relative flex justify-center">
        <div className="bag-blur chest-blur pointer-events-none" style={{ lineHeight: 0 }}>
          <img
            src="/shopkeep.png"
            alt=""
            className="select-none"
            style={{ width: "1173px", maxWidth: "100%", filter: "drop-shadow(0 6px 19px rgba(0,0,0,1)) drop-shadow(0 10px 24px rgba(0,0,0,0.6))", WebkitMaskImage: "linear-gradient(to bottom, black 75%, transparent 90%)", maskImage: "linear-gradient(to bottom, black 75%, transparent 90%)" }}
            draggable={false}
          />
        </div>
        {/* Gargoyle speech bubble */}
        <div
          className="absolute pointer-events-none"
          style={{ top: "-47px", left: "50%", transform: "translateX(calc(-50% + 60px))", width: "260px", zIndex: 6 }}
        >
          <div
            className="relative rounded-xl border px-4 py-3 text-sm font-body text-white text-center"
            style={{ backdropFilter: "blur(4px)", borderColor: "#C4A882", backgroundColor: "rgba(196,168,130,0.25)" }}
          >
            {gargoyleQuote}
            <div
              className="absolute bottom-0 translate-y-full"
              style={{ left: "37.5%", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #C4A882" }}
            />
          </div>
        </div>
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
              className="absolute left-[110px] bottom-[350px] bag-blur"
              style={{ zIndex: 5 }}
              onMouseEnter={() => setChestHovering(true)}
              onMouseLeave={() => setChestHovering(false)}
            >
              <StipendBanner claimable={stipendClaimable} seasonId={seasonId} />
            </div>
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
