# Task: Integrate prediction data into game tiles on /games

## Context
Prognos is a Steam game prediction platform. The `/games` page shows a grid of game tiles.
Currently tiles show only the game image, name, and status badges. We want each tile to show
the player's current prediction data at a glance, eliminating the need for a separate /predictions page.

## Design Reference
Each game tile should have three zones:

```
┌──────────────────────────────────┐
│  [Game Header Image — 90px tall] │
├──────────────────────────────────┤
│  Game Name                       │  ← font-display (Cinzel)
│  [Released] [Season I]  📅 Mar 14│  ← badges left, date right
├──────────────────────────────────┤
│  PREDICTION BAND (see below)     │
└──────────────────────────────────┘
```

## Prediction Band States

### 1. Perfect (both metrics correct, scored)
- Band background: rgba(22,163,74,0.04), border-top: rgba(22,163,74,0.3)
- Tile border: #16a34a
- Left: two metric columns
  - Players: "✓ 299K" in text-emerald-400, window "269K–329K" in text-emerald-700/small
  - Reviews: "✓ 82%" in text-emerald-400, window "79%–85%" in text-emerald-700/small
- Right: "Perfect!" in text-emerald-400, mana icon + "+150" in text-cyan-300 below

### 2. Partial (one metric correct)
- Band background: rgba(202,138,4,0.04), border-top: rgba(202,138,4,0.3)
- Tile border: #ca8a04
- Correct metric: emerald, incorrect metric: amber (text-amber-400 val, text-amber-800 window)
- Show ✓ on correct, ✗ on incorrect
- Right: "Partial" in text-amber-400, mana earned in cyan below

### 3. Failed (neither correct, scored)
- Band background: secondary/muted
- Right: "Missed" in text-muted-foreground, "0 mana" in muted

### 4. Early locked, awaiting score
- Band background: rgba(251,191,36,0.03), border-top: rgba(251,191,36,0.25)
- Both metric values in text-amber-400 with ⚡ prefix
- Window ranges in text-amber-800/small
- Right: "Locked" in text-amber-400, "scoring soon" in muted/tiny below

### 5. Saved, not yet locked, upcoming game
- Band: default border/background (no tint)
- Both metric values in text-emerald-400 (no ✓/✗ yet)
- Right: "Saved" in muted, countdown "32d left" in muted/tiny below

### 6. No prediction yet
- Band: simple row, no tint
- Left: italic muted "No prediction yet"
- Right: small purple "Predict →" button/link (navigates to /games/[id])

## Data to Fetch

On the /games page server component, after fetching games, also fetch:

```ts
// Get current user's predictions for this season
const { data: predictions } = await supabase
  .from("predictions")
  .select(`
    game_id,
    players_midpoint,
    reviews_midpoint,
    players_window_low,
    players_window_high,
    reviews_window_low,
    reviews_window_high,
    early_locked_at,
    is_locked,
    result,
    players_correct,
    reviews_correct,
    final_points,
    scored_at
  `)
  .eq("user_id", user.id)
  .eq("season_id", activeSeason.id)
```

Build a map: `const predMap = Object.fromEntries(predictions.map(p => [p.game_id, p]))`

Pass `predMap` and `releaseDate` to each game card component.

## Release Date Display
- Show as calendar icon + short date: "Mar 14" or "Jun 19"
- Position: right side of the badges row
- Use: `new Date(game.release_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })`
- Show even for released games (historical context)

## Formatting Rules
- Player counts: use toLocaleString() — show "1.2M" for ≥1,000,000, "299K" for ≥1,000, "450" for <1,000
  - Helper: `function fmtPlayers(n) { if (n >= 1000000) return (n/1000000).toFixed(1)+'M'; if (n >= 1000) return Math.round(n/1000)+'K'; return String(n); }`
- Review scores: show as percentage "82%"
- Window ranges: show low–high in smaller muted text below the midpoint
- Mana earned: mana icon (img /icons/mana-icon.png, 11px) + "+N" in text-cyan-300

## Component Structure
The game card is likely in `components/game-card.tsx` or rendered inline in `app/(authenticated)/games/page.tsx`.
Read the current implementation first before making changes.

Add a `PredictionBand` sub-component (can be in the same file) that takes:
```ts
interface PredictionBandProps {
  prediction: PredictionData | null
  gameId: string
  isReleased: boolean
  releaseDate: string | null
}
```

## Styling Notes
- Font: font-display (Cinzel) for values and status labels, font-body (IM Fell English) for small descriptive text
- Tile border changes color to match result state — use Tailwind ring or border utilities
- The prediction band is always the bottom section of the tile, separated by a top border
- Keep the tile compact — the image stays 90px tall, total tile height should be reasonable for a grid
- All colors follow the project color system:
  - Emerald = correct predictions / windows
  - Amber = early lock / boosters / incorrect metrics
  - Cyan = mana values
  - Purple (#9D84D4) = brand accent / "Predict →" CTA

## What NOT to change
- The game image, name, and badge layout above the prediction band
- The click behavior of the tile (should still navigate to /games/[id])
- The tab system (Active Season / Past Seasons / All) on /games
- The three-column prediction card on /games/[id] — this is the full detail view

## Verification
After implementing, check:
1. A game with no prediction shows "No prediction yet" + "Predict →"
2. A scored Perfect prediction shows ✓ on both metrics, green border, mana earned
3. A scored Partial shows ✓ on correct metric, ✗ + amber on incorrect metric
4. An early-locked unscored prediction shows ⚡ amber values, "Locked" status
5. An upcoming game with a saved prediction shows values in emerald, countdown to release
6. Release date appears on all tiles in the top-right of the meta row
7. No TypeScript errors (run npx tsc --noEmit)
8. No hydration mismatch errors (data is fetched server-side and passed as props)
