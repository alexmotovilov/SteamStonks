"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

const EQUIPMENT_SLUGS = ["seers_spectacles", "arcanum_esoterica", "clockwork_familiar"] as const

const EQUIPMENT_IMAGES: Record<string, string> = {
  seers_spectacles:   "/equipment/seers-spectacles.png",
  arcanum_esoterica:  "/equipment/arcanum-esoterica.png",
  clockwork_familiar: "/equipment/clockwork-familiar.png",
}

const EQUIPMENT_TIERS: Record<string, { t0: string; t3: string; t6: string }> = {
  seers_spectacles: {
    t0: "Players window +3% · Reviews window +1",
    t3: "Players window +5% · Reviews window +2",
    t6: "Players window +10% · Reviews window +5",
  },
  arcanum_esoterica: {
    t0: "+15 mana per correct metric",
    t3: "+25 mana per correct metric · +25 mana if both correct",
    t6: "+25 mana per correct metric · +25 mana if both correct · +50 mana total reward",
  },
  clockwork_familiar: {
    t0: "+1 drop if players correct · +1 drop if reviews correct",
    t3: "+1 drop if players correct · +1 drop if reviews correct · +1 booster slot",
    t6: "+1 booster slot · +2 drops total reward",
  },
}

const EQUIPMENT_COLORS: Record<string, string> = {
  seers_spectacles:   "text-emerald-400",
  arcanum_esoterica:  "text-cyan-300",
  clockwork_familiar: "text-amber-400",
}

interface EquipmentItem {
  id: string
  slug: string
  name: string
  description: string | null
  effects: Record<string, unknown>
}

interface VestSeasonButtonProps {
  seasonId: string
  entryFee: number
  currentBalance: number
}

function TierRow({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1 border-t border-border/50">
      <span className="font-display text-[9px] text-muted-foreground/50 tracking-widest uppercase w-12 shrink-0 pt-0.5">
        {label}
      </span>
      <span className={`${color} leading-tight`}>{text}</span>
    </div>
  )
}

function EquipmentCard({ item, isSelected, onSelect }: {
  item: EquipmentItem
  isSelected: boolean
  onSelect: () => void
}) {
  const tiers = EQUIPMENT_TIERS[item.slug]
  const image = EQUIPMENT_IMAGES[item.slug]

  return (
    <div
      onClick={onSelect}
      className={`rounded-xl border overflow-hidden cursor-pointer transition-all duration-200 ${
        isSelected
          ? "border-amber-500 shadow-[0_0_0_1px_rgba(217,119,6,0.3)] bg-amber-950/20"
          : "border-border bg-[rgba(15,12,25,0.9)] hover:border-purple-500/40"
      }`}
    >
      <div className="aspect-square w-full overflow-hidden bg-purple-950/30">
        {image ? (
          <img src={image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">⚗</div>
        )}
      </div>
      <div className="p-3">
        <div className="font-display text-sm text-foreground mb-3">{item.name}</div>
        {tiers && (
          <div>
            <TierRow label="Tier I"   text={tiers.t0} color={EQUIPMENT_COLORS[item.slug] ?? "text-muted-foreground"} />
            <TierRow label="Tier II"  text={tiers.t3} color={EQUIPMENT_COLORS[item.slug] ?? "text-muted-foreground"} />
            <TierRow label="Tier III" text={tiers.t6} color={EQUIPMENT_COLORS[item.slug] ?? "text-muted-foreground"} />
          </div>
        )}
        <div className={`w-full py-1.5 mt-3 rounded-lg font-display text-[10px] tracking-wide text-center transition-colors ${
          isSelected
            ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
            : "border border-purple-500/30 text-purple-400 hover:bg-purple-950/30"
        }`}>
          {isSelected ? "✓ Selected" : "Select"}
        </div>
      </div>
    </div>
  )
}

export function VestSeasonButton({ seasonId, entryFee, currentBalance }: VestSeasonButtonProps) {
  const [open, setOpen] = useState(false)
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [vesting, setVesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canAfford = currentBalance >= entryFee

  async function openModal() {
    const supabase = createClient()
    const { data } = await supabase
      .from("items")
      .select("id, slug, name, description, effects")
      .in("slug", EQUIPMENT_SLUGS)
    const sorted = (data ?? []).sort(
      (a, b) => EQUIPMENT_SLUGS.indexOf(a.slug as typeof EQUIPMENT_SLUGS[number]) -
                EQUIPMENT_SLUGS.indexOf(b.slug as typeof EQUIPMENT_SLUGS[number])
    )
    setEquipment(sorted)
    setOpen(true)
  }

  function handleCancel() {
    setOpen(false)
    setSelectedSlug(null)
    setError(null)
  }

  async function handleConfirmVest() {
    if (!selectedSlug) return
    setVesting(true)
    setError(null)
    try {
      const res = await fetch("/api/seasons/vest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId, equipment_id: selectedSlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to vest")
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vest")
    } finally {
      setVesting(false)
    }
  }

  return (
    <>
      <button
        onClick={canAfford ? openModal : undefined}
        disabled={!canAfford}
        className={`font-display text-sm px-5 py-2.5 rounded-xl border transition-colors tracking-wide ${
          canAfford
            ? "border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-950/50 hover:border-purple-500/60 cursor-pointer"
            : "border-white/10 bg-white/5 text-muted-foreground cursor-not-allowed"
        }`}
      >
        {canAfford
          ? `Vest into Season (${entryFee} tokens)`
          : `Insufficient Tokens (${currentBalance}/${entryFee})`}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-[rgba(10,10,20,0.98)] border border-purple-500/20 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">

            <div className="text-center mb-6">
              <h2 className="font-display text-2xl text-foreground tracking-wide mb-2">
                Choose Your Equipment
              </h2>
              <p className="text-sm text-muted-foreground mb-1">
                Vesting costs {entryFee} tokens (you have {currentBalance}).
                Unlocks the Season Ladder, Auspicious Omens, equipment bonuses, and the weekly stipend.
              </p>
              <p className="text-xs text-amber-400 font-display tracking-wide">
                ⚠ Your equipment choice is permanent for this season
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {equipment.map(item => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  isSelected={selectedSlug === item.slug}
                  onSelect={() => setSelectedSlug(item.slug)}
                />
              ))}
              {equipment.length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground font-body">
                  Loading equipment…
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                onClick={handleCancel}
                className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
              >
                ← Cancel
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Entry fee: <span className="text-amber-400">{entryFee} tokens</span>
                </span>
                <button
                  onClick={handleConfirmVest}
                  disabled={!selectedSlug || vesting}
                  className={`font-display text-sm px-5 py-2 rounded-xl border transition-colors ${
                    selectedSlug && !vesting
                      ? "bg-emerald-500/12 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                      : "bg-white/5 text-muted-foreground border-white/10 cursor-not-allowed"
                  }`}
                >
                  {vesting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Vesting…
                    </span>
                  ) : (
                    "Confirm Equipment & Vest →"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
