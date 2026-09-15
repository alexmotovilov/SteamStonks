# Task: Persist Auspicious Omens star on ladder tiles after prediction lock and scoring

## Bug
The Auspicious Omens star (★) that appears on a game's ladder tile disappears once
the prediction is locked (game launched) or scored. It should remain visible
permanently on any game that has had Auspicious Omens applied to it.

## Root cause investigation

Read `components/prediction-form.tsx` carefully, focusing on:

1. How `aoMarked` state is initialized:
```ts
const [aoMarked, setAoMarked] = useState(existingPrediction?.ao_marked ?? false)
```

2. How `isAoMarked` is passed to `LadderTile`:
```tsx
isAoMarked={isCurrentGame && aoMarked}
```

The likely causes:

**Cause A** — `ao_marked` column is not being read from the DB:
The prediction query in `app/(authenticated)/games/[id]/page.tsx` may not include
`ao_marked` in the select statement. If it's missing, `existingPrediction?.ao_marked`
is always undefined → `aoMarked` initializes to false.

**Cause B** — The scored prediction card renders instead of the normal card:
When `existingPrediction?.scored_at && existingPrediction.result` is truthy, the
component returns `<ScoredPredictionCard>` early, which does NOT render the ladder
at all — so the AO star is never shown regardless.

**Cause C** — `ao_marked` is not being written to the DB when AO is performed:
The `/api/rites/perform` route updates `applied_rites` but may not set `ao_marked: true`
on the prediction row.

---

## Fixes required

### Fix 1 — Ensure `ao_marked` is in the prediction query
In `app/(authenticated)/games/[id]/page.tsx`, find the prediction select and add
`ao_marked` if missing:

```ts
.select(`
  id, user_id, game_id, season_id,
  players_midpoint, reviews_midpoint,
  players_window_low, players_window_high,
  reviews_window_low, reviews_window_high,
  early_locked_at, is_locked,
  result, players_correct, reviews_correct,
  actual_player_count, actual_review_score,
  final_points, scored_at,
  applied_boosters, applied_rites,
  ao_marked,           ← ensure this is present
  mana_players, mana_reviews, mana_both_bonus,
  mana_early_lock, mana_boosters, mana_equipment,
  mana_first_prediction, drops_awarded
`)
```

### Fix 2 — Ensure `ao_marked` is written when AO rite is performed
In `app/api/rites/perform/route.ts`, add explicit `ao_marked: true` update for
auspicious_omens alongside the `applied_rites` update:

```ts
// Update prediction.applied_rites and ao_marked
const currentRites = prediction.applied_rites ?? {}
const updatePayload: Record<string, unknown> = {
  applied_rites: { ...currentRites, [rite_slug]: new Date().toISOString() }
}

if (rite_slug === "auspicious_omens") {
  updatePayload.ao_marked = true
}

await supabaseAdmin
  .from("predictions")
  .update(updatePayload)
  .eq("id", prediction_id)
```

### Fix 3 — Show AO star on scored prediction card
The `ScoredPredictionCard` component is returned early when a prediction is scored,
bypassing the ladder entirely. The AO star needs to appear somewhere on the scored card.

**Option A (preferred)** — Pass `aoMarked` and `ladderGames` + `ladder` state to
`ScoredPredictionCard` and render a mini read-only ladder that still shows the AO star:

Add `aoMarked` prop to `ScoredPredictionCard` and show a simple indicator:
```tsx
{aoMarked && (
  <div className="flex items-center gap-1.5 text-xs">
    <div className="w-5 h-5 rounded-full bg-black/80 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_6px_rgba(251,191,36,0.5)]">
      <span className="text-[10px] text-violet-400 leading-none">★</span>
    </div>
    <span className="font-display text-[10px] text-amber-600">Auspicious Omens marked</span>
  </div>
)}
```

**Option B** — Don't return `<ScoredPredictionCard>` early. Instead render the full
three-column layout with the scored results shown inline in the center column,
keeping the ladder visible in the right column with the AO star intact.
This is more work but preserves the full ladder view for scored predictions.

Implement Option A for now — it's simpler and shows the relevant info.

### Fix 4 — `isAoMarked` on non-current-game ladder tiles
Currently `isAoMarked` is only true for the current game:
```tsx
isAoMarked={isCurrentGame && aoMarked}
```

This means AO marks on OTHER games in the ladder are never shown. To show AO marks
across all ladder tiles, we need to know which games have been AO-marked by this player.

Pass `aoMarkedGameIds` as a prop from the page — a set of game IDs that have
`ao_marked = true` in the player's predictions for this season:

In `app/(authenticated)/games/[id]/page.tsx`:
```ts
// Fetch all AO-marked predictions for this player this season
const { data: aoMarkedPreds } = user && seasonId
  ? await supabase
      .from("predictions")
      .select("game_id")
      .eq("user_id", user.id)
      .eq("season_id", seasonId)
      .eq("ao_marked", true)
  : { data: [] }

const aoMarkedGameIds = new Set((aoMarkedPreds ?? []).map(p => p.game_id))
```

Pass to `PredictionForm` as a new prop:
```tsx
<PredictionFormClient
  ...
  aoMarkedGameIds={Array.from(aoMarkedGameIds)}
/>
```

Add to `PredictionFormProps`:
```ts
aoMarkedGameIds?: string[]
```

Update `isAoMarked` in the ladder render:
```tsx
const aoMarkedSet = new Set(aoMarkedGameIds ?? [])

// In ladder map:
isAoMarked={(isCurrentGame && aoMarked) || aoMarkedSet.has(gId)}
```

---

## Verification
1. Apply Auspicious Omens to a prediction → gold-ring star appears on that game's
   ladder tile ✓
2. Save the prediction → star persists after page reload ✓
3. Game releases and prediction locks → navigate to the game page, star still
   visible on the ladder tile ✓
4. Prediction is scored → `ScoredPredictionCard` shows AO marked indicator ✓
5. Navigate to a DIFFERENT game's prediction card — if another game in the ladder
   has been AO marked, its ladder tile shows the star ✓
6. Check Supabase: `predictions.ao_marked = true` for the marked game ✓
7. Run `npx tsc --noEmit` — no errors
