# Task: Replace "Max Reward" bar with Active Effects panel on prediction card

## What to remove
The current mana preview bar in the center column of the prediction card:
```tsx
<div className="flex items-center justify-between px-3 py-2 rounded-lg bg-cyan-950/25 border border-cyan-500/15">
  <div className="flex items-center gap-2"><ManaIcon size={14} /><span>Max reward</span></div>
  <span className="font-display text-xs text-cyan-300">+{previewMana} mana</span>
</div>
```
Replace this entirely with the Active Effects panel described below.

---

## Active Effects Panel — design spec

### Layout
A compact panel with a muted "Active Effects" label at the top, then effects grouped
by their source item/rite. Each source has its name in small muted Cinzel above its
bullet points.

```
┌─────────────────────────────────────┐
│  ACTIVE EFFECTS                     │  ← 9px Cinzel, muted, uppercase
│                                     │
│  · +50 mana first prediction bonus  │  ← no source label, cyan
│  ─────────────────────────────────  │
│  Seer's Spectacles                  │  ← source name, 9px muted Cinzel
│  · Players window +5%               │  ← green dot + green text
│                                     │
│  Blood Bargain                      │
│  · Reviews window +3                │  ← green (buff)
│  · −15 mana if reviews correct      │  ← red (penalty)
│                                     │
│  Eldritch Wager                     │
│  · +25 mana per correct metric      │  ← cyan
│  · +25 mana if both correct         │  ← cyan
│                                     │
│  Auspicious Omens                   │
│  · ★ Marked for Top 8              │  ← gold
└─────────────────────────────────────┘
```

### Color coding (dots + text)
| Effect type | Dot color | Text color | Tailwind |
|-------------|-----------|------------|---------|
| Prediction range buff (wider window) | green | green | `text-emerald-400` |
| Prediction range debuff (narrower window) | red | red | `text-red-400` |
| Mana reward bonus | cyan | cyan | `text-cyan-300` |
| Mana reward penalty | red | red | `text-red-400` |
| Extra booster slot | amber | amber | `text-amber-400` |
| Auspicious Omens mark | gold | gold | `text-amber-600` / `#d97706` |

Dot: `w-1.5 h-1.5 rounded-full shrink-0 mt-1`

### Source grouping rules
- Each source (booster, equipment, rite) gets ONE group heading in 9px muted Cinzel
- All effects from that source are listed as bullets under the heading
- Sources are ordered: equipment first, then boosters alphabetically, then rites
- First prediction bonus has NO source heading — just the bullet, placed first before a divider
- If there are zero active effects beyond the first prediction bonus, show a muted italic
  "No boosters or rites active" line after the divider
- Panel background: `bg-[rgba(10,10,20,0.6)] border border-white/8 rounded-xl p-3`

---

## Effect definitions per source

### Equipment effects
Read from `resolveEquipmentEffects(equipmentSlug, equipmentTierScore)` return value.
Map each non-zero field to a bullet:

| Field | Effect text | Color |
|-------|-------------|-------|
| `players_window_pct > 0` | `Players window +{n}%` | green |
| `players_window_pct < 0` | `Players window −{n}%` | red |
| `reviews_window_flat > 0` | `Reviews window +{n}` | green |
| `reviews_window_flat < 0` | `Reviews window −{n}` | red |
| `mana_players_bonus > 0` | `+{n} mana if players correct` | cyan |
| `mana_reviews_bonus > 0` | `+{n} mana if reviews correct` | cyan |
| `mana_both_bonus > 0` | `+{n} mana if both correct` | cyan |
| `mana_total_reward > 0` | `+{n} mana total reward` | cyan |
| `extra_booster_slots > 0` | `+{n} booster slot` | amber |

Source name: use the equipment display name (look up from slug)
```ts
const EQUIPMENT_NAMES: Record<string, string> = {
  seers_spectacles: "Seer's Spectacles",
  arcanum_esoterica: "Arcanum Esoterica",
  clockwork_familiar: "Clockwork Familiar",
}
```

### Booster effects
Read from `resolveBoosterEffects(appliedBoosters)` — but this returns aggregated totals,
not per-booster breakdown. For source grouping, compute per-booster effects individually.
Add a helper `resolveBoosterEffectsSingle(slug)` or map each slug to its known effects:

```ts
const BOOSTER_EFFECTS: Record<string, EffectLine[]> = {
  scrying_orb_polish:    [{ text: "Players window +10%", color: "green" }],
  crystal_focus:         [{ text: "Reviews window +2", color: "green" }],
  evocation_distillate:  [{ text: "+25 mana total reward", color: "cyan" }],
  thaumaturgic_concentrate: [{ text: "+50 mana total reward", color: "cyan" }],
  blood_bargain:         [{ text: "Reviews window +3", color: "green" }, { text: "−15 mana if reviews correct", color: "red" }],
  black_gem_accumulator: [{ text: "Players window −5%", color: "red" }, { text: "+75 mana if players correct", color: "cyan" }],
  infernal_patrons_pact: [{ text: "Reviews window −1", color: "red" }, { text: "+1 loot drop total reward", color: "cyan" }],
  tincture_of_divination:[{ text: "Players window +10%", color: "green" }, { text: "Reviews window +5", color: "green" }],
}

const BOOSTER_NAMES: Record<string, string> = {
  scrying_orb_polish:    "Scrying Orb Polish",
  crystal_focus:         "Crystal Focus",
  evocation_distillate:  "Evocation Distillate",
  thaumaturgic_concentrate: "Thaumaturgic Concentrate",
  blood_bargain:         "Blood Bargain",
  black_gem_accumulator: "Black Gem Accumulator",
  infernal_patrons_pact: "Infernal Patron's Pact",
  tincture_of_divination:"Tincture of Divination",
}
```

### Rite effects (only show if performed/active)
```ts
const RITE_EFFECTS: Record<string, EffectLine[]> = {
  eldritch_wager:       [{ text: "+25 mana per correct metric", color: "cyan" }, { text: "+25 mana if both correct", color: "cyan" }],
  sigil_of_multiplicity:[{ text: "+1 booster slot", color: "amber" }],
  auspicious_omens:     [{ text: "★ Marked for Top 8", color: "gold" }],
  // ritual_of_augury and temporal_translocation have no persistent prediction effects
}
```

### First prediction bonus
Show if `!existingPrediction?.first_prediction_bonus_claimed` AND no prediction scored yet:
- Text: `+50 mana first prediction bonus`
- Color: cyan
- No source label

---

## TypeScript interface

```ts
interface EffectLine {
  text: string
  color: "green" | "red" | "cyan" | "amber" | "gold"
}

interface EffectGroup {
  source: string | null  // null = no source label (first prediction bonus)
  effects: EffectLine[]
}
```

---

## Component structure

Create an `ActiveEffectsPanel` component within `prediction-form.tsx`:

```tsx
function ActiveEffectsPanel({
  equipmentSlug,
  equipmentTierScore,
  appliedBoosters,
  performedRites,
  aoMarked,
  firstPredictionBonusEligible,
}: ActiveEffectsPanelProps) {
  const groups: EffectGroup[] = []

  // 1. First prediction bonus (no source)
  if (firstPredictionBonusEligible) {
    groups.push({ source: null, effects: [{ text: "+50 mana first prediction bonus", color: "cyan" }] })
  }

  // 2. Equipment
  if (equipmentSlug) {
    const eq = resolveEquipmentEffects(equipmentSlug, equipmentTierScore)
    const effects: EffectLine[] = []
    // ... map eq fields to EffectLine[]
    if (effects.length > 0) groups.push({ source: EQUIPMENT_NAMES[equipmentSlug], effects })
  }

  // 3. Applied boosters (in order)
  for (const slug of appliedBoosters) {
    const effects = BOOSTER_EFFECTS[slug]
    if (effects) groups.push({ source: BOOSTER_NAMES[slug], effects })
  }

  // 4. Performed rites
  for (const slug of performedRites) {
    const effects = RITE_EFFECTS[slug]
    if (effects) groups.push({ source: RITE_NAMES[slug], effects })
  }

  // ... render
}
```

---

## Dot and text color helpers

```tsx
const dotColor = {
  green: "bg-emerald-400",
  red:   "bg-red-400",
  cyan:  "bg-cyan-400",
  amber: "bg-amber-400",
  gold:  "bg-amber-600",
}

const textColor = {
  green: "text-emerald-400",
  red:   "text-red-400",
  cyan:  "text-cyan-300",
  amber: "text-amber-400",
  gold:  "text-amber-600",
}
```

---

## Verification
1. No boosters/rites, first prediction eligible → panel shows one cyan bullet, "No boosters or rites active" below divider
2. Blood Bargain applied → shows under one "Blood Bargain" heading with green + red bullets
3. Eldritch Wager performed → shows under "Eldritch Wager" with two cyan bullets
4. Auspicious Omens performed → shows "★ Marked for Top 8" in gold under "Auspicious Omens"
5. Clockwork Familiar equipment with tier 3+ → shows "+1 booster slot" in amber
6. First prediction bonus NOT shown if `first_prediction_bonus_claimed` is true on season_entries
7. Max reward bar is completely removed — not just hidden
8. Run `npx tsc --noEmit` — no errors
