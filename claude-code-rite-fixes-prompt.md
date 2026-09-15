# Task: Three prediction card fixes

---

## Fix 1 — Used rites turn grey when they cannot be used again

### Behaviour required
After a rite is performed, its circle should grey out IF it cannot be used again
on the same prediction card. Rules:

| Rite | Can be reused? | Grey out after use? |
|------|---------------|---------------------|
| Ritual of Augury | Yes (re-activate for another 2-min window) | No — stays active/glowing |
| Temporal Translocation | Yes (only if early-locked again) | No — disable if not early-locked |
| Eldritch Wager | No | Yes — grey out after use |
| Sigil of Multiplicity | No | Yes — grey out after use |
| Auspicious Omens | No (one mark per game) | Yes — grey out after use |

### Implementation
In `components/prediction-form.tsx`, the `RiteCircle` component already receives
`isPerformed: boolean`. Currently it uses `disabled || isPerformed` to disable the
button. Update the visual state to grey when performed AND non-reusable:

Add a `reusable` field to the RITES array:
```ts
const RITES = [
  { slug: "ritual_of_augury", ..., reusable: true },
  { slug: "eldritch_wager", ..., reusable: false },
  { slug: "sigil_of_multiplicity", ..., reusable: false },
  { slug: "temporal_translocation", ..., reusable: true },
  { slug: "auspicious_omens", ..., reusable: false },
]
```

In `RiteCircle`, update the visual logic:
```tsx
const isGreyedOut = isPerformed && !(rite as any).reusable

// Apply grey styling when greyed out
className={`... ${
  isGreyedOut
    ? "opacity-40 grayscale cursor-not-allowed border-white/10"
    : isPerformed
    ? auraGlowClass   // cyan or purple aura for performed+reusable rites
    : "border-purple-900/40 hover:border-purple-500/50"
}`}
```

Temporal Translocation special case — it should be greyed out (disabled) when:
- Not early locked (can't be used), OR
- Already performed AND not early locked again
The existing `disabled` logic handles this, just ensure the grey styling applies.

---

## Fix 2 — Mana not being deducted when a rite is activated

### Symptom
When a player confirms a rite (e.g. Eldritch Wager for 30 mana), the rite
activates locally but the player's mana balance is not deducted.

### Root cause
The `performRite` function in `PredictionForm` handles rites locally in state
(`setPerformedRites`) but only calls the backend API for Ritual of Augury.
All other rites have no API call and no mana deduction.

### Fix
Create a new API route `app/api/rites/perform/route.ts` that:
1. Authenticates the user
2. Validates the rite slug and that the prediction belongs to the user
3. Calls the `deduct_mana` RPC with the rite's mana cost
4. Logs the rite to `rite_history` table
5. Updates `predictions.applied_rites` to record the rite was used

```ts
// app/api/rites/perform/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const RITE_COSTS: Record<string, number> = {
  eldritch_wager: 30,
  sigil_of_multiplicity: 50,
  temporal_translocation: 100,
  auspicious_omens: 0, // dynamic cost — passed from client
  // ritual_of_augury handled by /api/rites/augury separately
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prediction_id, season_id, rite_slug, mana_cost } = await request.json()

  // Verify prediction belongs to user
  const { data: prediction } = await supabase
    .from("predictions")
    .select("id, user_id, applied_rites")
    .eq("id", prediction_id)
    .single()

  if (!prediction || prediction.user_id !== user.id) {
    return NextResponse.json({ error: "Prediction not found" }, { status: 404 })
  }

  // Determine cost
  const cost = rite_slug === "auspicious_omens" ? (mana_cost ?? 10) : RITE_COSTS[rite_slug]
  if (cost === undefined) {
    return NextResponse.json({ error: "Unknown rite" }, { status: 400 })
  }

  // Deduct mana
  if (cost > 0) {
    const { data: ok } = await supabase.rpc("deduct_mana", {
      p_user_id: user.id,
      p_season_id: season_id,
      p_amount: cost,
    })
    if (!ok) {
      return NextResponse.json({ error: "Insufficient mana" }, { status: 400 })
    }
  }

  // Log to rite_history
  await supabaseAdmin.from("rite_history").insert({
    user_id: user.id,
    season_id,
    prediction_id,
    rite_slug,
    mana_cost: cost,
  })

  // Update prediction.applied_rites
  const currentRites = prediction.applied_rites ?? {}
  await supabaseAdmin
    .from("predictions")
    .update({ applied_rites: { ...currentRites, [rite_slug]: new Date().toISOString() } })
    .eq("id", prediction_id)

  return NextResponse.json({ success: true, mana_deducted: cost })
}
```

### Update `performRite` in prediction-form.tsx
Call this API for all rites except `ritual_of_augury` (which has its own route):

```ts
async function performRite(slug: string) {
  if (performedRites.has(slug) && !REUSABLE_RITES.includes(slug)) return
  setError(null)

  if (slug === "ritual_of_augury") {
    // existing augury logic unchanged
    return
  }

  // All other rites — call perform API
  const res = await fetch("/api/rites/perform", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prediction_id: existingPrediction?.id,
      season_id: seasonId,
      rite_slug: slug,
      mana_cost: slug === "auspicious_omens" ? aoNextCost : undefined,
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    setError(data.error || "Rite failed")
    return
  }

  if (slug === "auspicious_omens") setAoMarked(true)
  if (slug === "sigil_of_multiplicity") {
    // extra slot derived from performedRites — auto-updates
  }
  setPerformedRites(prev => new Set([...prev, slug]))
  router.refresh() // refresh to update mana balance in header
}
```

Note: `performRite` should guard against being called before a prediction is saved
(no `existingPrediction?.id`). If no prediction exists yet, show an error:
"Save your prediction first before using rites."

---

## Fix 3 — Gold ring around AO star on ladder tiles

### Current state
When Auspicious Omens is activated for a game, a purple star (★) appears in the
top-right corner of that game's image in the season ladder. The star is hard to
see against varied game artwork.

### Fix
Wrap the star in a small circular badge with a gold ring, similar to how the mana
cost badge is styled on rite circles:

In `components/prediction-form.tsx`, find the `LadderTile` component and update
the AO star overlay:

```tsx
{/* AO star — gold ring badge */}
{isAoMarked && (
  <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/80 border-2 border-amber-400 flex items-center justify-center shadow-[0_0_6px_rgba(251,191,36,0.5)]">
    <span className="text-[10px] text-violet-400 leading-none">★</span>
  </div>
)}
```

The gold (`border-amber-400`) ring contrasts against any game artwork, the dark
background ensures the purple star is visible, and the subtle gold glow ties it
to the amber/gold color system used throughout the prediction card.

---

## Verification
1. Use Eldritch Wager — circle greys out, mana balance in header decreases by 30
2. Use Ritual of Augury — circle stays glowing (reusable), mana decreases by 10
3. Use Auspicious Omens — circle greys out, mana decreases by aoNextCost, gold-ring
   star appears on the game's ladder tile
4. Sigil of Multiplicity — circle greys out, extra booster slot appears, mana decreases
5. Trying a rite with insufficient mana shows an error message
6. Trying a rite before saving the prediction shows "Save your prediction first"
7. AO star on ladder tile has visible gold ring border against all background colors
8. Run `npx tsc --noEmit` — no errors
