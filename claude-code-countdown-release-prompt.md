# Task: Countdown timers on game tiles + release date handling improvements

## Feature 1 — Countdown timer on upcoming game tiles in /games

### What to add
Upcoming game tiles (games where `is_released = false`) should show a live
countdown timer in the prediction band where the "Xd left" static text currently
appears. The countdown should tick in real time.

### Implementation
The countdown belongs in the `PredictionBand` or `GamesTabs` client component
(since it requires `useEffect` + `setInterval`, it must be in a client component).

Add a `CountdownTimer` sub-component:

```tsx
"use client"

function CountdownTimer({ releaseDate }: { releaseDate: string }) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    function compute() {
      const diff = new Date(releaseDate).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft("releasing now")
        return
      }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)

      if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`)
      else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`)
      else setTimeLeft(`${m}m ${s}s`)
    }

    compute()
    const t = setInterval(compute, 1000)
    return () => clearInterval(t)
  }, [releaseDate])

  return (
    <span className="font-display text-[9px] text-muted-foreground/50 tabular-nums">
      {timeLeft}
    </span>
  )
}
```

Use `tabular-nums` so the digits don't cause layout shift as numbers change.

Show seconds only when under 1 hour remaining (adds urgency without being noisy
for games that are weeks away).

### Where to render
In the prediction band for upcoming games — replace the static "Xd left" text:
- "Saved" state → show CountdownTimer to the right of "Saved"
- "No prediction" state → show CountdownTimer to the right of "No prediction yet"
- Released games → no countdown (show nothing or "Released" date)

---

## Feature 2 — Release date precision and early lock timing

### Problem
Steam's public API (`/api/appdetails`) returns release dates as human-readable
strings (e.g. `"19 May, 2025"`) with NO time component. This causes two issues:

1. **Off-by-one day** — Steam sometimes reports the date in the developer's local
   timezone which can differ from UTC, causing games to appear as releasing a day
   early or late.

2. **Midnight lock** — The steam-collector marks `is_released = true` when
   `current_date >= release_date`, which triggers at UTC midnight rather than the
   actual launch time. For example, Deep Rock Galactic: Rogue Core showed release
   date 5/19 but actually launched at 11am on 5/20.

### Fix A — Store release date as end-of-day rather than start-of-day
When the steam-collector writes `release_date` to the DB, add 23 hours to the
stored timestamp so that `is_released` doesn't trigger until the end of the
release day rather than the start. This gives a buffer for games that release
in the afternoon/evening:

In `app/api/cron/steam-collector/route.ts`, find where `release_date` is written
and adjust:

```ts
// Current — stores as midnight of release date
const releaseDate = new Date(steamData.release_date.date)

// Better — store as end of release day (23:59 UTC)
const releaseDate = new Date(steamData.release_date.date)
releaseDate.setUTCHours(23, 59, 59, 0)
const releaseDateStr = releaseDate.toISOString()
```

### Fix B — Add a `release_time_utc` admin override field
For games where the exact launch time is known (e.g. from the developer's Steam
page or press release), allow admins to set an explicit UTC launch time that
overrides the Steam API date.

Add a nullable `release_time_override` column to the `games` table:
```sql
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS release_time_override timestamptz;
```

In the steam-collector, when checking `is_released`:
```ts
const effectiveReleaseDate = game.release_time_override
  ? new Date(game.release_time_override)
  : releaseDateFromSteam

if (new Date() >= effectiveReleaseDate) {
  // mark as released
}
```

In the admin game management page, add a "Release Time Override" datetime input
that allows admins to set the exact UTC release time for a game.

### Fix C — Countdown timer uses override if available
The `CountdownTimer` component should use `release_time_override` if present,
falling back to `release_date`:

```ts
const targetDate = game.release_time_override ?? game.release_date
```

Pass both fields through from the server query to the game tile component.

---

## Data requirements

### Games query in `app/(authenticated)/games/page.tsx`
Ensure `release_time_override` is included in the games select:
```ts
.select(`
  id, name, steam_appid, header_image_url,
  is_released, release_date,
  release_time_override,   ← add this
  peak_24h_player_count,
  review_positive, review_negative
`)
```

### Pass to game tile / GamesTabs
Add `releaseTimeOverride?: string | null` to the game tile props and pass it
through to `CountdownTimer`.

---

## Priority order
Implement in this order:
1. Fix A (end-of-day release date) — quick win, prevents future early locks
2. CountdownTimer component — visible user-facing feature
3. Fix B (admin override) — requires DB migration, do last

Run the migration for Fix B:
```sql
ALTER TABLE public.games
ADD COLUMN IF NOT EXISTS release_time_override timestamptz;
```

---

## Verification
1. An upcoming game tile shows a live countdown ticking in real time ✓
2. Countdown shows "Xd Xh Xm" for games more than 1 hour away ✓
3. Countdown shows "Xm Xs" for games under 1 hour away ✓
4. Released games show no countdown ✓
5. In Supabase, a game with `release_time_override` set uses that time for
   the countdown instead of `release_date` ✓
6. Admin page has a datetime input for `release_time_override` ✓
7. Steam-collector stores release dates at 23:59 UTC rather than 00:00 ✓
8. Run `npx tsc --noEmit` — no errors
