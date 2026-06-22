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
      mail_reads!left(read_at, claimed_at, deleted_at),
      mail_attachments(quantity, items:item_id(id, name, slug, image_url)),
      mail_mystery_drops(id, drop_count, revealed_at, revealed_items)
    `)
    .eq("is_published", true)
    .or(`target.eq.all,target_user_id.eq.${user.id}`)
    .order("created_at", { ascending: false })

  return (
    <>
    <style>{`::-webkit-scrollbar { display: none; }`}</style>
    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "calc(12vh - 85px)" }}>
      <div style={{
        width: "50vw",
        paddingRight: "4vw",
        paddingBottom: "3rem",
      }}>
        <MailboxClient messages={(messages ?? []).filter((m: any) => {
          const reads = Array.isArray(m.mail_reads) ? m.mail_reads[0] : m.mail_reads
          return !reads?.deleted_at
        }) as any} />
      </div>
    </div>
    </>
  )
}
