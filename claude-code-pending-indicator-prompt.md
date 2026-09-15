# Task: Add pending prediction indicator to Games nav link in header

## Feature
When a player has one or more unreleased games in the active season for which they
have NOT yet set a prediction, the "Games" navigation link in the header should show
a subtle animated border/glow to draw their attention.

The indicator should:
- Appear as a subtle pulsing border or ring around the "Games" nav link
- Use the emerald green color (prediction/window color) to signal "action available"
- Disappear once all upcoming games have predictions set
- Not appear if there are no unreleased games, or all unreleased games have predictions

---

## Implementation

### 1. New client component: `components/pending-predictions-indicator.tsx`

This component fetches the count of upcoming games without predictions and wraps
the Games nav link with the indicator styling.

```tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface PendingPredictionsIndicatorProps {
  user: SupabaseUser
  children: React.ReactNode  // the Games nav link content
  href: string
  className: string
}

export function PendingPredictionsIndicator({
  user, children, href, className
}: PendingPredictionsIndicatorProps) {
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function check() {
      // Get active season
      const { data: season } = await supabase
        .from("seasons")
        .select("id")
        .eq("status", "active")
        .single()

      if (!season) return

      // Get all unreleased games in this season
      const { data: seasonGames } = await supabase
        .from("season_games")  // or however games are linked to seasons
        .select("game_id")
        .eq("season_id", season.id)

      if (!seasonGames?.length) return

      const gameIds = seasonGames.map(g => g.game_id)

      // Filter to only unreleased games
      const { data: unreleasedGames } = await supabase
        .from("games")
        .select("id")
        .in("id", gameIds)
        .eq("is_released", false)

      if (!unreleasedGames?.length) return

      const unreleasedIds = unreleasedGames.map(g => g.id)

      // Check if player has predictions for all of them
      const { data: predictions } = await supabase
        .from("predictions")
        .select("game_id")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .in("game_id", unreleasedIds)

      const predictedIds = new Set((predictions ?? []).map(p => p.game_id))
      const hasMissing = unreleasedIds.some(id => !predictedIds.has(id))

      setHasPending(hasMissing)
    }

    check()
  }, [user.id])

  if (!hasPending) {
    return <Link href={href} className={className}>{children}</Link>
  }

  return (
    <Link
      href={href}
      className={`${className} relative rounded px-2 py-0.5`}
      style={{
        outline: "1.5px solid rgba(34,197,94,0.5)",
        outlineOffset: "2px",
        animation: "pulse-border 2s ease-in-out infinite",
      }}
    >
      {children}
    </Link>
  )
}
```

### 2. Add the pulse animation to `app/globals.css`

```css
@keyframes pulse-border {
  0%, 100% {
    outline-color: rgba(34, 197, 94, 0.5);
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
  50% {
    outline-color: rgba(34, 197, 94, 0.8);
    box-shadow: 0 0 6px 1px rgba(34, 197, 94, 0.2);
  }
}
```

### 3. Update `components/header.tsx`

Replace the plain Games nav link with the indicator component:

```tsx
import { PendingPredictionsIndicator } from "@/components/pending-predictions-indicator"

// In the nav, replace:
<Link href="/games" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display">
  Games
</Link>

// With:
{user ? (
  <Suspense fallback={
    <Link href="/games" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display">
      Games
    </Link>
  }>
    <PendingPredictionsIndicator
      user={user}
      href="/games"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display"
    >
      Games
    </PendingPredictionsIndicator>
  </Suspense>
) : (
  <Link href="/games" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display">
    Games
  </Link>
)}
```

Wrap in `<Suspense fallback={...}>` so the async fetch doesn't affect Radix
hydration — critical to prevent the existing header hydration mismatch issue.

---

## Notes on game-season relationship

Read the existing codebase to understand how games are linked to seasons. It may be:
- A `season_games` junction table
- A `season_id` column directly on `games`
- Games filtered by `release_date` within the season's date range

Adapt the query accordingly. The key check is:
```
unreleased games in active season WHERE player has no prediction row
```

---

## Design details

- **Border style**: `outline` rather than `border` so it doesn't affect layout
- **Color**: emerald `rgba(34,197,94,0.5)` — consistent with the prediction/window color
- **Animation**: slow 2s pulse between 50% and 80% opacity — subtle, not distracting
- **Radius**: small `rounded` (4px) so the border follows the text shape
- **No dot/badge**: just the border — keeps the nav clean and uncluttered
- **Falls back gracefully**: if the fetch fails or returns null, `hasPending` stays
  false and the plain link renders — no broken UI

---

## Verification
1. Player with unreleased games and no predictions → Games link has pulsing green border ✓
2. Player sets predictions for all upcoming games → border disappears ✓
3. No unreleased games in active season → no border ✓
4. No active season → no border ✓
5. Border disappears immediately after navigating to /games and saving a prediction
   (on next header render/refresh) ✓
6. No hydration mismatch errors — Suspense wrapper prevents ID shift ✓
7. Run `npx tsc --noEmit` — no errors ✓
