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

  // Verify message belongs to this user and has unclaimed mana
  const { data: message } = await supabase
    .from("mail_messages")
    .select("id, mana_reward, mana_claimed_at, season_id, target_user_id")
    .eq("id", message_id)
    .eq("target_user_id", user.id)
    .single()

  if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 })
  if (message.mana_claimed_at) return NextResponse.json({ error: "Already claimed" }, { status: 400 })
  if (!message.mana_reward || message.mana_reward <= 0) {
    return NextResponse.json({ error: "No mana to claim" }, { status: 400 })
  }

  // Add to spending balance only (leaderboard already updated by scorer)
  const { error: manaError } = await supabaseAdmin.rpc("add_mana_balance", {
    p_user_id:   user.id,
    p_season_id: message.season_id,
    p_amount:    message.mana_reward,
  })

  if (manaError) {
    console.error("[Claim Mana]", manaError)
    return NextResponse.json({ error: "Failed to add mana" }, { status: 500 })
  }

  await supabaseAdmin
    .from("mail_messages")
    .update({ mana_claimed_at: new Date().toISOString() })
    .eq("id", message_id)

  return NextResponse.json({ success: true, mana_claimed: message.mana_reward })
}
