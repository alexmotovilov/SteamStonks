"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface Props {
  user: SupabaseUser
  href: string
  className: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function MailboxIndicator({ user, href, className, style, children }: Props) {
  const [unreadCount, setUnreadCount] = useState(0)
  const pathname = usePathname()

  useEffect(() => {
    async function check() {
      const supabase = createClient()

      const { data: messages } = await supabase
        .from("mail_messages")
        .select("id")
        .eq("is_published", true)
        .or(`target.eq.all,target_user_id.eq.${user.id}`)

      const messageIds = (messages ?? []).map(m => m.id)
      if (!messageIds.length) return

      const { data: reads } = await supabase
        .from("mail_reads")
        .select("message_id")
        .eq("user_id", user.id)
        .not("read_at", "is", null)
        .in("message_id", messageIds)

      const readIds = new Set((reads ?? []).map(r => r.message_id))
      setUnreadCount(messageIds.filter(id => !readIds.has(id)).length)
    }
    check()
  }, [user.id, pathname])

  if (unreadCount === 0) {
    return <Link href={href} className={className} style={style}>{children}</Link>
  }

  return (
    <Link
      href={href}
      className={`${className} relative rounded px-2 py-0.5`}
      style={{
        ...style,
        outline: "1.5px solid rgba(157,132,212,0.6)",
        outlineOffset: "2px",
        animation: "pulse-border 2s ease-in-out infinite",
      }}
    >
      {children}
      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center font-display text-[9px] text-white leading-none">
        {unreadCount > 9 ? "9+" : unreadCount}
      </span>
    </Link>
  )
}
