# Task: Consolidate header navigation

## Context
Prognos currently has too many top-level nav links. We are consolidating pages and the header
nav should reflect the new slimmed-down structure.

## Current nav links (to be changed)
Dashboard · Seasons · Games · Leaderboard · Admin

## New nav links
Games · Vendor · Archives · Admin (admin only, unchanged)

## Changes

### Remove these nav links entirely
- Dashboard (`/dashboard`) — being eliminated, its content moves to /games
- Seasons (`/seasons`) — being eliminated, join season moves to /games
- Leaderboard (`/leaderboard`) — being replaced by /archives

### Add this nav link
- Archives (`/archives`) — replaces Leaderboard, will show historical season leaderboards
  - Note: /archives page does not exist yet, just add the nav link pointing to `/archives`
  - It's fine if the page 404s for now — the route will be built separately

### Keep these nav links unchanged
- Games (`/games`)
- Vendor (`/vendor`)
- Admin (`/admin`) — admin only, conditional on profile?.is_admin, unchanged

## Final nav order
Games · Vendor · Archives · Admin (admin only)

## File to edit
`components/header.tsx`

## Implementation
Read the file first, then make the minimal change — only touch the `<nav>` block that
contains the Link elements. Do not change anything else in the header (logo, mana badge,
dropdown, Suspense wrapper, vignette overlays, suppressHydrationWarning, etc.)

## Verification
- Run `npx tsc --noEmit` — no new errors
- Nav should show exactly: Games · Vendor · Archives for regular users
- Nav should show: Games · Vendor · Archives · Admin for admin users
- All links use `font-display` class and the same className as existing nav links
