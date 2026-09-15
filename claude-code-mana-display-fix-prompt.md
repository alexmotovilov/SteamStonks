# Task: Fix mana earned display on scored game tiles

## Bug
Scored prediction tiles on /games are showing incorrect (lower than actual) mana earned.
They appear to be summing only the base prediction components rather than showing the
true total. For example a prediction with:
- +50 mana players correct
- +50 mana reviews correct  
- +50 mana both correct bonus
- +50 mana first prediction bonus
- +18 mana early lock bonus

...shows only 150 mana instead of 218 mana.

## Root cause
The tile is almost certainly computing mana by summing individual columns:
```ts
// WRONG — misses first_prediction, early_lock, boosters, equipment bonuses
const manaEarned = (prediction.mana_players ?? 0)
  + (prediction.mana_reviews ?? 0)
  + (prediction.mana_both_bonus ?? 0)
```

Or it may be using `mana_players + mana_reviews` only and missing the bonus columns entirely.

## Fix
Always use `final_points` — it is the single authoritative total written by the
score-calculator and includes ALL mana components:
- mana_players
- mana_reviews  
- mana_both_bonus
- mana_early_lock
- mana_boosters
- mana_equipment
- mana_first_prediction

```ts
// CORRECT
const manaEarned = prediction.final_points ?? 0
```

## Files to check and fix

### 1. The prediction query in `app/(authenticated)/games/page.tsx`
Make sure `final_points` is included in the select:
```ts
.select(`
  game_id,
  players_midpoint, reviews_midpoint,
  players_window_low, players_window_high,
  reviews_window_low, reviews_window_high,
  early_locked_at, is_locked,
  result, players_correct, reviews_correct,
  final_points,        ← must be included
  scored_at,
  actual_player_count, actual_review_score
`)
```

### 2. The PredictionBand component (likely `components/games-tabs.tsx`)
Find wherever mana earned is displayed on scored tiles and replace any summing
logic with `prediction.final_points`:

```tsx
// Find this pattern (or similar):
const manaEarned = (pred.mana_players ?? 0) + (pred.mana_reviews ?? 0) + ...

// Replace with:
const manaEarned = pred.final_points ?? 0
```

The mana display in the tile should show:
```tsx
<div className="pred-mana">
  <img src="/icons/mana-icon.png" alt="mana" width={11} height={11} />
  <span className="font-display text-[10px] text-cyan-300">+{manaEarned.toLocaleString()}</span>
</div>
```

## Also check — missed predictions
A Failed result (neither metric correct) should still show mana earned if any bonuses
applied (e.g. early lock bonus, booster guaranteed rewards, equipment guaranteed rewards).
`final_points` handles this correctly since the score-calculator writes the full total
including guaranteed bonuses even on a failed prediction.

Do NOT special-case Failed predictions to show 0 — always use `final_points`.

## Verification
1. Find a scored Perfect prediction in the DB and note its `final_points` value
2. Check that the game tile shows exactly that number in cyan
3. Find a scored prediction with `mana_first_prediction > 0` — tile should include it
4. Find a scored prediction with `mana_early_lock > 0` — tile should include it
5. Run `npx tsc --noEmit` — no errors
