"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

interface MailAttachment {
  quantity: number
  items: { id: string; name: string; slug: string; image_url: string | null } | null
}

interface MailMessage {
  id: string
  subject: string
  body: string
  created_at: string
  expires_at: string | null
  mail_reads: unknown
  mail_attachments: MailAttachment[]
}

function getReadRow(reads: unknown): { read_at: string | null; claimed_at: string | null } | null {
  if (!reads) return null
  const row = Array.isArray(reads) ? reads[0] : reads
  if (!row || typeof row !== "object") return null
  return row as { read_at: string | null; claimed_at: string | null }
}

interface MailboxClientProps {
  messages: MailMessage[]
}

export function MailboxClient({ messages }: MailboxClientProps) {
  const initialRead = new Set(
    messages.filter(m => getReadRow(m.mail_reads)?.read_at).map(m => m.id)
  )
  const initialClaimed = new Set(
    messages.filter(m => getReadRow(m.mail_reads)?.claimed_at).map(m => m.id)
  )

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [read, setRead] = useState<Set<string>>(initialRead)
  const [claimed, setClaimed] = useState<Set<string>>(initialClaimed)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({})

  async function toggleExpand(id: string) {
    const opening = !expanded.has(id)
    setExpanded(prev => {
      const s = new Set(prev)
      opening ? s.add(id) : s.delete(id)
      return s
    })
    if (opening && !read.has(id)) {
      setRead(prev => new Set([...prev, id]))
      fetch("/api/mail/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: id }),
      }).catch(() => {})
    }
  }

  async function handleClaim(id: string) {
    setClaiming(id)
    setClaimErrors(prev => ({ ...prev, [id]: "" }))
    const res = await fetch("/api/mail/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: id }),
    })
    const data = await res.json()
    if (!res.ok) {
      setClaimErrors(prev => ({ ...prev, [id]: data.error || "Failed to claim" }))
    } else {
      setClaimed(prev => new Set([...prev, id]))
    }
    setClaiming(null)
  }

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
          const isOpen = expanded.has(msg.id)
          const isClaimed = claimed.has(msg.id)
          const isExpired = msg.expires_at ? new Date(msg.expires_at) < new Date() : false
          const hasAttachments = msg.mail_attachments.length > 0
          const date = new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })

          return (
            <div
              key={msg.id}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isRead ? "border-border bg-card" : "border-purple-500/40 bg-purple-950/[0.08]"
              }`}
            >
              {/* Summary row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                onClick={() => toggleExpand(msg.id)}
              >
                <div className={`w-2 h-2 rounded-full shrink-0 transition-colors ${isRead ? "bg-transparent" : "bg-purple-500"}`} />
                <span className={`flex-1 font-display text-sm truncate ${isRead ? "text-muted-foreground" : "text-foreground"}`}>
                  {msg.subject}
                </span>
                {hasAttachments && <span className="text-amber-400/60 text-xs shrink-0">📦</span>}
                <span className="text-[10px] text-muted-foreground/40 font-body shrink-0">{date}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 shrink-0 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`} />
              </button>

              {/* Expanded body */}
              {isOpen && (
                <div className="border-t border-border/40 px-4 py-4 space-y-4">
                  <p className="text-sm font-body text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {msg.body}
                  </p>

                  {hasAttachments && (
                    <div className="space-y-2">
                      <div className="text-[9px] font-display tracking-widest uppercase text-muted-foreground/40">
                        Attachments
                      </div>
                      {msg.mail_attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                          {att.items?.image_url && (
                            <img
                              src={att.items.image_url}
                              alt={att.items.name}
                              className="w-8 h-8 rounded-md object-cover shrink-0"
                            />
                          )}
                          <span className="flex-1 text-sm font-body text-foreground">
                            {att.quantity > 1 && (
                              <span className="text-amber-400 font-display">{att.quantity}× </span>
                            )}
                            {att.items?.name ?? "Unknown item"}
                          </span>

                          {isClaimed ? (
                            <span className="text-xs font-display text-emerald-400 shrink-0">✓ Claimed</span>
                          ) : isExpired ? (
                            <span className="text-xs font-body text-muted-foreground/50 shrink-0">Expired</span>
                          ) : (
                            <button
                              onClick={() => handleClaim(msg.id)}
                              disabled={claiming === msg.id}
                              className="px-3 py-1 rounded-lg text-xs font-display bg-purple-500/10 text-purple-400 border border-purple-500/25 hover:bg-purple-500/20 transition-colors disabled:opacity-50 shrink-0"
                            >
                              {claiming === msg.id ? "Claiming…" : "Claim"}
                            </button>
                          )}
                        </div>
                      ))}
                      {claimErrors[msg.id] && (
                        <p className="text-xs text-red-400 font-body">{claimErrors[msg.id]}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
