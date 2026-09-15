# Task: Update equipment tier description text and colors in selection modal

## Overview
The equipment tier descriptions in the selection modal need updated wording
and color coding. Update ONLY the display text in `components/join-season-button.tsx`
(or wherever EQUIPMENT_TIERS is defined). Do NOT change any scoring logic.

---

## Correct tier descriptions and colors

### Seer's Spectacles — unchanged, green
```ts
seers_spectacles: {
  t0: "Players window +3% · Reviews window +1",
  t3: "Players window +5% · Reviews window +2",
  t6: "Players window +10% · Reviews window +5",
}
```
Color: all text `text-emerald-400` (green — prediction range buffs)

### Arcanum Esoterica — reworded, cyan
```ts
arcanum_esoterica: {
  t0: "+15 mana for partial · +30 mana for perfect",
  t3: "+25 mana for partial · +75 mana for perfect",
  t6: "+25 mana for partial · +75 mana for perfect · +50 mana total reward",
}
```
Color: all text `text-cyan-300` (cyan — mana rewards)

Note on Tier II math: partial = one metric correct = +25 mana. Perfect = both
correct = +25 players + +25 reviews + +25 both bonus = +75 mana.
Note on Tier III: same as Tier II plus +50 mana total reward on top.

### Clockwork Familiar — reworded, ALL amber
```ts
clockwork_familiar: {
  t0: "+1 drop for partial · +2 drops for perfect",
  t3: "+1 drop for partial · +2 drops for perfect · +1 booster slot",
  t6: "+1 booster slot · +2 drops total reward",
}
```
Color: ALL text `text-amber-400` (amber — drops and booster slots are both
item/booster category rewards)

---

## Color application in TierRow component

The `TierRow` component (or wherever tier text is rendered in the card) needs
to apply the correct color per equipment piece. The simplest approach is to
pass a `color` prop per equipment:

```tsx
const EQUIPMENT_COLORS: Record<string, string> = {
  seers_spectacles:   "text-emerald-400",
  arcanum_esoterica:  "text-cyan-300",
  clockwork_familiar: "text-amber-400",
}
```

Then in `TierRow`:
```tsx
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
```

Pass `color={EQUIPMENT_COLORS[item.slug]}` when rendering each card's tier rows.

---

## What NOT to change
- Scoring logic in `lib/scoring.ts` — already updated separately
- The `EquipmentTierEffect` interface or `resolveEquipmentEffects` function
- Any DB queries or API routes
- The modal layout, card styling, or confirm/cancel logic

---

## Verification
1. Seer's Spectacles tier rows show in green ✓
2. Arcanum Esoterica tier rows show in cyan with correct partial/perfect wording ✓
3. Clockwork Familiar tier rows show entirely in amber ✓
4. Tier II AE reads "+25 mana for partial · +75 mana for perfect" ✓
5. CF Tier II reads "+1 drop for partial · +2 drops for perfect · +1 booster slot" ✓
6. CF Tier III reads "+1 booster slot · +2 drops total reward" ✓
7. Run `npx tsc --noEmit` — no errors ✓
