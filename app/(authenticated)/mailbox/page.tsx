import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { MailboxClient } from "@/components/mailbox-client"

export default async function MailboxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: messages } = await supabase
    .from("mail_messages")
    .select(`
      id, subject, body, created_at, expires_at,
      message_type, metadata, mana_reward, mana_claimed_at, prediction_id, season_id,
      mail_reads!left(read_at, claimed_at),
      mail_attachments(quantity, items:item_id(id, name, slug, image_url)),
      mail_mystery_drops(id, drop_count, revealed_at, revealed_items)
    `)
    .eq("is_published", true)
    .or(`target.eq.all,target_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground">Mailbox</h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Messages from the Prognos team
        </p>
      </div>
      <MailboxClient messages={(messages ?? []) as any} />
    </div>
  )
}
