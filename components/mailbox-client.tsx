"use client"

import { useState, useEffect } from "react"
import { ChevronDown, CheckCircle2, Loader2, Trophy } from "lucide-react"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────

interface MailAttachment {
  quantity: number
  items: { id: string; name: string; slug: string; image_url: string | null } | null
}

interface MysteryDrop {
  id: string
  drop_count: number
  revealed_at: string | null
  revealed_items: RevealedItem[] | null
}

interface RevealedItem {
  item_id: string
  name: string
  slug: string
  image_url: string | null
  quantity: number
}

interface ManaBreakdownLine {
  label: string
  amount: number
  color: "cyan" | "amber"
}

interface ScoringMetadata {
  game_id: string
  game_name: string
  result: "perfect" | "partial" | "failed"
  players_midpoint: number | null
  players_window_low: number | null
  players_window_high: number | null
  players_correct: boolean | null
  actual_player_count: number | null
  reviews_midpoint: number | null
  reviews_window_low: number | null
  reviews_window_high: number | null
  reviews_correct: boolean | null
  actual_review_score: number | null
  mana_breakdown: ManaBreakdownLine[]
  total_mana: number
  drops_awarded: number
}

interface LadderMetadata {
  binary_mana: number
  sequence_length: number
  sequence_mana: number
  ao_all_correct: boolean | null
  ao_mana: number
  total_mana: number
}

interface MailMessage {
  id: string
  subject: string
  body: string
  created_at: string
  expires_at: string | null
  message_type: string
  metadata: unknown
  mana_reward: number | null
  mana_claimed_at: string | null
  prediction_id: string | null
  season_id: string | null
  mail_reads: unknown
  mail_attachments: MailAttachment[]
  mail_mystery_drops: unknown
}

// ─── Helpers ──────────────────────────────────────────────────

function getReadRow(reads: unknown): { read_at: string | null; claimed_at: string | null } | null {
  if (!reads) return null
  const row = Array.isArray(reads) ? reads[0] : reads
  if (!row || typeof row !== "object") return null
  return row as { read_at: string | null; claimed_at: string | null }
}

function getMysteryDrop(drops: unknown): MysteryDrop | null {
  if (!drops) return null
  const row = Array.isArray(drops) ? drops[0] : drops
  if (!row || typeof row !== "object") return null
  return row as MysteryDrop
}

function fmtPlayers(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M"
  if (n >= 1000) return Math.round(n / 1000) + "K"
  return String(n)
}

// ─── ClaimManaButton ──────────────────────────────────────────

function ClaimManaButton({ messageId, manaAmount, onClaimed }: {
  messageId: string
  manaAmount: number
  onClaimed: () => void
}) {
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState("")

  async function handleClaim() {
    setClaiming(true)
    setError("")
    const res = await fetch("/api/mail/claim-mana", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    if (res.ok) {
      onClaimed()
    } else {
      const data = await res.json()
      setError(data.error || "Failed to claim")
    }
    setClaiming(false)
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleClaim}
        disabled={claiming}
        className="w-full py-2 rounded-lg font-display text-xs tracking-wide bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 hover:bg-cyan-500/18 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {claiming
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <img src="/icons/mana-icon.png" alt="" width={14} height={14} />
        }
        Claim +{manaAmount.toLocaleString()} mana to spending balance
      </button>
      {error && <p className="text-xs text-red-400 font-body text-center">{error}</p>}
    </div>
  )
}

// ─── DropRevealModal ──────────────────────────────────────────

function DropRevealModal({ items, onClose }: { items: RevealedItem[]; onClose: () => void }) {
  const [phase, setPhase] = useState<"opening" | "revealing" | "done">("opening")
  const [visibleItems, setVisibleItems] = useState<RevealedItem[]>([])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("revealing"), 800)
    return () => clearTimeout(t1)
  }, [])

  useEffect(() => {
    if (phase !== "revealing") return
    items.forEach((item, i) => {
      setTimeout(() => {
        setVisibleItems(prev => [...prev, item])
        if (i === items.length - 1) setPhase("done")
      }, i * 600 + 200)
    })
  }, [phase, items])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(4px)" }}
    >
      {phase === "opening" && (
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-24 h-24 rounded-full animate-spin"
            style={{
              background: "conic-gradient(from 0deg, #d97706, #9D84D4, #d97706)",
              boxShadow: "0 0 40px rgba(217,119,6,0.6), 0 0 80px rgba(157,132,212,0.4)",
            }}
          />
          <div className="font-display text-lg text-amber-400 tracking-widest animate-pulse">
            Opening…
          </div>
        </div>
      )}

      {(phase === "revealing" || phase === "done") && (
        <div className="flex flex-col items-center gap-8 px-8">
          <div className="font-display text-2xl text-amber-400 tracking-widest">
            {items.length > 1 ? "Items Revealed!" : "Item Revealed!"}
          </div>

          <div className="flex flex-wrap gap-6 justify-center">
            {visibleItems.map((item, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-2"
                style={{ animation: "scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both" }}
              >
                <div
                  className="w-24 h-24 rounded-xl border-2 border-amber-500 overflow-hidden"
                  style={{ boxShadow: "0 0 20px rgba(217,119,6,0.4)" }}
                >
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-amber-950/50 flex items-center justify-center text-2xl">⚗</div>
                  }
                </div>
                <div className="font-display text-xs text-amber-300 text-center max-w-[100px]">{item.name}</div>
                {item.quantity > 1 && <div className="font-display text-xs text-amber-400">×{item.quantity}</div>}
              </div>
            ))}
          </div>

          {phase === "done" && (
            <button
              onClick={onClose}
              className="font-display text-sm px-6 py-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors tracking-wide"
            >
              Added to Inventory ✓
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MysteryDropSection ───────────────────────────────────────

function MysteryDropSection({ drop, messageId }: { drop: MysteryDrop; messageId: string }) {
  const [opening, setOpening] = useState(false)
  const [revealedItems, setRevealedItems] = useState<RevealedItem[] | null>(
    drop.revealed_items ?? null
  )
  const [showModal, setShowModal] = useState(false)
  const [error, setError] = useState("")

  async function handleOpen() {
    setOpening(true)
    setError("")
    const res = await fetch("/api/mail/claim-drops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId }),
    })
    const data = await res.json()
    if (res.ok) {
      setRevealedItems(data.revealed)
      setShowModal(true)
    } else {
      setError(data.error || "Failed to open")
    }
    setOpening(false)
  }

  // Already revealed — show items plainly
  if (revealedItems && !showModal) {
    return (
      <div className="space-y-1.5">
        <div className="text-[9px] font-display tracking-widest uppercase text-amber-600/60">
          Drops Received
        </div>
        {revealedItems.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {item.image_url && (
              <img src={item.image_url} alt={item.name} className="w-6 h-6 rounded object-cover" />
            )}
            <span className="text-foreground font-body">{item.name}</span>
            {item.quantity > 1 && <span className="text-amber-400 font-display">×{item.quantity}</span>}
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {showModal && revealedItems && (
        <DropRevealModal items={revealedItems} onClose={() => setShowModal(false)} />
      )}
      <div className="flex items-center justify-between p-2.5 rounded-lg border border-amber-500/20 bg-amber-950/10">
        <div className="flex items-center gap-2">
          {Array.from({ length: drop.drop_count }).map((_, i) => (
            <div
              key={i}
              className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-900 to-purple-950 border border-purple-500/40 flex items-center justify-center"
              style={{ animation: `pulse 2s ease-in-out infinite ${i * 0.3}s` }}
            >
              <span className="text-purple-400 text-sm">?</span>
            </div>
          ))}
          <span className="font-display text-[10px] text-amber-400 tracking-wide">
            {drop.drop_count} {drop.drop_count === 1 ? "item" : "items"} awaiting
          </span>
        </div>
        <button
          onClick={handleOpen}
          disabled={opening}
          className="font-display text-[10px] px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
        >
          {opening ? "Opening…" : "Open ✨"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 font-body">{error}</p>}
    </>
  )
}

// ─── ScoringMessageCard ───────────────────────────────────────

function ScoringMessageCard({ msg, isRead, onRead }: {
  msg: MailMessage
  isRead: boolean
  onRead: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [manaClaimed, setManaClaimed] = useState(!!msg.mana_claimed_at)
  const meta = msg.metadata as ScoringMetadata | LadderMetadata | null
  const mysteryDrop = getMysteryDrop(msg.mail_mystery_drops)
  const date = new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const isScoreWeekOne = msg.message_type === "score_week_one"
  const scoreMeta = isScoreWeekOne ? meta as ScoringMetadata : null
  const isPerfect = scoreMeta?.result === "perfect"
  const isPartial = scoreMeta?.result === "partial"

  async function toggle() {
    const opening = !expanded
    setExpanded(opening)
    if (opening && !isRead) {
      onRead()
      fetch("/api/mail/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msg.id }),
      }).catch(() => {})
    }
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      isPerfect ? "border-emerald-500/30" :
      isPartial ? "border-amber-500/30" :
      isRead ? "border-border" : "border-purple-500/40 bg-purple-950/[0.06]"
    }`}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        onClick={toggle}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${isRead ? "bg-transparent" : "bg-purple-500"}`} />
        <div className="flex-1 min-w-0">
          <div className={`font-display text-sm truncate ${isRead ? "text-muted-foreground" : "text-foreground"}`}>
            {msg.subject}
          </div>
        </div>
        {!manaClaimed && (msg.mana_reward ?? 0) > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <img src="/icons/mana-icon.png" alt="" width={10} height={10} />
            <span className="font-display text-[10px] text-cyan-300/70">+{(msg.mana_reward ?? 0).toLocaleString()}</span>
          </div>
        )}
        <span className="text-[10px] text-muted-foreground/40 font-body shrink-0">{date}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} />
      </button>

      {/* Expanded body */}
      {expanded && scoreMeta && (
        <div className="border-t border-border/40 px-4 py-4 space-y-4">
          {/* Metric results grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2.5 rounded-lg border text-xs ${scoreMeta.players_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
              <div className="text-muted-foreground mb-1 font-body">Peak Players</div>
              <div className="font-mono font-bold text-foreground">
                {scoreMeta.actual_player_count != null ? fmtPlayers(scoreMeta.actual_player_count) : "—"}
              </div>
              <div className="text-muted-foreground text-[10px] font-body mt-0.5">
                Window: {scoreMeta.players_window_low != null ? fmtPlayers(scoreMeta.players_window_low) : "—"}–{scoreMeta.players_window_high != null ? fmtPlayers(scoreMeta.players_window_high) : "—"}
              </div>
            </div>
            <div className={`p-2.5 rounded-lg border text-xs ${scoreMeta.reviews_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
              <div className="text-muted-foreground mb-1 font-body">Review Score</div>
              <div className="font-mono font-bold text-foreground">
                {scoreMeta.actual_review_score != null ? `${scoreMeta.actual_review_score.toFixed(1)}%` : "—"}
              </div>
              <div className="text-muted-foreground text-[10px] font-body mt-0.5">
                Window: {scoreMeta.reviews_window_low ?? "—"}%–{scoreMeta.reviews_window_high ?? "—"}%
              </div>
            </div>
          </div>

          {/* Mana breakdown */}
          {scoreMeta.mana_breakdown?.length > 0 && (
            <div className="space-y-1">
              {scoreMeta.mana_breakdown.map((line, i) => (
                <div key={i} className="flex justify-between text-xs text-muted-foreground font-body">
                  <span>{line.label}</span>
                  <span className={line.color === "amber" ? "text-amber-400" : "text-cyan-300"}>+{line.amount}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-medium border-t border-border pt-1 mt-1">
                <div className="flex items-center gap-1 text-foreground">
                  <img src="/icons/mana-icon.png" alt="" width={12} height={12} />
                  <span>Total mana</span>
                </div>
                <span className="text-cyan-300 font-display">+{scoreMeta.total_mana.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <div className="flex items-center gap-1 text-foreground">
                  <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
                  <span>Season score</span>
                </div>
                <span className="text-amber-400 font-display">+{scoreMeta.total_mana.toLocaleString()} pts</span>
              </div>
            </div>
          )}

          {/* Mana claim */}
          {manaClaimed ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="font-display">+{(msg.mana_reward ?? 0).toLocaleString()} mana added to spending balance</span>
            </div>
          ) : (msg.mana_reward ?? 0) > 0 ? (
            <ClaimManaButton
              messageId={msg.id}
              manaAmount={msg.mana_reward ?? 0}
              onClaimed={() => setManaClaimed(true)}
            />
          ) : null}

          {/* Mystery drops */}
          {mysteryDrop && (
            <MysteryDropSection drop={mysteryDrop} messageId={msg.id} />
          )}

          {/* Link to game prediction */}
          {scoreMeta.game_id && (
            <Link
              href={`/games/${scoreMeta.game_id}`}
              className="inline-block font-display text-[10px] text-purple-400 border border-purple-500/30 rounded px-2.5 py-1 hover:bg-purple-950/30 transition-colors"
            >
              View Prediction →
            </Link>
          )}
        </div>
      )}

      {/* Ladder message body */}
      {expanded && msg.message_type === "score_ladder" && meta && (
        <div className="border-t border-border/40 px-4 py-4 space-y-2">
          {[
            { label: "Binary matches", value: `+${(meta as LadderMetadata).binary_mana}`, color: "text-cyan-300" },
            { label: `Sequence run (${(meta as LadderMetadata).sequence_length} games)`, value: `+${(meta as LadderMetadata).sequence_mana}`, color: "text-cyan-300" },
            ...(((meta as LadderMetadata).ao_mana ?? 0) > 0
              ? [{ label: "Auspicious Omens", value: `+${(meta as LadderMetadata).ao_mana}`, color: "text-amber-400" }]
              : []),
          ].map((row, i) => (
            <div key={i} className="flex justify-between text-xs font-body text-muted-foreground">
              <span>{row.label}</span>
              <span className={row.color}>{row.value}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs font-medium border-t border-border pt-1">
            <div className="flex items-center gap-1 text-foreground">
              <img src="/icons/mana-icon.png" alt="" width={12} height={12} />
              <span>Total mana</span>
            </div>
            <span className="text-cyan-300 font-display">+{((meta as LadderMetadata).total_mana ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <div className="flex items-center gap-1 text-foreground">
              <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
              <span>Season score</span>
            </div>
            <span className="text-amber-400 font-display">+{((meta as LadderMetadata).total_mana ?? 0).toLocaleString()} pts</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── AdminMessageCard (unchanged behaviour) ───────────────────

function AdminMessageCard({ msg, isRead, isClaimed, onRead, onClaim }: {
  msg: MailMessage
  isRead: boolean
  isClaimed: boolean
  onRead: () => void
  onClaim: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState("")
  const isExpired = msg.expires_at ? new Date(msg.expires_at) < new Date() : false
  const date = new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })

  async function toggle() {
    const opening = !expanded
    setExpanded(opening)
    if (opening && !isRead) {
      onRead()
      fetch("/api/mail/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: msg.id }),
      }).catch(() => {})
    }
  }

  async function handleClaim() {
    setClaiming(true)
    setClaimError("")
    const res = await fetch("/api/mail/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: msg.id }),
    })
    const data = await res.json()
    if (!res.ok) setClaimError(data.error || "Failed to claim")
    else onClaim(msg.id)
    setClaiming(false)
  }

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      isRead ? "border-border bg-card" : "border-purple-500/40 bg-purple-950/[0.08]"
    }`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        onClick={toggle}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${isRead ? "bg-transparent" : "bg-purple-500"}`} />
        <span className={`flex-1 font-display text-sm truncate ${isRead ? "text-muted-foreground" : "text-foreground"}`}>
          {msg.subject}
        </span>
        {msg.mail_attachments.length > 0 && <span className="text-amber-400/60 text-xs shrink-0">📦</span>}
        <span className="text-[10px] text-muted-foreground/40 font-body shrink-0">{date}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} />
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-4 space-y-4">
          <p className="text-sm font-body text-muted-foreground leading-relaxed whitespace-pre-wrap">{msg.body}</p>

          {msg.mail_attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-[9px] font-display tracking-widest uppercase text-muted-foreground/40">Attachments</div>
              {msg.mail_attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                  {att.items?.image_url && (
                    <img src={att.items.image_url} alt={att.items.name} className="w-8 h-8 rounded-md object-cover shrink-0" />
                  )}
                  <span className="flex-1 text-sm font-body text-foreground">
                    {att.quantity > 1 && <span className="text-amber-400 font-display">{att.quantity}× </span>}
                    {att.items?.name ?? "Unknown item"}
                  </span>
                  {isClaimed ? (
                    <span className="text-xs font-display text-emerald-400 shrink-0">✓ Claimed</span>
                  ) : isExpired ? (
                    <span className="text-xs font-body text-muted-foreground/50 shrink-0">Expired</span>
                  ) : (
                    <button
                      onClick={handleClaim}
                      disabled={claiming}
                      className="px-3 py-1 rounded-lg text-xs font-display bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {claiming ? "Claiming…" : "Claim"}
                    </button>
                  )}
                </div>
              ))}
              {claimError && <p className="text-xs text-red-400 font-body">{claimError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main MailboxClient ───────────────────────────────────────

interface MailboxClientProps {
  messages: MailMessage[]
}

export function MailboxClient({ messages }: MailboxClientProps) {
  const [read, setRead] = useState<Set<string>>(new Set(
    messages.filter(m => getReadRow(m.mail_reads)?.read_at).map(m => m.id)
  ))
  const [claimed, setClaimed] = useState<Set<string>>(new Set(
    messages.filter(m => getReadRow(m.mail_reads)?.claimed_at).map(m => m.id)
  ))

  if (messages.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground font-body">
        Your mailbox is empty.
      </div>
    )
  }

  const unreadCount = messages.filter(m => !read.has(m.id)).length

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <p className="text-xs font-body text-muted-foreground">
          {unreadCount} unread {unreadCount === 1 ? "message" : "messages"}
        </p>
      )}

      <div className="space-y-3">
        {messages.map(msg => {
          const isRead = read.has(msg.id)

          if (msg.message_type === "score_week_one" || msg.message_type === "score_ladder") {
            return (
              <ScoringMessageCard
                key={msg.id}
                msg={msg}
                isRead={isRead}
                onRead={() => setRead(prev => new Set([...prev, msg.id]))}
              />
            )
          }

          return (
            <AdminMessageCard
              key={msg.id}
              msg={msg}
              isRead={isRead}
              isClaimed={claimed.has(msg.id)}
              onRead={() => setRead(prev => new Set([...prev, msg.id]))}
              onClaim={id => setClaimed(prev => new Set([...prev, id]))}
            />
          )
        })}
      </div>
    </div>
  )
}
