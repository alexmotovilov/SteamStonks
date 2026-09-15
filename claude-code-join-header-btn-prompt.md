# Task: Add "Join Season" button to header

## Overview
When a logged-in player has NOT yet joined the active season, show a
"Join Season I →" button on the right side of the header, between the
nav links area and the mana badge / avatar. This gives players a persistent
prominent CTA to join without having to find it on the /games page.

Once the player has joined the active season, the button disappears entirely.
If there is no active season, the button does not appear.

---

## Placement

```
[Logo]  Games · Vendor · Archives · Mailbox · Admin    [Join Season I →]  [🔮 1,250]  [avatar]
                                                              ↑
                                          appears here only when not yet joined
```

The button should be right-aligned, between the nav and the mana badge group.
It should feel distinct from the nav links — a proper button, not a link styled as text.

---

## Data requirements

The header already receives `user` and `profile` as props from the authenticated layout.
It needs one additional piece of data: whether the player has joined the active season.

### Option A — Pass from layout (preferred, no extra client fetch)
In `app/(authenticated)/layout.tsx`, add a query alongside the existing profile fetch:

```ts
// Check if user has joined the active season
const { data: activeSeason } = await supabase
  .from("seasons")
  .select("id, name")
  .eq("status", "active")
  .single()

const { data: seasonEntry } = activeSeason
  ? await supabase
      .from("season_entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("season_id", activeSeason.id)
      .single()
  : { data: null }

const hasJoinedActiveSeason = !!seasonEntry
const activeSeasonName = activeSeason?.name ?? null
const activeSeasonId = activeSeason?.id ?? null
```

Pass to Header:
```tsx
<Header
  user={user}
  profile={profile}
  hasJoinedActiveSeason={hasJoinedActiveSeason}
  activeSeasonName={activeSeasonName}
  activeSeasonId={activeSeasonId}
  activeSeasonEntryFee={/* fetch from seasons table */}
/>
```

### Option B — Fetch client-side in a new component (fallback if layout is complex)
Create `components/join-season-header-button.tsx` as a client component that
fetches its own data (same pattern as SeasonPointsBadge), wrapped in Suspense.

**Use Option A if the layout change is straightforward. Use Option B if the layout
already has many queries and adding more would be messy.**

---

## Button design

```tsx
// Not yet joined — show button
<Link
  href={`/seasons/${activeSeasonId}`}  // or trigger the join modal directly
  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display text-xs tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18 transition-colors whitespace-nowrap"
>
  Join {activeSeasonName} →
</Link>
```

Alternatively, if we want it to trigger the equipment selection modal directly
rather than navigating to a seasons page (which no longer exists):

```tsx
// Opens the join flow inline
<button
  onClick={() => setShowJoinModal(true)}
  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display text-xs tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18 transition-colors"
>
  Join {activeSeasonName} →
</button>
```

**Use the Link approach navigating to `/games`** — the join button on /games already
triggers the equipment modal. This avoids duplicating the join logic in the header
and keeps the flow consistent. The button in the header is a wayfinding CTA,
not a duplicate join mechanism.

So the button simply links to `/games`:
```tsx
{!hasJoinedActiveSeason && activeSeasonName && (
  <Link
    href="/games"
    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display text-xs tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18 transition-colors whitespace-nowrap"
  >
    Join {activeSeasonName} →
  </Link>
)}
```

---

## Header props update

Add to `HeaderProps` interface in `components/header.tsx`:
```ts
interface HeaderProps {
  user: SupabaseUser | null
  profile?: { ... } | null
  hasJoinedActiveSeason?: boolean   // ← new
  activeSeasonName?: string | null  // ← new
  activeSeasonId?: string | null    // ← new (in case needed later)
}
```

---

## Rules
- Button only shows when: user is logged in AND active season exists AND user
  has NOT joined it
- Hidden on mobile (`hidden sm:flex`) — same as mana badge
- Does NOT replace the join button on /games — both coexist
- Must be wrapped in the right part of the header JSX — right side, before the
  mana badge and avatar group
- Do NOT modify the Suspense wrappers, suppressHydrationWarning, vignette overlays,
  or any other part of the header
- Run `npx tsc --noEmit` after changes

---

## Verification
1. Player not yet joined active season → green "Join Season I →" button visible
   in header right side ✓
2. Clicking button navigates to /games where join flow is available ✓
3. Player joins season → button disappears (after page refresh) ✓
4. No active season → button not shown ✓
5. Button hidden on mobile ✓
6. No hydration mismatch errors ✓
7. Run `npx tsc --noEmit` — no errors ✓
