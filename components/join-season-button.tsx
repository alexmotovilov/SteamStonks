"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Loader2, Coins } from "lucide-react"

// ─── Constants ────────────────────────────────────────────────

const EQUIPMENT_SLUGS = ["seers_spectacles", "arcanum_esoterica", "clockwork_familiar"] as const

export const EQUIPMENT_IMAGES: Record<string, string> = {
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

// ─── Types ────────────────────────────────────────────────────

interface EquipmentItem {
  id: string
  slug: string
  name: string
  description: string | null
  effects: Record<string, unknown>
}

interface JoinSeasonButtonProps {
  seasonId: string
  seasonName: string
  entryFee: number
  currentBalance: number
}

// ─── Sub-components ───────────────────────────────────────────

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
      {/* Artwork */}
      <div className="aspect-square w-full overflow-hidden bg-purple-950/30">
        {image ? (
          <img src={image} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-40">⚗</div>
        )}
      </div>

      {/* Info */}
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

// ─── Main component ───────────────────────────────────────────

export function JoinSeasonButton({ seasonId, seasonName, entryFee, currentBalance }: JoinSeasonButtonProps) {
  const [phase, setPhase] = useState<"idle" | "selecting">("idle")
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canAfford = currentBalance >= entryFee

  async function openModal() {
    const supabase = createClient()
    const { data } = await supabase
      .from("items")
      .select("id, slug, name, description, effects")
      .in("slug", EQUIPMENT_SLUGS)
    // Sort to match EQUIPMENT_SLUGS order
    const sorted = (data ?? []).sort(
      (a, b) => EQUIPMENT_SLUGS.indexOf(a.slug as typeof EQUIPMENT_SLUGS[number]) -
                EQUIPMENT_SLUGS.indexOf(b.slug as typeof EQUIPMENT_SLUGS[number])
    )
    setEquipment(sorted)
    setPhase("selecting")
  }

  function handleCancel() {
    setPhase("idle")
    setSelectedId(null)
    setSelectedSlug(null)
    setError(null)
  }

  async function handleConfirmJoin() {
    if (!selectedSlug) return
    setJoining(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("You must be logged in")

      // 1. Deduct entry fee tokens
      const { error: tokenError } = await supabase
        .from("profiles")
        .update({ token_balance: currentBalance - entryFee, updated_at: new Date().toISOString() })
        .eq("id", user.id)
      if (tokenError) throw tokenError

      // 2. Create season entry WITH equipment_id (slug) set from the start
      const { error: entryError } = await supabase
        .from("season_entries")
        .insert({
          season_id:                    seasonId,
          user_id:                      user.id,
          tokens_paid:                  entryFee,
          equipment_id:                 selectedSlug,
          season_score:                 0,
          equipment_tier_score:         0,
          stipend_week_number:          0,
          starter_kit_claimed:          false,
          first_prediction_bonus_claimed: false,
        })

      if (entryError) {
        // Rollback token deduction
        await supabase.from("profiles").update({ token_balance: currentBalance }).eq("id", user.id)
        throw entryError
      }

      // 3. Award starter kit (non-fatal if it fails)
      const kitRes = await fetch("/api/seasons/join/starter-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId }),
      })
      if (!kitRes.ok) {
        console.error("[Join Season] Failed to award starter kit:", await kitRes.text())
      }

      setPhase("idle")
      router.push("/games")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join season")
    } finally {
      setJoining(false)
    }
  }

  if (!canAfford) {
    return (
      <Button disabled>
        <Coins className="mr-2 h-4 w-4" />
        Insufficient Tokens ({currentBalance}/{entryFee})
      </Button>
    )
  }

  return (
    <>
      <Button onClick={openModal}>
        <Coins className="mr-2 h-4 w-4" />
        Join Season ({entryFee} tokens)
      </Button>

      {phase === "selecting" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-[rgba(10,10,20,0.98)] border border-purple-500/20 rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">

            {/* Header */}
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl text-foreground tracking-wide mb-2">
                Choose Your Equipment
              </h2>
              <p className="text-sm text-muted-foreground mb-1">
                Select one piece of equipment for {seasonName}.
              </p>
              <p className="text-xs text-amber-400 font-display tracking-wide">
                ⚠ Your choice is permanent for this season
              </p>
            </div>

            {/* Equipment cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {equipment.map(item => (
                <EquipmentCard
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onSelect={() => { setSelectedId(item.id); setSelectedSlug(item.slug) }}
                />
              ))}
              {equipment.length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground font-body">
                  Loading equipment…
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}

            {/* Footer */}
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
                  onClick={handleConfirmJoin}
                  disabled={!selectedId || joining}
                  className={`font-display text-sm px-5 py-2 rounded-xl border transition-colors ${
                    selectedId && !joining
                      ? "bg-emerald-500/12 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                      : "bg-white/5 text-muted-foreground border-white/10 cursor-not-allowed"
                  }`}
                >
                  {joining ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Joining…
                    </span>
                  ) : (
                    "Confirm Selection & Join →"
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
