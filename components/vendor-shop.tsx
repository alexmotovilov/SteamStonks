"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { ManaIcon } from "@/components/mana-icon"

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
  inventory: InventoryItem[]
}

function BoosterDisplayTile({ inv }: { inv: InventoryItem }) {
  const [hovering, setHovering] = useState(false)
  if (!inv.items) return null
  return (
    <div
      className="relative"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="w-[88px] h-[112px] flex flex-col items-center gap-1 p-1.5 rounded-xl border border-white/7 bg-[rgba(25,15,5,0.7)]">
        <div className="relative w-[70px] h-[70px] mx-auto mb-1.5">
          <div className="w-full h-full rounded-lg overflow-hidden border border-white/6 bg-purple-950/20 flex items-center justify-center">
            {inv.items.image_url
              ? <img src={inv.items.image_url} alt={inv.items.name} className="w-full h-full object-cover" />
              : <span className="text-2xl opacity-50">⚗</span>
            }
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-black/90 border border-amber-500/60 flex items-center justify-center z-10">
            <span className="font-display text-[7px] leading-none text-amber-300">×{inv.quantity}</span>
          </div>
        </div>
        <div className="font-display text-[8px] text-muted-foreground text-center leading-tight line-clamp-2 w-full">
          {inv.items.name}
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

export function VendorShop({ items, purchasedCounts, manaBalance, seasonId, inventory }: VendorShopProps) {
  const router = useRouter()
  const [localMana, setLocalMana] = useState(manaBalance)
  const [localPurchased, setLocalPurchased] = useState<Record<string, number>>(purchasedCounts)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [confirmingSlug, setConfirmingSlug] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

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

  return (
    <div className="relative space-y-10">
      {/* Vendor item grid */}
      <div className="flex flex-wrap justify-center gap-3">
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
              className={`relative rounded-2xl border bg-[rgba(15,10,5,0.85)] p-4 flex flex-col items-center gap-3 transition-all duration-200 w-[171px] ${
                exhausted
                  ? "border-white/10"
                  : "border-amber-500/20 hover:border-amber-500/40"
              }`}
              onMouseEnter={() => setHoveredSlug(item.slug)}
              onMouseLeave={() => setHoveredSlug(null)}
              onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
            >
              {/* Purchase confirmation popout */}
              {isConfirming && (
                <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-50 bg-[rgba(10,10,25,0.98)] border border-amber-500/30 rounded-xl p-3 shadow-2xl flex flex-col items-center gap-2.5">
                  <div className="absolute top-[-6px] left-1/2 w-3 h-3 bg-[rgba(10,10,25,0.98)] border-l border-t border-amber-500/30" style={{ transform: "translateX(-50%) rotate(45deg)" }} />
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

              <div className={`w-[86px] h-[86px] rounded-xl overflow-hidden border transition-all duration-200 ${
                exhausted ? "border-white/10 grayscale opacity-40" : "border-amber-500/20"
              }`}>
                {item.image_url
                  ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-amber-950/30 flex items-center justify-center text-3xl opacity-50">⚗</div>
                }
              </div>

              {/* Name — min-h reserves two lines so bottom content aligns across all tiles */}
              <div className={`font-display text-sm text-center min-h-[42px] w-full flex flex-col items-center justify-start ${exhausted ? "text-muted-foreground" : "text-amber-300"}`}>
                {item.name}
              </div>

              <div className="font-body text-[11px] text-muted-foreground text-center">
                {exhausted
                  ? "Limit reached this week"
                  : `${remaining} of ${item.vendor_weekly_limit} purchase${item.vendor_weekly_limit !== 1 ? "s" : ""} remaining`
                }
              </div>

              <div className="flex items-center gap-1.5">
                <ManaIcon size={14} />
                <span className="font-display text-sm text-cyan-300">{item.vendor_price}</span>
              </div>

              {errors[item.slug] && (
                <div className="text-[10px] text-red-400 text-center font-body w-full">{errors[item.slug]}</div>
              )}

              {exhausted ? (
                <div className="w-full py-2 text-center font-display text-[11px] text-muted-foreground border border-white/10 rounded-lg">
                  Limit Reached
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingSlug(item.slug)}
                  disabled={!canAfford || isBuying || purchasing !== null}
                  className={`w-full py-2 rounded-lg font-display text-[11px] border transition-all duration-200 flex items-center justify-center gap-1.5 ${
                    isBuying
                      ? "border-amber-500/40 bg-amber-950/30 text-amber-400 cursor-wait"
                      : !canAfford
                      ? "border-white/10 text-muted-foreground cursor-not-allowed opacity-50"
                      : purchasing !== null
                      ? "border-white/10 text-muted-foreground cursor-not-allowed opacity-50"
                      : "border-amber-500/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40 hover:border-amber-500/60 cursor-pointer"
                  }`}
                >
                  {isBuying && <Loader2 className="h-3 w-3 animate-spin" />}
                  {isBuying ? "Purchasing…" : !canAfford ? "Insufficient Mana" : "Purchase"}
                </button>
              )}
            </div>
          )
        })}
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

      {/* Booster inventory section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-white/8" />
          <span className="font-display text-[11px] text-muted-foreground tracking-widest uppercase">Your Booster Stock</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        {inventory.length === 0 ? (
          <p className="text-[11px] text-muted-foreground font-body text-center">
            Your inventory is empty. Purchase items above or earn drops from predictions.
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3 mx-auto w-fit">
            {inventory.map(inv => (
              <BoosterDisplayTile key={inv.item_id} inv={inv} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
