# Task: Automated scoring result messages in the mailbox

## Overview
After the score-calculator scores a prediction, it automatically generates a
mailbox message to the player with an itemized breakdown. The message contains:
1. A mana reward that must be manually claimed to add to spending balance
2. Mystery loot drops (unidentified until claimed — rolls the loot table on open)

This is separate from the existing manual admin broadcast messages but uses
the same `mail_messages` infrastructure.

---

## Database changes

### Add columns to `mail_messages`

```sql
-- Link scoring messages to their source prediction/season
ALTER TABLE public.mail_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'admin',
  -- 'admin' | 'score_week_one' | 'score_ladder'
  ADD COLUMN IF NOT EXISTS prediction_id uuid REFERENCES public.predictions(id),
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id),
  ADD COLUMN IF NOT EXISTS metadata jsonb,
  -- Stores structured scoring breakdown for rendering
  ADD COLUMN IF NOT EXISTS mana_reward integer NOT NULL DEFAULT 0,
  -- Spending balance mana to be claimed (0 if already claimed or no reward)
  ADD COLUMN IF NOT EXISTS mana_claimed_at timestamptz;
  -- Set when player claims the mana reward

-- Add mana_claimed_at to mail_reads (per-player claim tracking)
ALTER TABLE public.mail_reads
  ADD COLUMN IF NOT EXISTS mana_claimed_at timestamptz;

-- Deduplication index — one scoring message per prediction
CREATE UNIQUE INDEX IF NOT EXISTS mail_messages_prediction_unique
  ON public.mail_messages(prediction_id)
  WHERE prediction_id IS NOT NULL;
```

### New `mail_mystery_drops` table

```sql
-- Unidentified loot drops attached to scoring messages
-- Each row = one mystery item slot (revealed on claim via loot table roll)
CREATE TABLE public.mail_mystery_drops (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id),
  season_id    uuid NOT NULL REFERENCES public.seasons(id),
  drop_count   integer NOT NULL DEFAULT 1,  -- how many items to roll
  revealed_at  timestamptz,                 -- null until claimed
  revealed_items jsonb                      -- [{item_id, name, slug, image_url, quantity}]
);
```

---

## Metadata JSON structure

### Week-one scoring message metadata:
```json
{
  "game_id": "uuid",
  "game_name": "Hollow Knight 2",
  "result": "perfect",
  "players_midpoint": 450000,
  "players_window_low": 405000,
  "players_window_high": 495000,
  "players_correct": true,
  "actual_player_count": 462000,
  "reviews_midpoint": 91,
  "reviews_window_low": 88,
  "reviews_window_high": 94,
  "reviews_correct": true,
  "actual_review_score": 92.3,
  "mana_breakdown": [
    { "label": "Players correct", "amount": 50, "color": "cyan" },
    { "label": "Reviews correct", "amount": 50, "color": "cyan" },
    { "label": "Both correct bonus", "amount": 50, "color": "cyan" },
    { "label": "Early lock bonus", "amount": 18, "color": "amber" },
    { "label": "Evocation Distillate", "amount": 25, "color": "cyan" },
    { "label": "First prediction bonus", "amount": 50, "color": "cyan" }
  ],
  "total_mana": 243,
  "drops_awarded": 2
}
```

### Ladder scoring message metadata:
```json
{
  "final_rank": 4,
  "total_players": 12,
  "binary_matches": 3,
  "binary_mana": 150,
  "sequence_length": 4,
  "sequence_mana": 150,
  "total_ladder_mana": 300,
  "ranked_games": ["game_name_1", "game_name_2", "..."]
}
```

---

## Score-calculator changes

### `app/api/cron/score-calculator/route.ts`

After scoring each prediction, add a call to generate the scoring message.
Add a helper function at the bottom of the file:

```ts
async function generateScoringMessage(
  supabaseAdmin: SupabaseClient,
  prediction: ScoredPrediction,
  gameName: string,
) {
  // Deduplication check — skip if message already exists for this prediction
  const { data: existing } = await supabaseAdmin
    .from("mail_messages")
    .select("id")
    .eq("prediction_id", prediction.id)
    .single()

  if (existing) return // already sent, skip

  // Build mana breakdown array from prediction columns
  const breakdown = []
  if ((prediction.mana_players ?? 0) > 0)
    breakdown.push({ label: "Players correct", amount: prediction.mana_players, color: "cyan" })
  if ((prediction.mana_reviews ?? 0) > 0)
    breakdown.push({ label: "Reviews correct", amount: prediction.mana_reviews, color: "cyan" })
  if ((prediction.mana_both_bonus ?? 0) > 0)
    breakdown.push({ label: "Both correct bonus", amount: prediction.mana_both_bonus, color: "cyan" })
  if ((prediction.mana_early_lock ?? 0) > 0)
    breakdown.push({ label: "Early lock bonus", amount: prediction.mana_early_lock, color: "amber" })
  if ((prediction.mana_boosters ?? 0) > 0)
    breakdown.push({ label: "Booster bonus", amount: prediction.mana_boosters, color: "cyan" })
  if ((prediction.mana_equipment ?? 0) > 0)
    breakdown.push({ label: "Equipment bonus", amount: prediction.mana_equipment, color: "cyan" })
  if ((prediction.mana_first_prediction ?? 0) > 0)
    breakdown.push({ label: "First prediction bonus", amount: prediction.mana_first_prediction, color: "cyan" })

  const metadata = {
    game_id: prediction.game_id,
    game_name: gameName,
    result: prediction.result,
    players_midpoint: prediction.players_midpoint,
    players_window_low: prediction.players_window_low,
    players_window_high: prediction.players_window_high,
    players_correct: prediction.players_correct,
    actual_player_count: prediction.actual_player_count,
    reviews_midpoint: prediction.reviews_midpoint,
    reviews_window_low: prediction.reviews_window_low,
    reviews_window_high: prediction.reviews_window_high,
    reviews_correct: prediction.reviews_correct,
    actual_review_score: prediction.actual_review_score,
    mana_breakdown: breakdown,
    total_mana: prediction.final_points ?? 0,
    drops_awarded: prediction.drops_awarded ?? 0,
  }

  const resultLabel = prediction.result === "perfect" ? "Perfect Hit"
    : prediction.result === "partial" ? "Partial Hit"
    : "Missed"

  // Insert message
  const { data: message } = await supabaseAdmin
    .from("mail_messages")
    .insert({
      message_type: "score_week_one",
      subject: `${resultLabel} — ${gameName}`,
      body: "",  // rendered from metadata by frontend
      target: "user",
      target_user_id: prediction.user_id,
      prediction_id: prediction.id,
      season_id: prediction.season_id,
      metadata,
      mana_reward: prediction.final_points ?? 0,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (!message) return

  // Create mystery drop slot if drops were awarded
  if ((prediction.drops_awarded ?? 0) > 0) {
    await supabaseAdmin.from("mail_mystery_drops").insert({
      message_id: message.id,
      user_id: prediction.user_id,
      season_id: prediction.season_id,
      drop_count: prediction.drops_awarded,
    })
  }

  // NOTE: Do NOT add mana to spending balance here.
  // prediction_mana_earned is already updated by increment_season_mana.
  // mana_balance (spending) is only updated when player claims from mailbox.
}
```

Call this after each prediction is scored:
```ts
await generateScoringMessage(supabaseAdmin, scoredPrediction, game.name)
```

---

## New API routes

### `POST /api/mail/claim-mana`

Claims the mana reward from a scoring message, adding it to spending balance:

```ts
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message_id } = await request.json()

  // Verify message belongs to this user and has unclaimed mana
  const { data: message } = await supabase
    .from("mail_messages")
    .select("id, mana_reward, mana_claimed_at, season_id, target_user_id")
    .eq("id", message_id)
    .eq("target_user_id", user.id)
    .single()

  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (message.mana_claimed_at) return NextResponse.json({ error: "Already claimed" }, { status: 400 })
  if (!message.mana_reward || message.mana_reward <= 0) {
    return NextResponse.json({ error: "No mana to claim" }, { status: 400 })
  }

  // Add mana to spending balance (NOT leaderboard — that was already done by scorer)
  const { error: manaError } = await supabaseAdmin.rpc("add_mana_balance", {
    p_user_id: user.id,
    p_season_id: message.season_id,
    p_amount: message.mana_reward,
  })

  if (manaError) {
    return NextResponse.json({ error: "Failed to add mana" }, { status: 500 })
  }

  // Mark mana as claimed
  await supabaseAdmin
    .from("mail_messages")
    .update({ mana_claimed_at: new Date().toISOString() })
    .eq("id", message_id)

  return NextResponse.json({ success: true, mana_claimed: message.mana_reward })
}
```

### New RPC function needed — `add_mana_balance`

Add to Supabase SQL editor:
```sql
CREATE OR REPLACE FUNCTION public.add_mana_balance(
  p_user_id uuid,
  p_season_id uuid,
  p_amount integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.season_entries
  SET mana_balance = mana_balance + p_amount,
      updated_at   = now()
  WHERE user_id   = p_user_id
    AND season_id = p_season_id;
END;
$$;
```

### `POST /api/mail/claim-drops`

Rolls the loot table and reveals the mystery drop:

```ts
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message_id } = await request.json()

  // Get mystery drop row
  const { data: drop } = await supabase
    .from("mail_mystery_drops")
    .select("*")
    .eq("message_id", message_id)
    .eq("user_id", user.id)
    .single()

  if (!drop) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (drop.revealed_at) return NextResponse.json({ error: "Already opened" }, { status: 400 })

  // Roll loot table N times (drop_count)
  const { data: droppableItems } = await supabaseAdmin
    .from("items")
    .select("id, name, slug, image_url, drop_rate")
    .eq("is_droppable", true)
    .gt("drop_rate", 0)

  if (!droppableItems?.length) {
    return NextResponse.json({ error: "No droppable items" }, { status: 500 })
  }

  // Weighted random roll
  function rollLootTable(items: typeof droppableItems) {
    const total = items.reduce((sum, i) => sum + i.drop_rate, 0)
    let roll = Math.random() * total
    for (const item of items) {
      roll -= item.drop_rate
      if (roll <= 0) return item
    }
    return items[items.length - 1]
  }

  const revealed: { item_id: string, name: string, slug: string, image_url: string, quantity: number }[] = []
  for (let i = 0; i < drop.drop_count; i++) {
    const rolled = rollLootTable(droppableItems)
    const existing = revealed.find(r => r.item_id === rolled.id)
    if (existing) existing.quantity++
    else revealed.push({ item_id: rolled.id, name: rolled.name, slug: rolled.slug, image_url: rolled.image_url ?? "", quantity: 1 })
  }

  // Add items to inventory
  for (const item of revealed) {
    for (let i = 0; i < item.quantity; i++) {
      await supabaseAdmin.rpc("increment_inventory", {
        p_user_id: user.id,
        p_item_id: item.item_id,
      })
    }
    // Log to drop_history
    await supabaseAdmin.from("drop_history").insert({
      user_id: user.id,
      season_id: drop.season_id,
      item_id: item.item_id,
      source: "scoring_drop",
    })
  }

  // Mark as revealed
  await supabaseAdmin
    .from("mail_mystery_drops")
    .update({
      revealed_at: new Date().toISOString(),
      revealed_items: revealed,
    })
    .eq("id", drop.id)

  return NextResponse.json({ success: true, revealed })
}
```

---

## Mailbox UI changes — scoring messages

### Scoring message card (in `components/mailbox-client.tsx`)

Scoring messages (`message_type === 'score_week_one'`) render differently from
admin broadcast messages. They use `metadata` for structured display:

```tsx
function ScoringMessageCard({ message, mysteryDrop, onManaClaimed, onDropRevealed }) {
  const meta = message.metadata
  const isPerfect = meta.result === "perfect"
  const isPartial = meta.result === "partial"

  return (
    <div className={`border rounded-xl overflow-hidden ${
      isPerfect ? "border-emerald-500/30" : isPartial ? "border-amber-500/30" : "border-border"
    }`}>
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!message.mail_reads?.[0]?.read_at && (
            <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
          )}
          <div>
            <div className="font-display text-sm text-foreground">{message.subject}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {new Date(message.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <Link href={`/games/${meta.game_id}`}
          className="font-display text-[10px] text-purple-400 border border-purple-500/30 rounded px-2 py-1 hover:bg-purple-950/30 transition-colors">
          View Prediction →
        </Link>
      </div>

      {/* Scoring breakdown */}
      <div className="px-4 pb-3 space-y-3 border-t border-border">
        {/* Metric results */}
        <div className="grid grid-cols-2 gap-2 pt-3">
          <div className={`p-2 rounded-lg border text-xs ${
            meta.players_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"
          }`}>
            <div className="text-muted-foreground mb-1">Peak Players</div>
            <div className="font-mono font-bold text-foreground">
              {meta.actual_player_count?.toLocaleString() ?? "—"}
            </div>
            <div className="text-muted-foreground text-[10px]">
              Window: {meta.players_window_low?.toLocaleString()}–{meta.players_window_high?.toLocaleString()}
            </div>
          </div>
          <div className={`p-2 rounded-lg border text-xs ${
            meta.reviews_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"
          }`}>
            <div className="text-muted-foreground mb-1">Review Score</div>
            <div className="font-mono font-bold text-foreground">
              {meta.actual_review_score?.toFixed(1) ?? "—"}%
            </div>
            <div className="text-muted-foreground text-[10px]">
              Window: {meta.reviews_window_low}%–{meta.reviews_window_high}%
            </div>
          </div>
        </div>

        {/* Mana breakdown */}
        <div className="space-y-1">
          {meta.mana_breakdown?.map((line, i) => (
            <div key={i} className="flex justify-between text-xs text-muted-foreground">
              <span>{line.label}</span>
              <span className={line.color === "amber" ? "text-amber-400" : "text-cyan-300"}>
                +{line.amount}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-xs font-medium text-foreground border-t border-border pt-1 mt-1">
            <div className="flex items-center gap-1">
              <img src="/icons/mana-icon.png" width={12} height={12} alt="mana" />
              <span>Total mana</span>
            </div>
            <span className="text-cyan-300 font-bold">+{meta.total_mana}</span>
          </div>
        </div>

        {/* Mana claim button */}
        {!message.mana_claimed_at ? (
          <ClaimManaButton
            messageId={message.id}
            manaAmount={message.mana_reward}
            onClaimed={onManaClaimed}
          />
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-display">+{message.mana_reward} mana claimed</span>
          </div>
        )}

        {/* Mystery drop */}
        {mysteryDrop && (
          <MysteryDropSection
            drop={mysteryDrop}
            onRevealed={onDropRevealed}
          />
        )}
      </div>
    </div>
  )
}
```

### `ClaimManaButton` component

```tsx
function ClaimManaButton({ messageId, manaAmount, onClaimed }) {
  const [claiming, setClaiming] = useState(false)

  async function handleClaim() {
    setClaiming(true)
    const res = await fetch("/api/mail/claim-mana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) onClaimed(manaAmount)
    setClaiming(false)
  }

  return (
    <button onClick={handleClaim} disabled={claiming}
      className="w-full py-2 rounded-lg font-display text-xs tracking-wide bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/18 transition-colors flex items-center justify-center gap-2">
      {claiming ? <Loader2 className="h-3 w-3 animate-spin" /> : <img src="/icons/mana-icon.png" width={14} height={14} alt="mana" />}
      Claim +{manaAmount} mana
    </button>
  )
}
```

---

## Mystery Drop reveal component

### `MysteryDropSection` component

The "unopened" state shows a pulsing mystery orb. Clicking "Open" calls
`/api/mail/claim-drops` and triggers the reveal animation.

```tsx
function MysteryDropSection({ drop, onRevealed }) {
  const [opening, setOpening] = useState(false)
  const [revealed, setRevealed] = useState(drop.revealed_items ?? null)
  const [showReveal, setShowReveal] = useState(false)

  async function handleOpen() {
    setOpening(true)
    const res = await fetch("/api/mail/claim-drops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: drop.message_id }),
    })
    const data = await res.json()
    if (res.ok) {
      setRevealed(data.revealed)
      setShowReveal(true)
      onRevealed(data.revealed)
    }
    setOpening(false)
  }

  if (revealed && !showReveal) {
    // Already revealed in a previous session — show items plainly
    return (
      <div className="space-y-1">
        <div className="font-display text-[10px] text-muted-foreground/50 tracking-widest uppercase">
          Drops Received
        </div>
        {revealed.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-foreground">
            <img src={item.image_url} alt={item.name} className="w-6 h-6 rounded object-cover" />
            <span>{item.name}</span>
            {item.quantity > 1 && <span className="text-amber-400">×{item.quantity}</span>}
          </div>
        ))}
      </div>
    )
  }

  if (showReveal) {
    // Reveal animation popout — see below
    return <DropRevealModal items={revealed} onClose={() => setShowReveal(false)} />
  }

  return (
    <div className="flex items-center justify-between p-2 rounded-lg border border-amber-500/20 bg-amber-950/10">
      <div className="flex items-center gap-2">
        {/* Pulsing mystery orbs */}
        {Array.from({ length: drop.drop_count }).map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-900 to-purple-950 border border-purple-500/40 flex items-center justify-center"
            style={{ animation: `pulse 2s ease-in-out infinite ${i * 0.3}s` }}>
            <span className="text-purple-400 text-sm">?</span>
          </div>
        ))}
        <span className="font-display text-[10px] text-amber-400 tracking-wide">
          {drop.drop_count} item{drop.drop_count !== 1 ? "s" : ""} awaiting
        </span>
      </div>
      <button onClick={handleOpen} disabled={opening}
        className="font-display text-[10px] px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors">
        {opening ? "Opening..." : "Open ✨"}
      </button>
    </div>
  )
}
```

### `DropRevealModal` — the loot reveal popout

This is the visually exciting part. A full-screen overlay with a dramatic item reveal:

```tsx
function DropRevealModal({ items, onClose }) {
  const [phase, setPhase] = useState<"opening" | "revealing" | "done">("opening")
  const [visibleItems, setVisibleItems] = useState<typeof items>([])

  useEffect(() => {
    // Phase 1: opening animation (1s)
    const t1 = setTimeout(() => setPhase("revealing"), 800)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (phase !== "revealing") return
    // Reveal items one by one with delay
    items.forEach((item, i) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, item])
        if (i === items.length - 1) setPhase("done")
      }, i * 600 + 200)
    })
  }, [phase, items])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)" }}>

      {/* Opening phase — spinning orb */}
      {phase === "opening" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 via-purple-600 to-amber-400 animate-spin"
            style={{ boxShadow: "0 0 40px rgba(217,119,6,0.6), 0 0 80px rgba(157,132,212,0.4)" }}
          />
          <div className="font-display text-lg text-amber-400 tracking-widest animate-pulse">
            Opening...
          </div>
        </div>
      )}

      {/* Revealing phase — items appear */}
      {(phase === "revealing" || phase === "done") && (
        <div className="flex flex-col items-center gap-8 px-8">
          <div className="font-display text-2xl text-amber-400 tracking-widest">
            {items.length > 1 ? "Items Revealed!" : "Item Revealed!"}
          </div>

          <div className="flex flex-wrap gap-6 justify-center">
            {visibleItems.map((item, i) => (
              <div key={i}
                className="flex flex-col items-center gap-2"
                style={{ animation: "scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
              >
                <div className="w-24 h-24 rounded-xl border-2 border-amber-500 overflow-hidden"
                  style={{ boxShadow: "0 0 20px rgba(217,119,6,0.4)" }}>
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="font-display text-xs text-amber-300 text-center max-w-[100px]">
                  {item.name}
                </div>
                {item.quantity > 1 && (
                  <div className="font-display text-xs text-amber-400">×{item.quantity}</div>
                )}
              </div>
            ))}
          </div>

          {phase === "done" && (
            <button onClick={onClose}
              className="font-display text-sm px-6 py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors tracking-wide">
              Claim to Inventory
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

Add to `app/globals.css`:
```css
@keyframes scale-in {
  0% { transform: scale(0) rotate(-10deg); opacity: 0; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
```

---

## Ladder scoring message (season end)

Add a similar `generateLadderMail` helper to the score-calculator for season-end
ladder scoring. Same pattern — insert one message per player with ladder breakdown
in metadata. No mana reward (season is over, spending balance irrelevant) and no
drops. Just the breakdown for the record.

```ts
async function generateLadderMail(supabaseAdmin, ladderResult, userId, seasonId, seasonName) {
  // Deduplication: one ladder message per user per season
  const { data: existing } = await supabaseAdmin
    .from("mail_messages")
    .select("id")
    .eq("season_id", seasonId)
    .eq("target_user_id", userId)
    .eq("message_type", "score_ladder")
    .single()

  if (existing) return

  await supabaseAdmin.from("mail_messages").insert({
    message_type: "score_ladder",
    subject: `${seasonName} — Final Ladder Results`,
    body: "",
    target: "user",
    target_user_id: userId,
    season_id: seasonId,
    mana_reward: 0,  // no spending balance reward for ladder
    metadata: {
      final_rank: ladderResult.rank,
      total_players: ladderResult.totalPlayers,
      binary_matches: ladderResult.binaryMatches,
      binary_mana: ladderResult.binaryMana,
      sequence_length: ladderResult.sequenceLength,
      sequence_mana: ladderResult.sequenceMana,
      total_ladder_mana: ladderResult.totalMana,
    },
    is_published: true,
    published_at: new Date().toISOString(),
  })
}
```

---

## Verification checklist
1. Score-calculator scores a prediction → scoring message appears in player mailbox ✓
2. Running score-calculator again → no duplicate message (deduplication works) ✓
3. Mana breakdown matches final_points on predictions table ✓
4. "Claim mana" button adds mana to spending balance (header badge updates) ✓
5. Claiming mana twice returns "Already claimed" error ✓
6. Mystery drop "?" orbs appear for predictions with drops_awarded > 0 ✓
7. Clicking "Open" triggers spinning orb animation, then items reveal one by one ✓
8. Items are added to inventory after reveal ✓
9. Revisiting mailbox after claiming: shows items plainly, no re-open button ✓
10. "View Prediction →" link navigates to correct /games/[game_id] ✓
11. Ladder scoring message appears at season end with no claim button ✓
12. Run `npx tsc --noEmit` — no errors ✓
