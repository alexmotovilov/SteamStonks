# Task: Fix two prediction card bugs

## Bug 1 — Rite confirmation popover not opening

### Symptom
Clicking a rite circle on the prediction card does nothing — the confirmation
popover does not appear. The rite cannot be activated.

### Investigation
Read `components/prediction-form.tsx` carefully, specifically the `RiteCircle`
component. The confirmation popover is controlled by `const [open, setOpen] = useState(false)`
and toggled by the button's `onClick`.

Check for these likely causes:

1. **The button is disabled** — the `disabled` prop on the button prevents onClick
   from firing. Check the disabled condition passed to RiteCircle from the parent:
   ```tsx
   disabled={isFullyLocked || (rite.slug === "temporal_translocation" && !isEarlyLocked) || ...}
   ```
   If `isFullyLocked` is incorrectly true, all rites will be unclickable.
   Log `isFullyLocked`, `isSeasonClosed`, `existingPrediction?.is_locked`, `isReleased`
   to verify.

2. **The click handler condition** — the button onClick does:
   ```tsx
   onClick={() => !disabled && !isPerformed && setOpen(o => !o)}
   ```
   If `isPerformed` is incorrectly true (e.g. `performedRites` is pre-populated
   from `applied_rites` on the existing prediction), all rites will be unclickable.
   Check what `existingPrediction?.applied_rites` contains and how `performedRites`
   is initialized.

3. **z-index or overflow clipping** — the popover uses `z-50` but a parent container
   may have `overflow: hidden` clipping it. The popover is `absolute` positioned
   relative to the rite item div.

4. **The hover tooltip interfering** — the `hovered` state and the `open` state
   share the same component. If `hovered` is somehow blocking the click event,
   the popover won't open. Check that `onMouseLeave` properly sets `hovered` to false.

### Fix
After identifying the root cause:
- If `isFullyLocked` is wrong: fix the condition that computes it
- If `isPerformed` is wrong: fix how `performedRites` is initialized from existing data
- If overflow/z-index: change popover to `position: fixed` using viewport coordinates
  (same as the hover tooltip approach already used in the component)
- If hover interference: ensure hover state and click state are independent

---

## Bug 2 — Gem slider thumb offset from center of green range bar

### Symptom
On the "Highest Player Count - Week 1" slider, the trilliant gem thumb appears
offset to the right of the center of the green range bar, rather than centered
within it. This is most noticeable at low player count values (e.g. 10,000).

### Root cause
`gem-slider.tsx` uses two separate coordinate systems that are not synchronized:

- **Gem position** is derived from the native `<input type="range">` value, which
  internally uses 0–1000 positions (the `LOG_STEPS` range). The SVG x position
  is computed as: `(logPos / LOG_STEPS) * SVG_W`

- **Range bar and tick positions** are computed via `valToSvg(value)` which calls
  `toLogPos(v, min, max) / LOG_STEPS * SVG_W`

These should be identical, but the gem SVG position may be computed from the
raw slider value rather than the log-converted position.

### Fix
Read `components/gem-slider.tsx` carefully. Find where `gemX` is computed and
ensure it uses the SAME log-scale conversion as `lowX` and `highX`:

```ts
// All three must use the same valToSvg function:
const valToSvg = (v: number) => logScale
  ? (toLogPos(v, min, max) / LOG_STEPS) * SVG_W
  : toSvgX(v, min, max)

const gemX  = valToSvg(value)      // ← must use valToSvg, NOT a linear conversion
const lowX  = valToSvg(windowLow)
const highX = valToSvg(windowHigh)
```

Also check the native input value sync. The native `<input type="range">` uses
0–LOG_STEPS internally when logScale is true:
```ts
value={logScale ? toLogPos(value, min, max) : value}
```

But the SVG gem position must be derived from the actual player count value
through `valToSvg`, not from the internal slider position. If they are getting
out of sync, add a useEffect or useMemo to ensure gemX always reflects the
current `value` prop through the log conversion.

### Verification
- At default 10,000 players: gem should be centered in the green range bar
- Drag the slider left (low values ~100-1000): gem stays centered in range bar
- Drag the slider right (high values ~1M-2M): gem stays centered in range bar
- Reviews slider (linear): gem still centered correctly (no regression)
- Run `npx tsc --noEmit` — no errors
