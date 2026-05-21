"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"

interface Item {
  id: string
  name: string
  slug: string
  image_url: string | null
}

interface Profile {
  id: string
  display_name: string | null
}

interface Attachment {
  item_id: string
  quantity: number
}

interface AdminMailComposeProps {
  items: Item[]
  profiles: Profile[]
  onSent: () => void
}

export function AdminMailCompose({ items, profiles, onSent }: AdminMailComposeProps) {
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [target, setTarget] = useState<"all" | "user">("all")
  const [targetUserId, setTargetUserId] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [expiresDays, setExpiresDays] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  function addAttachment() {
    if (items.length === 0) return
    setAttachments(prev => [...prev, { item_id: items[0].id, quantity: 1 }])
  }

  function removeAttachment(i: number) {
    setAttachments(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateAttachment(i: number, field: keyof Attachment, value: string | number) {
    setAttachments(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a))
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required.")
      return
    }
    if (target === "user" && !targetUserId) {
      setError("Select a target player.")
      return
    }
    setSending(true)
    setError("")
    setSuccess("")

    const res = await fetch("/api/admin/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        body,
        target,
        target_user_id: target === "user" ? targetUserId : undefined,
        attachments,
        expires_days: expiresDays ? Number(expiresDays) : undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "Failed to send")
    } else {
      setSuccess("Message sent!")
      setSubject("")
      setBody("")
      setTarget("all")
      setTargetUserId("")
      setAttachments([])
      setExpiresDays("")
      onSent()
    }
    setSending(false)
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-sm text-red-400 font-body">{error}</p>}
      {success && <p className="text-sm text-emerald-400 font-body">{success}</p>}

      <div className="space-y-1.5">
        <Label className="font-display text-xs text-muted-foreground tracking-wide">Subject</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Season I begins tomorrow!" />
      </div>

      <div className="space-y-1.5">
        <Label className="font-display text-xs text-muted-foreground tracking-wide">Body</Label>
        <Textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Greetings, seer…"
          rows={5}
          className="font-body resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="font-display text-xs text-muted-foreground tracking-wide">Target</Label>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-body text-muted-foreground">
            <input type="radio" checked={target === "all"} onChange={() => setTarget("all")} className="accent-purple-500" />
            All players
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm font-body text-muted-foreground">
            <input type="radio" checked={target === "user"} onChange={() => setTarget("user")} className="accent-purple-500" />
            Specific player
          </label>
        </div>
        {target === "user" && (
          <Select value={targetUserId} onValueChange={setTargetUserId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select player…" />
            </SelectTrigger>
            <SelectContent>
              {profiles.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.display_name ?? p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="font-display text-xs text-muted-foreground tracking-wide">Attachments</Label>
          <Button variant="ghost" size="sm" onClick={addAttachment} disabled={items.length === 0} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />Add booster
          </Button>
        </div>
        {attachments.map((att, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select value={att.item_id} onValueChange={v => updateAttachment(i, "item_id", v)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={1}
              max={5}
              value={att.quantity}
              onChange={e => updateAttachment(i, "quantity", Number(e.target.value))}
              className="w-16 text-center"
            />
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeAttachment(i)}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="font-display text-xs text-muted-foreground tracking-wide">
          Expires in (days, blank = never)
        </Label>
        <Input
          type="number"
          min={1}
          value={expiresDays}
          onChange={e => setExpiresDays(e.target.value)}
          placeholder="e.g. 7"
          className="w-32"
        />
      </div>

      <Button onClick={handleSend} disabled={sending} className="font-display">
        {sending ? "Sending…" : target === "all" ? "Send to all players" : "Send to player"}
      </Button>
    </div>
  )
}
