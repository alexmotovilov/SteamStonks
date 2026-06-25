"use client"

const LETTER_TEXT_SHADOW = "0 0 2px #000, 0 0 2px #000, 0 0 2px #000, 0 0 4px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9)"

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import { CheckCircle2, Loader2, Trash2 } from "lucide-react"
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
  season_name?: string
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

function getReadRow(reads: unknown): { read_at: string | null; claimed_at: string | null; deleted_at: string | null } | null {
  if (!reads) return null
  const row = Array.isArray(reads) ? reads[0] : reads
  if (!row || typeof row !== "object") return null
  return row as { read_at: string | null; claimed_at: string | null; deleted_at: string | null }
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

  async function handleClaim(e: React.MouseEvent) {
    e.stopPropagation()
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

  async function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
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

// ─── ExpandedPanel ────────────────────────────────────────────
// Rendered via portal into document.body — appears on left 50% of screen

function ExpandedPanel({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  return (
    <>
      {createPortal(
        <div
          style={{
            position: "fixed", left: 0, top: 0,
            width: "50vw", height: "100vh",
            zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            className="relative"
            style={{
              width: "85%",
              transform: `translateX(40px) translateY(175px) scale(${hovered ? 1.0 : 0.95})`,
              transition: "transform 0.2s ease",
              pointerEvents: "auto",
            }}
            onClickCapture={e => {
              if (!(e.target as HTMLElement).closest("button, a, [role='button']")) {
                setModalOpen(true)
              }
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <img src="/letter-background.png" alt="" className="w-full h-auto block" />
            <div className="absolute inset-0 flex items-center justify-center">
              {children}
            </div>
          </div>
        </div>,
        document.body
      )}

      {modalOpen && createPortal(
        <div
          style={{
            position: "fixed", inset: 0,
            zIndex: 60,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.65)",
          }}
        >
          <div
            className="relative"
            style={{ width: "62vw", maxWidth: "860px" }}
          >
            <img src="/letter-background.png" alt="" className="w-full h-auto block" />
            <button
              onClick={() => setModalOpen(false)}
              className="absolute z-10 flex items-center justify-center rounded bg-black/40 border border-white/15 text-white/80 hover:text-white hover:bg-black/60 transition-colors"
              style={{ top: "68px", right: "58px", width: "48px", height: "48px", fontSize: "26px", lineHeight: 1 }}
            >
              ×
            </button>
            <div className="absolute inset-0 flex items-center justify-center">
              {children}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ─── ScoringMessageCard ───────────────────────────────────────

function ScoringMessageCard({ msg, isRead, isExpanded, onToggle, onRead, onDelete }: {
  msg: MailMessage
  isRead: boolean
  isExpanded: boolean
  onToggle: () => void
  onRead: () => void
  onDelete: (id: string) => void
}) {
  const [manaClaimed, setManaClaimed] = useState(!!msg.mana_claimed_at)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteBlocked, setShowDeleteBlocked] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const meta = msg.metadata as ScoringMetadata | LadderMetadata | null
  const mysteryDrop = getMysteryDrop(msg.mail_mystery_drops)
  const date = new Date(msg.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
  const isScoreWeekOne = msg.message_type === "score_week_one"
  const scoreMeta = isScoreWeekOne ? meta as ScoringMetadata : null
  const isPerfect = scoreMeta?.result === "perfect"
  const isPartial = scoreMeta?.result === "partial"
  const isLadder = msg.message_type === "score_ladder"
  const ladderMeta = isLadder ? meta as LadderMetadata : null
  const subjectColor = isLadder ? "text-purple-300" : isPerfect ? "text-emerald-400" : isPartial ? "text-amber-300" : isRead ? "text-foreground/60" : "text-foreground"
  const hasUnclaimed = ((msg.mana_reward ?? 0) > 0 && !manaClaimed) || (!!mysteryDrop && !mysteryDrop.revealed_at)

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (hasUnclaimed) {
      setShowDeleteBlocked(true)
      setTimeout(() => setShowDeleteBlocked(false), 3000)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  async function handleDeleteConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    await fetch("/api/mail/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: msg.id }),
    })
    setDeleting(false)
    onDelete(msg.id)
  }

  function toggle() {
    const opening = !isExpanded
    onToggle()
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
    <div>
      {/* Roll — always visible; locked at expanded scale when open */}
      <div
        className={`relative cursor-pointer transition-transform duration-150 ${isExpanded ? "scale-[1.06]" : "hover:scale-[1.06]"}`}
        onClick={toggle}
        style={{ width: "100%" }}
      >
        <img
          src="/letter-roll.png"
          alt=""
          className="w-full h-auto block"
          style={isRead
            ? { filter: "grayscale(0.55) brightness(0.75) drop-shadow(0 6px 19px rgba(0,0,0,1)) drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }
            : { filter: "drop-shadow(0 6px 19px rgba(0,0,0,1)) drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }
          }
        />
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto flex items-center gap-3 px-6" style={{ transform: "translateY(-15px)" }}>
            <div className="flex-1 min-w-0" style={{ paddingLeft: 25 }}>
              <div className={`font-display truncate inline-block max-w-full px-1 py-0.5 ${subjectColor}`} style={{ textShadow: LETTER_TEXT_SHADOW, fontSize: 13, position: "relative", top: 10 }}>
                {msg.subject}
              </div>
            </div>
            <div className="flex items-center shrink-0" style={{ marginRight: "28px", gap: "6px" }}>
              {showDeleteBlocked ? (
                <span className="font-body text-xs text-red-400" style={{ textShadow: LETTER_TEXT_SHADOW }}>
                  Contents must be claimed before deleting.
                </span>
              ) : showDeleteConfirm ? (
                <div className="flex items-center gap-2" style={{ position: "relative", top: 5, left: -5 }} onClick={e => e.stopPropagation()}>
                  <span className="font-body text-xs text-foreground/80" style={{ textShadow: LETTER_TEXT_SHADOW }}>Delete this message?</span>
                  <button onClick={handleDeleteConfirm} disabled={deleting}
                    className="font-display text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-500/40"
                    style={{ background: "rgba(0,0,0,0.65)" }}>
                    {deleting ? "…" : "Yes"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false) }}
                    className="font-display text-xs text-foreground/60 hover:text-foreground px-2 py-0.5 rounded border border-border/40"
                    style={{ background: "rgba(0,0,0,0.65)" }}>
                    No
                  </button>
                </div>
              ) : (
                <>
                  {((msg.mana_reward ?? 0) > 0 || mysteryDrop) && (() => {
                    const allClaimed = manaClaimed && (!mysteryDrop || !!mysteryDrop.revealed_at)
                    return (
                      <span className={`font-display text-lg font-bold w-8 h-8 flex items-center justify-center rounded mr-3 ${allClaimed ? "text-foreground/30 border-[3px] border-foreground/30" : "text-amber-400 border-[3px] border-amber-400"}`} style={{ background: "rgba(0,0,0,0.58)", position: "relative", top: 7 }}>?</span>
                    )
                  })()}
                  <span className="text-xs text-foreground/70 font-body" style={{ textShadow: LETTER_TEXT_SHADOW, position: "relative", top: 5, right: 10 }}>{date}</span>
                  {isRead
                    ? <button onClick={handleDeleteClick} className="text-red-300 hover:text-red-200 leading-none font-bold text-[10px] flex items-center justify-center rounded-full w-4 h-4 shrink-0" style={{ marginLeft: "20px", background: "rgba(100,60,60,0.45)", border: "1.5px solid rgba(180,180,180,0.4)", position: "relative", top: 5, right: 10 }}><Trash2 size={8} /></button>
                    : <div className="w-4 h-4 shrink-0" style={{ marginLeft: "12px", position: "relative", top: 5, right: 10 }} />
                  }
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded panel — portal to left 50% */}
      {isExpanded && (
        <ExpandedPanel onClose={toggle}>
          {scoreMeta && (
            <div className="w-[72%] space-y-2 rounded-xl px-6 py-3" style={{ background: "rgba(8,6,4,0.62)", backdropFilter: "blur(2px)" }}>
              <div>
                <div className="font-display text-sm text-foreground">{scoreMeta.game_name}</div>
                {scoreMeta.season_name && (
                  <div className="font-body text-xs text-muted-foreground mt-0.5">{scoreMeta.season_name}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className={`p-2.5 rounded-lg border text-xs ${scoreMeta.players_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
                  <div className="text-muted-foreground mb-1 font-body">Peak Players</div>
                  <div className="font-mono font-bold text-foreground">
                    {scoreMeta.actual_player_count != null ? fmtPlayers(scoreMeta.actual_player_count) : "—"}
                  </div>
                  <div className="text-[10px] font-body mt-0.5 text-muted-foreground">
                    Window: {scoreMeta.players_window_low != null ? fmtPlayers(scoreMeta.players_window_low) : "—"}–{scoreMeta.players_window_high != null ? fmtPlayers(scoreMeta.players_window_high) : "—"}
                  </div>
                </div>
                <div className={`p-2.5 rounded-lg border text-xs ${scoreMeta.reviews_correct ? "border-emerald-500/25 bg-emerald-500/5" : "border-border bg-secondary/20"}`}>
                  <div className="text-muted-foreground mb-1 font-body">Review Score</div>
                  <div className="font-mono font-bold text-foreground">
                    {scoreMeta.actual_review_score != null ? `${scoreMeta.actual_review_score.toFixed(1)}%` : "—"}
                  </div>
                  <div className="text-[10px] font-body mt-0.5 text-muted-foreground">
                    Window: {scoreMeta.reviews_window_low ?? "—"}%–{scoreMeta.reviews_window_high ?? "—"}%
                  </div>
                </div>
              </div>
              {scoreMeta.mana_breakdown?.length > 0 && (
                <div className="space-y-1">
                  {scoreMeta.mana_breakdown.map((line, i) => (
                    <div key={i} className="flex justify-between text-xs font-body text-muted-foreground">
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
                      <img src="/icons/season-score-icon.png" alt="" width={12} height={12} className="shrink-0" />
                      <span>Season score</span>
                    </div>
                    <span className="text-amber-400 font-display">+{scoreMeta.total_mana.toLocaleString()} pts</span>
                  </div>
                </div>
              )}
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
              {mysteryDrop && (
                <MysteryDropSection drop={mysteryDrop} messageId={msg.id} />
              )}
              {scoreMeta.game_id && (
                <Link
                  href={`/games/${scoreMeta.game_id}`}
                  className="inline-block font-display text-[10px] text-purple-400 border border-purple-500/30 rounded px-2.5 py-1 hover:bg-purple-950/30 transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  View Prediction →
                </Link>
              )}
            </div>
          )}

          {ladderMeta && (
            <div className="w-[72%] space-y-2 rounded-xl px-6 py-5" style={{ background: "rgba(8,6,4,0.62)", backdropFilter: "blur(2px)" }}>
              {[
                { label: "Binary matches", value: `+${ladderMeta.binary_mana}`, color: "text-cyan-300" },
                { label: `Sequence run (${ladderMeta.sequence_length} games)`, value: `+${ladderMeta.sequence_mana}`, color: "text-cyan-300" },
                ...((ladderMeta.ao_mana ?? 0) > 0
                  ? [{ label: "Auspicious Omens", value: `+${ladderMeta.ao_mana}`, color: "text-amber-400" }]
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
                <span className="text-cyan-300 font-display">+{(ladderMeta.total_mana ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <div className="flex items-center gap-1 text-foreground">
                  <img src="/icons/season-score-icon.png" alt="" width={12} height={12} className="shrink-0" />
                  <span>Season score</span>
                </div>
                <span className="text-amber-400 font-display">+{(ladderMeta.total_mana ?? 0).toLocaleString()} pts</span>
              </div>
            </div>
          )}
        </ExpandedPanel>
      )}
    </div>
  )
}

// ─── AdminMessageCard ─────────────────────────────────────────

function AdminMessageCard({ msg, isRead, isClaimed, isExpanded, onToggle, onRead, onClaim, onDelete }: {
  msg: MailMessage
  isRead: boolean
  isClaimed: boolean
  isExpanded: boolean
  onToggle: () => void
  onRead: () => void
  onClaim: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState("")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDeleteBlocked, setShowDeleteBlocked] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isExpired = msg.expires_at ? new Date(msg.expires_at) < new Date() : false
  const date = new Date(msg.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })
  const hasUnclaimed = msg.mail_attachments.length > 0 && !isClaimed && !isExpired

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (hasUnclaimed) {
      setShowDeleteBlocked(true)
      setTimeout(() => setShowDeleteBlocked(false), 3000)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  async function handleDeleteConfirm(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    await fetch("/api/mail/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: msg.id }),
    })
    setDeleting(false)
    onDelete(msg.id)
  }

  function toggle() {
    const opening = !isExpanded
    onToggle()
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
    <div>
      {/* Roll — always visible */}
      <div
        className={`relative cursor-pointer transition-transform duration-150 ${isExpanded ? "scale-[1.06]" : "hover:scale-[1.06]"}`}
        onClick={toggle}
        style={{ width: "100%" }}
      >
        <img
          src="/letter-roll.png"
          alt=""
          className="w-full h-auto block"
          style={isRead
            ? { filter: "grayscale(0.55) brightness(0.75) drop-shadow(0 6px 19px rgba(0,0,0,1)) drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }
            : { filter: "drop-shadow(0 6px 19px rgba(0,0,0,1)) drop-shadow(0 10px 24px rgba(0,0,0,0.6))" }
          }
        />
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto flex items-center gap-3 px-6" style={{ transform: "translateY(-15px)" }}>
            <div className="flex-1 min-w-0" style={{ paddingLeft: 25 }}>
              <span className={`font-display truncate inline-block max-w-full px-1 py-0.5 ${isRead ? "text-foreground/60" : "text-foreground"}`} style={{ textShadow: LETTER_TEXT_SHADOW, fontSize: 13, position: "relative", top: 10 }}>
                {msg.subject}
              </span>
            </div>
            <div className="flex items-center shrink-0" style={{ marginRight: "28px", gap: "6px" }}>
              {showDeleteBlocked ? (
                <span className="font-body text-xs text-red-400" style={{ textShadow: LETTER_TEXT_SHADOW }}>
                  Contents must be claimed before deleting.
                </span>
              ) : showDeleteConfirm ? (
                <div className="flex items-center gap-2" style={{ position: "relative", top: 5, left: -5 }} onClick={e => e.stopPropagation()}>
                  <span className="font-body text-xs text-foreground/80" style={{ textShadow: LETTER_TEXT_SHADOW }}>Delete this message?</span>
                  <button onClick={handleDeleteConfirm} disabled={deleting}
                    className="font-display text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-500/40"
                    style={{ background: "rgba(0,0,0,0.65)" }}>
                    {deleting ? "…" : "Yes"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setShowDeleteConfirm(false) }}
                    className="font-display text-xs text-foreground/60 hover:text-foreground px-2 py-0.5 rounded border border-border/40"
                    style={{ background: "rgba(0,0,0,0.65)" }}>
                    No
                  </button>
                </div>
              ) : (
                <>
                  {msg.mail_attachments.length > 0 && (
                    <span className={`font-display text-lg font-bold w-8 h-8 flex items-center justify-center rounded mr-3 ${isClaimed ? "text-foreground/30 border-[3px] border-foreground/30" : "text-amber-400 border-[3px] border-amber-400"}`} style={{ background: "rgba(0,0,0,0.58)", position: "relative", top: 7 }}>?</span>
                  )}
                  <span className="text-xs text-foreground/70 font-body" style={{ textShadow: LETTER_TEXT_SHADOW, position: "relative", top: 5, right: 10 }}>{date}</span>
                  {isRead
                    ? <button onClick={handleDeleteClick} className="text-red-300 hover:text-red-200 leading-none font-bold text-[10px] flex items-center justify-center rounded-full w-4 h-4 shrink-0" style={{ marginLeft: "20px", background: "rgba(100,60,60,0.45)", border: "1.5px solid rgba(180,180,180,0.4)", position: "relative", top: 5, right: 10 }}><Trash2 size={8} /></button>
                    : <div className="w-4 h-4 shrink-0" style={{ marginLeft: "12px", position: "relative", top: 5, right: 10 }} />
                  }
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded panel — portal to left 50% */}
      {isExpanded && (
        <ExpandedPanel onClose={toggle}>
          <div className="w-[72%] space-y-4 rounded-xl px-6 py-5" style={{ background: "rgba(8,6,4,0.62)", backdropFilter: "blur(2px)" }}>
            <p className="text-sm font-body text-foreground/85 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
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
                        onClick={e => { e.stopPropagation(); handleClaim() }}
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
        </ExpandedPanel>
      )}
    </div>
  )
}

// ─── Main MailboxClient ───────────────────────────────────────

interface MailboxClientProps {
  messages: MailMessage[]
}

const ITEMS_PER_PAGE = 6

export function MailboxClient({ messages }: MailboxClientProps) {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault()
    const preventKey = (e: KeyboardEvent) => {
      if (["ArrowUp","ArrowDown","PageUp","PageDown","Home","End"," "].includes(e.key)) e.preventDefault()
    }
    document.addEventListener("wheel", prevent, { passive: false })
    document.addEventListener("touchmove", prevent, { passive: false })
    document.addEventListener("keydown", preventKey)
    document.documentElement.style.scrollbarWidth = "none"
    return () => {
      document.removeEventListener("wheel", prevent)
      document.removeEventListener("touchmove", prevent)
      document.removeEventListener("keydown", preventKey)
      document.documentElement.style.scrollbarWidth = ""
    }
  }, [])

  const [msgs, setMsgs] = useState(messages)
  const [read, setRead] = useState<Set<string>>(new Set(
    messages.filter(m => getReadRow(m.mail_reads)?.read_at).map(m => m.id)
  ))
  const [claimed, setClaimed] = useState<Set<string>>(new Set(
    messages.filter(m => getReadRow(m.mail_reads)?.claimed_at).map(m => m.id)
  ))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil(msgs.length / ITEMS_PER_PAGE))
  const pagedMsgs = msgs.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE)

  function goToPage(page: number) {
    setCurrentPage(page)
    setExpandedId(null)
  }

  function handleDelete(id: string) {
    setMsgs(prev => {
      const next = prev.filter(m => m.id !== id)
      const newTotal = Math.max(1, Math.ceil(next.length / ITEMS_PER_PAGE))
      if (currentPage >= newTotal) setCurrentPage(newTotal - 1)
      return next
    })
    if (expandedId === id) setExpandedId(null)
  }

  function handleToggle(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  if (msgs.length === 0) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "60vh", paddingTop: "20px",
      }}>
        <span className="text-foreground/70 font-display text-2xl" style={{
          textShadow: "0 0 2px #000, 0 0 2px #000, 0 0 2px #000, 0 0 4px #000, 0 0 4px #000, 0 0 4px #000, 0 0 6px #000, 0 0 6px #000, 0 0 8px #000, 0 0 8px #000, 0 0 10px #000, 0 0 12px #000, 0 0 16px #000, 0 0 20px #000, 0 0 28px #000, 0 0 40px rgba(0,0,0,0.97), 0 0 60px rgba(0,0,0,0.93), 0 0 90px rgba(0,0,0,0.88)",
        }}>
          Your mailbox is empty.
        </span>
      </div>
    )
  }

  const atFirst = currentPage === 0
  const atLast = currentPage === totalPages - 1

  const navBtn = (onClick: () => void, disabled: boolean, icon: string, alt: string) => (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
        transition: "transform 0.1s",
        background: "none",
        border: "none",
        padding: 0,
        pointerEvents: disabled ? "none" : "auto",
      }}
      onMouseDown={e => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.88)" }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)" }}
    >
      <img src={`/icons/${icon}`} alt={alt} style={{ width: 94, height: 94, objectFit: "contain", display: "block" }} />
    </button>
  )

  return (
    <div className="space-y-3">
<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 4px", minHeight: 36, marginBottom: -8, transform: "translateY(-20px)" }}>
        {navBtn(() => goToPage(0),               atFirst, "double-left.png",  "Newest")}
        {navBtn(() => goToPage(currentPage - 1), atFirst, "left.png",         "Newer")}
        <div style={{ width: 80 }} />
        {navBtn(() => goToPage(currentPage + 1), atLast,  "right.png",        "Older")}
        {navBtn(() => goToPage(totalPages - 1),  atLast,  "double-right.png", "Oldest")}
      </div>

      <div style={{ transform: "translateY(-25px) scale(1.03)", transformOrigin: "top center", display: "flex", flexDirection: "column", gap: "10px" }}>
      {pagedMsgs.map(msg => {
        const isRead = read.has(msg.id)

        if (msg.message_type === "score_week_one" || msg.message_type === "score_ladder") {
          return (
            <ScoringMessageCard
              key={msg.id}
              msg={msg}
              isRead={isRead}
              isExpanded={expandedId === msg.id}
              onToggle={() => handleToggle(msg.id)}
              onRead={() => setRead(prev => new Set([...prev, msg.id]))}
              onDelete={handleDelete}
            />
          )
        }

        return (
          <AdminMessageCard
            key={msg.id}
            msg={msg}
            isRead={isRead}
            isClaimed={claimed.has(msg.id)}
            isExpanded={expandedId === msg.id}
            onToggle={() => handleToggle(msg.id)}
            onRead={() => setRead(prev => new Set([...prev, msg.id]))}
            onClaim={id => setClaimed(prev => new Set([...prev, id]))}
            onDelete={handleDelete}
          />
        )
      })}
      </div>
    </div>
  )
}


