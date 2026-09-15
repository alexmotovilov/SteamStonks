# Task: Rename "prediction mana earned" to "Season Score" throughout the codebase

## Overview
The current dual-mana system is confusing. Rename to make the distinction clear:

| Old name | New name | What it is |
|----------|----------|------------|
| `prediction_mana_earned` | `season_score` | Leaderboard ranking value, only accumulates, never decreases |
| `mana_balance` | `mana_balance` | Spendable wallet, can increase/decrease. Unchanged. |

The mana icon (🔮 `/icons/mana-icon.png`) is ONLY used with `mana_balance`.
Season score uses a different visual — a trophy or star icon, or plain text with
no icon. Color: keep using the existing purple `#9D84D4` or a distinct gold color.
Do NOT use the cyan mana icon alongside season score values anywhere.

In scoring result displays, both values appear side by side but are distinct:
```
+125 🔮 mana    +125 ★ score
     ↑ cyan          ↑ gold/purple, different icon
```

---

## Database changes

### Rename column in `season_entries`
```sql
ALTER TABLE public.season_entries
  RENAME COLUMN prediction_mana_earned TO season_score;
```

### Update any views or functions that reference `prediction_mana_earned`
Run this in Supabase SQL editor to find references:
```sql
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition ILIKE '%prediction_mana_earned%';
```

Update `increment_season_mana` RPC and any other functions to use `season_score`.

### Update `leaderboards` table if it has a `prediction_mana_earned` column
```sql
ALTER TABLE public.leaderboards
  RENAME COLUMN prediction_mana_earned TO season_score;
-- (only if column exists)
```

---

## Season score icon

Add a season score icon to use in place of the mana icon. Use the Trophy lucide
icon OR a simple star `★` character styled in gold:

```tsx
// Option A — Lucide Trophy icon
import { Trophy } from "lucide-react"
<Trophy className="h-3.5 w-3.5 text-amber-500" />

// Option B — Unicode star styled in gold (simpler, no import needed)
<span className="text-amber-500 text-xs leading-none">★</span>
```

Use Option A (Trophy) for consistency with lucide icons used elsewhere.
Color: `text-amber-500` — distinct from cyan mana and purple brand.

Create a reusable `ScoreIcon` component in `components/score-icon.tsx`:
```tsx
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

export function ScoreIcon({ size = 14, className }: { size?: number; className?: string }) {
  return <Trophy className={cn(`h-[${size}px] w-[${size}px] text-amber-500 shrink-0`, className)} />
}
```

---

## Files to update

### 1. All Supabase queries selecting `prediction_mana_earned`
Search for `prediction_mana_earned` across all `.ts` and `.tsx` files and
rename to `season_score`. Key files likely include:

- `app/(authenticated)/archives/page.tsx` or `components/archives-client.tsx`
- `components/season-points-badge.tsx` — currently shows leaderboard score
  (if this was reading `prediction_mana_earned` rename the query field)
- `components/season-rank-badge.tsx` — rename column reference
- `app/(authenticated)/dashboard/page.tsx`
- `app/api/cron/score-calculator/route.ts` — where `increment_season_mana` is called
- `lib/scoring.ts` — any interface with `prediction_mana_earned`

### 2. `components/season-points-badge.tsx`
This badge currently shows the spendable `mana_balance` in the header (cyan).
Verify it is reading from `mana_balance` NOT `prediction_mana_earned`.
If it was incorrectly reading `prediction_mana_earned`, fix it to read `mana_balance`.

### 3. `components/season-rank-badge.tsx`
Currently computes rank by comparing `prediction_mana_earned` values.
Rename to `season_score` in the query:
```ts
.select("season_score")  // was prediction_mana_earned
.gt("season_score", entry.season_score ?? 0)  // was prediction_mana_earned
```

The badge display currently shows "N,NNN mana" below the rank — change to "N,NNN pts":
```tsx
<span className="font-display text-[10px] text-muted-foreground leading-tight">
  {(entry.season_score ?? 0).toLocaleString()} pts
</span>
```

### 4. Scoring result displays (mailbox, prediction card scored state)

Wherever a scoring result shows mana earned, display BOTH values side by side:
```
+125 🔮 mana    +125 ★ score
```

In `components/prediction-form.tsx` scored card:
```tsx
<div className="flex items-center gap-4">
  <div className="flex items-center gap-1">
    <ManaIcon size={13} />
    <span className="text-cyan-300 font-bold text-xs">+{totalMana} mana</span>
  </div>
  <div className="flex items-center gap-1">
    <Trophy className="h-3 w-3 text-amber-500" />
    <span className="text-amber-400 font-bold text-xs">+{totalMana} score</span>
  </div>
</div>
```

Note: the values are identical (1:1 ratio) but displayed as distinct labels.

In scoring mail messages (`components/mailbox-client.tsx`), update the mana
breakdown section to show both at the end:
```
Total mana earned:   +243 🔮
Season score gained: +243 ★
```

### 5. `/archives` page
The leaderboard currently shows "mana earned" column header and values.
Rename:
- Column header: "Season Score" (not "Mana Earned")
- Values: show `Trophy` icon + number + "pts" (not mana icon)
- The rank badge subtext: "N,NNN pts" (already covered above)

### 6. Dashboard page
Any display of `prediction_mana_earned` or leaderboard score:
- Label: "Season Score" (not "Season Mana" or "Prediction Mana")
- Icon: `Trophy` in amber (not mana icon)
- Value display: "N,NNN pts" or just the number

### 7. `increment_season_mana` RPC (if named confusingly)
The RPC function name `increment_season_mana` can stay as-is (it's a backend
function name). But its internal reference to `prediction_mana_earned` must
be updated to `season_score` after the column rename.

---

## Display conventions summary

| Context | Mana | Season Score |
|---------|------|-------------|
| Icon | ManaIcon (cyan orb) | Trophy (amber) |
| Color | `text-cyan-300` | `text-amber-500` |
| Unit label | "mana" | "pts" or "score" |
| Header badge (rank) | n/a | "#N · N,NNN pts" |
| Scored prediction | "+N 🔮 mana" | "+N ★ score" |
| Leaderboard column | n/a | "Season Score" |
| Mailbox breakdown | "+N mana" | "+N score" |

---

## Search and replace reference

Run a global search for these strings and rename as indicated:

| Find | Replace with |
|------|-------------|
| `prediction_mana_earned` | `season_score` |
| `predictionManaEarned` | `seasonScore` |
| `Season Mana` (when referring to leaderboard score, NOT spendable balance) | `Season Score` |
| `mana earned` (in leaderboard/score contexts) | `score` or `season score` |
| `Mana Earned` (column header) | `Season Score` |

Do NOT rename:
- `mana_balance` — stays as-is
- `add_mana_balance` RPC — stays as-is
- `deduct_mana` RPC — stays as-is
- Any UI label referring to spendable mana balance

---

## Verification
1. Supabase `season_entries.season_score` column exists, `prediction_mana_earned` gone ✓
2. Score calculator writes to `season_score` correctly ✓
3. Header mana badge (cyan) still shows `mana_balance` ✓
4. Header rank badge shows "#N · N,NNN pts" with Trophy icon ✓
5. Scored prediction card shows "+N mana" (cyan) AND "+N score" (amber) separately ✓
6. Archives leaderboard column says "Season Score" with Trophy icon ✓
7. Dashboard shows "Season Score" card with Trophy icon, not mana icon ✓
8. Mana icon never appears next to season score values ✓
9. `npx tsc --noEmit` — no errors ✓
