"use client"

import { useRouter } from "next/navigation"
import { AdminMailCompose } from "@/components/admin-mail-compose"

interface Item { id: string; name: string; slug: string; image_url: string | null }
interface Profile { id: string; display_name: string | null }

export function AdminMailComposeWrapper({ items, profiles }: { items: Item[]; profiles: Profile[] }) {
  const router = useRouter()
  return (
    <AdminMailCompose
      items={items}
      profiles={profiles}
      onSent={() => router.refresh()}
    />
  )
}
