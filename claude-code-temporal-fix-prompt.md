# Task: Fix Temporal Translocation — early lock not being removed on use

## Bug
When a player uses the Temporal Translocation rite on a prediction card, the rite
activates (mana is deducted, rite is marked as performed) but the early lock is NOT
removed from the prediction. The sliders remain frozen and `early_locked_at` remains
set on the prediction row in the database.

## Expected behaviour
When Temporal Translocation is confirmed:
1. `predictions.early_locked_at` is set to NULL (removes the early lock)
2. The sliders become editable again
3. The early lock amber overlay disappears from the sliders
4. The "Early Locked" badge in the card header disappears
5. The early lock mana bonus that was previously earned is forfeited (set to 0)
6. Mana is deducted (100 mana) — already handled by /api/rites/perform

## Files to fix

### 1. `app/api/rites/perform/route.ts`
After the mana deduction succeeds, add a special case for temporal_translocation
that nullifies `early_locked_at` on the prediction:

```ts
// After mana deduction, before logging to rite_history:
if (rite_slug === "temporal_translocation") {
  const { error: unlockError } = await supabaseAdmin
    .from("predictions")
    .update({
      early_locked_at: null,
      // Also clear the early lock mana bonus since it's being forfeited
      mana_early_lock: 0,
    })
    .eq("id", prediction_id)
    .eq("user_id", user.id)

  if (unlockError) {
    console.error("[Temporal Translocation] Failed to remove early lock:", unlockError)
    return NextResponse.json({ error: "Failed to remove early lock" }, { status: 500 })
  }
}
```

### 2. `components/prediction-form.tsx`
In the `performRite` function, after a successful API response for
`temporal_translocation`, the local state must also be updated so the UI
reflects the change immediately without requiring a full page reload:

The `isEarlyLocked` and `isSlidersLocked` values are derived from
`existingPrediction?.early_locked_at`. Since `existingPrediction` is a prop
(server-fetched), local state needs to override it after the rite is performed.

Add a local state override:
```ts
const [temporalUnlocked, setTemporalUnlocked] = useState(false)

// Override early lock state if temporal translocation was used this session
const isEarlyLocked = !temporalUnlocked &&
  !!existingPrediction?.early_locked_at &&
  !existingPrediction?.is_locked
```

Then in `performRite`, after successful API call for temporal_translocation:
```ts
if (slug === "temporal_translocation") {
  setTemporalUnlocked(true)
}
setPerformedRites(prev => new Set([...prev, slug]))
router.refresh() // refresh to sync server state
```

### 3. Disable temporal translocation correctly
Temporal Translocation should only be available when:
- The prediction has been early locked (`isEarlyLocked === true`)
- It has not already been used this session (`!performedRites.has("temporal_translocation")`)

After use, it should grey out (non-reusable per the earlier fix).

The existing disabled condition in the RiteCircle render should be:
```tsx
disabled={
  isFullyLocked ||
  (rite.slug === "temporal_translocation" && !isEarlyLocked) ||
  (rite.slug === "ritual_of_augury" && auguryRunning)
}
```

This already exists — verify it is using the updated `isEarlyLocked` that accounts
for `temporalUnlocked` local state.

## Verification
1. Early lock a prediction
2. Confirm the "Early Locked" badge and amber overlay appear on sliders
3. Use Temporal Translocation (costs 100 mana)
4. Verify: sliders become editable, amber overlay gone, badge gone
5. Verify: mana balance decreased by 100
6. Verify: in Supabase, `predictions.early_locked_at` is NULL for that row
7. Verify: Temporal Translocation circle is greyed out after use
8. Verify: Temporal Translocation is disabled (greyed, unclickable) on predictions
   that are NOT early locked
9. Run `npx tsc --noEmit` — no errors
