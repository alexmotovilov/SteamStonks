# Prognos — Developer Context

## Project Overview

**Prognos** (formerly SteamStonks) is a seasonal Steam game prediction platform with RPG/arcane aesthetics. Players predict upcoming PC game performance metrics, earn mana through accuracy, and compete on a season leaderboard.

- **Stack:** Next.js (App Router) + Supabase + Stripe + Vercel Pro
- **GitHub:** alexmotovilov/SteamStonks
- **Local dev:** Windows (Alex's machine)
- **Shorthand:** PGS

---

## Commands

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npx tsc --noEmit   # Type check
```

---

## Architecture

### Directory Structure
```
app/
  (authenticated)/     # Protected routes — layout reads user + profile from Supabase
    dashboard/
    games/[id]/        # Game detail + prediction card
    games/             # Games list with Active Season / Past Seasons / All tabs
    predictions/       # Player's prediction history
    leaderboard/
    admin/             # Admin tools (users, seasons, games)
  auth/                # Login, sign-up, error, success pages
  api/
    cron/
      steam-collector/route.ts   # Runs every 30 min — fetches Steam data
      score-calculator/route.ts  # Runs daily at 07:00 UTC — scores predictions
    predictions/
      boosters/route.ts          # Consume/return inventory on save
    rites/
      augury/route.ts            # Ritual of Augury heatmap data
    seasons/
      join/starter-kit/route.ts  # Awards 3 starter items on season join
components/
  header.tsx                # Sticky header — logo, nav, mana badge, avatar dropdown
  prediction-form.tsx       # Three-column prediction card (main game UI)
  prediction-form-client.tsx # Dynamic import wrapper (ssr: false)
  gem-slider.tsx            # Custom SVG slider with trilliant gem thumb
  mana-icon.tsx             # Plain <img> for /icons/mana-icon.png
  season-points-badge.tsx   # Header mana balance badge (client-side fetch)
lib/
  scoring.ts                # Window math, booster/equipment resolvers, early lock
  ladder-scoring.ts         # LCS algorithm, AO scoring, Augury heatmap generator
  supabase/
    client.ts               # Browser Supabase client
    server.ts               # Server Supabase client
public/
  icons/
    game-name-logo.png          # Combined pentagram + "Prognos" wordmark (transparent bg)
    game-logo.png               # Pentagram only
    mana-icon.png               # Three-orb cyan swirl
  rites/
    ritual-of-augury.png
    eldritch-wager.png
    sigil-of-multiplicity.png
    temporal-translocation.png
    auspicious-omens.png
  items/                    # Booster artwork (one PNG per slug)
  background.png            # Wizard at PC — D&D illustration style
```

---

## Database (Supabase, live)

### Key Tables

**profiles**
- `id`, `display_name`, `avatar_url`, `token_balance`, `is_admin`, `is_banned`
- No mana columns — mana lives on `season_entries`

**season_entries**
- `user_id`, `season_id`, `equipment_id`, `prediction_mana_earned`, `mana_balance`
- `equipment_tier_score`, `stipend_week_number`, `starter_kit_claimed`
- `first_prediction_bonus_claimed`, `tokens_paid`
- `mana_balance` = spendable wallet (shown in header badge)
- `prediction_mana_earned` = leaderboard score (never decreases)

**predictions**
- `week_one` type only
- Key columns: `players_midpoint`, `reviews_midpoint`, `players_window_low/high`, `reviews_window_low/high`
- `early_locked_at`, `is_locked`, `result` (perfect/partial/failed)
- `players_correct`, `reviews_correct`, `actual_player_count`, `actual_review_score`
- `mana_players`, `mana_reviews`, `mana_both_bonus`, `mana_early_lock`
- `mana_boosters`, `mana_equipment`, `mana_first_prediction`
- `drops_awarded`, `final_points`, `scored_at`
- `applied_boosters` (string[]), `applied_rites` (jsonb), `ao_marked`

**items**
- `slug`, `name`, `item_type` (booster/equipment), `image_url`
- `drop_rate`, `is_droppable`, `is_vendored`, `vendor_price`, `vendor_weekly_limit`
- `carry_over_limit`, `effects` (jsonb), `description`

**inventory**
- `user_id`, `item_id`, `quantity` (per-player booster stock, max 999)

**ladder_rankings**
- `user_id`, `season_id`, `ranked_games` (jsonb UUID array, top 8)
- `locked_game_ids[]`, `binary_mana`, `sequence_mana`, `sequence_length`, `total_mana`

**seasons**
- `current_vendor_week`, `current_vendor_cycle` (A/B), `last_vendor_reset_at`

**Other:** `vendor_purchases`, `rite_history`, `drop_history`, `leaderboards`, `game_snapshots`

### RPC Functions
- `increment_season_mana(user_id, season_id, mana, tier_increment, claim_first)`
- `increment_inventory(user_id, item_id)`
- `deduct_mana(user_id, season_id, amount) → boolean`
- `consume_inventory_item(user_id, item_id, quantity) → boolean`
- `add_weekly_stipend(user_id, season_id, amount, week_number)`
- `lock_ladder_game(user_id, season_id, game_id)`

---

## Game Design

### Prediction Metrics (week-one)

**Element 1 — Highest Player Count (Week 1)**
- Metric: MAX(player_count) across all Steam snapshots in 7 days post-release
- Slider: log scale (min 100, max 2,000,000), trilliant-cut emerald gem thumb
- Window: ±10% of midpoint (boosters/equipment can adjust)

**Element 2 — % Positive Reviews (Week 1)**
- Metric: most recent review snapshot in 7-day window
- Slider: linear 0–100%
- Window: ±3 fixed (boosters/equipment can adjust)

**Element 3 — Season Ladder**
- Drag-to-rank top 8 games by predicted highest all-time peak players
- Displayed as right column of prediction card

### Scoring

| Result | Condition | Mana |
|--------|-----------|------|
| Perfect | Both correct | +50 players +50 reviews +50 bonus = 150 base |
| Partial | One correct | +50 base |
| Failed | Neither correct | 0 base |

- Early lock: linear 0–25 mana over 2 weeks before release
- First prediction bonus: +50 mana (one-time per season)
- Boosters/equipment/rites add on top regardless of result (guaranteed)
- Drops: Perfect = 2 drops, Partial = 1 drop (plus equipment bonuses)

### Mana Dual-Tracking
- `prediction_mana_earned` → leaderboard score, never decreases
- `mana_balance` → spendable wallet, decreases when spent on vendor/rites
- Weekly stipend: +15 mana to `mana_balance` only (not leaderboard)

### Ladder Scoring (season-end)
- Binary: +50 mana per exact rank match
- Sequence (LCS): 2=+50, 3=+100, 4=+150, 5=+250, 6=+350, 7=+500, 8=+700
- Auspicious Omens: mark games for top 8, all-or-nothing escalating reward (max 920)

---

## Items

### Boosters (consumed on save, max 2 slots default)

| Slug | Effect | Drop Rate | Vendor |
|------|--------|-----------|--------|
| `scrying_orb_polish` | Players window +10% | 26% | Week A, 15 mana |
| `crystal_focus` | Reviews window +2 | 20% | Week B, 20 mana |
| `evocation_distillate` | +25 mana total reward | 25% | Drop only |
| `thaumaturgic_concentrate` | +50 mana total reward | 5% | Drop only |
| `blood_bargain` | Reviews window +3, -15 mana reward | 10% | Week A, 30 mana |
| `black_gem_accumulator` | Players window -5%, +75 mana if players correct | 11% | Week B, 20 mana |
| `infernal_patrons_pact` | Reviews window -1, +1 drop total reward | 12% | Week A, 25 mana |
| `tincture_of_divination` | Players +10%, Reviews +5 | Vendor only | Week B, 75 mana |

### Equipment (season-bound, chosen on join)

| Slug | Tier 0-2 | Tier 3-5 | Tier 6+ |
|------|----------|----------|---------|
| `seers_spectacles` | Players window +5% | Players window +10% | Players window +10%, +25 mana if players correct |
| `arcanum_esoterica` | +15 mana both correct | +25 mana both correct | +50 mana both correct |
| `clockwork_familiar` | +1 drop if players correct | +1 booster slot | +2 drops total reward |

Tier increments on every Perfect or Partial prediction.

### Rites (mana cost, per-prediction)

| Rite | Cost | Effect |
|------|------|--------|
| Ritual of Augury | 10 mana | Heatmap overlay on sliders for 2 min (crowd distribution) |
| Eldritch Wager | 30 mana | +25 mana per correct metric, +25 if both |
| Sigil of Multiplicity | 50 mana | +1 booster slot for this prediction |
| Temporal Translocation | 100 mana | Unlock early-locked prediction (resets early lock bonus) |
| Auspicious Omens | 10 × mark# mana | Mark game for top 8 — all-or-nothing escalating reward |

### Starter Kit (awarded on season join)
- 1× Evocation Distillate, 1× Crystal Focus, 1× Scrying Orb Polish

### Vendor Cycles
- Week A: Scrying Orb Polish, Blood Bargain, Infernal Patron's Pact
- Week B: Crystal Focus, Black Gem Accumulator, Tincture of Divination
- Resets Monday 00:00 UTC, per-player purchase limits

---

## Branding & Design System

### Fonts
- **Cinzel** — display font (`font-display`): headings, card titles, nav, item names, labels
- **IM Fell English** — body font (`font-body`): descriptions, body copy, small text
- Loaded via `next/font/google` (self-hosted at build time)

### Colors
| Use | Color | Tailwind |
|-----|-------|---------|
| Mana / predictions / windows | Cyan | `text-cyan-300`, `border-cyan-500` |
| Boosters / drops / vendor / amber | Amber | `text-amber-400`, `border-amber-500` |
| Emerald (slider gem / correct predictions) | Emerald | `text-emerald-400`, `#16a34a` |
| Brand accent (logo, rite auras, nav) | Purple | `#9D84D4` |

### Logo / Branding
- Combined wordmark: `/public/icons/game-name-logo.png` (pentagram + stone-texture "Prognos" text, transparent bg)
- Pentagram only: `/public/icons/game-logo.png`
- Mana icon: `/public/icons/mana-icon.png` (always use plain `<img>` NOT next/image — avoids hydration mismatch)
- Header: logo at 56px, `marginLeft: 18px`, purple drop-shadow, vignette + rightward fade overlay
- Auth pages: logo at 80px centered above card

### Background
- `/public/background.png` — fixed, `object-cover`, dark overlay `rgba(0,0,0,0.75)` in `app/layout.tsx`

---

## Prediction Card Layout

Three-column grid: `120px | flex-1 | 128px`

```
┌──────────┬─────────────────────────┬──────────┐
│  Rites   │  Highest Player Count   │  Ladder  │
│ (circles │  Review Score slider    │  (tiles, │
│ with art)│  Mana preview           │  drag to │
│  Hover & │  Booster slot squares   │  rank)   │
│  confirm │  Booster tile grid 4×N  │          │
│  popover)│  Save / Early Lock btns │          │
└──────────┴─────────────────────────┴──────────┘
```

**Rite circles:**
- 62px rounded-full, artwork image fills circle
- Mana cost badge: 14px circle, overlapping bottom edge, `border-cyan-500/60`, cyan number
- Hover: `fixed` tooltip to right of cursor with description + mana icon + cyan cost
- Click: confirmation popover opens to right of circle
- Performed: cyan or purple aura glow

**Booster tiles:**
- 4-column grid, `54×54px` image, `rounded-xl` border
- Quantity badge: 14px circle bottom-right corner, amber, shows `×N`
- Slot indicators: `rounded-sm` squares (not circles), amber gradient when filled

**Ladder tiles:**
- Image height shrinks dynamically with more games (min 28px at 9 games)
- Hover expands image to 52px
- AO marked: violet star overlay top-right
- Locked/released: grayscale

**Gem slider:**
- Trilliant cut emerald, point down, curved sides, ~30×34px in SVG space
- Gold outline + 22 internal facet lines
- Gold tick marks with small round green gems at bottom termination
- Log scale for players slider (min 100), linear for reviews

---

## Common Patterns & Gotchas

### Hydration Mismatch (Radix IDs)
- Always wrap `SeasonPointsBadge` in `<Suspense fallback={null}>` in header
- Add `suppressHydrationWarning` to `DropdownMenuTrigger` Button
- Never use `next/image` for `mana-icon.png` — use plain `<img>`
- Heavy client components on server pages → use dynamic import with `ssr: false` via a `"use client"` wrapper

### Client Component Pattern
```tsx
// prediction-form-client.tsx
"use client"
import dynamic from "next/dynamic"
const PredictionForm = dynamic(
  () => import("@/components/prediction-form").then(m => m.PredictionForm),
  { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-lg border border-border" /> }
)
```

### Supabase
- Server components: `createClient` from `@/lib/supabase/server`
- Client components: `createClient` from `@/lib/supabase/client`
- Admin operations (inventory, rite history): use service role key via direct `createClient` from `@supabase/supabase-js`

### Scoring Engine
- `lib/scoring.ts` — `computePlayersWindow`, `computeReviewsWindow`, `resolveBoosterEffects`, `resolveEquipmentEffects`, `calculateEarlyLockMana`
- `lib/ladder-scoring.ts` — `computeAuguryDistribution`, `distributionToGradient`, LCS functions

---

## Cron Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| steam-collector | `*/30 * * * *` | Fetch player counts + reviews from Steam API |
| score-calculator | `0 7 * * *` | Score predictions using 7-day peak window |

Week-one player count = `MAX(player_count)` from all snapshots in 7 days post-release.

---

## Phase Status

### Phase 1 — NEARLY COMPLETE
- ✅ Scoring engine, log-scale gem slider, booster consumption API
- ✅ Ladder UI, early lock, first prediction bonus structure
- ✅ Starter kit API, 7-day peak scoring, 30-min cron
- ✅ Three-column prediction card with rites/boosters/ladder
- ✅ Trilliant gem slider, rite artwork, booster artwork
- ✅ Dual mana tracking, color system, fonts
- ⬜ Weekly stipend cron not yet built

### Phase 2 — NOT STARTED
Equipment selection UI at season join, tier tracking

### Phase 3 — PARTIALLY STARTED
Booster UI on prediction card done, inventory management page not built

### Phase 4 — NOT STARTED
Vendor page, purchase API, weekly reset cron

---

## Pre-existing Issues (Low Priority)
- TS errors in `seasons/[id]/page.tsx` and `seasons/page.tsx`
- Stripe integration (deferred)
- Game delay handling (deferred) — delayed games excluded, costs refunded
