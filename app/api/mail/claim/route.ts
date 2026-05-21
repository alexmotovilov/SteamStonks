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

  const { message_id } = await request.json()
  if (!message_id) return NextResponse.json({ error: "message_id required" }, { status: 400 })

  // Verify message is published, not expired, and targets this player
  const { data: message } = await supabase
    .from("mail_messages")
    .select("id, expires_at")
    .eq("id", message_id)
    .eq("is_published", true)
    .single()

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })

  if (message.expires_at && new Date(message.expires_at) < new Date()) {
    return NextResponse.json({ error: "This offer has expired" }, { status: 400 })
  }

  // Check not already claimed
  const { data: readRow } = await supabaseAdmin
    .from("mail_reads")
    .select("id, claimed_at")
    .eq("message_id", message_id)
    .eq("user_id", user.id)
    .single()

  if (readRow?.claimed_at) {
    return NextResponse.json({ error: "Already claimed" }, { status: 400 })
  }

  // Get attachments
  const { data: attachments } = await supabaseAdmin
    .from("mail_attachments")
    .select("item_id, quantity")
    .eq("message_id", message_id)

  if (!attachments?.length) {
    return NextResponse.json({ error: "No attachments to claim" }, { status: 400 })
  }

  // Add items to inventory
  let itemsClaimed = 0
  for (const att of attachments) {
    for (let i = 0; i < att.quantity; i++) {
      await supabaseAdmin.rpc("increment_inventory", {
        p_user_id: user.id,
        p_item_id: att.item_id,
      })
    }
    itemsClaimed += att.quantity
  }

  // Mark as claimed (upsert so read_at is also set if missing)
  await supabaseAdmin
    .from("mail_reads")
    .upsert(
      {
        message_id,
        user_id: user.id,
        read_at: new Date().toISOString(),
        claimed_at: new Date().toISOString(),
      },
      { onConflict: "message_id,user_id" }
    )

  return NextResponse.json({ success: true, items_claimed: itemsClaimed })
}
