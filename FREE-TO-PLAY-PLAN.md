# Free-to-Play (Unvested) Season Participation — Implementation Plan (Rev. 3)

## Purpose

Two goals:
1. **Try before you buy** — let a registered player experience core gameplay (predictions, mana, drops, vendor, most rites) without paying the entry fee.
2. **Facilitate late entry** — a free player may "vest" (pay the entry fee) at *any* point during an active season and unlock everything going forward, with two conditions: (a) already-released games can never be ladder-ranked (they sit in the 9th "burn" slot), and (b) season score is **not** retroactively earned on predictions whose games have already released.

This revision also reworks onboarding rewards (welcome mail + starter kit mail) and **removes the scored first-prediction bonus** — see "Onboarding Mail & First-Prediction Bonus Removal."

---

## Rules Summary

### Free (Unvested) Players Can:
- Make week-one predictions on any game
- Use all rites **except** Auspicious Omens (ladder-tied)
- Apply boosters from inventory
- Earn **spendable** mana from correct predictions (credited on mail claim)
- Earn drops from correct predictions
- Access the vendor (spend mana on items)
- Receive and claim scored prediction mail
- Receive the starter-kit mail (every season) and the account welcome mail (+50 mana, once ever)

### Free (Unvested) Players Cannot:
- Earn **season score** (`season_score` — the leaderboard ranking stat)
- Use the **season ladder** (rank games in top-8)
- Use the **Auspicious Omens** rite
- Choose or benefit from **equipment**
- Collect the **weekly mana stipend**

### On Vesting (Paying Entry Fee):
- Equipment chosen at vest time via the existing selection modal
- **Retroactive equipment tier**: count of prior perfect/partial *scored* predictions sets initial `equipment_tier_score`
- **Ladder**: immediately usable for unreleased games; already-released games occupy the 9th "burn"/overflow slot and cannot be ranked
- **Season score**: earned only from predictions whose game had **not yet released** at vest time (not yet locked for scoring). Predictions on already-released games are **not** retroactively credited
- **Mana and boosters earned as free player**: kept
- **Starter kit**: NOT re-awarded on vest (already received at free join)

### Leaderboard
Free players appear on the leaderboard at 0 season score (`updateLeaderboards` already pulls all `season_entries`). No separate tier/badge for now.

---

## Onboarding Mail & First-Prediction Bonus Removal

The old scored first-prediction bonus (+50 folded into `final_mana`) is removed. It made players wait for scoring before getting spendable resources and quietly added a uniform, meaningless +50 to everyone's season score. Replaced with two mailbox deliveries that reuse existing claim infrastructure.

### Infra confirmation (no new claim mechanics needed)
- **`add_mana_balance` (migration 017) ignores `p_season_id`** — it credits `profiles.mana_balance WHERE id = p_user_id`. A **season-less** welcome mail therefore claims correctly through the existing `/api/mail/claim-mana` route.
- **`mail_attachments` + `/api/mail/claim`** already deliver fixed items to inventory (`increment_inventory` per attachment). The starter kit ships as attachments through this existing route.
- The two mails never overlap claim types: welcome is **mana-only** (`mana_claimed_at` on the message), starter kit is **attachments-only** (`mail_reads.claimed_at`). Each hits exactly one existing route — no split-claim UX.

### A. Welcome mail — `message_type = "welcome"`
- **When:** generated **app-side on first authenticated load** (from the authenticated layout), via an idempotent service-role insert. Duplicate sends are prevented by a **unique partial index**, so the repeated insert attempt is a cheap no-op after the first.
- **Scope:** **once per account, ever** (not per season).
- **Contents:** `season_id = null`, `target = "user"`, `target_user_id = user`, `mana_reward = 50`, `is_published = true`. Body/metadata carry welcome copy + basic directions (join a season, read the guide, etc.).
- **Claim:** existing `/api/mail/claim-mana` → `add_mana_balance` → `profiles.mana_balance`. The +50 sits in the cross-season wallet until the player joins a season and can spend it (vendor/rites are season-scoped).

### B. Starter-kit mail — `message_type = "starter_kit"`
- **When:** generated on **season join** (free or paid), replacing the old discrete inventory deposit.
- **Scope:** **every season**.
- **Contents:** `season_id = <season>`, `target_user_id = user`, one `mail_attachments` row per starter item (Evocation Distillate, Crystal Focus, Scrying Orb Polish).
- **Claim:** existing `/api/mail/claim` → `increment_inventory` per attachment.
- `drop_history` is **not** written for starter-kit claims (the generic claim route doesn't log it) — accepted; the starter kit isn't a "drop."

### C. Scoring engine — drop the first-prediction bonus
- `lib/scoring.ts` `scoreWeekOnePrediction` stops emitting `mana_first_prediction` (returns 0 / removes it from `final_mana`).
- `app/api/cron/score-calculator/route.ts` drops the `isFirst` computation and the `p_claim_first` argument usage.
- The mail breakdown drops the "First prediction bonus" line.
- `season_entries.first_prediction_bonus_claimed` becomes **vestigial** — left in place, dormant, like `season_entries.mana_balance` after migration 017.
- **Consequence:** the free-player scoring path no longer needs any first-prediction-flag handling (see simplified §5).

---

## Database Migrations

**New file:** `scripts/019-free-entry.sql`

```sql
alter table public.season_entries
  add column if not exists is_free_entry boolean not null default false,
  add column if not exists vested_at timestamptz default null;
```

| Column | Meaning |
|--------|---------|
| `is_free_entry` | `true` = joined for free. Permanent — never cleared after vesting. |
| `vested_at` | `null` = currently unvested. Set to `now()` on vest. |

**"Currently unvested" predicate throughout:** `is_free_entry = true AND vested_at IS NULL`

**New file:** `scripts/020-onboarding-mail.sql`

```sql
-- One welcome mail per account, ever
create unique index if not exists mail_messages_welcome_unique
  on public.mail_messages(target_user_id)
  where message_type = 'welcome';

-- One starter-kit mail per player per season
create unique index if not exists mail_messages_starter_kit_unique
  on public.mail_messages(target_user_id, season_id)
  where message_type = 'starter_kit';
```

No backfill for existing accounts (test data only).

---

## 1. Season Join Page

**File:** `app/(authenticated)/seasons/[id]/page.tsx`

Add a second join path when `season.status === "active" && !isJoined`:
- **Pay Entry Fee** — existing paid flow (requires token balance)
- **Join for Free** — new; no token requirement

Pass `freeEntry={true}` to the join button for the free path.

---

## 2. Join Button — Free Entry + Starter-Kit-as-Mail

**File:** `components/join-season-button.tsx`

Add a `freeEntry?: boolean` prop. When `true`:
- Skip the equipment selection modal (go straight to confirm)
- Skip token deduction
- Insert `season_entries` with `is_free_entry: true`, `tokens_paid: 0`, `equipment_id: null`, and the usual zeros (`season_score`, `equipment_tier_score`, `stipend_week_number`, `starter_kit_claimed: false`, `first_prediction_bonus_claimed: false`)

For **both** free and paid joins, the starter kit is now delivered as **mail**, not a direct inventory deposit:
- Repurpose `app/api/seasons/join/starter-kit/route.ts` to insert a `starter_kit` mail (`season_id`, `target_user_id`) plus 3 `mail_attachments` rows, instead of writing to `inventory`. Idempotent via `mail_messages_starter_kit_unique`; keep `starter_kit_claimed` as the "mail dispatched" marker.

(`equipment_id` holds the equipment **slug**, e.g. `"seers_spectacles"`, not a UUID — free entry stores `null`.)

---

## 3. Vest API

**New file:** `app/api/seasons/vest/route.ts` (POST)

**Request body:** `{ season_id, equipment_id }` — `equipment_id` is the equipment **slug** selected in the modal (matches how the join flow stores it).

Logic:
1. Auth check
2. Fetch season entry → verify `is_free_entry = true AND vested_at IS NULL` (guards double-vest)
3. Fetch season → verify `status = "active"`, get `entry_fee_tokens`
4. Check `profiles.token_balance >= entry_fee_tokens`
5. Count retroactive equipment tier:
   ```sql
   SELECT COUNT(*) FROM predictions
   WHERE user_id = ? AND season_id = ?
     AND result IN ('perfect', 'partial')
     AND scored_at IS NOT NULL
   ```
6. **Atomic token deduction + vest.** Prefer an RPC or a guarded update (`... WHERE user_id = ? AND season_id = ? AND vested_at IS NULL`, treating 0 rows as "already vested") so concurrent calls can't double-deduct or double-vest.
7. Update `season_entries`: `tokens_paid = entry_fee_tokens`, `vested_at = now()`, `equipment_id = <slug>`, `equipment_tier_score = retroactive_count`
8. Return `{ success: true, equipmentTierScore: retroactiveCount }`

Runs server-side (service role) — intentional, since it moves real tokens.

---

## 4. Vest UI

**New file:** `components/vest-season-button.tsx`

Reuses the equipment selection modal from `join-season-button.tsx`. On confirm, calls `POST /api/seasons/vest` with the selected **slug**; on success `router.refresh()`.

**Placement:** `app/(authenticated)/vendor/page.tsx` — prominent CTA card where `seasonEntry.is_free_entry === true && !seasonEntry.vested_at`, showing entry-fee cost and current token balance.

---

## 5. Score Calculator — Season-Score Eligibility (simplified)

**File:** `app/api/cron/score-calculator/route.ts`

With the first-prediction bonus removed (see Onboarding section C), the only change here is gating season score for unvested players. No flag juggling.

**5a. Extend the per-prediction entry select** to include the new columns:
```ts
.select("equipment_id, equipment_tier_score, is_free_entry, vested_at")
```
(`first_prediction_bonus_claimed` no longer needed here.)

**5b. Compute eligibility using the effective release moment as Dates** (honoring `release_time_override` from migration 013, not a raw string compare):
```ts
// effectiveReleaseDate = release_time_override ?? release_date, as a Date
const isEligibleForSeasonScore =
  !entry?.is_free_entry ||
  (entry.vested_at != null && new Date(entry.vested_at) < effectiveReleaseDate)
```

**5c. Gate only the season-score credit:**
```ts
if (isEligibleForSeasonScore) {
  const isCorrect = scoreResult.result !== "failed"
  await supabase.rpc("increment_season_mana", {
    p_user_id:        pred.user_id,
    p_season_id:      pred.season_id,
    p_mana:           scoreResult.final_mana,
    p_tier_increment: isCorrect ? 1 : 0,
    p_claim_first:    false,   // first-prediction bonus removed
  })
}
// else: skip season-score/tier entirely.
```
Everything else is unchanged for both paths: the prediction row still gets all `mana_*`/`final_points`/`scored_at`, drops are awarded, and scoring mail is generated. **Spendable mana still reaches free players** via mail claim (`/api/mail/claim-mana` → `add_mana_balance`), independent of `increment_season_mana`.

**5d. Ladder scoring:** no change — free players never create a `ladder_rankings` row (ladder UI locked; row only upserted when `rankedGames.length > 0`).

---

## 6. Rites API — Block Auspicious Omens

**File:** `app/api/rites/perform/route.ts`

This route currently fetches only the prediction, so the AO guard must **add** a `season_entries` lookup:
```ts
if (rite_slug === "auspicious_omens") {
  const { data: entry } = await supabase
    .from("season_entries")
    .select("is_free_entry, vested_at")
    .eq("user_id", user.id).eq("season_id", season_id).single()

  if (entry?.is_free_entry && !entry.vested_at) {
    return NextResponse.json({ error: "Vest into the season to use Auspicious Omens" }, { status: 403 })
  }
}
```
Server-side defense-in-depth; the AO rite circle is also disabled in the UI (§8).

---

## 7. Vendor Stipend — Block for Free Players

**File:** `app/api/vendor/stipend/route.ts`

Extend the entry select (currently just `stipend_week_number`) and add the guard:
```ts
.select("stipend_week_number, is_free_entry, vested_at")
// ...
if (entry?.is_free_entry && !entry.vested_at) {
  return NextResponse.json({ error: "Free players cannot claim the weekly stipend" }, { status: 403 })
}
```
Vendor **purchases** remain allowed.

---

## 8. Prediction Form — Free Player UI Restrictions

**File:** `components/game-prediction-panel.tsx`
- Ensure `seasonEntry` query includes `is_free_entry, vested_at`, then derive `const isUnvested = !!(seasonEntry?.is_free_entry && !seasonEntry?.vested_at)` and pass to `PredictionForm`. `equipmentSlug` is already `null` for free players.

**File:** `components/prediction-form.tsx` — add `isUnvested?: boolean`. When `true`:

| Area | Change |
|------|--------|
| Ladder column | Locked overlay: grey tiles + "Vest to unlock Season Ladder"; must prevent any ranked state from being submitted (no `ladder_rankings` upsert) |
| Auspicious Omens rite circle | Disabled (reduced opacity, no pointer events, tooltip: "Vest to unlock") |
| Equipment effects | Already absent (null slug) — no change |
| Mana preview | Show normally |
| Other rites, boosters, sliders, save | Work identically |

---

## 9. Mailbox Client — Two New Message Types

**File:** `components/mailbox-client.tsx`

Render and route claims for the two new `message_type`s:
- `welcome` → "Claim 50 mana" → `POST /api/mail/claim-mana`
- `starter_kit` → "Claim items" → `POST /api/mail/claim`

Must render a `welcome` mail with `season_id = null` cleanly (season-agnostic).

---

## Resolved Design Decisions

1. **Cross-season economy leak** — resolved. Welcome mana is **once per account**, so no per-season mana farming. Only low-tier starter boosters recur per season (subject to `carry_over_limit`); accepted as negligible/intentional.
2. **First-prediction bonus** — removed from scoring; replaced by the once-per-account welcome mail (see Onboarding section).
3. **Equipment effects on free-made predictions scored after vest** — a prediction made while free on an unreleased game becomes season-score-eligible after vest, and the cron resolves equipment from the *current* entry, so equipment effects apply at scoring. Consistent with "unlocks everything going forward"; accepted.
4. **Leaderboard clutter** — free players show at 0 season score; acceptable for now.

---

## Files to Modify / Create

| File | Type | Change |
|------|------|--------|
| `scripts/019-free-entry.sql` | **New** | Add `is_free_entry`, `vested_at` to season_entries |
| `scripts/020-onboarding-mail.sql` | **New** | Unique partial indexes for welcome + starter-kit mail |
| `app/(authenticated)/seasons/[id]/page.tsx` | Modify | Add free join option alongside paid join |
| `components/join-season-button.tsx` | Modify | `freeEntry` path; starter kit via mail |
| `app/api/seasons/join/starter-kit/route.ts` | Modify | Emit starter-kit mail + attachments instead of inventory deposit |
| `app/api/seasons/vest/route.ts` | **New** | Atomic vest (token deduct, equipment slug, retroactive tier) |
| `components/vest-season-button.tsx` | **New** | Equipment modal + vest API call |
| `app/(authenticated)/vendor/page.tsx` | Modify | VestSeasonButton CTA for free players |
| `app/(authenticated)/layout.tsx` | Modify | Idempotently generate welcome mail on first authenticated load |
| `app/api/cron/score-calculator/route.ts` | Modify | Season-score eligibility gate (simplified) |
| `lib/scoring.ts` | Modify | `scoreWeekOnePrediction` stops emitting `mana_first_prediction` |
| `app/api/rites/perform/route.ts` | Modify | Add entry fetch; block `auspicious_omens` for unvested |
| `app/api/vendor/stipend/route.ts` | Modify | Extend select; block stipend for unvested |
| `components/game-prediction-panel.tsx` | Modify | Include new columns; derive + pass `isUnvested` |
| `components/prediction-form.tsx` | Modify | `isUnvested` prop: lock ladder, disable AO rite |
| `components/mailbox-client.tsx` | Modify | Handle `welcome` + `starter_kit` message types |

---

## Verification Checklist

1. **Welcome mail**: New account → welcome mail appears (once), `season_id=null`, `mana_reward=50`; claim → `profiles.mana_balance` +50; second authenticated load does **not** create a duplicate
2. **Starter-kit mail**: Join season (free or paid) → starter-kit mail with 3 attachments; claim → 3 boosters in inventory; re-join attempt doesn't duplicate the mail
3. **Free join**: `season_entries` has `is_free_entry=true, vested_at=null, equipment_id=null, tokens_paid=0, season_score=0`; token balance unchanged
4. **Restrictions**: Prediction form → ladder locked, AO rite disabled; other 4 rites usable; vendor purchases work; stipend blocked (403)
5. **Scoring as free**: Cron scores a free prediction → `season_score` and `equipment_tier_score` stay 0; **no** first-prediction bonus anywhere; mail delivered with mana; claim → `profiles.mana_balance` increases
6. **First-prediction bonus gone**: No scored prediction (free or paid) shows a "First prediction bonus" line or adds the +50 to season score
7. **Vest flow**: Vest CTA → equipment modal → confirm → `vested_at` set, `equipment_id`=slug, `equipment_tier_score`=count of prior perfect/partial scored predictions; tokens deducted exactly once (idempotent on double-submit)
8. **Post-vest ladder**: unreleased games rankable; already-released games in 9th burn slot, not rankable
9. **Season-score eligibility after vest**: prediction whose game released **before** vest → `season_score` unchanged; game released **after** vest (incl. one made while free) → credited normally
10. **Release-day edge**: vest timestamp on the same day as effective release resolves correctly (Date comparison, `release_time_override` honored)
