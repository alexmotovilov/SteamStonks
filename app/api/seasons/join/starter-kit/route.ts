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

  // Verify the player has actually joined this season
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

  // Award one of each starter kit item
  for (const item of items) {
    await supabaseAdmin.rpc("increment_inventory", {
      p_user_id: user.id,
      p_item_id: item.id,
    })

    await supabaseAdmin.from("drop_history").insert({
      user_id:   user.id,
      season_id,
      item_id:   item.id,
      source:    "starter_kit",
    })
  }

  // Mark starter kit as claimed
  await supabaseAdmin
    .from("season_entries")
    .update({ starter_kit_claimed: true })
    .eq("user_id", user.id)
    .eq("season_id", season_id)

  return NextResponse.json({ success: true, items_awarded: items.length })
}
