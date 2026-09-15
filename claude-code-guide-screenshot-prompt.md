# Task: Update /guide page — replace diagram with screenshot + add ladder scoring section

## Part 1 — Replace generated diagram with actual screenshot

A screenshot of the prediction card is available at:
`public/guide/prediction-card-guide.png`

### What to do
Find the annotated diagram component in `app/(authenticated)/guide/page.tsx`
(or wherever the diagram was rendered) and replace it with the actual screenshot,
keeping the numbered callout overlays positioned on top of the image.

### Implementation

Use a `position: relative` wrapper with the screenshot as a background or `<img>`,
and absolutely-positioned callout bubbles overlaid on the relevant regions.

```tsx
function PredictionCardDiagram() {
  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border">
      {/* Actual screenshot */}
      <img
        src="/guide/prediction-card-guide.png"
        alt="Prognos prediction card with annotated sections"
        className="w-full h-auto block"
      />

      {/* Callout overlays — adjust left/top % to match the screenshot layout */}

      {/* ① Rites — left column */}
      <div className="absolute top-[8%] left-[1%]">
        <CalloutBubble number={1} color="purple" />
      </div>

      {/* ② Sliders — center top */}
      <div className="absolute top-[8%] left-[20%]">
        <CalloutBubble number={2} color="emerald" />
      </div>

      {/* ③ Active Effects — center middle */}
      <div className="absolute top-[52%] left-[20%]">
        <CalloutBubble number={3} color="emerald" />
      </div>

      {/* ④ Boosters — center lower */}
      <div className="absolute top-[68%] left-[20%]">
        <CalloutBubble number={4} color="amber" />
      </div>

      {/* ⑤ Season Ladder — right column */}
      <div className="absolute top-[8%] right-[1%]">
        <CalloutBubble number={5} color="purple" />
      </div>
    </div>
  )
}

function CalloutBubble({ number, color }: { number: number; color: "purple" | "emerald" | "amber" }) {
  const styles = {
    purple:  "bg-violet-600 text-white border-violet-400",
    emerald: "bg-emerald-600 text-white border-emerald-400",
    amber:   "bg-amber-500 text-white border-amber-300",
  }
  return (
    <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-display text-sm font-bold shadow-lg ${styles[color]}`}>
      {number}
    </div>
  )
}
```

### Callout position calibration
After implementing, view the guide page locally and adjust the `top` and `left`/`right`
percentage values for each callout bubble until they sit cleanly over the correct
region of the screenshot. The approximate regions based on the three-column layout:

| Callout | Region | Approx position |
|---------|--------|-----------------|
| ① Rites | Left column, near top | top: 5–10%, left: 2–5% |
| ② Sliders | Center column, upper half | top: 5–10%, left: 22–25% |
| ③ Active Effects | Center column, middle | top: 50–55%, left: 22–25% |
| ④ Boosters | Center column, lower | top: 65–72%, left: 22–25% |
| ⑤ Season Ladder | Right column, near top | top: 5–10%, right: 2–5% |

Fine-tune these values by viewing the rendered page — the screenshot dimensions
will determine exact positioning.

---

## Part 2 — Add Season Ladder scoring section to the guide

The current guide is missing an explanation of how the Season Ladder is scored
at season end. Add a dedicated section with anchor `#ladder-scoring`.

### Where to add it
Add immediately after the `#ladder` section (Season Ladder column description)
and before `#lifecycle`.

Also add to the sidebar nav:
```tsx
{ label: "Ladder Scoring", href: "#ladder-scoring" }
```

### Section content

```
## Season Ladder Scoring

At the end of the season, your ladder ranking is compared against the actual
final peak player counts for all season games. Two scoring methods apply:

---

### Binary scoring
Each game whose rank in your ladder exactly matches its actual final rank
earns +50 mana and +50 season score.

Example: if you ranked GTA VI at #2 and it finishes #2 overall,
you earn +50 for that exact match.

---

### Sequence scoring (LCS)
Beyond exact matches, the longest consecutive run of correctly ordered games
in your ladder earns an escalating bonus — even if those games aren't in the
exact right positions overall, as long as they appear in the correct order
relative to each other.

Bonus by run length:

| Run length | Bonus |
|------------|-------|
| 2 games    | +50   |
| 3 games    | +100  |
| 4 games    | +150  |
| 5 games    | +250  |
| 6 games    | +350  |
| 7 games    | +500  |
| 8 games    | +700  |

Example: if games A, C, and E in your ladder appear in the same relative
order as the actual results (even with other games between them), that
counts as a run of 3 → +100 bonus.

---

### Auspicious Omens (ladder)
If you used Auspicious Omens to mark games during the season, those marks
are evaluated at season end against the final Top 8. The reward is all-or-nothing:

| Marks correct | Reward |
|--------------|--------|
| 1 of 1       | +10    |
| 2 of 2       | +30    |
| 3 of 3       | +60    |
| 4 of 4       | +100   |
| 5 of 5       | +150   |
| 6 of 6       | +210   |
| 7 of 7       | +280   |
| 8 of 8       | +360   |
| Any miss     | +0     |

If any marked game fails to reach the Top 8, all Auspicious Omens rewards
are forfeited — including marks that were correct.

---

### Ladder results
Your ladder scoring breakdown arrives in your Mailbox at the end of the season,
showing your binary matches, sequence run, and Auspicious Omens result.
Ladder mana and score are applied automatically — no mana claim required
since the season has ended and your spending balance carries into the next season.
```

### Render the bonus table
Use a styled table component consistent with the rest of the guide:

```tsx
<table className="w-full text-sm border-collapse mt-3">
  <thead>
    <tr className="border-b border-border">
      <th className="text-left py-2 font-display text-xs text-muted-foreground tracking-widest uppercase">Run length</th>
      <th className="text-right py-2 font-display text-xs text-muted-foreground tracking-widest uppercase">Bonus</th>
    </tr>
  </thead>
  <tbody>
    {[
      ["2 games", "+50"],
      ["3 games", "+100"],
      ["4 games", "+150"],
      ["5 games", "+250"],
      ["6 games", "+350"],
      ["7 games", "+500"],
      ["8 games", "+700"],
    ].map(([run, bonus]) => (
      <tr key={run} className="border-b border-border/50">
        <td className="py-1.5 text-muted-foreground">{run}</td>
        <td className="py-1.5 text-amber-400 font-display text-right">{bonus}</td>
      </tr>
    ))}
  </tbody>
</table>
```

Use the same table pattern for the Auspicious Omens reward table.

---

## Also: add "?" guide link for ladder scoring on prediction card

In `components/prediction-form.tsx`, find the existing `<GuideLink>` next to the
Ladder column label and update it to link to `#ladder-scoring` instead of
(or in addition to) `#ladder`:

```tsx
<GuideLink section="ladder-scoring" label="How ladder scoring works" />
```

---

## Verification
1. Guide page shows the actual screenshot from `public/guide/prediction-card-guide.png` ✓
2. Five numbered callout bubbles appear over the correct regions of the screenshot ✓
3. Callout bubbles use correct colors: purple (①⑤), emerald (②③), amber (④) ✓
4. "Season Ladder Scoring" section appears in sidebar nav and page ✓
5. Section covers binary scoring, sequence scoring with bonus table, and AO ✓
6. Tables render correctly with amber bonus values ✓
7. "?" button on ladder column links to `#ladder-scoring` ✓
8. Run `npx tsc --noEmit` — no errors ✓
