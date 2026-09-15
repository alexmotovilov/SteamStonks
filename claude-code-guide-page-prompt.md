# Task: Build /guide page and first-login welcome modal

## Overview
Create two things:
1. A `/guide` page — a streamlined reference for new players explaining every part of the prediction card, with annotated screenshots and deep-linkable sections
2. A first-login welcome modal — appears once on a new player's first visit after joining, briefly introduces the core loop, and links to the guide

---

## Part 1 — `/guide` page

### Route
`app/(authenticated)/guide/page.tsx`

### Nav link
Add to `components/header.tsx` nav after Mailbox:
```tsx
<Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display">
  Guide
</Link>
```

### Page structure

The page is a single scrollable document with a sticky sidebar nav on desktop
linking to each section by anchor. On mobile the sidebar collapses to a top
dropdown or simply stacks.

```
/guide

  ┌─────────────────────────────────────────────────────────┐
  │  Sidebar (sticky)    │  Content                        │
  │                      │                                  │
  │  Overview            │  ## Overview                     │
  │  The Prediction Card │  ## The Prediction Card          │
  │    Sliders           │  ### Sliders                     │
  │    Boosters          │  ### Boosters                    │
  │    Rites             │  ### Rites                       │
  │    Season Ladder     │  ### Season Ladder               │
  │  Prediction Lifecycle│  ## Prediction Lifecycle         │
  │  Scoring             │  ## Scoring                      │
  │  Equipment           │  ## Equipment                    │
  │  Vendor              │  ## Vendor & Inventory           │
  │  Mailbox             │  ## Mailbox                      │
  └─────────────────────────────────────────────────────────┘
```

---

### Section content

#### § Overview
Brief intro — what Prognos is, how a season works, what players are competing on.

```
Prognos is a prediction competition where players forecast the performance of
upcoming PC games on Steam. Each season, a selection of upcoming games is chosen.
You set predictions, earn mana and score when you're right, and compete on the
season leaderboard.

Two things you're predicting per game:
1. Highest peak player count in the first 7 days after release
2. Week-one positive review percentage

You also rank all season games in order of predicted all-time peak players
on the Season Ladder.
```

#### § The Prediction Card

Intro text:
```
Each game in the active season has a Prediction Card. Click any game tile
on the Games page to open it. The card has three columns.
```

**ANNOTATED IMAGE PLACEHOLDER — LEFT COLUMN**
Use a colored overlay/annotation approach since we can't embed live screenshots.
Create an SVG diagram showing the three-column layout with labeled callouts:

```tsx
// Render a simplified SVG diagram of the prediction card layout
// Left column labeled "Rites", center labeled "Sliders & Boosters", right labeled "Ladder"
// Each column has a numbered callout bubble
```

Actually: since real screenshots aren't available at build time, render the
annotations as styled `<div>` mockups using Tailwind that visually represent
each section. See "Diagram components" section below.

---

##### §§ Sliders — `#sliders`

```
The two sliders in the center column are where you set your prediction.

Peak Player Count (Week 1)
Drag the green gem to your predicted highest player count in the first
7 days after the game releases. The scale is logarithmic — small
adjustments at low values (under 10,000) are easy, while the right
side covers the millions range for major releases.

The gold tick marks show your prediction window — the range within which
the actual value must fall to score. The green bar between the ticks is
your window.

% Positive Reviews (Week 1)
Drag the gem to your predicted positive review percentage at the end of
week one. This uses a linear 0–100% scale. The window is ±3% by default.

Setting your prediction:
1. Drag the gem left or right
2. Watch the window range update below the slider
3. Apply boosters or equipment to widen the window if needed
4. Click Save Prediction to record your values
```

##### §§ Boosters — `#boosters`

```
Boosters are single-use items that modify your prediction for one game.
They appear as tiles below the sliders.

Booster slots (the small squares above the grid) show how many boosters
you can apply — 2 by default. The Sigil of Multiplicity rite or
Clockwork Familiar equipment can add a third slot.

To apply a booster: click its tile. The amber border confirms it's active.
Applied boosters are consumed from your inventory when you save the prediction
and CANNOT be removed after saving.

The ×N badge on each tile shows how many you have in stock.
Hover over any booster to see its effect.

Boosters are earned through loot drops from scoring, the weekly vendor,
and the starter kit you receive when joining a season.
```

##### §§ Rites — `#rites`

```
Rites are special abilities in the left column. Each costs mana from
your spendable balance. Click a rite circle to see its description and
confirm activation.

Ritual of Augury (10 mana)
Reveals a heatmap on both sliders showing where other players have
placed their predictions. Active for 2 minutes. Can be used multiple times.

Eldritch Wager (30 mana)
Adds +25 mana to your reward for each correct metric, and +25 more if
both are correct. One use per prediction.

Sigil of Multiplicity (50 mana)
Unlocks a third booster slot for this prediction. One use.

Temporal Translocation (100 mana)
Removes your early lock, letting you update your sliders again.
Only available if you have an active early lock.

Auspicious Omens (variable mana)
Marks this game as your pick for the Top 8 season ladder. Marks are
all-or-nothing — if any marked game misses the top 8, all Auspicious
Omens rewards are forfeited. Each additional mark costs more mana.

Rites that can only be used once (Eldritch Wager, Sigil, Auspicious Omens)
turn grey after use. Ritual of Augury stays active while its heatmap is showing.
```

##### §§ Season Ladder — `#ladder`

```
The right column shows all season games ranked by your predicted
all-time peak player count — highest at the top.

Drag tiles to reorder your ranking at any time before the season ends.
Released games (shown in grey with a lock icon) have their positions locked
and cannot be moved.

The ★ gold-ring badge on a tile means you've marked that game with
Auspicious Omens.

Ladder scoring happens at the end of the season:
- Exact rank matches earn +50 mana score each (Binary scoring)
- Consecutive correct runs earn escalating bonuses (Sequence scoring)
```

---

#### § Prediction Lifecycle — `#lifecycle`

This section uses a horizontal timeline or numbered steps:

```
1. SET          2. SAVE         3. EARLY LOCK   4. RELEASE      5. SCORING      6. RESULT
   Drag sliders    Confirm &       Optional —      Automatic       7-day window    Perfect /
   apply boosters  consume         freeze sliders  on launch       closes          Partial /
   use rites       boosters        earn bonus      prediction      score runs      Missed
                                   mana            locked                          → Mailbox
```

Details per step:

**SET** — Drag both sliders to your predictions. Apply any boosters or rites.
Arrange your ladder ranking.

**SAVE** — Click "Save Prediction". Boosters are consumed from your inventory
at this point and cannot be removed. You can update slider values until
the game releases.

**EARLY LOCK** — Optional. Click "Early Lock" to voluntarily freeze your
sliders before the game releases. You earn a mana bonus that grows the
earlier you lock (up to +25 mana if locked 2 weeks before release).
After early locking: rites, boosters (adding more), and the ladder
remain editable. Use Temporal Translocation to undo an early lock.

**RELEASE** — When the game launches, your prediction automatically locks.
No further changes to sliders or boosters. Rites and the ladder
remain open until the season ends.

**SCORING WINDOW** — The score-calculator checks all Steam snapshots from
the 7 days after release and finds the highest player count recorded.
It also reads the most recent review score in that window.

**RESULT** — Your prediction is scored. A message arrives in your Mailbox
with a full breakdown. Mana is deposited to your balance (claim it from
the mailbox). Your season score increases automatically.

---

#### § Scoring — `#scoring`

```
Results and rewards:

Perfect  Both metrics within window  +50 peak players +50 reviews +50 bonus = 150 base mana
Partial  One metric within window    +50 mana
Missed   Neither metric correct      +0 base mana

Additional mana on top of base:
- Early lock bonus: up to +25 mana
- Equipment bonuses: depends on your equipment and tier
- Booster bonuses: depends on applied boosters
- Rite bonuses: Eldritch Wager adds per-correct bonuses
- First prediction bonus: +50 mana on your very first scored prediction

Loot drops:
Perfect = 2 drops, Partial = 1 drop (plus equipment bonuses)
Drops arrive as mystery items in your Mailbox — open them to reveal
and claim the contents.

Season Score vs Mana:
Every mana you earn from scoring is also added to your Season Score
(shown with a Trophy icon). These always match 1:1 but are tracked
separately. Season Score never decreases and determines your leaderboard
rank. Mana Balance is your spendable wallet — used for rites and the vendor.
```

---

#### § Equipment — `#equipment`

```
When you join a season you choose one piece of equipment. It stays with
you for the entire season and gets stronger as you make more predictions.

Tier I:   0–2  Perfect or Partial predictions this season
Tier II:  3–5  Perfect or Partial predictions
Tier III: 6+   Perfect or Partial predictions

Seer's Spectacles    — Widens your prediction windows (easier to score)
Arcanum Esoterica    — Bonus mana for correct predictions
Clockwork Familiar   — Bonus loot drops and an extra booster slot at Tier II+

Your current equipment and tier are shown in the header and on your dashboard.
```

---

#### § Vendor & Inventory — `#vendor`

```
The Vendor page rotates weekly between two inventories (Week A / Week B).
Each week a selection of boosters is available for purchase using your
mana balance. Stock resets every Monday at midnight UTC.

You can hold multiple copies of most boosters. Carry-over limits apply
between seasons.

The weekly stipend (+15 mana) is added to your mana balance each week
while you are an active season participant.
```

---

#### § Mailbox — `#mailbox`

```
Your Mailbox receives two types of messages:

Admin messages — News, announcements, and special booster rewards from
the Prognos team. Attached boosters can be claimed directly from the message.

Scoring results — After each prediction is scored, you receive a detailed
breakdown showing your result, the actual values, and a full mana breakdown.
These messages contain:
- A Claim Mana button — adds your earned mana to your spendable balance
- Mystery drop items (if earned) — click Open to roll the loot table and
  reveal your items

The Mailbox nav link shows an unread count badge when new messages arrive.
```

---

### "?" help buttons on prediction card

Add small `?` icon buttons near key elements of the prediction card that
link to the corresponding guide section. These should be unobtrusive —
small, muted, appearing on hover or as a static icon.

Add to `components/prediction-form.tsx`:

```tsx
function GuideLink({ section, label }: { section: string; label?: string }) {
  return (
    <a
      href={`/guide#${section}`}
      target="_blank"
      rel="noopener noreferrer"
      title={label ?? `Learn more`}
      className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-muted-foreground/20 text-muted-foreground/40 hover:text-muted-foreground hover:border-muted-foreground/40 transition-colors text-[9px] font-display leading-none"
    >
      ?
    </a>
  )
}
```

Place `<GuideLink>` buttons:
- Next to "RITES" column label → links to `#rites`
- Next to slider labels → links to `#sliders`
- Next to "Booster slots" label → links to `#boosters`
- Next to "Ladder" column label → links to `#ladder`
- Next to early lock button → links to `#lifecycle`

---

### Diagram components (annotated card illustration)

Since real screenshots aren't available at build time, create a styled SVG
or Tailwind div diagram showing the three-column layout with numbered callouts.
Use the project's color system:
- Rites column: purple border
- Center column: emerald border
- Ladder column: purple border

The diagram should be simple — colored boxes with labels, not a pixel-perfect
replica. The goal is spatial orientation, not full detail.

---

## Part 2 — First-login welcome modal

### Trigger condition
Show once to a user who has just joined for the first time OR who has
never dismissed it before.

Track in `localStorage` with key `prognos_guide_modal_dismissed`.
If not set, show the modal. On dismiss, set it to `"true"`.

(localStorage is appropriate here — this is a UI preference, not critical data)

### New component: `components/welcome-modal.tsx`

```tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export function WelcomeModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem("prognos_guide_modal_dismissed")
    if (!dismissed) setShow(true)
  }, [])

  function dismiss() {
    localStorage.setItem("prognos_guide_modal_dismissed", "true")
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}>
      <div className="bg-[rgba(10,10,20,0.98)] border border-purple-500/25 rounded-2xl p-8 w-full max-w-lg shadow-2xl flex flex-col gap-5">

        <div className="text-center">
          <img src="/icons/game-name-logo.png" alt="Prognos" className="h-16 mx-auto mb-4" />
          <h2 className="font-display text-2xl text-foreground tracking-wide mb-2">
            Welcome to Prognos
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Prognos is a prediction competition for upcoming Steam games.
            Forecast player counts and review scores, earn mana, and
            climb the season leaderboard.
          </p>
        </div>

        <div className="space-y-3">
          {[
            { icon: "🎯", title: "Set predictions", text: "Use the sliders to forecast each game's week-one player count and review score." },
            { icon: "⚗", title: "Apply boosters & rites", text: "Use items from your inventory to widen windows or earn bonus mana." },
            { icon: "🏆", title: "Earn score", text: "Accurate predictions earn mana and season score. Compete on the leaderboard." },
          ].map(({ icon, title, text }) => (
            <div key={title} className="flex items-start gap-3">
              <span className="text-xl shrink-0 mt-0.5">{icon}</span>
              <div>
                <div className="font-display text-sm text-foreground">{title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <Link
            href="/guide"
            onClick={dismiss}
            className="w-full py-2.5 rounded-xl font-display text-sm tracking-wide text-center bg-purple-500/12 text-purple-300 border border-purple-500/25 hover:bg-purple-500/20 transition-colors"
          >
            Read the full guide →
          </Link>
          <button
            onClick={dismiss}
            className="w-full py-2 font-display text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Got it, take me to the games
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Add to authenticated layout

In `app/(authenticated)/layout.tsx`:
```tsx
import { WelcomeModal } from "@/components/welcome-modal"

// In the return:
<div className="min-h-screen bg-background">
  <Header user={user} profile={profile} ... />
  <WelcomeModal />
  <main className="container py-6">
    {children}
  </main>
</div>
```

---

## Styling notes
- Guide page uses `container py-8` layout with `prose`-like spacing
- Section headings: `font-display text-2xl` with an amber or purple left border accent
- Body text: `font-body text-sm leading-relaxed text-muted-foreground`
- Code/values shown in `font-mono text-emerald-400`
- Dividers between sections: `border-t border-border my-8`
- Sidebar: `hidden lg:block w-48 sticky top-24` with smooth scroll links

---

## Verification
1. `/guide` page loads without errors ✓
2. All anchor links (`#sliders`, `#rites`, etc.) scroll to correct section ✓
3. "?" buttons on prediction card open guide in new tab at correct section ✓
4. Sidebar nav links work on desktop ✓
5. First-login modal appears for new users ✓
6. Modal dismissed state persists across page refreshes ✓
7. Modal "Read the full guide" link navigates to /guide ✓
8. "Guide" nav link added to header after Mailbox ✓
9. Guide nav link does NOT show unread badge (it's not a mailbox) ✓
10. Run `npx tsc --noEmit` — no errors ✓
