# Task: Fully implement Ritual of Augury

## Overview
Ritual of Augury is a rite on the prediction card that costs 10 mana. When activated,
it overlays a heatmap gradient on both prediction sliders for 2 minutes, showing the
distribution of other players' prediction midpoints. After 2 minutes the heatmap fades
and the rite can be used again.

---

## Current state (read these files first)

- `app/api/rites/augury/route.ts` — existing POST endpoint, may need reconciliation with /api/rites/perform
- `lib/ladder-scoring.ts` — contains `computeAuguryDistribution()` and `distributionToGradient()`
- `components/gem-slider.tsx` — accepts `auguryGradient?: string | null` prop
- `components/prediction-form.tsx` — has augury state vars, calls the augury route in `performRite`

Read all four files carefully before making any changes.

---

## Fix 1 — Mana deduction reconciliation

The `/api/rites/augury/route.ts` was written before `/api/rites/perform` existed.
Check whether augury is:
a) Only handled by `/api/rites/augury` (deducts mana + returns data in one call)
b) Handled by both routes (double deduction risk)
c) Skipped by `/api/rites/perform` but augury route doesn't deduct mana

The correct architecture:
- `/api/rites/augury` handles EVERYTHING for augury: deducts 10 mana, logs to
  rite_history, returns the distribution data
- `/api/rites/perform` explicitly SKIPS augury (it's already handled separately)

Ensure `/api/rites/perform/route.ts` has this guard:
```ts
if (rite_slug === "ritual_of_augury") {
  return NextResponse.json({ error: "Use /api/rites/augury for this rite" }, { status: 400 })
}
```

Ensure `/api/rites/augury/route.ts`:
1. Authenticates the user
2. Verifies prediction belongs to user (requires `prediction_id` in body)
3. Deducts 10 mana via `supabase.rpc("deduct_mana", ...)` using SERVER client
   (same fix as vendor purchase — use server client not admin client for deduct_mana)
4. Logs to rite_history
5. Queries all OTHER players' predictions for this game+season:
   ```ts
   const { data: otherPredictions } = await supabase
     .from("predictions")
     .select("players_midpoint, reviews_midpoint")
     .eq("game_id", game_id)
     .eq("season_id", season_id)
     .neq("user_id", user.id)
     .not("players_midpoint", "is", null)
     .not("reviews_midpoint", "is", null)
   ```
6. Returns `{ players_midpoints: number[], reviews_midpoints: number[] }`

If fewer than 3 other predictions exist, still return the data but include
`{ sparse: true }` so the frontend can show a notice.

---

## Fix 2 — Gradient rendering on the new slider SVG

The `GemSlider` component uses a `600×64` SVG viewBox. The `auguryGradient` prop
is a CSS gradient string (e.g. `"linear-gradient(to right, transparent, rgba(255,100,0,0.3), ...)"`)
that needs to be rendered as an overlay on the track area.

Read `components/gem-slider.tsx` and find where `auguryGradient` is currently rendered.
The gradient must be applied as a `<rect>` or `<foreignObject>` covering the track area:

```tsx
{/* Augury heatmap overlay — covers track width, centered on track Y */}
{auguryGradient && (
  <foreignObject
    x={0}
    y={TRACK_Y - 8}
    width={SVG_W}
    height={TRACK_H + 16}
  >
    <div
      xmlns="http://www.w3.org/1999/xhtml"
      style={{
        width: "100%",
        height: "100%",
        background: auguryGradient,
        opacity: 0.55,
        borderRadius: "4px",
      }}
    />
  </foreignObject>
)}
```

Place this ABOVE the track background rect but BELOW the gem shape in the SVG
render order so the gem sits on top of the heatmap.

---

## Fix 3 — computeAuguryDistribution and distributionToGradient

Read `lib/ladder-scoring.ts` and verify these functions exist and work correctly.

`computeAuguryDistribution(midpoints: number[], min: number, max: number)` should:
- Bin the midpoint values into N buckets (e.g. 100 buckets across the range)
- Return a normalized density array (0–1 per bucket)
- For the PLAYERS slider: use log scale binning since the slider is log scale
  ```ts
  // Log-scale bin assignment:
  const logMin = Math.log10(Math.max(min, 1))
  const logMax = Math.log10(max)
  const binIndex = Math.floor(
    ((Math.log10(Math.max(value, 1)) - logMin) / (logMax - logMin)) * numBuckets
  )
  ```
- For the REVIEWS slider: use linear binning (0–100 range)

`distributionToGradient(distribution: number[])` should:
- Convert the density array to a CSS linear-gradient string
- Use a heat color scale: transparent (0) → cool blue → green → yellow → hot orange/red (1)
- Example output:
  ```
  "linear-gradient(to right, transparent 0%, transparent 5%, rgba(34,197,94,0.2) 15%, rgba(251,191,36,0.5) 45%, rgba(239,68,68,0.6) 50%, rgba(251,191,36,0.5) 55%, transparent 90%, transparent 100%)"
  ```

If either function is missing or incorrect, implement/fix them.

---

## Fix 4 — 2-minute countdown timer visible to player

Currently the heatmap appears but there's no UI feedback showing how long it lasts.
Add a visible countdown in the prediction card.

In `components/prediction-form.tsx`, after the augury gradients are set, render a
small countdown badge that appears above the sliders and ticks down in real time:

```tsx
{/* Augury countdown — shows while heatmap is active */}
{auguryExpiry && Date.now() < auguryExpiry && (
  <AuguryCountdown expiry={auguryExpiry} />
)}
```

```tsx
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

  const pct = (secondsLeft / 120) * 100  // 120 seconds total

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
      <div className="relative w-3 h-3">
        <svg viewBox="0 0 12 12" className="w-full h-full -rotate-90">
          <circle cx="6" cy="6" r="5" fill="none" stroke="rgba(103,232,249,0.2)" strokeWidth="1.5"/>
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
```

Place this between the reviews slider and the active effects panel (or mana preview).

---

## Fix 5 — Rite circle aura resets after expiry

Ritual of Augury is reusable. Currently the cyan aura stays on the circle permanently
after use. It should:
- Show the cyan aura glow while the heatmap is active (auguryExpiry > Date.now())
- Return to normal (no aura) once the 2 minutes expire
- Allow re-activation after expiry (re-performing costs another 10 mana)

In `components/prediction-form.tsx`, the `isPerformed` prop passed to the Augury
RiteCircle should reflect the ACTIVE state, not just "has ever been used":

```ts
// For augury specifically, "performed" means currently active (within expiry window)
const auguryActive = !!auguryExpiry && Date.now() < auguryExpiry

// In the RITES.map():
<RiteCircle
  key={rite.slug}
  rite={rite.slug === "auspicious_omens" ? { ...rite, cost: aoNextCost } : rite}
  isPerformed={
    rite.slug === "ritual_of_augury"
      ? auguryActive  // ← active only while heatmap is showing
      : performedRites.has(rite.slug)
  }
  disabled={
    isFullyLocked ||
    (rite.slug === "temporal_translocation" && !isEarlyLocked) ||
    (rite.slug === "ritual_of_augury" && (auguryRunning || auguryActive))
    // disable during fetch AND while active (can't stack)
  }
  onConfirm={() => performRite(rite.slug)}
/>
```

Also update `performedRites` handling — augury should NOT be added to `performedRites`
(which permanently greys out rites). Instead it uses `auguryActive` exclusively.

---

## Fix 6 — Sparse data notice

When fewer than 3 other predictions exist (early in the season), show a notice:

```tsx
{auguryGradientPlayers && (
  <div className="text-[9px] text-muted-foreground/50 text-center italic">
    {auguryIsSparse
      ? "Few prophecies recorded — heatmap may not be representative"
      : "Showing crowd prediction distribution"
    }
  </div>
)}
```

Add `auguryIsSparse` state, set it from the API response's `sparse` field.

---

## Call in performRite

Ensure `performRite` for augury in `prediction-form.tsx`:
1. Sets `auguryRunning = true`
2. Calls `/api/rites/augury` with `{ game_id, season_id, prediction_id }`
3. On success:
   - Calls `distributionToGradient(computeAuguryDistribution(data.players_midpoints, 100, 2000000))` for players
   - Calls `distributionToGradient(computeAuguryDistribution(data.reviews_midpoints, 0, 100))` for reviews
   - Sets `auguryGradientPlayers` and `auguryGradientReviews`
   - Sets `auguryExpiry = Date.now() + 2 * 60 * 1000`
   - Sets `auguryIsSparse = data.sparse ?? false`
4. On error: sets error message
5. Sets `auguryRunning = false`
6. Does NOT add to `performedRites`

---

## Verification
1. Player activates Augury — mana balance decreases by 10 ✓
2. Heatmap gradient appears on both sliders immediately ✓
3. Gradient reflects actual distribution of other players' midpoints ✓
4. Countdown timer shows "👁 Augury active · 120s" and ticks down ✓
5. After 2 minutes: gradient disappears, countdown gone, rite circle returns to normal ✓
6. Rite can be activated again after expiry ✓
7. Activating while already active is disabled (button greyed) ✓
8. Fewer than 3 predictions → sparse notice shown below sliders ✓
9. mana deduction only happens once (no double-charge) ✓
10. Run `npx tsc --noEmit` — no errors ✓
