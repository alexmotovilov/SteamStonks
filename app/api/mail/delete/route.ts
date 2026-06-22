import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message_id } = await request.json()
  if (!message_id) return NextResponse.json({ error: "message_id required" }, { status: 400 })

  // First try to delete a personal message owned by this user
  const { error, count } = await supabase
    .from("mail_messages")
    .delete({ count: "exact" })
    .eq("id", message_id)
    .eq("target_user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If no rows deleted it's a broadcast message — mark it dismissed per-user in mail_reads
  if (count === 0) {
    const { error: readError } = await supabase
      .from("mail_reads")
      .upsert(
        { user_id: user.id, message_id, deleted_at: new Date().toISOString() },
        { onConflict: "user_id,message_id" }
      )
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
