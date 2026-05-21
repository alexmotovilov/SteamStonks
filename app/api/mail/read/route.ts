import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message_id } = await request.json()
  if (!message_id) return NextResponse.json({ error: "message_id required" }, { status: 400 })

  await supabase
    .from("mail_reads")
    .upsert(
      { message_id, user_id: user.id, read_at: new Date().toISOString() },
      { onConflict: "message_id,user_id", ignoreDuplicates: false }
    )

  return NextResponse.json({ success: true })
}
