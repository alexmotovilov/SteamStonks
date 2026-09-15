# Task: Fix game tile prediction band state logic on /games

## Two bugs to fix

### Bug 1 — Scored predictions showing as "Saved" instead of scored result
Predictions for games that released more than 7 days ago are showing "Saved" with
the player's midpoint values in emerald, as if they are still pending. They should
be showing Perfect / Partial / Missed with actual values and mana earned.

### Bug 2 — "Predict →" CTA showing for games where predictions are locked
A game that released more than 7 days ago (and therefore has a locked prediction
window) is showing "No prediction yet" with a "Predict →" button, despite the
fact that the prediction window is closed and no new predictions can be made.
It should show a locked/closed state instead.

---

## Root cause investigation

Read `components/games-tabs.tsx` (or wherever the game tile prediction band logic lives)
and `app/(authenticated)/games/page.tsx` carefully before making any changes.

The likely causes are:

### Bug 1
The `PredictionBand` component is probably checking `prediction.scored_at` or
`prediction.result` to determine if scored, but one of these is null/undefined
because the score-calculator cron hasn't run yet OR the component is checking the
wrong condition. Verify the state priority order is:

```
1. scored_at is not null AND result is not null → show scored state (Perfect/Partial/Missed)
2. is_locked is true → show "Locked · awaiting score"
3. early_locked_at is not null → show "Early Locked · awaiting score"
4. prediction exists, game not released → show "Saved" with countdown
5. prediction exists, game released but <7 days → show "Saved · scoring soon"
6. no prediction, game released >7 days → show "Closed" (not "Predict →")
7. no prediction, game not released → show "Predict →"
```

### Bug 2
The "No prediction yet" / "Predict →" state is being shown without checking
whether the game has already passed the prediction lock window. A game that is
released (or released more than 7 days ago) should never show "Predict →".

The correct check for whether predictions are still open:
```ts
const predictionsClosed = game.is_released  // once released, window is locked
// OR more precisely:
const daysSinceRelease = game.release_date
  ? Math.floor((Date.now() - new Date(game.release_date).getTime()) / 86400000)
  : 0
const predictionsClosed = game.is_released && daysSinceRelease >= 0
```

---

## Correct state logic to implement

In the `PredictionBand` component (or wherever state is determined), use this priority:

```ts
function getPredictionState(prediction, game) {
  const isReleased = game.is_released

  // 1. Scored
  if (prediction?.scored_at && prediction?.result) {
    return { state: "scored", result: prediction.result }
  }

  // 2. Hard locked (released, awaiting score)
  if (prediction?.is_locked || isReleased) {
    return { state: "locked" }
  }

  // 3. Early locked
  if (prediction?.early_locked_at) {
    return { state: "early_locked" }
  }

  // 4. Saved prediction, game not yet released
  if (prediction) {
    return { state: "saved" }
  }

  // 5. No prediction — check if window is still open
  if (isReleased) {
    return { state: "closed" }  // window closed, no prediction made
  }

  // 6. No prediction, game upcoming
  return { state: "no_prediction" }
}
```

## "Closed" state UI (new state for Bug 2)
When `state === "closed"` (released game, no prediction made):
```
┌─────────────────────────────────┐
│  — —        —%    Closed        │  ← muted dashes for values
│  no data   no data  missed window│  ← small muted subtext
└─────────────────────────────────┘
```
- Show dashes "—" instead of values
- Status text: "Closed" in `text-muted-foreground`
- Subtext: "prediction window passed" in muted/tiny
- No "Predict →" button
- No colored border tint

## Data requirements
Make sure the prediction query in `games/page.tsx` includes all needed fields:
```ts
.select(`
  game_id,
  players_midpoint, reviews_midpoint,
  players_window_low, players_window_high,
  reviews_window_low, reviews_window_high,
  early_locked_at, is_locked,
  result, players_correct, reviews_correct,
  final_points, scored_at,
  actual_player_count, actual_review_score
`)
```

Note: `actual_player_count` and `actual_review_score` are needed to show actual
values on scored tiles (not just the predicted midpoints).

## Verification checklist
After implementing, verify all states render correctly:

1. Game released >7 days ago, prediction scored Perfect → green border, ✓ on both,
   actual player count shown, mana earned in cyan
2. Game released >7 days ago, prediction scored Partial → amber border, ✓ on correct,
   ✗ on incorrect, actual values shown
3. Game released, prediction not yet scored → "Locked · awaiting score" in amber
4. Game released, NO prediction made → "Closed" state, no Predict button, no colored border
5. Game upcoming, prediction saved → "Saved" in muted, countdown to release
6. Game upcoming, NO prediction → "Predict →" CTA in purple
7. Run `npx tsc --noEmit` — no new errors
