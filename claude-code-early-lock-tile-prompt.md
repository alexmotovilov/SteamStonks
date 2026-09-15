# Task: Differentiate early lock from release lock on /games game tiles

## Bug
On the /games page, game tiles show the same locked state ("Locked · scoring soon")
for two distinct situations:
1. **Early locked** — player voluntarily early locked their prediction, game not yet released
2. **Release locked** — game has launched, prediction automatically locked

These should look and say different things. The early lock state should communicate
that the player can still use Temporal Translocation to undo it.

---

## Current state logic (in `components/games-tabs.tsx` or equivalent)

The prediction band state priority should already have these cases. Find where
`state === "locked"` or `state === "early_locked"` is determined and ensure they
are handled separately.

Correct priority order:
```ts
// 1. Scored
if (prediction?.scored_at && prediction?.result) → "scored"

// 2. Release locked (game is out, awaiting score)
if (prediction?.is_locked || game.is_released) → "release_locked"

// 3. Early locked (player chose to lock, game not yet out)
if (prediction?.early_locked_at && !game.is_released) → "early_locked"

// 4. Saved, upcoming
if (prediction && !game.is_released) → "saved"

// 5. No prediction, game released
if (!prediction && game.is_released) → "closed"

// 6. No prediction, upcoming
→ "no_prediction"
```

---

## UI changes

### Early locked state (player-initiated, game not yet released)
```
┌─────────────────────────────────────────────┐
│  ⚡ 450K        ⚡ 91%        Early Locked   │
│  405K–495K    88%–94%    Temporal available │
└─────────────────────────────────────────────┘
```
- Values: amber `⚡` prefix, amber text — same as current
- Status label: **"Early Locked"** in `text-amber-400` font-display
- Subtext below status: **"Temporal available"** in `text-amber-600/70` tiny text
  — hints that Temporal Translocation can undo this
- Band background: `rgba(251,191,36,0.03)` amber tint — same as current
- Countdown timer still shows below (time until release)

### Release locked state (game launched, awaiting score)
```
┌─────────────────────────────────────────────┐
│  🔒 450K        🔒 91%       Locked         │
│  405K–495K    88%–94%    scoring soon       │
└─────────────────────────────────────────────┘
```
- Values: 🔒 prefix (or just show values without prefix), muted text
  — no longer amber since the player can't do anything about it
- Status label: **"Locked"** in `text-muted-foreground` font-display
- Subtext: **"scoring soon"** in muted tiny text
- Band background: `rgba(255,255,255,0.02)` neutral — NOT amber tint
- No countdown timer (game already released)

---

## Exact text changes

| State | Status label | Subtext | Values color |
|-------|-------------|---------|-------------|
| `early_locked` | "Early Locked" | "Temporal available" | `text-amber-400` with ⚡ |
| `release_locked` | "Locked" | "scoring soon" | `text-muted-foreground` |

---

## Data requirements

Make sure the prediction query in `app/(authenticated)/games/page.tsx` includes
`early_locked_at` — it's needed to distinguish the two states:

```ts
.select(`
  game_id,
  players_midpoint, reviews_midpoint,
  players_window_low, players_window_high,
  reviews_window_low, reviews_window_high,
  early_locked_at,    ← must be present
  is_locked,
  result, players_correct, reviews_correct,
  final_points, scored_at,
  actual_player_count, actual_review_score,
  ao_marked
`)
```

The logic to distinguish:
```ts
const isEarlyLocked = !!prediction?.early_locked_at && !game.is_released
const isReleaseLocked = game.is_released && !prediction?.scored_at
```

---

## Verification
1. A prediction with `early_locked_at` set, game not yet released →
   shows "Early Locked" in amber, "Temporal available" subtext, amber ⚡ values ✓
2. A game that has released with a locked prediction (not yet scored) →
   shows "Locked" in muted, "scoring soon" subtext, muted values ✓
3. These two states have visually distinct band backgrounds (amber tint vs neutral) ✓
4. Early lock state still shows countdown timer to release ✓
5. Release lock state shows no countdown (game already out) ✓
6. Run `npx tsc --noEmit` — no errors ✓
