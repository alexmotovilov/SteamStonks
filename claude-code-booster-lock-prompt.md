# Task: Lock applied boosters after prediction is saved

## Desired behaviour
Once a prediction has been saved with one or more boosters applied:
1. Those boosters are consumed from inventory (already working)
2. The player CANNOT remove those boosters from the prediction — they are locked in
3. The player CAN still add additional boosters (up to the slot limit) if they have
   inventory and available slots
4. Locked boosters show a visual indicator that they cannot be removed (no click,
   different styling)

The reasoning: boosters are consumed on save, so allowing removal after save would
require returning them to inventory and creates inconsistency. Once committed, they're committed.

---

## Changes required

### 1. `app/api/predictions/boosters/route.ts`
Add a check that prevents removal of previously saved boosters.

The route currently computes:
```ts
const toReturn = prev.filter((s: string) => !next.includes(s))
const toConsume = next.filter((s: string) => !prev.includes(s))
```

Where `prev` = `existingPrediction.applied_boosters` (what's saved in DB).

Block any removal attempt:
```ts
// Boosters that were already saved cannot be removed
if (toReturn.length > 0) {
  return NextResponse.json(
    { error: "Applied boosters cannot be removed after saving" },
    { status: 400 }
  )
}
```

This makes the API the authoritative guard — even if the client somehow sends
a removal request, the server rejects it.

### 2. `components/prediction-form.tsx` — `toggleBooster` function

Currently `toggleBooster` allows removing any applied booster:
```ts
function toggleBooster(slug: string) {
  if (isSlidersLocked) return
  setAppliedBoosters(prev => {
    if (prev.includes(slug)) return prev.filter(s => s !== slug)  // ← remove this branch
    ...
  })
}
```

Update to only allow removal of boosters that haven't been saved yet:
```ts
function toggleBooster(slug: string) {
  if (isSlidersLocked) return
  setAppliedBoosters(prev => {
    if (prev.includes(slug)) {
      // Only allow removal if this booster hasn't been saved to the DB yet
      const alreadySaved = (existingPrediction?.applied_boosters ?? []).includes(slug)
      if (alreadySaved) return prev  // locked — cannot remove
      return prev.filter(s => s !== slug)
    }
    if (prev.length >= maxSlots) return prev
    const inv = inventory.find(i => i.items.slug === slug)
    if (!inv || inv.quantity <= 0) return prev
    return [...prev, slug]
  })
}
```

### 3. `components/prediction-form.tsx` — `BoosterTile` component

Saved boosters need a distinct visual treatment to communicate they are locked:

Add an `isSavedLocked` prop:
```ts
function BoosterTile({
  inv,
  isApplied,
  canApply,
  isSavedLocked,  // ← new: this booster is saved and cannot be removed
  onToggle,
}: { ... isSavedLocked?: boolean ... })
```

When `isSavedLocked`:
- Show a small lock icon (🔒 or Lucide `Lock` at 8px) in the top-left corner
  of the image (opposite corner from the quantity badge)
- Change cursor to `cursor-default` (not `cursor-pointer`)
- Keep the amber border/glow (still applied) but slightly different opacity
  to indicate permanence vs selectability
- Tooltip text changes to "Applied & locked — boosters cannot be removed after saving"

```tsx
// In the image wrapper div:
{isSavedLocked && (
  <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 rounded-full bg-black/90 border border-amber-500/60 flex items-center justify-center z-10">
    <Lock className="h-2 w-2 text-amber-400" />
  </div>
)}
```

### 4. Passing `isSavedLocked` to each BoosterTile

In the booster grid render in `PredictionForm`:
```tsx
const savedBoosters = existingPrediction?.applied_boosters ?? []

{inventory.map(inv => {
  if (!inv.items) return null
  const isApplied = appliedBoosters.includes(inv.items.slug)
  const isSavedLocked = savedBoosters.includes(inv.items.slug)
  const canApply = !isApplied && appliedBoosters.length < maxSlots && inv.quantity > 0
  return (
    <BoosterTile
      key={inv.item_id}
      inv={inv}
      isApplied={isApplied}
      isSavedLocked={isSavedLocked}
      canApply={canApply}
      onToggle={() => toggleBooster(inv.items.slug)}
    />
  )
})}
```

---

## Edge cases to handle

### New prediction (not yet saved)
- `existingPrediction` is null → `savedBoosters` is empty → all applied boosters
  are removable (player is still selecting before first save)
- This is correct — full flexibility before first save

### Adding more boosters after first save
- Player has saved with 1 booster and has a second slot available
- They can still add a second booster — `isSavedLocked` is false for unapplied boosters
- On the next save, the new booster gets consumed and also becomes locked
- This is correct — each save locks whatever is currently applied

### Full slot scenario
- Player has saved with 2 boosters (both slots filled)
- Both tiles show lock icons
- No more boosters can be added or removed
- Player's only option is to use Sigil of Multiplicity to unlock a 3rd slot

---

## Verification
1. New prediction: apply a booster → tile shows amber border, no lock icon, removable ✓
2. Save prediction with booster: reload page → tile shows amber border + lock icon,
   clicking does nothing, tooltip says "locked"
3. Try to add a second booster to a saved prediction with a free slot → works ✓
4. Save with second booster → both tiles now show lock icons ✓
5. Inspect network: POST to /api/predictions/boosters with a removal attempt
   returns 400 "Applied boosters cannot be removed after saving" ✓
6. Run `npx tsc --noEmit` — no errors
