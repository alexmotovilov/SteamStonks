# Task: Build player mailbox system

## Overview
A one-way communication system where admins send messages to players. Players
receive messages in a `/mailbox` page. Messages can optionally have booster items
attached that players can claim. An unread indicator appears on the nav link.

---

## Database schema (run migrations first)

```sql
-- Messages created by admins
CREATE TABLE public.mail_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.profiles(id),
  subject       text NOT NULL,
  body          text NOT NULL,
  target        text NOT NULL DEFAULT 'all',  -- 'all' or specific user_id
  target_user_id uuid REFERENCES public.profiles(id),  -- null if target='all'
  expires_at    timestamptz,  -- optional expiry for booster claims
  is_published  boolean NOT NULL DEFAULT false,
  published_at  timestamptz
);

-- Per-player read + claim state
CREATE TABLE public.mail_reads (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at       timestamptz,
  claimed_at    timestamptz,  -- when booster attachment was claimed
  UNIQUE(message_id, user_id)
);

-- Booster attachments on messages (0 or more per message)
CREATE TABLE public.mail_attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  item_id       uuid NOT NULL REFERENCES public.items(id),
  quantity      integer NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX ON public.mail_reads(user_id, read_at);
CREATE INDEX ON public.mail_messages(is_published, created_at);
```

---

## API routes to create

### `POST /api/mail/read` — mark a message as read
```ts
// Body: { message_id: string }
// Upserts a mail_reads row with read_at = now()
```

### `POST /api/mail/claim` — claim booster attachments
```ts
// Body: { message_id: string }
// Guards: message must be published, not expired, not already claimed
// Uses supabaseAdmin to:
//   1. Check mail_reads row exists and claimed_at is null
//   2. For each mail_attachment: call increment_inventory(user_id, item_id) × quantity
//   3. Set mail_reads.claimed_at = now()
// Returns: { success: true, items_claimed: N }
```

### `POST /api/admin/mail/send` — admin sends a message (admin only)
```ts
// Body: { subject, body, target: 'all'|'user', target_user_id?, attachments: [{item_id, quantity}][], expires_days? }
// Creates mail_messages row + mail_attachments rows
// Sets is_published = true, published_at = now()
```

---

## Pages to create

### `app/(authenticated)/mailbox/page.tsx` — player mailbox

**Server component** — fetches messages for this player:
```ts
// Get all published messages targeting this player (all + personal)
const { data: messages } = await supabase
  .from("mail_messages")
  .select(`
    id, subject, body, created_at, expires_at,
    mail_reads!left(read_at, claimed_at),
    mail_attachments(
      quantity,
      items:item_id(id, name, slug, image_url)
    )
  `)
  .eq("is_published", true)
  .or(`target.eq.all,target_user_id.eq.${user.id}`)
  .order("created_at", { ascending: false })
```

**Layout:**
```
/mailbox

  📬 Mailbox                        [2 unread]

  ┌──────────────────────────────────────────┐
  │ ● Season I Begins Tomorrow!    May 19    │  ← unread (dot)
  │   Greetings, seer. The first season...  │
  │   📦 1× Evocation Distillate  [Claim]   │
  └──────────────────────────────────────────┘
  ┌──────────────────────────────────────────┐
  │   Welcome to Prognos            May 1    │  ← read (no dot)
  │   Your journey as a seer begins...      │
  └──────────────────────────────────────────┘
```

**Message card design:**
- Unread: subtle left border `border-l-2 border-purple-500`, slightly brighter bg
- Read: normal border, muted
- Subject: `font-display` medium weight
- Date: right-aligned muted small
- Body: `font-body` (IM Fell English), max 3 lines collapsed, expand on click
- Unread dot: small purple circle left of subject
- Attachment section: shown below body when present
  - Item image (32px) + name + quantity
  - "Claim" button → calls `/api/mail/claim`
  - After claim: button replaced with "✓ Claimed" in emerald, item added to inventory
  - Expired: "Expired" in muted if `expires_at` has passed
- Mark as read automatically when message card is clicked/expanded

**Client component for interactivity:** `components/mailbox-client.tsx`
Handles expand/collapse, claim button state, read marking via fetch calls.

---

### `app/(authenticated)/admin/mail/page.tsx` — compose and send mail

**Add to admin nav** alongside existing admin pages.

**Compose form:**
```
Subject: [_________________________]

Body:    [                         ]
         [  (textarea, 4 rows)     ]
         [_________________________]

Target:  ○ All players
         ○ Specific player: [dropdown of profiles]

Attach booster: [dropdown of items] × [quantity 1-5]  [+ Add another]

Expires: [  ] days (leave blank = never)

[Preview]  [Send to all players]
```

**Implementation:**
```tsx
// components/admin-mail-compose.tsx — "use client"
// Form state, attachment rows, submit → POST /api/admin/mail/send
// On success: show "Message sent to N players" confirmation
```

**Message history section** below compose form:
- List of previously sent messages with send date, subject, target
- No delete/edit (messages are permanent once sent)

---

## Header unread indicator

### New component: `components/mailbox-indicator.tsx`

Same pattern as `PendingPredictionsIndicator` — wraps the Mailbox nav link:

```tsx
"use client"

export function MailboxIndicator({ user, children, href, className }) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const supabase = createClient()
    async function check() {
      // Count messages where no mail_reads row exists OR read_at is null
      const { count } = await supabase
        .from("mail_messages")
        .select("id", { count: "exact", head: true })
        .eq("is_published", true)
        .or(`target.eq.all,target_user_id.eq.${user.id}`)
        // Not yet read by this user
        .not("mail_reads.read_at", "is", null)  // adjust join logic as needed

      setUnreadCount(count ?? 0)
    }
    check()
  }, [user.id])

  // Simpler approach — fetch unread count via a dedicated query:
  // SELECT count(*) FROM mail_messages m
  // LEFT JOIN mail_reads r ON r.message_id = m.id AND r.user_id = $user_id
  // WHERE m.is_published = true
  // AND (m.target = 'all' OR m.target_user_id = $user_id)
  // AND r.read_at IS NULL

  if (unreadCount === 0) return <Link href={href} className={className}>{children}</Link>

  return (
    <Link href={href} className={`${className} relative rounded px-2 py-0.5`}
      style={{
        outline: "1.5px solid rgba(157,132,212,0.6)",
        outlineOffset: "2px",
        animation: "pulse-border 2s ease-in-out infinite",
      }}
    >
      {children}
      {/* Unread count badge */}
      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center font-display text-[9px] text-white leading-none">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    </Link>
  )
}
```

Note: uses **purple** border (brand color) rather than emerald — mailbox is
communication, not a prediction action. Keeps the two indicators visually distinct.

### Add to `components/header.tsx`

```tsx
import { MailboxIndicator } from "@/components/mailbox-indicator"

// In nav, add after Archives link:
{user && (
  <Suspense fallback={
    <Link href="/mailbox" className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display">
      Mailbox
    </Link>
  }>
    <MailboxIndicator user={user} href="/mailbox"
      className="text-sm text-muted-foreground hover:text-foreground transition-colors font-display">
      Mailbox
    </MailboxIndicator>
  </Suspense>
)}
```

Must be in `<Suspense>` — same hydration mismatch prevention as other header badges.

---

## Nav order (final)
Games · Vendor · Archives · Mailbox · Admin (admin only)

---

## RLS policies needed

```sql
-- Players can read published messages targeting them
CREATE POLICY "players read own mail" ON public.mail_messages
  FOR SELECT USING (
    is_published = true AND
    (target = 'all' OR target_user_id = auth.uid())
  );

-- Players can read/write their own mail_reads rows
CREATE POLICY "players manage own reads" ON public.mail_reads
  FOR ALL USING (user_id = auth.uid());

-- Players can read attachments for messages they can see
CREATE POLICY "players read attachments" ON public.mail_attachments
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM mail_messages
      WHERE is_published = true
      AND (target = 'all' OR target_user_id = auth.uid())
    )
  );

-- Only admins can insert mail_messages
CREATE POLICY "admins send mail" ON public.mail_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

---

## Verification checklist
1. Admin creates a message with subject, body, and 1× Scrying Orb Polish attachment ✓
2. Player navigates to /mailbox — message appears with purple unread border ✓
3. Mailbox nav link shows purple pulsing border + unread count badge ✓
4. Player clicks message — expands, read_at is set, indicator disappears ✓
5. Player clicks "Claim" — booster added to inventory, button shows "✓ Claimed" ✓
6. Player refreshes — claimed state persists, inventory shows the item ✓
7. Message with expires_at in the past shows "Expired" instead of Claim button ✓
8. Admin-targeted message only appears for that player, not others ✓
9. Non-admin cannot access /api/admin/mail/send (returns 403) ✓
10. Run `npx tsc --noEmit` — no errors ✓
