import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const runtime = "nodejs"

async function verifyAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single()
  return profile?.is_admin ? user : null
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  // Null out any cross-prediction FK references to this game (e.g. ladder slot columns).
  await supabaseAdmin.from("predictions").update({ ladder_red_slot_game_id: null }).eq("ladder_red_slot_game_id", id)

  // Fetch prediction IDs for this game to clean up FK-dependent tables.
  const { data: preds } = await supabaseAdmin.from("predictions").select("id").eq("game_id", id)
  const predIds = (preds ?? []).map(p => p.id)

  if (predIds.length > 0) {
    await supabaseAdmin.from("mail_messages").delete().in("prediction_id", predIds)
    await supabaseAdmin.from("drop_history").delete().in("prediction_id", predIds)
  }

  const { error: snapErr } = await supabaseAdmin.from("game_snapshots").delete().eq("game_id", id)
  if (snapErr) return NextResponse.json({ error: "Failed to delete snapshots: " + snapErr.message }, { status: 500 })

  const { error: predErr } = await supabaseAdmin.from("predictions").delete().eq("game_id", id)
  if (predErr) return NextResponse.json({ error: "Failed to delete predictions: " + predErr.message }, { status: 500 })

  const { error: gameErr } = await supabaseAdmin.from("games").delete().eq("id", id)
  if (gameErr) return NextResponse.json({ error: "Failed to delete game: " + gameErr.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
