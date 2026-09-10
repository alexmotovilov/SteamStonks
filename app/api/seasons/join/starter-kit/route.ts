import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const STARTER_KIT_SLUGS = [
  "evocation_distillate",
  "crystal_focus",
  "scrying_orb_polish",
]

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { season_id } = await request.json()

  // Verify the player has joined this season
  const { data: entry } = await supabase
    .from("season_entries")
    .select("id, starter_kit_claimed")
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .single()

  if (!entry) return NextResponse.json({ error: "Not joined" }, { status: 403 })
  if (entry.starter_kit_claimed) {
    return NextResponse.json({ message: "Already claimed" })
  }

  // Get item IDs for starter kit slugs
  const { data: items } = await supabaseAdmin
    .from("items")
    .select("id, slug")
    .in("slug", STARTER_KIT_SLUGS)

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Starter kit items not found" }, { status: 500 })
  }

  // Insert starter-kit mail message (idempotent via unique partial index on migration 020)
  const { data: mailMsg, error: mailError } = await supabaseAdmin
    .from("mail_messages")
    .insert({
      message_type: "starter_kit",
      subject: "Starter Kit",
      body: "Your starter items are ready to claim. Three boosters to get your first predictions off to a strong start.",
      target_user_id: user.id,
      target: "user",
      is_published: true,
      season_id,
    })
    .select("id")
    .single()

  if (mailError) {
    // '23505' = unique constraint violation (mail already dispatched by a concurrent request)
    if (mailError.code === "23505") {
      return NextResponse.json({ message: "Already dispatched" })
    }
    console.error("[starter-kit] Failed to create mail:", mailError)
    return NextResponse.json({ error: "Failed to create starter kit mail" }, { status: 500 })
  }

  // Insert one attachment per starter kit item
  for (const item of items) {
    await supabaseAdmin.from("mail_attachments").insert({
      message_id: mailMsg.id,
      item_id: item.id,
      quantity: 1,
    })
  }

  // Mark starter kit as claimed (mail dispatched marker)
  await supabaseAdmin
    .from("season_entries")
    .update({ starter_kit_claimed: true })
    .eq("user_id", user.id)
    .eq("season_id", season_id)

  return NextResponse.json({ success: true })
}
