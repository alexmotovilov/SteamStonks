"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Lock, Loader2, Target, Trophy, CheckCircle2, XCircle,
  AlertTriangle, GripVertical
} from "lucide-react"
import {
  computePlayersWindow,
  computeReviewsWindow,
  resolveBoosterEffects,
  resolveEquipmentEffects,
  calculateEarlyLockMana,
} from "@/lib/scoring"
import { GemSlider } from "@/components/gem-slider"
import { ManaIcon } from "@/components/mana-icon"
import { distributionToGradient, computeAuguryDistribution } from "@/lib/ladder-scoring"

function GuideLink({ section, label }: { section: string; label?: string }) {
  return (
    <a
      href={`/guide#${section}`}
      target="_blank"
      rel="noopener noreferrer"
      title={label ?? "Learn more"}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/20 text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors text-[9px] font-display leading-none"
    >
      ?
    </a>
  )
}

interface InventoryItem {
  item_id: string
  quantity: number
  items: {
    slug: string
    name: string
    image_url: string | null
    effects: Record<string, number>
    description: string
  }
}

interface ExistingPrediction {
  id: string
  players_midpoint: number | null
  reviews_midpoint: number | null
  players_window_low: number | null
  players_window_high: number | null
  reviews_window_low: number | null
  reviews_window_high: number | null
  early_locked_at: string | null
  is_locked: boolean
  locked_at: string | null
  result: "perfect" | "partial" | "failed" | null
  players_correct: boolean | null
  reviews_correct: boolean | null
  actual_player_count: number | null
  actual_review_score: number | null
  final_points: number | null
  scored_at: string | null
  applied_boosters: string[]
  applied_rites: Record<string, string>
  mana_players: number | null
  mana_reviews: number | null
  mana_both_bonus: number | null
  mana_early_lock: number | null
  mana_boosters: number | null
  mana_equipment: number | null
  mana_first_prediction: number | null
  drops_awarded: number | null
  ao_marked?: boolean
  ladder_red_slot_game_id?: string | null
}

interface LadderGame {
  id: string
  name: string
  header_image_url: string | null
  is_released: boolean
  release_date: string | null
}

interface PredictionFormProps {
  gameId: string
  gameName: string
  seasonId: string
  seasonStatus: string
  existingPrediction: ExistingPrediction | null
  isReleased: boolean
  releaseDate: string | null
  predictionLockDate: string | null
  snapshotPlayerCount?: number | null
  snapshotReviewPositive?: number | null
  snapshotReviewNegative?: number | null
  snapshotCapturedAt?: string | null
  equipmentSlug: string | null
  equipmentTierScore: number
  ladderGames: LadderGame[]
  existingLadder: string[]
  lockedLadderGameIds: string[]
  inventory: InventoryItem[]
  aoMarkCount?: number  // how many AO marks player has made this season
  aoMarkedGameIds?: string[]  // game IDs where this player has applied AO this season
  predictedGameIds?: string[]  // game IDs where this player has made a prediction this season
  firstPredictionBonusEligible?: boolean
}

const PLAYERS_MIN = 100
const PLAYERS_MAX = 2000000
const PLAYERS_STEP = 100

const RITES = [
  { slug: "ritual_of_augury",    name: "Ritual of Augury",      cost: 10,              placeholder: "👁", image: "/rites/ritual-of-augury.png",      description: "Reveals the crowd's prediction distribution as a heatmap on the sliders for 2 minutes.", confirmText: "Perform the Ritual of Augury?",        confirmBtn: "Perform", auraColor: "cyan",   reusable: true  },
  { slug: "eldritch_wager",      name: "Eldritch Wager",        cost: 30,              placeholder: "⚖", image: "/rites/eldritch-wager.png",         description: "Adds +25 mana to your reward for each correct metric, additional +25 mana if both are correct.",              confirmText: "Invoke the Eldritch Wager?",           confirmBtn: "Wager",   auraColor: "purple", reusable: false },
  { slug: "sigil_of_multiplicity", name: "Sigil of Multiplicity", cost: 50,            placeholder: "✦", image: "/rites/sigil-of-multiplicity.png",  description: "Unlocks an additional booster slot for this prediction.",                               confirmText: "Invoke the Sigil of Multiplicity?",    confirmBtn: "Invoke",  auraColor: "purple", reusable: false },
  { slug: "temporal_translocation", name: "Temporal Translocation", cost: 100,         placeholder: "⧗", image: "/rites/temporal-translocation.png", description: "Unlocks your early-locked prediction and resets the early lock bonus. Requires early lock to be active.", confirmText: "Unlock via Temporal Translocation?", confirmBtn: "Unlock",  auraColor: "cyan",   reusable: true  },
  { slug: "auspicious_omens",    name: "Auspicious Omens",      cost: null as number | null, placeholder: "★", image: "/rites/auspicious-omens.png", description: "Mark this game as destined for the Top 8. If any marked game misses, all Auspicious Omens rewards are forfeited.", confirmText: "Mark this game with Auspicious Omens?", confirmBtn: "Mark It", auraColor: "purple", reusable: false },
] as const

function RiteCircle({ rite, isPerformed, disabled, onConfirm }: { rite: typeof RITES[number] & { image?: string }; isPerformed: boolean; disabled: boolean; onConfirm: () => void }) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 })
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const isReusable = (rite as any).reusable as boolean
  const isGreyedOut = isPerformed && !isReusable
  const borderStyle = isGreyedOut
    ? "border-white/10"
    : isPerformed
      ? rite.auraColor === "cyan"
        ? "border-cyan-400 shadow-[0_0_0_2px_rgba(34,211,238,0.15),0_0_16px_rgba(34,211,238,0.2),inset_0_0_12px_rgba(34,211,238,0.08)]"
        : "border-violet-400 shadow-[0_0_0_2px_rgba(167,139,250,0.15),0_0_16px_rgba(167,139,250,0.2),inset_0_0_12px_rgba(167,139,250,0.08)]"
      : "border-purple-900/40 hover:border-purple-500/50"

  function handleButtonClick() {
    if (open) { setOpen(false); return }
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect()
      // Position to the right of the circle, vertically centered on it (circle is 62px tall)
      setPopoverPos({ x: rect.right + 10, y: rect.top + 31 })
    }
    setOpen(true)
  }

  return (
    <div
      className="flex flex-col items-center gap-1.5"
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={e => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Circle wrapper — badge positioned relative to this */}
      <div className="relative w-[62px] h-[62px]">
        <button disabled={disabled || isGreyedOut} onClick={handleButtonClick}
          className={`w-full h-full rounded-full border-2 bg-[rgba(20,15,40,0.9)] flex items-center justify-center text-2xl transition-all duration-200 overflow-hidden ${borderStyle} ${isGreyedOut ? "opacity-40 grayscale cursor-not-allowed" : disabled ? "cursor-default opacity-60" : "cursor-pointer"}`}>
          {(rite as any).image
            ? <img src={(rite as any).image} alt={rite.name} className="w-full h-full object-cover rounded-full" />
            : rite.placeholder
          }
        </button>
        {/* Mana cost badge — anchored to bottom of circle, always consistent */}
        {rite.cost != null && (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-black/90 border border-cyan-500/60 flex items-center justify-center z-10">
            <span className="font-display text-[7px] text-cyan-300 leading-none">{rite.cost}</span>
          </div>
        )}
      </div>
      <div className="font-display text-[9px] text-muted-foreground text-center leading-tight max-w-[80px]">{rite.name}</div>

      {/* Hover tooltip — fixed, appears to the right of the cursor */}
      {hovered && !open && (
        <div
          className="fixed z-[9999] w-44 bg-[rgba(10,10,25,0.98)] border border-purple-500/30 rounded-xl p-2.5 shadow-2xl pointer-events-none flex flex-col gap-1.5"
          style={{ left: mousePos.x + 14, top: mousePos.y - 10 }}
        >
          <div className="font-display text-[10px] text-emerald-300">{rite.name}</div>
          <div className="text-[9px] text-muted-foreground leading-relaxed">{rite.description}</div>
          {rite.cost != null && (
            <div className="flex items-center gap-1 mt-0.5">
              <img src="/icons/mana-icon.png" alt="mana" width={12} height={12} className="shrink-0" />
              <span className="font-display text-[10px] text-cyan-300">{rite.cost}</span>
            </div>
          )}
        </div>
      )}

      {/* Confirmation popover — fixed, anchored to right edge of rite circle */}
      {open && (
        <div
          className="fixed z-[9999] w-48 bg-[rgba(10,10,25,0.98)] border border-purple-500/30 rounded-xl p-3 shadow-2xl flex flex-col gap-2"
          style={{ left: popoverPos.x, top: popoverPos.y, transform: "translateY(-50%)" }}
        >
          <div className="absolute left-[-6px] top-1/2 w-3 h-3 bg-[rgba(10,10,25,0.98)] border-l border-b border-purple-500/30" style={{transform:"translateY(-50%) rotate(45deg)"}} />
          <div className="font-display text-[11px] text-emerald-300">{rite.name}</div>
          <div className="text-[10px] text-muted-foreground leading-relaxed">{rite.description}</div>
          {rite.cost != null && <div className="text-[10px] text-cyan-400">Cost: {rite.cost} mana</div>}
          <div className="text-[10px] text-muted-foreground italic">{rite.confirmText}</div>
          <div className="flex gap-2 mt-1">
            <button onClick={() => { setOpen(false); onConfirm() }} className="flex-1 py-1 rounded-lg text-[10px] font-display bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors">{rite.confirmBtn}</button>
            <button onClick={() => setOpen(false)} className="flex-1 py-1 rounded-lg text-[10px] font-display bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function BoosterTile({ inv, isApplied, canApply, isSavedLocked, onToggle }: { inv: InventoryItem; isApplied: boolean; canApply: boolean; isSavedLocked?: boolean; onToggle: () => void }) {
  const [hovering, setHovering] = useState(false)
  const outOfStock = inv.quantity <= 0 && !isApplied
  return (
    <div className="relative" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <button onClick={onToggle} disabled={isSavedLocked || (!canApply && !isApplied) || outOfStock}
        className={`w-full flex flex-col items-center gap-1 p-1 rounded-xl border transition-all duration-200 ${
          isSavedLocked ? "border-amber-500/60 shadow-[0_0_0_1px_rgba(217,119,6,0.2),inset_0_0_8px_rgba(217,119,6,0.06)] bg-amber-950/20 cursor-default"
          : isApplied ? "border-amber-500 shadow-[0_0_0_1px_rgba(217,119,6,0.3),inset_0_0_8px_rgba(217,119,6,0.08)] bg-amber-950/30 cursor-pointer"
          : outOfStock ? "border-white/7 bg-black/30 opacity-30 cursor-not-allowed"
          : canApply ? "border-white/7 bg-[rgba(25,15,5,0.7)] hover:border-amber-500/40 cursor-pointer"
          : "border-white/7 bg-[rgba(25,15,5,0.7)] opacity-40 cursor-not-allowed"
        }`}>
        {/* Image with quantity badge overlay */}
        <div className="relative w-[54px] h-[54px] mx-auto mb-1.5">
          <div className="w-full h-full rounded-lg overflow-hidden border border-white/6 bg-purple-950/20 flex items-center justify-center">
            {inv.items.image_url ? <img src={inv.items.image_url} alt={inv.items.name} className="w-full h-full object-cover" /> : <span className="text-2xl opacity-50">⚗</span>}
          </div>
          {/* Quantity badge — amber circle bottom-right */}
          <div className={`absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full border flex items-center justify-center z-10 ${
            outOfStock ? "bg-black/90 border-red-500/60" : "bg-black/90 border-amber-500/60"
          }`}>
            <span className={`font-display text-[7px] leading-none ${outOfStock ? "text-red-400" : "text-amber-300"}`}>
              {outOfStock ? "×0" : `×${inv.quantity}`}
            </span>
          </div>
          {/* Lock badge — top-left for saved+locked boosters */}
          {isSavedLocked && (
            <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-black/90 border border-amber-500/60 flex items-center justify-center z-10">
              <Lock className="h-2 w-2 text-amber-400" />
            </div>
          )}
          {/* Applied checkmark — top-right for applied+unlocked boosters */}
          {isApplied && !isSavedLocked && <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-amber-500/90 border border-amber-400 flex items-center justify-center z-10 text-[7px] text-white font-bold">✓</div>}
        </div>
        <div className="font-display text-[8px] text-muted-foreground text-center leading-tight line-clamp-2 w-full">{inv.items.name}</div>
      </button>
      {hovering && (
        <div className="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-50 w-40 bg-[rgba(10,10,25,0.98)] border border-amber-500/25 rounded-xl p-2.5 shadow-2xl pointer-events-none">
          <div className="absolute bottom-[-6px] left-1/2 w-3 h-3 bg-[rgba(10,10,25,0.98)] border-r border-b border-amber-500/25" style={{transform:"translateX(-50%) rotate(45deg)"}} />
          <div className="font-display text-[10px] text-amber-300 mb-1">{inv.items.name}</div>
          <div className="text-[9px] text-muted-foreground leading-relaxed">
            {isSavedLocked ? "Applied & locked — boosters cannot be removed after saving" : inv.items.description}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Augury Countdown ─────────────────────────────────────────────────────────

function AuguryCountdown({ expiry }: { expiry: number }) {
  const [secondsLeft, setSecondsLeft] = useState(
    Math.max(0, Math.ceil((expiry - Date.now()) / 1000))
  )

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((expiry - Date.now()) / 1000))
      setSecondsLeft(s)
      if (s <= 0) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [expiry])

  const pct = (secondsLeft / 120) * 100

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
      <div className="relative w-3 h-3 shrink-0">
        <svg viewBox="0 0 12 12" className="w-full h-full -rotate-90">
          <circle cx="6" cy="6" r="5" fill="none" stroke="rgba(103,232,249,0.2)" strokeWidth="1.5" />
          <circle cx="6" cy="6" r="5" fill="none" stroke="#67e8f9" strokeWidth="1.5"
            strokeDasharray={`${2 * Math.PI * 5}`}
            strokeDashoffset={`${2 * Math.PI * 5 * (1 - pct / 100)}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
      </div>
      <span className="font-display text-[10px] text-cyan-300 tracking-wide">
        👁 Augury active · {secondsLeft}s
      </span>
    </div>
  )
}

// ─── Active Effects Panel ─────────────────────────────────────────────────────

interface EffectLine { text: string; color: "green" | "red" | "cyan" | "amber" | "gold" }
interface EffectGroup { source: string | null; effects: EffectLine[]; sourceColor?: string }

const EQUIPMENT_NAMES: Record<string, string> = {
  seers_spectacles:   "Seer's Spectacles",
  arcanum_esoterica:  "Arcanum Esoterica",
  clockwork_familiar: "Clockwork Familiar",
}

const BOOSTER_EFFECTS: Record<string, EffectLine[]> = {
  scrying_orb_polish:       [{ text: "Players window +10%", color: "green" }],
  crystal_focus:            [{ text: "Reviews window +2", color: "green" }],
  evocation_distillate:     [{ text: "+25 mana total reward", color: "cyan" }],
  thaumaturgic_concentrate: [{ text: "+50 mana total reward", color: "cyan" }],
  blood_bargain:            [{ text: "Reviews window +3", color: "green" }, { text: "Players window −3%", color: "red" }],
  black_gem_accumulator:    [{ text: "Players window −5%", color: "red" }, { text: "+75 mana if players correct", color: "cyan" }],
  infernal_patrons_pact:    [{ text: "Reviews window −1", color: "red" }, { text: "+1 loot drop total reward", color: "amber" }],
  tincture_of_divination:   [{ text: "Players window +10%", color: "green" }, { text: "Reviews window +5", color: "green" }],
}

const BOOSTER_NAMES: Record<string, string> = {
  scrying_orb_polish:       "Scrying Orb Polish",
  crystal_focus:            "Crystal Focus",
  evocation_distillate:     "Evocation Distillate",
  thaumaturgic_concentrate: "Thaumaturgic Concentrate",
  blood_bargain:            "Blood Bargain",
  black_gem_accumulator:    "Black Gem Accumulator",
  infernal_patrons_pact:    "Infernal Patron's Pact",
  tincture_of_divination:   "Tincture of Divination",
}

const RITE_EFFECTS: Record<string, EffectLine[]> = {
  eldritch_wager:        [{ text: "+25 mana per correct metric", color: "cyan" }, { text: "+25 mana if both correct", color: "cyan" }],
  sigil_of_multiplicity: [{ text: "+1 booster slot", color: "amber" }],
  auspicious_omens:      [{ text: "★ Marked for Top 8", color: "gold" }],
}

const RITE_NAMES: Record<string, string> = {
  eldritch_wager:        "Eldritch Wager",
  sigil_of_multiplicity: "Sigil of Multiplicity",
  auspicious_omens:      "Auspicious Omens",
}

const DOT_COLOR: Record<string, string> = {
  green: "bg-emerald-400", red: "bg-red-400", cyan: "bg-cyan-400", amber: "bg-amber-400", gold: "bg-amber-600",
}
const TEXT_COLOR: Record<string, string> = {
  green: "text-emerald-400", red: "text-red-400", cyan: "text-cyan-300", amber: "text-amber-400", gold: "text-amber-600",
}

interface ActiveEffectsPanelProps {
  equipmentSlug: string | null
  equipmentTierScore: number
  appliedBoosters: string[]
  performedRites: Set<string>
  aoMarked: boolean
  firstPredictionBonusEligible: boolean
}

function ActiveEffectsPanel({ equipmentSlug, equipmentTierScore, appliedBoosters, performedRites, aoMarked, firstPredictionBonusEligible }: ActiveEffectsPanelProps) {
  const sourcedGroups: EffectGroup[] = []

  if (equipmentSlug) {
    const eq = resolveEquipmentEffects(equipmentSlug, equipmentTierScore)
    const effects: EffectLine[] = []
    if (eq.players_window_pct > 0)  effects.push({ text: `Players window +${eq.players_window_pct}%`, color: "green" })
    if (eq.players_window_pct < 0)  effects.push({ text: `Players window −${Math.abs(eq.players_window_pct)}%`, color: "red" })
    if (eq.reviews_window_flat > 0) effects.push({ text: `Reviews window +${eq.reviews_window_flat}`, color: "green" })
    if (eq.reviews_window_flat < 0) effects.push({ text: `Reviews window −${Math.abs(eq.reviews_window_flat)}`, color: "red" })
    if (eq.mana_players_bonus > 0)  effects.push({ text: `+${eq.mana_players_bonus} mana if players correct`, color: "cyan" })
    if (eq.mana_reviews_bonus > 0)  effects.push({ text: `+${eq.mana_reviews_bonus} mana if reviews correct`, color: "cyan" })
    if (eq.mana_both_bonus > 0)     effects.push({ text: `+${eq.mana_both_bonus} mana if both correct`, color: "cyan" })
    if (eq.mana_total_reward > 0)   effects.push({ text: `+${eq.mana_total_reward} mana total reward`, color: "cyan" })
    if (eq.extra_booster_slots > 0) effects.push({ text: `+${eq.extra_booster_slots} booster slot`, color: "amber" })
    if (eq.drops_players_bonus > 0) effects.push({ text: `+${eq.drops_players_bonus} drop if players correct`, color: "amber" })
    if (eq.drops_reviews_bonus > 0) effects.push({ text: `+${eq.drops_reviews_bonus} drop if reviews correct`, color: "amber" })
    if (eq.drops_total_reward > 0)  effects.push({ text: `+${eq.drops_total_reward} drops total reward`, color: "amber" })
    if (effects.length > 0) {
      const activeTier = equipmentTierScore <= 1 ? 0 : equipmentTierScore <= 4 ? 1 : 2
      const tierColor = ["#b87333", "#a8a9ad", "#ffd700"][activeTier]
      sourcedGroups.push({ source: EQUIPMENT_NAMES[equipmentSlug] ?? equipmentSlug, effects, sourceColor: tierColor })
    }
  }

  for (const slug of appliedBoosters) {
    const effects = BOOSTER_EFFECTS[slug]
    if (effects) sourcedGroups.push({ source: BOOSTER_NAMES[slug] ?? slug, effects, sourceColor: "#f59e0b" })
  }

  for (const slug of Array.from(performedRites)) {
    if (slug === "auspicious_omens" && !aoMarked) continue
    const effects = RITE_EFFECTS[slug]
    if (effects) sourcedGroups.push({ source: RITE_NAMES[slug] ?? slug, effects, sourceColor: "#9D84D4" })
  }

  return (
    <div className="bg-[rgba(10,10,20,0.6)] border border-white/8 rounded-xl p-3 space-y-1.5">
      <div className="font-display text-[9px] text-muted-foreground/50 tracking-widest uppercase">Active Effects</div>

      {firstPredictionBonusEligible && (
        <div className="flex items-start gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1 bg-cyan-400" />
          <span className="text-[9px] leading-tight text-cyan-300">+50 mana first prediction bonus</span>
        </div>
      )}

      <div className="border-t border-white/8" />

      {sourcedGroups.length === 0 ? (
        <p className="text-[9px] italic text-muted-foreground/40">No boosters or rites active</p>
      ) : (
        <div className="space-y-2">
          {sourcedGroups.map((group, gi) => (
            <div key={gi}>
              <div
                className={`font-display text-[9px] mb-0.5 ${group.sourceColor ? "" : "text-muted-foreground/60"}`}
                style={group.sourceColor ? { color: group.sourceColor } : undefined}
              >{group.source}</div>
              {group.effects.map((effect, ei) => (
                <div key={ei} className="flex items-start gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${DOT_COLOR[effect.color]}`} />
                  <span className={`text-[9px] leading-tight ${TEXT_COLOR[effect.color]}`}>{effect.text}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function EmptyLadderSlot({ rank, isOverflow, onDragEnter, onDragEnd }: {
  rank: number; isOverflow: boolean; onDragEnter: () => void; onDragEnd: () => void;
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      className={`rounded-lg border flex items-center px-2 min-h-[48px] transition-all duration-200 ${
        isOverflow
          ? "border-dashed border-red-500/20 bg-red-950/10"
          : "border-dashed border-white/8 bg-[rgba(15,12,25,0.3)]"
      }`}
    >
      <span className={`font-display text-[9px] ${isOverflow ? "text-red-400/30" : "text-muted-foreground/20"}`}>
        {isOverflow ? "—" : rank}
      </span>
    </div>
  )
}

function LadderTile({ game, rank, isLocked, isExcluded, isOverflow, isCurrentGame, isAoMarked, totalGames, onDragStart, onDragEnter, onDragEnd }: {
  game: LadderGame; rank: number; isLocked: boolean; isExcluded: boolean; isOverflow: boolean; isCurrentGame: boolean; isAoMarked: boolean; totalGames: number;
  onDragStart: () => void; onDragEnter: () => void; onDragEnd: () => void;
}) {
  const [hovered, setHovered] = useState(false)
  const baseHeight = Math.max(28, 52 - (totalGames - 1) * 3)
  const imgHeight = hovered ? Math.max(baseHeight, 52) : baseHeight
  const borderClass = isOverflow ? "border-dashed border-red-500/40"
    : isExcluded ? "border-dashed border-white/10 opacity-30"
    : isAoMarked ? "border-violet-500/50"
    : isCurrentGame ? "border-emerald-500/40"
    : isLocked ? "border-white/8 opacity-55"
    : "border-white/8 hover:border-purple-500/35"
  return (
    <div draggable={!isLocked && !isExcluded} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragEnd={onDragEnd} onDragOver={e => e.preventDefault()}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={`rounded-lg border overflow-hidden bg-[rgba(15,12,25,0.9)] transition-all duration-200 ${borderClass} ${!isLocked && !isExcluded ? "cursor-grab active:cursor-grabbing" : ""}`}>
      <div className={`w-full relative overflow-hidden transition-all duration-300 ${isLocked ? "grayscale" : ""}`} style={{ height: `${imgHeight}px` }}>
        {game.header_image_url ? <img src={game.header_image_url} alt={game.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-purple-950/30" />}
        {isOverflow && <div className="absolute inset-0 bg-red-950/60" />}
        {!isExcluded && <div className={`absolute top-1 left-1.5 font-display text-[9px] px-1.5 py-0.5 rounded bg-black/70 ${isCurrentGame ? "text-emerald-400" : isOverflow ? "text-red-400" : "text-muted-foreground"}`}>{isOverflow ? "—" : rank}</div>}
        {isAoMarked && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_6px_rgba(251,191,36,0.5)]">
            <span className="text-[10px] text-violet-400 leading-none">★</span>
          </div>
        )}
        {isLocked && !isExcluded && <div className="absolute bottom-1 right-1.5"><Lock className="h-2.5 w-2.5 text-muted-foreground/50" /></div>}
      </div>
      <div className="flex items-center justify-between px-1.5 py-1">
        <span className={`font-display text-[8px] truncate flex-1 ${isOverflow ? "text-red-400/70" : isExcluded ? "text-muted-foreground/40" : isCurrentGame ? "text-emerald-400" : isLocked ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
          {isExcluded ? "Excluded" : game.name}
        </span>
        {!isLocked && !isExcluded && <GripVertical className="h-3 w-3 text-muted-foreground/30 shrink-0" />}
      </div>
    </div>
  )
}

function ActionPopover({ open, title, description, confirmLabel, onConfirm, onCancel, colorClass = "emerald" }: {
  open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; colorClass?: "emerald" | "amber"
}) {
  if (!open) return null
  const cs = colorClass === "amber" ? "bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20" : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
  return (
    <div className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-50 bg-[rgba(10,10,25,0.98)] border border-purple-500/25 rounded-xl p-3 shadow-2xl flex flex-col gap-2">
      <div className="absolute bottom-[-6px] left-6 w-3 h-3 bg-[rgba(10,10,25,0.98)] border-r border-b border-purple-500/25" style={{transform:"rotate(45deg)"}} />
      <div className="font-display text-[11px] text-foreground">{title}</div>
      <div className="text-[10px] text-muted-foreground leading-relaxed">{description}</div>
      <div className="flex gap-2 mt-1">
        <button onClick={onConfirm} className={`flex-1 py-1.5 rounded-lg text-[10px] font-display border transition-colors ${cs}`}>{confirmLabel}</button>
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[10px] font-display bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

export function PredictionForm({
  gameId, gameName, seasonId, seasonStatus, existingPrediction, isReleased, releaseDate,
  snapshotPlayerCount, snapshotReviewPositive, snapshotReviewNegative,
  equipmentSlug, equipmentTierScore, ladderGames, existingLadder, lockedLadderGameIds, inventory, aoMarkCount = 0,
  aoMarkedGameIds = [],
  predictedGameIds = [],
  firstPredictionBonusEligible = false,
}: PredictionFormProps) {
  const predictedSet = new Set(predictedGameIds)
  const router = useRouter()
  const supabase = createClient()
  const isSeasonClosed = seasonStatus === "scoring" || seasonStatus === "completed"
  // temporalUnlocked overrides early_locked_at from the server prop so the UI
  // updates immediately after Temporal Translocation is used, without a full reload.
  const [temporalUnlocked, setTemporalUnlocked] = useState(false)
  const isEarlyLocked = !temporalUnlocked && !!existingPrediction?.early_locked_at && !existingPrediction?.is_locked
  const isSlidersLocked = isSeasonClosed || !!existingPrediction?.is_locked || isEarlyLocked || isReleased
  const isFullyLocked = isSeasonClosed || !!existingPrediction?.is_locked || isReleased

  const initialiseLadder = (): (string | null)[] => {
    if (isFullyLocked) return [...existingLadder]
    const slots: (string | null)[] = Array(9).fill(null)
    if (existingLadder.includes(gameId)) {
      // Already ranked — restore saved position; red slot from per-card saved state
      for (let i = 0; i < Math.min(existingLadder.length, 8); i++) slots[i] = existingLadder[i]
      slots[8] = existingPrediction?.ladder_red_slot_game_id ?? null
    } else {
      // Not yet ranked — others in 0–7, current game in red slot
      const others = existingLadder.filter(id => id !== gameId)
      for (let i = 0; i < Math.min(others.length, 8); i++) slots[i] = others[i]
      slots[8] = gameId
    }
    return slots
  }

  const [playersMidpoint, setPlayersMidpoint] = useState(existingPrediction?.players_midpoint ?? 10000)
  const [reviewsMidpoint, setReviewsMidpoint] = useState(existingPrediction?.reviews_midpoint ?? 75)
  const [playersEditing, setPlayersEditing] = useState(false)
  const [playersDraft,   setPlayersDraft]   = useState("")
  const [reviewsEditing, setReviewsEditing] = useState(false)
  const [reviewsDraft,   setReviewsDraft]   = useState("")
  const [appliedBoosters, setAppliedBoosters] = useState<string[]>(existingPrediction?.applied_boosters ?? [])
  const [performedRites, setPerformedRites] = useState<Set<string>>(new Set(Object.keys(existingPrediction?.applied_rites ?? {})))
  const [aoMarked, setAoMarked] = useState(existingPrediction?.ao_marked ?? false)
  // AO cost = 10 × (existing marks + 1), or +10 more if already marked this game
  const aoNextCost = (aoMarkCount + (aoMarked ? 0 : 1)) * 10
  const [ladder, setLadder] = useState<(string | null)[]>(initialiseLadder)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [auguryGradientPlayers, setAuguryGradientPlayers] = useState<string | null>(null)
  const [auguryGradientReviews, setAuguryGradientReviews] = useState<string | null>(null)
  const [auguryExpiry, setAuguryExpiry] = useState<number | null>(null)
  const [auguryRunning, setAuguryRunning] = useState(false)
  const [auguryIsSparse, setAuguryIsSparse] = useState(false)
  const [showSavePop, setShowSavePop] = useState(false)
  const [showLockPop, setShowLockPop] = useState(false)

  const boosters = resolveBoosterEffects(appliedBoosters)
  const equipment = resolveEquipmentEffects(equipmentSlug, equipmentTierScore)
  const playersWindow = computePlayersWindow(playersMidpoint, boosters.players_window_pct_delta + equipment.players_window_pct)
  const reviewsWindow = computeReviewsWindow(reviewsMidpoint, boosters.reviews_window_flat_delta + equipment.reviews_window_flat)
  const earlyLockMana = calculateEarlyLockMana(existingPrediction?.early_locked_at ?? new Date().toISOString(), releaseDate ? new Date(releaseDate) : null)
  const baseSlots = 2
  const extraSlots = equipment.extra_booster_slots + (performedRites.has("sigil_of_multiplicity") ? 1 : 0)
  const maxSlots = baseSlots + extraSlots
  const previewMana = (() => {
    let t = earlyLockMana + boosters.mana_total_reward + equipment.mana_total_reward
    t += 50 + boosters.mana_players_bonus - boosters.mana_players_penalty + equipment.mana_players_bonus
    t += 50 + boosters.mana_reviews_bonus + equipment.mana_reviews_bonus
    t += 50 + equipment.mana_both_bonus
    return t
  })()
  const snapshotReviewScore = snapshotReviewPositive != null && snapshotReviewNegative != null && snapshotReviewPositive + snapshotReviewNegative > 0
    ? Math.round((snapshotReviewPositive / (snapshotReviewPositive + snapshotReviewNegative)) * 100) : null

  useEffect(() => {
    if (!releaseDate || isReleased) return
    function update() {
      const diff = new Date(releaseDate!).getTime() - Date.now()
      if (diff <= 0) { setCountdown(null); return }
      const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000)
      setCountdown(d > 0 ? `${d}d ${h}h ${m}m until release` : `${h}h ${m}m until release`)
    }
    update(); const t = setInterval(update, 60000); return () => clearInterval(t)
  }, [releaseDate, isReleased])

  useEffect(() => {
    if (!auguryExpiry) return
    const t = setInterval(() => { if (Date.now() >= auguryExpiry) { setAuguryGradientPlayers(null); setAuguryGradientReviews(null); setAuguryExpiry(null) } }, 1000)
    return () => clearInterval(t)
  }, [auguryExpiry])

  function handleDragStart(i: number) { dragItem.current = i }
  function handleDragEnter(i: number) { dragOverItem.current = i }
  function handleDragEnd() {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return
    const id = ladder[dragItem.current]
    if (id === null) return
    const g = ladderGames.find(g => g.id === id)
    const gReleased = g ? (g.is_released || (!!g.release_date && new Date(g.release_date) <= new Date())) : false
    if (lockedLadderGameIds.includes(id) || gReleased) return
    const next = [...ladder]; const [d] = next.splice(dragItem.current, 1); next.splice(dragOverItem.current, 0, d)
    setLadder(next); dragItem.current = null; dragOverItem.current = null
  }

  function toggleBooster(slug: string) {
    if (isFullyLocked) return
    setAppliedBoosters(prev => {
      if (prev.includes(slug)) {
        // Boosters already saved to the DB are locked — cannot be removed
        if ((existingPrediction?.applied_boosters ?? []).includes(slug)) return prev
        return prev.filter(s => s !== slug)
      }
      if (prev.length >= maxSlots) return prev
      const inv = inventory.find(i => i.items.slug === slug)
      if (!inv || inv.quantity <= 0) return prev
      return [...prev, slug]
    })
  }

  async function performRite(slug: string) {
    const isReusable = RITES.find(r => r.slug === slug)?.reusable ?? false
    if (performedRites.has(slug) && !isReusable) return
    setError(null)

    if (slug === "ritual_of_augury") {
      if (!existingPrediction?.id) {
        setError("Save your prediction first before using the Ritual of Augury.")
        return
      }
      setAuguryRunning(true)
      try {
        const res = await fetch("/api/rites/augury", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game_id: gameId, season_id: seasonId, prediction_id: existingPrediction.id }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Ritual failed")
        // Players slider uses log scale; reviews is linear
        setAuguryGradientPlayers(distributionToGradient(computeAuguryDistribution(data.players_midpoints, PLAYERS_MIN, PLAYERS_MAX, 50, true)))
        setAuguryGradientReviews(distributionToGradient(computeAuguryDistribution(data.reviews_midpoints, 0, 100)))
        setAuguryExpiry(Date.now() + 2 * 60 * 1000)
        setAuguryIsSparse(data.sparse ?? false)
        // NOTE: intentionally NOT added to performedRites — augury uses auguryActive instead
      } catch (err) { setError(err instanceof Error ? err.message : "Ritual of Augury failed") }
      finally { setAuguryRunning(false) }
      return
    }

    if (!existingPrediction?.id) {
      setError("Save your prediction first before using rites.")
      return
    }

    const res = await fetch("/api/rites/perform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prediction_id: existingPrediction.id,
        season_id: seasonId,
        rite_slug: slug,
        mana_cost: slug === "auspicious_omens" ? aoNextCost : undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "Rite failed"); return }

    if (slug === "auspicious_omens") setAoMarked(true)
    if (slug === "temporal_translocation") setTemporalUnlocked(true)
    setPerformedRites(prev => new Set([...prev, slug]))
    router.refresh()
  }

  async function handleSavePrediction() {
    setSaving(true); setShowSavePop(false); setError(null); setSuccess(null)
    try {
      if (isReleased || isFullyLocked) throw new Error("Predictions are locked after a game's release date.")
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("You must be logged in")
      const payload = { user_id: user.id, game_id: gameId, season_id: seasonId, prediction_type: "week_one", players_midpoint: playersMidpoint, reviews_midpoint: reviewsMidpoint, players_window_low: playersWindow.low, players_window_high: playersWindow.high, reviews_window_low: reviewsWindow.low, reviews_window_high: reviewsWindow.high, applied_boosters: appliedBoosters, updated_at: new Date().toISOString(), ladder_red_slot_game_id: (ladder[8] !== null && ladder[8] !== gameId) ? ladder[8] : null }
      let predictionId = existingPrediction?.id ?? null
      if (existingPrediction) { const { error: e } = await supabase.from("predictions").update(payload).eq("id", existingPrediction.id); if (e) throw e }
      else { const { data: ins, error: e } = await supabase.from("predictions").insert(payload).select("id").single(); if (e) throw e; predictionId = ins?.id ?? null }
      const prev = existingPrediction?.applied_boosters ?? []
      const changed = appliedBoosters.length !== prev.length || appliedBoosters.some(s => !prev.includes(s))
      if (predictionId && changed) {
        const res = await fetch("/api/predictions/boosters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prediction_id: predictionId, season_id: seasonId, new_boosters: appliedBoosters, previous_boosters: prev }) })
        const data = await res.json(); if (!res.ok) throw new Error(data.error || "Failed to apply boosters")
      }
      const rankedGames = ladder.slice(0, 8).filter((id): id is string => id !== null)
      if (rankedGames.length > 0) await supabase.from("ladder_rankings").upsert({ user_id: user.id, season_id: seasonId, ranked_games: rankedGames, updated_at: new Date().toISOString() }, { onConflict: "user_id,season_id" })
      setSuccess("Prediction saved!"); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to save") }
    finally { setSaving(false) }
  }

  async function handleEarlyLock() {
    if (!existingPrediction || isSlidersLocked || isEarlyLocked) return
    setSaving(true); setShowLockPop(false); setError(null)
    try {
      const { error: e } = await supabase.from("predictions").update({ early_locked_at: new Date().toISOString() }).eq("id", existingPrediction.id)
      if (e) throw e
      setSuccess("Early lock applied! Boosters, rites, and the season ladder remain fully editable."); router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to early lock") }
    finally { setSaving(false) }
  }

  if (existingPrediction?.scored_at && existingPrediction.result) {
    return <ScoredPredictionCard result={existingPrediction.result} gameName={gameName} existingPrediction={existingPrediction} snapshotPlayerCount={snapshotPlayerCount} snapshotReviewScore={snapshotReviewScore} aoMarked={aoMarked} />
  }

  const orbs = Array.from({ length: maxSlots }, (_, i) => i < appliedBoosters.length)

  return (
    <Card className="border-border bg-[rgba(10,10,20,0.95)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Target className="h-5 w-5 text-primary" />{gameName}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-xs mt-0.5">
              Predict week-one performance · Rank in the season ladder
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isEarlyLocked && <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-xs"><Lock className="h-3 w-3 mr-1" />Early Locked</Badge>}
            {existingPrediction?.is_locked && <Badge variant="secondary" className="text-xs"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {error && <Alert variant="destructive" className="mb-3"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {success && <Alert className="border-emerald-500/30 bg-emerald-500/8 mb-3"><CheckCircle2 className="h-4 w-4 text-emerald-400" /><AlertDescription className="text-emerald-400">{success}</AlertDescription></Alert>}

        <div className="grid gap-3" style={{ gridTemplateColumns: "120px 1fr 128px" }}>

          {/* LEFT — Rites */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-1">
              <span className="font-display text-[9px] text-muted-foreground/50 tracking-widest uppercase">Rites</span>
              <GuideLink section="rites" label="About rites" />
            </div>
            {(() => {
              const auguryActive = !!auguryExpiry && Date.now() < auguryExpiry
              return RITES.map(rite => (
                <RiteCircle key={rite.slug}
                  rite={rite.slug === "auspicious_omens" ? { ...rite, cost: aoNextCost } : rite}
                  isPerformed={rite.slug === "ritual_of_augury" ? auguryActive : performedRites.has(rite.slug)}
                  disabled={
                    isFullyLocked ||
                    (rite.slug === "temporal_translocation" && !isEarlyLocked) ||
                    (rite.slug === "ritual_of_augury" && (auguryRunning || auguryActive))
                  }
                  onConfirm={() => performRite(rite.slug)} />
              ))
            })()}
          </div>

          {/* CENTER — Sliders + Boosters + Actions */}
          <div className="flex flex-col gap-4">

            {/* Week 1 sliders — wrapped together so the early lock overlay spans both */}
            <div className="relative flex flex-col gap-4">
              <div className={`space-y-1.5 transition-opacity duration-200 ${isEarlyLocked ? "opacity-30" : ""}`}>
                <div className="flex items-center justify-between">
                  <label className="font-display text-[10px] text-muted-foreground tracking-wide uppercase flex items-center gap-1">Highest Player Count · Week 1 <GuideLink section="sliders" label="About sliders" /></label>
                  <input
                    type="text"
                    inputMode="numeric"
                    readOnly={isSlidersLocked}
                    value={playersEditing ? playersDraft : playersMidpoint.toLocaleString()}
                    onFocus={() => { setPlayersEditing(true); setPlayersDraft(String(playersMidpoint)) }}
                    onChange={e => setPlayersDraft(e.target.value.replace(/[^0-9]/g, ""))}
                    onBlur={() => {
                      const raw = parseInt(playersDraft, 10)
                      const clamped = isNaN(raw) ? playersMidpoint : Math.min(PLAYERS_MAX, Math.max(PLAYERS_MIN, Math.round(raw / PLAYERS_STEP) * PLAYERS_STEP))
                      setPlayersMidpoint(clamped)
                      setPlayersEditing(false)
                    }}
                    onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                    className={`font-mono text-xs text-emerald-400 font-bold bg-transparent rounded px-1.5 py-0.5 text-right w-24 outline-none transition-colors border ${isSlidersLocked ? "cursor-default border-emerald-500/10" : "cursor-text border-emerald-500/25 hover:border-emerald-500/50 focus:border-emerald-500/70 focus:bg-emerald-950/20"}`}
                  />
                </div>
                <GemSlider min={PLAYERS_MIN} max={PLAYERS_MAX} step={PLAYERS_STEP} value={Math.max(PLAYERS_MIN, playersMidpoint)} onChange={setPlayersMidpoint} disabled={isSlidersLocked} windowLow={Math.max(0, playersWindow.low)} windowHigh={playersWindow.high} auguryGradient={auguryGradientPlayers} formatValue={v => v.toLocaleString() + " players"} logScale />
                <div className="text-[10px] text-emerald-700 text-center">{playersWindow.low.toLocaleString()} – {playersWindow.high.toLocaleString()}</div>
              </div>

              <div className={`space-y-1.5 transition-opacity duration-200 ${isEarlyLocked ? "opacity-30" : ""}`}>
                <div className="flex items-center justify-between">
                  <label className="font-display text-[10px] text-muted-foreground tracking-wide uppercase flex items-center gap-1">% Positive Reviews · Week 1 <GuideLink section="sliders" label="About sliders" /></label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      readOnly={isSlidersLocked}
                      value={reviewsEditing ? reviewsDraft : String(reviewsMidpoint)}
                      onFocus={() => { setReviewsEditing(true); setReviewsDraft(String(reviewsMidpoint)) }}
                      onChange={e => setReviewsDraft(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={() => {
                        const raw = parseInt(reviewsDraft, 10)
                        const clamped = isNaN(raw) ? reviewsMidpoint : Math.min(100, Math.max(0, raw))
                        setReviewsMidpoint(clamped)
                        setReviewsEditing(false)
                      }}
                      onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
                      className={`font-mono text-xs text-emerald-400 font-bold bg-transparent rounded px-1.5 py-0.5 text-right w-8 outline-none transition-colors border ${isSlidersLocked ? "cursor-default border-emerald-500/10" : "cursor-text border-emerald-500/25 hover:border-emerald-500/50 focus:border-emerald-500/70 focus:bg-emerald-950/20"}`}
                    />
                    <span className="font-mono text-xs text-emerald-400 font-bold">%</span>
                  </div>
                </div>
                <GemSlider min={0} max={100} step={1} value={reviewsMidpoint} onChange={setReviewsMidpoint} disabled={isSlidersLocked} windowLow={reviewsWindow.low} windowHigh={reviewsWindow.high} auguryGradient={auguryGradientReviews} formatValue={v => v + "% positive"} />
                <div className="text-[10px] text-emerald-700 text-center">{reviewsWindow.low}% – {reviewsWindow.high}%</div>
              </div>

              {/* Single padlock overlay for the whole week 1 panel */}
              {isEarlyLocked && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative">
                    <svg width="80" height="96" viewBox="0 0 80 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Shackle */}
                      <path
                        d="M22 46 L22 26 Q22 8 40 8 Q58 8 58 26 L58 46"
                        stroke="#f59e0b"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        fill="none"
                        opacity="0.85"
                      />
                      {/* Body */}
                      <rect x="6" y="40" width="68" height="50" rx="9"
                        fill="rgba(120,53,15,0.92)"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                      />
                    </svg>
                    {/* Mana value centred inside the padlock body */}
                    <div className="absolute left-0 right-0 flex items-center justify-center gap-1.5" style={{ top: "57px" }}>
                      <span className="font-display text-sm text-amber-300 font-bold tracking-wide">+{earlyLockMana}</span>
                      <img src="/icons/mana-icon.png" alt="mana" width={14} height={14} className="shrink-0" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Early lock — lives here because it only affects the sliders above */}
            {!isSeasonClosed && existingPrediction && !isEarlyLocked && !isReleased && !isFullyLocked && (
              <div className="relative">
                <button onClick={() => { setShowLockPop(p => !p); setShowSavePop(false) }} disabled={saving}
                  className="w-full py-2 rounded-lg font-display text-xs tracking-wide bg-amber-500/8 text-amber-400 border border-amber-500/22 hover:bg-amber-500/15 transition-colors">
                  <Lock className="inline h-3 w-3 mr-1" />Early Lock (+{earlyLockMana} mana bonus) <GuideLink section="early-lock" label="About early lock" />
                </button>
                <ActionPopover open={showLockPop} title="Apply Early Lock?" description="Your week-one sliders and prediction window will be frozen, securing your early lock mana bonus. Boosters, rites, and the season ladder remain fully editable." confirmLabel="Lock It" onConfirm={handleEarlyLock} onCancel={() => setShowLockPop(false)} colorClass="amber" />
              </div>
            )}

            {/* Augury countdown + sparse notice */}
            {auguryExpiry && Date.now() < auguryExpiry && (
              <AuguryCountdown expiry={auguryExpiry} />
            )}
            {auguryGradientPlayers && (
              <div className="text-[9px] text-muted-foreground/50 text-center italic font-body">
                {auguryIsSparse
                  ? "Few prophecies recorded — heatmap may not be representative"
                  : "Showing crowd prediction distribution"}
              </div>
            )}

            {/* Active Effects panel */}
            <ActiveEffectsPanel
              equipmentSlug={equipmentSlug}
              equipmentTierScore={equipmentTierScore}
              appliedBoosters={appliedBoosters}
              performedRites={performedRites}
              aoMarked={aoMarked}
              firstPredictionBonusEligible={firstPredictionBonusEligible ?? false}
            />

            {/* Booster orbs + grid */}
            {!isSeasonClosed && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {orbs.map((filled, i) => (
                    <div key={i} className={`w-5 h-5 rounded-sm border-2 transition-all duration-300 ${filled ? "border-amber-400 bg-gradient-to-br from-yellow-300 via-amber-500 to-amber-700 shadow-[0_0_8px_rgba(251,191,36,0.4)]" : "border-amber-900/50 bg-transparent"}`} />
                  ))}
                  <span className="font-display text-[9px] text-muted-foreground/50 tracking-widest uppercase ml-1 flex items-center gap-1">Booster slots <GuideLink section="boosters" label="About boosters" /></span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {inventory.map(inv => {
                    if (!inv.items) return null
                    const isApplied = appliedBoosters.includes(inv.items.slug)
                    const isSavedLocked = (existingPrediction?.applied_boosters ?? []).includes(inv.items.slug)
                    const canApply = !isApplied && appliedBoosters.length < maxSlots && inv.quantity > 0
                    return <BoosterTile key={inv.item_id} inv={inv} isApplied={isApplied} isSavedLocked={isSavedLocked} canApply={canApply} onToggle={() => toggleBooster(inv.items.slug)} />
                  })}
                  {inventory.length === 0 && <div className="col-span-4 text-[10px] text-muted-foreground text-center py-3">No boosters in inventory</div>}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {!isSeasonClosed && (
              <div className="flex flex-col gap-2">
                {!isFullyLocked && (
                  <div className="relative">
                    <button onClick={() => { setShowSavePop(p => !p); setShowLockPop(false) }} disabled={saving}
                      className="w-full py-2 rounded-lg font-display text-xs tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18 transition-colors disabled:opacity-50">
                      {saving ? <Loader2 className="inline h-3 w-3 animate-spin mr-1" /> : null}
                      {existingPrediction ? "Update Prediction" : "Save Prediction"}
                    </button>
                    <ActionPopover open={showSavePop} title={existingPrediction ? "Update your prediction?" : "Save your prediction?"} description="Your midpoints, window adjustments, and applied boosters will be recorded." confirmLabel="Confirm" onConfirm={handleSavePrediction} onCancel={() => setShowSavePop(false)} colorClass="emerald" />
                  </div>
                )}
                {countdown && <div className="font-display text-[9px] text-muted-foreground/40 text-center tracking-widest">{countdown}</div>}
                {isReleased && existingPrediction && <div className="font-display text-[9px] text-muted-foreground/40 text-center tracking-widest"><Lock className="inline h-2.5 w-2.5 mr-1" />Locked on release · awaiting scoring</div>}
              </div>
            )}
          </div>

          {/* RIGHT — Ladder */}
          {ladderGames.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-display text-[9px] text-muted-foreground/50 tracking-widest uppercase">Ladder</span>
                <GuideLink section="ladder-scoring" label="How ladder scoring works" />
              </div>
              <div className="flex flex-col gap-1.5">
                {ladder.slice(0, 9).map((gId, index) => {
                  const isOverflow = index === 8
                  if (gId === null) {
                    return (
                      <EmptyLadderSlot key={`empty-${index}`} rank={index + 1} isOverflow={isOverflow} onDragEnter={() => handleDragEnter(index)} onDragEnd={handleDragEnd} />
                    )
                  }
                  const game = ladderGames.find(g => g.id === gId)
                  if (!game) return null
                  const gameReleased = game.is_released || (!!game.release_date && new Date(game.release_date) <= new Date())
                  const isLockedPos = lockedLadderGameIds.includes(gId) || gameReleased
                  const isExcluded = gameReleased && !predictedSet.has(gId)
                  const isCurrentGame = gId === gameId
                  return (
                    <LadderTile key={gId} game={game} rank={index + 1} isLocked={isLockedPos} isExcluded={isExcluded} isOverflow={isOverflow} isCurrentGame={isCurrentGame} isAoMarked={(isCurrentGame && aoMarked) || new Set(aoMarkedGameIds).has(gId)} totalGames={isFullyLocked ? ladder.filter(id => id !== null).length : 9} onDragStart={() => handleDragStart(index)} onDragEnter={() => handleDragEnter(index)} onDragEnd={handleDragEnd} />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScoredPredictionCard({ result, gameName, existingPrediction, snapshotPlayerCount, snapshotReviewScore, aoMarked }: { result: "perfect" | "partial" | "failed"; gameName: string; existingPrediction: ExistingPrediction; snapshotPlayerCount?: number | null; snapshotReviewScore?: number | null; aoMarked?: boolean }) {
  const totalMana = existingPrediction.final_points ?? 0
  const isPerfect = result === "perfect", isPartial = result === "partial"
  return (
    <Card className={`border ${isPerfect ? "border-emerald-500/40" : isPartial ? "border-yellow-500/40" : "border-border"}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isPerfect ? "bg-emerald-500/15" : isPartial ? "bg-yellow-500/15" : "bg-muted"}`}>
            {isPerfect ? <Trophy className="h-5 w-5 text-emerald-400" /> : isPartial ? <CheckCircle2 className="h-5 w-5 text-yellow-400" /> : <XCircle className="h-5 w-5 text-muted-foreground" />}
          </div>
          <div>
            <CardTitle className="text-foreground text-base">{gameName}</CardTitle>
            <CardDescription className={isPerfect ? "text-emerald-400" : isPartial ? "text-yellow-400" : "text-muted-foreground"}>
              {isPerfect ? "Perfect Prognos!" : isPartial ? "Partial Prognos" : "Missed"} · <span className="text-cyan-300 font-bold">+{totalMana} mana</span>
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className={`p-2 rounded-lg border ${existingPrediction.players_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
            <div className="text-xs text-muted-foreground mb-1">Peak Players</div>
            <div className="font-mono font-bold text-foreground">{(snapshotPlayerCount ?? existingPrediction.actual_player_count)?.toLocaleString() ?? "—"}</div>
            <div className="text-xs text-muted-foreground">Predicted: {existingPrediction.players_window_low?.toLocaleString()}–{existingPrediction.players_window_high?.toLocaleString()}</div>
          </div>
          <div className={`p-2 rounded-lg border ${existingPrediction.reviews_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
            <div className="text-xs text-muted-foreground mb-1">Review Score</div>
            <div className="font-mono font-bold text-foreground">{(snapshotReviewScore ?? existingPrediction.actual_review_score)?.toFixed(1) ?? "—"}%</div>
            <div className="text-xs text-muted-foreground">Predicted: {existingPrediction.reviews_window_low}%–{existingPrediction.reviews_window_high}%</div>
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {(existingPrediction.mana_players ?? 0) > 0 && <div className="flex justify-between"><span>Players correct</span><span className="text-cyan-300">+{existingPrediction.mana_players}</span></div>}
          {(existingPrediction.mana_reviews ?? 0) > 0 && <div className="flex justify-between"><span>Reviews correct</span><span className="text-cyan-300">+{existingPrediction.mana_reviews}</span></div>}
          {(existingPrediction.mana_both_bonus ?? 0) > 0 && <div className="flex justify-between"><span>Both correct bonus</span><span className="text-cyan-300">+{existingPrediction.mana_both_bonus}</span></div>}
          {(existingPrediction.mana_early_lock ?? 0) > 0 && <div className="flex justify-between"><span>Early lock bonus</span><span className="text-amber-400">+{existingPrediction.mana_early_lock}</span></div>}
          {(existingPrediction.mana_boosters ?? 0) > 0 && <div className="flex justify-between"><span>Booster bonus</span><span className="text-cyan-300">+{existingPrediction.mana_boosters}</span></div>}
          {(existingPrediction.mana_equipment ?? 0) > 0 && <div className="flex justify-between"><span>Equipment bonus</span><span className="text-cyan-300">+{existingPrediction.mana_equipment}</span></div>}
          {(existingPrediction.mana_first_prediction ?? 0) > 0 && <div className="flex justify-between"><span>First prediction bonus</span><span className="text-cyan-300">+{existingPrediction.mana_first_prediction}</span></div>}
          <div className="flex justify-between border-t border-border pt-1 font-medium text-foreground">
            <div className="flex items-center gap-1"><ManaIcon size={12} /><span>Mana</span></div>
            <span className="text-cyan-300 font-bold">+{totalMana}</span>
          </div>
          <div className="flex justify-between font-medium text-foreground">
            <div className="flex items-center gap-1"><Trophy className="h-3 w-3 text-amber-500 shrink-0" /><span>Season score</span></div>
            <span className="text-amber-400 font-bold">+{totalMana} pts</span>
          </div>
          {(existingPrediction.drops_awarded ?? 0) > 0 && <div className="flex justify-between text-amber-400 font-medium"><span>Loot drops</span><span>+{existingPrediction.drops_awarded} item{(existingPrediction.drops_awarded ?? 0) !== 1 ? "s" : ""}</span></div>}
          {aoMarked && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-border">
              <div className="w-5 h-5 rounded-full bg-black/80 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_6px_rgba(251,191,36,0.5)]">
                <span className="text-[10px] text-violet-400 leading-none">★</span>
              </div>
              <span className="font-display text-[10px] text-amber-600">Auspicious Omens marked</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
