import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { subject, body, target, target_user_id, attachments, expires_days } = await request.json()

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
  }

  const expiresAt = expires_days
    ? new Date(Date.now() + Number(expires_days) * 86400000).toISOString()
    : null

  const { data: message, error: msgError } = await supabaseAdmin
    .from("mail_messages")
    .insert({
      subject: subject.trim(),
      body: body.trim(),
      target: target ?? "all",
      target_user_id: target === "user" ? (target_user_id ?? null) : null,
      created_by: user.id,
      expires_at: expiresAt,
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (msgError || !message) {
    console.error("[Mail Send]", msgError)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }

  if (Array.isArray(attachments) && attachments.length > 0) {
    await supabaseAdmin.from("mail_attachments").insert(
      attachments.map((a: { item_id: string; quantity: number }) => ({
        message_id: message.id,
        item_id: a.item_id,
        quantity: Math.max(1, Number(a.quantity)),
      }))
    )
  }

  return NextResponse.json({ success: true, message_id: message.id })
}
