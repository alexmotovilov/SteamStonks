# Task: Add season rank badge to header

## Context
The header currently shows the player's spendable mana balance (cyan badge, left of avatar).
We need to add a second badge showing the player's current season leaderboard rank and
prediction mana earned. This replaces the need for a dedicated /leaderboard page for
current-season standings.

## Design

Two distinct badges in the header, left of the avatar dropdown:

```
[🔮 1,250]  [#4 · 3,200 mana]  [avatar]
  ↑ cyan        ↑ purple
spendable     rank + earned
 balance
```

### Rank badge specs
- Shows: `#N` (rank number) on top line, `N,NNN mana` below in smaller text
- Colors: purple accent — `#9D84D4` for the rank number, muted for the mana earned line
- Background: `bg-purple-950/40 border border-purple-500/20` (matches project aesthetic)
- Font: `font-display` (Cinzel) for the rank number, regular for mana
- Size: similar compact pill to the existing mana badge
- Hidden on mobile (same `hidden sm:flex` as existing badge)
- Shows "Unranked" if player has no scored predictions yet

### Visual hierarchy
The two values must be clearly distinct:
- Spendable mana (cyan) = "what can I spend right now?"
- Rank + earned (purple) = "how am I doing in the season?"

Do NOT combine them into one badge.

## Implementation

### New component: `components/season-rank-badge.tsx`

Create a client component (similar pattern to `SeasonPointsBadge`) that:

1. Fetches the active season ID
2. Queries `season_entries` for the player's `prediction_mana_earned`
3. Computes rank by counting how many players have higher `prediction_mana_earned`
   in the same season:

```ts
// Get player's mana earned
const { data: entry } = await supabase
  .from("season_entries")
  .select("prediction_mana_earned")
  .eq("user_id", user.id)
  .eq("season_id", season.id)
  .single()

// Count players ranked above this player
const { count } = await supabase
  .from("season_entries")
  .select("*", { count: "exact", head: true })
  .eq("season_id", season.id)
  .gt("prediction_mana_earned", entry.prediction_mana_earned ?? 0)

const rank = (count ?? 0) + 1
```

4. Renders:
```tsx
<div className="hidden sm:flex flex-col items-center px-3 py-1 rounded-md bg-purple-950/40 border border-purple-500/20">
  <span className="font-display text-xs text-[#9D84D4] leading-tight">#{rank}</span>
  <span className="font-display text-[10px] text-muted-foreground leading-tight">
    {(entry.prediction_mana_earned ?? 0).toLocaleString()} mana
  </span>
</div>
```

5. Returns `null` while loading (same pattern as `SeasonPointsBadge`)
6. Returns "Unranked" state if no active season or no season entry

### Update `components/header.tsx`

Import and add `SeasonRankBadge` next to `SeasonPointsBadge`, wrapped in `<Suspense fallback={null}>`:

```tsx
{user && (
  <Suspense fallback={null}>
    <SeasonPointsBadge user={user} />
  </Suspense>
)}
{user && (
  <Suspense fallback={null}>
    <SeasonRankBadge user={user} />
  </Suspense>
)}
```

Order: spendable mana badge first (left), rank badge second (right of it), then avatar.

## Rules
- Follow the EXACT same pattern as `components/season-points-badge.tsx` — useEffect,
  createClient from @/lib/supabase/client, fetch on mount, null while loading
- Must be wrapped in Suspense in the header — this is critical to prevent Radix
  hydration mismatch (same reason SeasonPointsBadge is wrapped)
- Do NOT use next/image for any icons — use plain <img> tags
- Do not modify any other part of the header (logo, nav, vignette overlays,
  suppressHydrationWarning, dropdown)
- Run `npx tsc --noEmit` after changes

## Verification
1. Header shows two badges: cyan mana balance on left, purple rank on right
2. Rank badge shows `#1`, `#4` etc. based on actual leaderboard position
3. Mana earned below rank is distinct from the spendable balance in the cyan badge
4. No hydration mismatch errors in console
5. Badges hidden on mobile (sm:flex)
6. No active season → rank badge not shown (returns null)
