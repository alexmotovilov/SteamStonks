# Task: Equipment selection during season join onboarding

## Overview
When a player joins a season, they must select one piece of equipment before their
season entry is created. Equipment is permanent for the duration of the season.
The entry fee is only deducted and the season_entry only created AFTER the player
has selected equipment and confirmed.

The flow must be fully atomic — if the player closes the modal without selecting,
nothing happens. No tokens deducted, no entry created.

---

## Current join flow (in `components/join-season-button.tsx`)

Read this file first. Currently:
1. Player clicks "Join Season"
2. Confirmation dialog appears
3. Player confirms → tokens deducted → season_entry created → starter kit awarded

## New flow
1. Player clicks "Join Season"
2. **Equipment selection modal appears** (replaces or precedes confirmation dialog)
3. Player browses three equipment cards and selects one
4. Player clicks "Confirm Selection & Join"
5. Only now: tokens deducted → season_entry created with equipment_id → starter kit awarded
6. If player closes modal at any point before step 4: nothing happens

---

## Equipment data

### Items (already seeded in DB, fetch from `items` table)

```ts
const EQUIPMENT_SLUGS = ["seers_spectacles", "arcanum_esoterica", "clockwork_familiar"]
```

Query on modal open:
```ts
const { data: equipment } = await supabase
  .from("items")
  .select("id, slug, name, description, effects")
  .in("slug", EQUIPMENT_SLUGS)
```

### Artwork paths (already in public folder)
```
/equipment/seers-spectacles.png
/equipment/arcanum-esoterica.png
/equipment/clockwork-familiar.png
```

Map slug → image:
```ts
const EQUIPMENT_IMAGES: Record<string, string> = {
  seers_spectacles:   "/equipment/seers-spectacles.png",
  arcanum_esoterica:  "/equipment/arcanum-esoterica.png",
  clockwork_familiar: "/equipment/clockwork-familiar.png",
}
```

### Tier descriptions (hardcoded — these are fixed by design)
```ts
const EQUIPMENT_TIERS: Record<string, { t0: string; t3: string; t6: string }> = {
  seers_spectacles: {
    t0: "Players window +5%",
    t3: "Players window +10%",
    t6: "Players window +10% · +25 mana if players correct",
  },
  arcanum_esoterica: {
    t0: "+15 mana if both correct",
    t3: "+25 mana if both correct",
    t6: "+50 mana if both correct",
  },
  clockwork_familiar: {
    t0: "+1 loot drop if players correct",
    t3: "+1 booster slot",
    t6: "+2 loot drops total reward",
  },
}
```

Tiers advance every 3 Perfect or Partial predictions (0–2 = tier 0, 3–5 = tier 1, 6+ = tier 2).
Display as three rows in each card: Tier I / Tier II / Tier III.

---

## Modal design

Full-screen overlay, centered content, dark backdrop:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Choose Your Equipment                                     │  ← font-display, large
│   Select one piece of equipment for Season I.              │  ← muted subtext
│   Your choice is permanent for this season.                │  ← amber warning text
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  [artwork]  │  │  [artwork]  │  │  [artwork]  │        │
│  │             │  │             │  │             │        │
│  │ Seer's      │  │ Arcanum     │  │ Clockwork   │        │
│  │ Spectacles  │  │ Esoterica   │  │ Familiar    │        │
│  │             │  │             │  │             │        │
│  │ Tier I      │  │ Tier I      │  │ Tier I      │        │
│  │ +5% window  │  │ +15 both    │  │ +1 drop     │        │
│  │             │  │             │  │             │        │
│  │ Tier II     │  │ Tier II     │  │ Tier II     │        │
│  │ +10% window │  │ +25 both    │  │ +1 slot     │        │
│  │             │  │             │  │             │        │
│  │ Tier III    │  │ Tier III    │  │ Tier III    │        │
│  │ +10%+bonus  │  │ +50 both    │  │ +2 drops    │        │
│  │             │  │             │  │             │        │
│  │  [Select]   │  │  [Select]   │  │  [Select]   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                             │
│  ← Cancel              Confirm Selection & Join →          │
│  (no tokens spent)     (only active when one selected)     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Equipment card styling
- Unselected: `border border-border bg-[rgba(15,12,25,0.9)] rounded-xl`
- Hovered: `border-purple-500/30 hover:border-purple-500/50`
- Selected: `border-amber-500 shadow-[0_0_0_1px_rgba(217,119,6,0.3)] bg-amber-950/20`
- Artwork image: full width, square aspect ratio, `rounded-t-xl`
- Equipment name: `font-display text-sm text-foreground` below image
- Tier rows: three rows, each with a muted label and effect text

### Tier row styling
```tsx
function TierRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1 border-t border-border/50">
      <span className="font-display text-[9px] text-muted-foreground/50 tracking-widest uppercase w-12 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-muted-foreground leading-tight">{text}</span>
    </div>
  )
}
```

### Select button within card
When card is not selected:
```tsx
<button className="w-full py-1.5 mt-2 rounded-lg font-display text-[10px] tracking-wide border border-purple-500/30 text-purple-400 hover:bg-purple-950/30 transition-colors">
  Select
</button>
```

When card is selected:
```tsx
<div className="w-full py-1.5 mt-2 rounded-lg font-display text-[10px] tracking-wide text-center bg-amber-500/15 text-amber-400 border border-amber-500/30">
  ✓ Selected
</div>
```

---

## Component structure

### Modify `components/join-season-button.tsx`

Replace the existing `AlertDialog` with a two-phase flow:

```tsx
"use client"

export function JoinSeasonButton({ seasonId, entryFee, currentBalance, seasonName }: JoinSeasonButtonProps) {
  const [phase, setPhase] = useState<"idle" | "selecting" | "joining">("idle")
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null)
  const [selectedEquipmentSlug, setSelectedEquipmentSlug] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<EquipmentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)

  async function openModal() {
    // Fetch equipment items
    const supabase = createClient()
    const { data } = await supabase
      .from("items")
      .select("id, slug, name, description, effects")
      .in("slug", ["seers_spectacles", "arcanum_esoterica", "clockwork_familiar"])
    setEquipment(data ?? [])
    setPhase("selecting")
  }

  async function handleConfirmJoin() {
    if (!selectedEquipmentId) return
    setJoining(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("You must be logged in")

      // 1. Deduct tokens
      const { error: tokenError } = await supabase
        .from("profiles")
        .update({ token_balance: currentBalance - entryFee })
        .eq("id", user.id)
      if (tokenError) throw tokenError

      // 2. Create season entry WITH equipment_id
      const { error: entryError } = await supabase
        .from("season_entries")
        .insert({
          season_id: seasonId,
          user_id: user.id,
          tokens_paid: entryFee,
          equipment_id: selectedEquipmentId,  // ← set on creation
          prediction_mana_earned: 0,
          mana_balance: 0,
          equipment_tier_score: 0,
          stipend_week_number: 0,
          starter_kit_claimed: false,
          first_prediction_bonus_claimed: false,
        })

      if (entryError) {
        // Rollback token deduction
        await supabase.from("profiles").update({ token_balance: currentBalance }).eq("id", user.id)
        throw entryError
      }

      // 3. Award starter kit
      await fetch("/api/seasons/join/starter-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId }),
      })

      setPhase("idle")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join season")
    } finally {
      setJoining(false)
    }
  }

  function handleCancel() {
    setPhase("idle")
    setSelectedEquipmentId(null)
    setSelectedEquipmentSlug(null)
    setError(null)
  }

  // ... render
}
```

### Equipment selection modal render

```tsx
{phase === "selecting" && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
    style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
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

      {/* Equipment cards grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {equipment.map(item => (
          <EquipmentCard
            key={item.id}
            item={item}
            isSelected={selectedEquipmentId === item.id}
            onSelect={() => {
              setSelectedEquipmentId(item.id)
              setSelectedEquipmentSlug(item.slug)
            }}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-destructive text-center mb-4">{error}</p>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button onClick={handleCancel}
          className="font-display text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2">
          ← Cancel
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Entry fee: <span className="text-amber-400">{entryFee} tokens</span>
          </span>
          <button
            onClick={handleConfirmJoin}
            disabled={!selectedEquipmentId || joining}
            className={`font-display text-sm px-5 py-2 rounded-xl border transition-colors ${
              selectedEquipmentId
                ? "bg-emerald-500/12 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20"
                : "bg-white/5 text-muted-foreground border-white/10 cursor-not-allowed"
            }`}
          >
            {joining ? "Joining..." : "Confirm Selection & Join →"}
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

### `EquipmentCard` component (in same file or separate)

```tsx
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
      <div className="aspect-square w-full overflow-hidden">
        <img
          src={image}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="font-display text-sm text-foreground mb-3">{item.name}</div>

        {tiers && (
          <div className="space-y-0">
            <TierRow label="Tier I" text={tiers.t0} />
            <TierRow label="Tier II" text={tiers.t3} />
            <TierRow label="Tier III" text={tiers.t6} />
          </div>
        )}

        {/* Select button */}
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
```

---

## Additional: show selected equipment on profile/dashboard

After joining, the player's equipment should be visible somewhere. The season
entry already has `equipment_id`. Add a small equipment indicator to the
season banner on /games showing which equipment the player has equipped:

```tsx
// In games page season banner:
{entry?.equipment && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground">
    <img
      src={EQUIPMENT_IMAGES[entry.equipment.slug]}
      alt={entry.equipment.name}
      className="w-5 h-5 rounded object-cover"
    />
    <span className="font-display text-[10px]">{entry.equipment.name}</span>
    <span className="text-muted-foreground/50">·</span>
    <span>Tier {Math.floor(entry.equipment_tier_score / 3) + 1}</span>
  </div>
)}
```

---

## Verification
1. Player with sufficient tokens clicks "Join Season" → equipment modal opens ✓
2. No tokens deducted, no entry created until confirmation ✓
3. Player clicks Cancel → modal closes, balance unchanged, no entry in DB ✓
4. Player selects equipment → card gets amber border ✓
5. "Confirm Selection & Join" button only active after selection ✓
6. Player confirms → tokens deducted, entry created with equipment_id set ✓
7. `season_entries.equipment_id` matches selected item in Supabase ✓
8. Starter kit awarded after join ✓
9. Equipment artwork displays correctly for all three pieces ✓
10. Player with insufficient tokens sees disabled button (existing behaviour) ✓
11. Run `npx tsc --noEmit` — no errors ✓
