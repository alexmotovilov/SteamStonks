# Task: Fix equipment effects to match design specification

## Problem
The equipment tier effects currently shown in the equipment selection modal and
used in scoring are incorrect. The correct effects are defined below — update
all affected files to match.

---

## Correct equipment effects (from design spec)

Tier thresholds are based on total Perfect + Partial predictions this season:
- Tier I:   0–2  Perfect/Partial predictions
- Tier II:  3–5  Perfect/Partial predictions
- Tier III: >5   Perfect/Partial predictions

### Seer's Spectacles
| Tier | Effect |
|------|--------|
| Tier I (0–2)  | Players window +3%, Reviews window +1 |
| Tier II (3–5) | Players window +5%, Reviews window +2 |
| Tier III (>5) | Players window +10%, Reviews window +5 |

### Arcanum Esoterica
| Tier | Effect |
|------|--------|
| Tier I (0–2)  | +15 mana if players correct · +15 mana if reviews correct |
| Tier II (3–5) | +25 mana if players correct · +25 mana if reviews correct · +25 mana if both correct |
| Tier III (>5) | +25 mana if players correct · +25 mana if reviews correct · +25 mana if both correct · +50 mana total reward |

### Clockwork Familiar
| Tier | Effect |
|------|--------|
| Tier I (0–2)  | +1 drop if players correct · +1 drop if reviews correct |
| Tier II (3–5) | +1 drop if players correct · +1 drop if reviews correct · +1 booster slot |
| Tier III (>5) | +1 booster slot · +2 drops total reward |

---

## Files to update

### 1. `components/join-season-button.tsx` — EQUIPMENT_TIERS constant

Find and replace the `EQUIPMENT_TIERS` object with correct tier descriptions:

```ts
const EQUIPMENT_TIERS: Record<string, { t0: string; t3: string; t6: string }> = {
  seers_spectacles: {
    t0: "Players window +3% · Reviews window +1",
    t3: "Players window +5% · Reviews window +2",
    t6: "Players window +10% · Reviews window +5",
  },
  arcanum_esoterica: {
    t0: "+15 mana if players correct · +15 mana if reviews correct",
    t3: "+25 mana players · +25 mana reviews · +25 mana if both correct",
    t6: "+25 mana players · +25 mana reviews · +25 both correct · +50 mana total",
  },
  clockwork_familiar: {
    t0: "+1 drop if players correct · +1 drop if reviews correct",
    t3: "+1 drop players · +1 drop reviews · +1 booster slot",
    t6: "+1 booster slot · +2 drops total reward",
  },
}
```

### 2. `lib/scoring.ts` — `resolveEquipmentEffects` function

This function is called during scoring and prediction form rendering.
Find it and update the tier effect values to match the spec exactly.

The function signature should look something like:
```ts
export function resolveEquipmentEffects(
  equipmentSlug: string | null,
  tierScore: number  // total Perfect + Partial count
): EquipmentTierEffect
```

The tier threshold logic:
```ts
const tier = tierScore <= 2 ? 0 : tierScore <= 5 ? 1 : 2
```

Correct return values per equipment and tier:

#### Seer's Spectacles
```ts
seers_spectacles: [
  // Tier 0 (0–2): players +3%, reviews +1
  { players_window_pct: 3, reviews_window_flat: 1, mana_players_bonus: 0, mana_reviews_bonus: 0, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 0, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 0 },
  // Tier 1 (3–5): players +5%, reviews +2
  { players_window_pct: 5, reviews_window_flat: 2, mana_players_bonus: 0, mana_reviews_bonus: 0, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 0, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 0 },
  // Tier 2 (>5): players +10%, reviews +5
  { players_window_pct: 10, reviews_window_flat: 5, mana_players_bonus: 0, mana_reviews_bonus: 0, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 0, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 0 },
]
```

#### Arcanum Esoterica
```ts
arcanum_esoterica: [
  // Tier 0: +15 players, +15 reviews
  { players_window_pct: 0, reviews_window_flat: 0, mana_players_bonus: 15, mana_reviews_bonus: 15, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 0, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 0 },
  // Tier 1: +25 players, +25 reviews, +25 both
  { players_window_pct: 0, reviews_window_flat: 0, mana_players_bonus: 25, mana_reviews_bonus: 25, mana_both_bonus: 25, mana_total_reward: 0, extra_booster_slots: 0, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 0 },
  // Tier 2: +25 players, +25 reviews, +25 both, +50 total
  { players_window_pct: 0, reviews_window_flat: 0, mana_players_bonus: 25, mana_reviews_bonus: 25, mana_both_bonus: 25, mana_total_reward: 50, extra_booster_slots: 0, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 0 },
]
```

#### Clockwork Familiar
```ts
clockwork_familiar: [
  // Tier 0: +1 drop players, +1 drop reviews
  { players_window_pct: 0, reviews_window_flat: 0, mana_players_bonus: 0, mana_reviews_bonus: 0, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 0, drops_players_bonus: 1, drops_reviews_bonus: 1, drops_total_reward: 0 },
  // Tier 1: +1 drop players, +1 drop reviews, +1 booster slot
  { players_window_pct: 0, reviews_window_flat: 0, mana_players_bonus: 0, mana_reviews_bonus: 0, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 1, drops_players_bonus: 1, drops_reviews_bonus: 1, drops_total_reward: 0 },
  // Tier 2: +1 booster slot, +2 drops total
  { players_window_pct: 0, reviews_window_flat: 0, mana_players_bonus: 0, mana_reviews_bonus: 0, mana_both_bonus: 0, mana_total_reward: 0, extra_booster_slots: 1, drops_players_bonus: 0, drops_reviews_bonus: 0, drops_total_reward: 2 },
]
```

### 3. `EquipmentTierEffect` interface in `lib/scoring.ts`

Ensure the interface includes all required fields — add any missing ones:

```ts
export interface EquipmentTierEffect {
  players_window_pct: number       // % to add to players window
  reviews_window_flat: number      // flat points to add to reviews window
  mana_players_bonus: number       // extra mana if players correct
  mana_reviews_bonus: number       // extra mana if reviews correct
  mana_both_bonus: number          // extra mana if both correct
  mana_total_reward: number        // extra mana regardless of result
  extra_booster_slots: number      // additional booster slots
  drops_players_bonus: number      // extra drops if players correct
  drops_reviews_bonus: number      // extra drops if reviews correct
  drops_total_reward: number       // extra drops regardless of result
}
```

### 4. `app/api/cron/score-calculator/route.ts`

The score-calculator applies equipment effects during scoring. Find where
`resolveEquipmentEffects` is called and ensure ALL new fields are used:

```ts
const eq = resolveEquipmentEffects(equipmentSlug, equipmentTierScore)

// Drops calculation — must account for per-metric drops
let totalDrops = prediction.result === "perfect" ? 2
  : prediction.result === "partial" ? 1
  : 0

// Add equipment drops
if (prediction.players_correct) totalDrops += eq.drops_players_bonus
if (prediction.reviews_correct) totalDrops += eq.drops_reviews_bonus
totalDrops += eq.drops_total_reward

// Mana calculation
const equipmentMana = eq.mana_total_reward
  + (prediction.players_correct ? eq.mana_players_bonus : 0)
  + (prediction.reviews_correct ? eq.mana_reviews_bonus : 0)
  + (prediction.players_correct && prediction.reviews_correct ? eq.mana_both_bonus : 0)
```

### 5. `components/prediction-form.tsx` — active effects panel

The `EQUIPMENT_TIERS` or equivalent mapping used in the `ActiveEffectsPanel`
component must also be updated. Find and update the per-tier effect descriptions
displayed in the active effects list on the prediction card.

The effects shown should match what's actually applied by `resolveEquipmentEffects`
at the player's current tier. Use the same tier threshold:
```ts
const tier = equipmentTierScore <= 2 ? 0 : equipmentTierScore <= 5 ? 1 : 2
```

Seer's Spectacles effects to display (examples, adjust for current tier):
- `Players window +3%` (green) and `Reviews window +1` (green) at tier 0
- `Players window +5%` (green) and `Reviews window +2` (green) at tier 1
- `Players window +10%` (green) and `Reviews window +5` (green) at tier 2

Arcanum Esoterica effects to display:
- `+15 mana if players correct` (cyan) and `+15 mana if reviews correct` (cyan) at tier 0
- Add `+25 mana if both correct` (cyan) at tier 1
- Add `+50 mana total reward` (cyan) at tier 2

Clockwork Familiar effects to display:
- `+1 drop if players correct` (cyan) and `+1 drop if reviews correct` (cyan) at tier 0
- Add `+1 booster slot` (amber) at tier 1
- At tier 2: `+1 booster slot` (amber) and `+2 drops total reward` (cyan), remove per-metric drops

---

## Also fix the season name missing from the modal

Looking at the UI screenshot, the modal shows:
"Select one piece of equipment for ."
The season name is blank. Fix the prop passing so `seasonName` is correctly
passed to the `JoinSeasonButton` component and displayed in the modal.

Check `app/(authenticated)/games/page.tsx` or wherever `JoinSeasonButton` is
rendered and ensure `seasonName={activeSeason.name}` is passed.

---

## Verification
1. Equipment modal shows correct tier descriptions for all three items ✓
2. Season name appears in modal subtitle (not blank) ✓
3. `resolveEquipmentEffects("seers_spectacles", 0)` returns `{ players_window_pct: 3, reviews_window_flat: 1, ... }` ✓
4. `resolveEquipmentEffects("seers_spectacles", 4)` returns `{ players_window_pct: 5, reviews_window_flat: 2, ... }` ✓
5. `resolveEquipmentEffects("clockwork_familiar", 0)` returns `{ drops_players_bonus: 1, drops_reviews_bonus: 1, ... }` ✓
6. Score calculator correctly adds per-metric drops for Clockwork Familiar ✓
7. Active effects panel on prediction card shows correct effects for current tier ✓
8. Run `npx tsc --noEmit` — no errors ✓
