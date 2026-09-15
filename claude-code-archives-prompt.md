# Task: Build /archives page

## Overview
Create a new page at `app/(authenticated)/archives/page.tsx` that shows:
1. The **current active season's leaderboard** — fully expanded and visible
2. **Previous seasons** — listed as collapsed accordion items, expand on click to
   reveal that season's final leaderboard and top 8 ladder results

The nav link to `/archives` already exists in the header — only the page needs building.

---

## Page structure

```
/archives

┌─────────────────────────────────────────┐
│  Archives                               │
│  Season leaderboards and top 8 results  │
├─────────────────────────────────────────┤
│                                         │
│  ▼ Season I  (active — expanded)        │
│  ┌───────────────────────────────────┐  │
│  │ Leaderboard                       │  │
│  │  #1  WizardAlex       3,250 mana  │  │
│  │  #2  ProphetJane      2,800 mana  │  │
│  │  #3  OracleKev        2,100 mana  │  │
│  │  ...                              │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ▶ Season II  (completed — collapsed)   │
│  ▶ Season III (completed — collapsed)   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Data to fetch

```ts
// 1. All seasons ordered by start_date descending
const { data: seasons } = await supabase
  .from("seasons")
  .select("id, name, status, start_date, end_date")
  .order("start_date", { ascending: false })

// 2. For EACH season, leaderboard data:
const { data: entries } = await supabase
  .from("season_entries")
  .select(`
    user_id,
    prediction_mana_earned,
    profiles:user_id (
      display_name,
      avatar_url
    )
  `)
  .eq("season_id", season.id)
  .order("prediction_mana_earned", { ascending: false })
  .limit(50)  // top 50 per season

// 3. For COMPLETED seasons only, top 8 ladder results:
const { data: ladderResults } = await supabase
  .from("ladder_rankings")
  .select(`
    user_id,
    ranked_games,
    total_mana,
    binary_mana,
    sequence_mana,
    profiles:user_id (display_name)
  `)
  .eq("season_id", season.id)
  .order("total_mana", { ascending: false })
  .limit(10)
```

Fetch all seasons server-side, but only fetch entries for the active season upfront.
Past season data can be fetched client-side when the accordion is expanded (avoids
loading all historical data on page load).

---

## Component architecture

### Server component — `app/(authenticated)/archives/page.tsx`
Fetches active season + its leaderboard entries upfront. Passes seasons list and
active season data to the client component.

### Client component — `components/archives-client.tsx`
Handles accordion state and lazy-fetches past season data on expand.

```tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

interface ArchivesClientProps {
  seasons: Season[]
  activeSeason: Season | null
  activeSeasonEntries: SeasonEntry[]
}

export function ArchivesClient({ seasons, activeSeason, activeSeasonEntries }: ArchivesClientProps) {
  // Active season always expanded, past seasons collapsed by default
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(activeSeason ? [activeSeason.id] : [])
  )
  const [pastData, setPastData] = useState<Record<string, SeasonEntry[]>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())

  async function toggleSeason(seasonId: string, status: string) {
    if (expanded.has(seasonId)) {
      setExpanded(prev => { const s = new Set(prev); s.delete(seasonId); return s })
      return
    }
    setExpanded(prev => new Set([...prev, seasonId]))

    // Lazy fetch past season data if not already loaded
    if (status !== "active" && !pastData[seasonId]) {
      setLoading(prev => new Set([...prev, seasonId]))
      const supabase = createClient()
      const { data: entries } = await supabase
        .from("season_entries")
        .select(`user_id, prediction_mana_earned, profiles:user_id(display_name, avatar_url)`)
        .eq("season_id", seasonId)
        .order("prediction_mana_earned", { ascending: false })
        .limit(50)
      setPastData(prev => ({ ...prev, [seasonId]: entries ?? [] }))
      setLoading(prev => { const s = new Set(prev); s.delete(seasonId); return s })
    }
  }

  // ... render
}
```

---

## Leaderboard table design

```
┌────────────────────────────────────────────────┐
│  Rank  Player              Mana Earned  Perfect │
│  ─────────────────────────────────────────────  │
│  #1 🥇  WizardAlex         3,250 🔮     12      │
│  #2 🥈  ProphetJane        2,800 🔮     9       │
│  #3 🥉  OracleKev          2,100 🔮     7       │
│  #4     SeerMike           1,900 🔮     6       │
│  ...                                            │
│  (current user row highlighted if in list)      │
└────────────────────────────────────────────────┘
```

### Columns
- **Rank** — #1, #2, #3... with medal emoji for top 3 (🥇🥈🥉)
- **Player** — avatar (AvatarFallback if no image) + display_name
- **Mana Earned** — `prediction_mana_earned` with mana icon, in cyan
- **Perfect** — count of perfect predictions (query separately or join from leaderboards table)

### Styling
- Current user's row: subtle purple highlight `bg-purple-950/30 border-l-2 border-purple-500`
- Top 3 rows: slightly brighter text
- Font: `font-display` (Cinzel) for rank numbers and mana values, regular for names
- Alternating row background: very subtle `even:bg-white/[0.02]`
- Compact rows — this is a list, not cards

### "No entries yet" state
For the active season early on:
```
No predictions have been scored yet this season.
Check back after the first games release!
```

---

## Accordion header design

```
┌──────────────────────────────────────────────┐
│  ▼  Season I   ·  Active  ·  14 players      │
└──────────────────────────────────────────────┘
```

- Season name in `font-display`
- Status badge: Active (emerald) / Completed (muted) / Scoring (amber)
- Player count: "N players" in muted small text
- Chevron rotates on expand/collapse
- Active season: cannot be collapsed (always open) OR can be collapsed but defaults open
- Completed seasons: collapsed by default, expand on click

---

## Past season extras (completed seasons only)

When a past season is expanded, show TWO tabs within it:
1. **Leaderboard** — the prediction mana leaderboard (same format as above)
2. **Top 8 Ladder** — the final season ladder results

### Top 8 Ladder tab
Shows the top ladder performers — who had the most accurate season ranking:

```
┌────────────────────────────────────────────────┐
│  Player          Ladder Mana  Binary  Sequence  │
│  ───────────────────────────────────────────── │
│  WizardAlex      700 🔮       +350    +350      │
│  ProphetJane     350 🔮       +200    +150      │
└────────────────────────────────────────────────┘
```

Only show this tab for `status === "completed"` seasons since ladder scoring
runs at season end. For active seasons just show the leaderboard.

---

## File structure to create

```
app/(authenticated)/archives/
  page.tsx              ← server component, fetches active season data
components/
  archives-client.tsx   ← client component, accordion + lazy fetch
```

---

## Styling notes
- Page follows the same layout as other authenticated pages: `container py-6`
- Section heading: `font-display text-3xl` matching other page titles
- Accordion items: `border border-border rounded-xl overflow-hidden mb-3`
- Accordion header: `p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02]`
- Expanded content: `border-t border-border`
- No external accordion library needed — implement with simple `useState` + conditional render

---

## Verification
1. `/archives` loads without error ✓
2. Active season is expanded by default showing leaderboard ✓
3. Completed seasons are collapsed, expand on click ✓
4. Expanding a past season triggers a loading state then shows the leaderboard ✓
5. Current user's row is highlighted in the leaderboard ✓
6. Top 3 rows show medal emojis ✓
7. Completed seasons show a "Top 8 Ladder" tab alongside "Leaderboard" ✓
8. Nav link "Archives" in header navigates correctly ✓
9. Run `npx tsc --noEmit` — no errors ✓
