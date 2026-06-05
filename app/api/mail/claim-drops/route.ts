import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function rollLootTable(items: { id: string; name: string; slug: string; image_url: string | null; drop_rate: number }[]) {
  const total = items.reduce((sum, i) => sum + i.drop_rate, 0)
  let roll = Math.random() * total
  for (const item of items) {
    roll -= item.drop_rate
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { message_id } = await request.json()
  if (!message_id) return NextResponse.json({ error: "message_id required" }, { status: 400 })

  // Get the mystery drop row for this user/message
  const { data: drop } = await supabase
    .from("mail_mystery_drops")
    .select("*")
    .eq("message_id", message_id)
    .eq("user_id", user.id)
    .single()

  if (!drop) return NextResponse.json({ error: "Drop not found" }, { status: 404 })
  if (drop.revealed_at) return NextResponse.json({ error: "Already opened" }, { status: 400 })

  // Get droppable items
  const { data: droppableItems } = await supabaseAdmin
    .from("items")
    .select("id, name, slug, image_url, drop_rate")
    .eq("is_droppable", true)
    .gt("drop_rate", 0)

  if (!droppableItems?.length) {
    return NextResponse.json({ error: "No droppable items configured" }, { status: 500 })
  }

  // Roll loot table drop_count times, collapsing duplicates
  const revealed: { item_id: string; name: string; slug: string; image_url: string | null; quantity: number }[] = []
  for (let i = 0; i < drop.drop_count; i++) {
    const rolled = rollLootTable(droppableItems)
    const existing = revealed.find(r => r.item_id === rolled.id)
    if (existing) {
      existing.quantity++
    } else {
      revealed.push({ item_id: rolled.id, name: rolled.name, slug: rolled.slug, image_url: rolled.image_url, quantity: 1 })
    }
  }

  // Add items to inventory + log each drop
  for (const item of revealed) {
    for (let i = 0; i < item.quantity; i++) {
      await supabaseAdmin.rpc("increment_inventory", {
        p_user_id: user.id,
        p_item_id: item.item_id,
      })
    }
    await supabaseAdmin.from("drop_history").insert({
      user_id:    user.id,
      season_id:  drop.season_id,
      item_id:    item.item_id,
      source:     "scoring_drop",
    })
  }

  // Mark as revealed with rolled items
  await supabaseAdmin
    .from("mail_mystery_drops")
    .update({ revealed_at: new Date().toISOString(), revealed_items: revealed })
    .eq("id", drop.id)

  return NextResponse.json({ success: true, revealed })
}
