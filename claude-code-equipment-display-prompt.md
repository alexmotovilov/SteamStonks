# Task: Display current equipment in header and dashboard

## Overview
Players need to see their current season equipment and tier progress in two places:
1. **Header** — a compact badge showing equipment icon + current tier, visible at all times
2. **Dashboard** — a full equipment card showing all three tiers, highlighting the active one

---

## Part 1 — Header equipment badge

### Design
A small compact badge to the left of the mana balance badge:

```
[⚙ Seer's · T2]  [🔮 1,250]  [avatar]
     ↑ purple badge   ↑ cyan badge
```

- Shows equipment artwork thumbnail (20×20px, rounded) + abbreviated name + tier
- Color: purple (`bg-purple-950/40 border border-purple-500/20`) — distinct from cyan mana badge
- Hidden if player hasn't joined the active season or has no equipment selected
- Hidden on mobile (`hidden sm:flex`)

### New component: `components/equipment-badge.tsx`

Same pattern as `SeasonPointsBadge` — client component, fetches on mount, wrapped in Suspense:

```tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

const EQUIPMENT_IMAGES: Record<string, string> = {
  seers_spectacles:   "/equipment/seers-spectacles.png",
  arcanum_esoterica:  "/equipment/arcanum-esoterica.png",
  clockwork_familiar: "/equipment/clockwork-familiar.png",
}

const EQUIPMENT_SHORT: Record<string, string> = {
  seers_spectacles:   "Spectacles",
  arcanum_esoterica:  "Arcanum",
  clockwork_familiar: "Familiar",
}

export function EquipmentBadge({ user }: { user: SupabaseUser }) {
  const [equipment, setEquipment] = useState<{
    slug: string
    name: string
    tierScore: number
  } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    async function fetch() {
      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()
      if (!season) return

      const { data: entry } = await supabase
        .from("season_entries")
        .select(`
          equipment_tier_score,
          items:equipment_id (slug, name)
        `)
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .single()

      if (!entry?.items) return

      setEquipment({
        slug: (entry.items as any).slug,
        name: (entry.items as any).name,
        tierScore: entry.equipment_tier_score ?? 0,
      })
    }
    fetch()
  }, [user.id])

  if (!equipment) return null

  // Tier: 0–2 = I, 3–5 = II, >5 = III
  const tier = equipment.tierScore <= 2 ? "I" : equipment.tierScore <= 5 ? "II" : "III"
  const image = EQUIPMENT_IMAGES[equipment.slug]
  const short = EQUIPMENT_SHORT[equipment.slug] ?? equipment.name

  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-purple-950/40 border border-purple-500/20">
      {image && (
        <img
          src={image}
          alt={equipment.name}
          width={18}
          height={18}
          className="rounded object-cover shrink-0"
        />
      )}
      <span className="font-display text-[10px] text-purple-300 leading-none">
        {short}
      </span>
      <span className="font-display text-[10px] text-purple-500 leading-none">
        T{tier}
      </span>
    </div>
  )
}
```

### Update `components/header.tsx`

Import and add `EquipmentBadge` wrapped in `<Suspense fallback={null}>`,
placed to the LEFT of the existing `SeasonPointsBadge`:

```tsx
import { EquipmentBadge } from "@/components/equipment-badge"

// In the right-side badges area:
{user && (
  <Suspense fallback={null}>
    <EquipmentBadge user={user} />
  </Suspense>
)}
{user && (
  <Suspense fallback={null}>
    <SeasonPointsBadge user={user} />
  </Suspense>
)}
```

Order left to right: Equipment badge → Mana badge → Rank badge → Avatar

---

## Part 2 — Equipment card on dashboard

### Design
A card on the dashboard page showing:
- Equipment artwork (full width, aspect-ratio square, rounded top)
- Equipment name + current tier highlighted
- All three tier rows, with the active tier visually distinguished

```
┌─────────────────────────────────────┐
│  [Equipment artwork image]          │
├─────────────────────────────────────┤
│  Seer's Spectacles    ● Tier II     │
│                                     │
│  ○ Tier I    Players +3% · Rev +1   │  ← muted (past)
│  ● Tier II   Players +5% · Rev +2   │  ← highlighted (active)
│  ○ Tier III  Players +10% · Rev +5  │  ← muted (future)
│                                     │
│  3 / 6 predictions to Tier III      │  ← progress hint
└─────────────────────────────────────┘
```

### Tier row styling
- **Active tier**: full brightness text, colored (green/cyan/amber per equipment),
  small filled dot `●`, slightly brighter background `bg-white/[0.03]`
- **Past tier**: muted text, empty dot `○`, strikethrough optional
- **Future tier**: muted text, empty dot `○`

### Progress hint
Show how many more Perfect/Partial predictions until next tier:
```ts
const predictionsToNextTier = equipment.tierScore <= 2
  ? `${3 - equipment.tierScore} prediction${3 - equipment.tierScore !== 1 ? "s" : ""} to Tier II`
  : equipment.tierScore <= 5
  ? `${6 - equipment.tierScore} prediction${6 - equipment.tierScore !== 1 ? "s" : ""} to Tier III`
  : "Max tier reached"
```

### Implementation in `app/(authenticated)/dashboard/page.tsx`

Fetch equipment data server-side alongside existing dashboard queries:

```ts
// Fetch player's equipment for active season
const { data: seasonEntry } = user && activeSeason
  ? await supabase
      .from("season_entries")
      .select(`
        equipment_tier_score,
        items:equipment_id (id, slug, name)
      `)
      .eq("user_id", user.id)
      .eq("season_id", activeSeason.id)
      .single()
  : { data: null }
```

Add an `EquipmentCard` component (can be in the dashboard page file or a
separate `components/equipment-card.tsx`):

```tsx
const EQUIPMENT_TIERS: Record<string, { label: string; t0: string; t3: string; t6: string; color: string }> = {
  seers_spectacles: {
    label: "Seer's Spectacles",
    t0: "Players window +3% · Reviews window +1",
    t3: "Players window +5% · Reviews window +2",
    t6: "Players window +10% · Reviews window +5",
    color: "text-emerald-400",
  },
  arcanum_esoterica: {
    label: "Arcanum Esoterica",
    t0: "+15 mana for partial · +30 mana for perfect",
    t3: "+25 mana for partial · +75 mana for perfect",
    t6: "+25 mana for partial · +75 mana for perfect · +50 mana total reward",
    color: "text-cyan-300",
  },
  clockwork_familiar: {
    label: "Clockwork Familiar",
    t0: "+1 drop for partial · +2 drops for perfect",
    t3: "+1 drop for partial · +2 drops for perfect · +1 booster slot",
    t6: "+1 booster slot · +2 drops total reward",
    color: "text-amber-400",
  },
}

function EquipmentCard({ slug, tierScore }: { slug: string; tierScore: number }) {
  const eq = EQUIPMENT_TIERS[slug]
  if (!eq) return null

  const activeTier = tierScore <= 2 ? 0 : tierScore <= 5 ? 1 : 2
  const image = EQUIPMENT_IMAGES[slug]

  const tiers = [
    { label: "Tier I",   text: eq.t0, tier: 0 },
    { label: "Tier II",  text: eq.t3, tier: 1 },
    { label: "Tier III", text: eq.t6, tier: 2 },
  ]

  const predictionsToNext = tierScore <= 2
    ? `${3 - tierScore} prediction${3 - tierScore !== 1 ? "s" : ""} to Tier II`
    : tierScore <= 5
    ? `${6 - tierScore} prediction${6 - tierScore !== 1 ? "s" : ""} to Tier III`
    : "Max tier reached"

  return (
    <Card className="border-purple-500/20 bg-purple-950/10 overflow-hidden">
      {/* Artwork */}
      {image && (
        <div className="aspect-square w-full overflow-hidden">
          <img src={image} alt={eq.label} className="w-full h-full object-cover" />
        </div>
      )}
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-foreground">{eq.label}</CardTitle>
          <span className="font-display text-xs text-purple-400 bg-purple-950/50 border border-purple-500/20 px-2 py-0.5 rounded">
            Tier {activeTier === 0 ? "I" : activeTier === 1 ? "II" : "III"}
          </span>
        </div>

        {/* Tier rows */}
        <div className="space-y-1">
          {tiers.map(({ label, text, tier }) => {
            const isActive = tier === activeTier
            const isPast = tier < activeTier
            return (
              <div key={tier}
                className={`flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                  isActive ? "bg-white/[0.04]" : ""
                }`}
              >
                <span className={`mt-0.5 text-[10px] ${isActive ? eq.color : "text-muted-foreground/30"}`}>
                  {isActive ? "●" : isPast ? "✓" : "○"}
                </span>
                <div className="flex-1">
                  <span className={`font-display text-[9px] tracking-widest uppercase mr-2 ${
                    isActive ? "text-muted-foreground" : "text-muted-foreground/30"
                  }`}>
                    {label}
                  </span>
                  <span className={isActive ? eq.color : isPast ? "text-muted-foreground/40" : "text-muted-foreground/25"}>
                    {text}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress hint */}
        <div className="text-[10px] text-muted-foreground/50 font-display tracking-wide text-center pt-1 border-t border-border">
          {predictionsToNext}
        </div>
      </CardContent>
    </Card>
  )
}
```

Place the `EquipmentCard` in the dashboard stats grid alongside Season Mana
and Token Balance cards. If no equipment is selected (player hasn't joined),
show a placeholder card with "Join a season to equip an artifact."

---

## Rules
- `EquipmentBadge` must be wrapped in `<Suspense fallback={null}>` in the header
  — critical to prevent Radix hydration mismatch
- Do not use `next/image` for equipment artwork — use plain `<img>` tags
- Do not modify any scoring logic
- Run `npx tsc --noEmit` after changes

---

## Verification
1. Header shows equipment badge with thumbnail, short name, and tier for joined players ✓
2. Header badge not shown for players who haven't joined the season ✓
3. Dashboard shows full equipment card with all three tiers ✓
4. Active tier is visually highlighted (brighter text + filled dot + subtle bg) ✓
5. Past tiers show checkmark, future tiers show empty circle ✓
6. Progress hint correctly shows predictions needed to reach next tier ✓
7. "Max tier reached" shown for players with >5 Perfect/Partial predictions ✓
8. No hydration mismatch errors ✓
9. Run `npx tsc --noEmit` — no errors ✓
