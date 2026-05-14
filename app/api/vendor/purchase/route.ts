import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const CYCLE_A_SLUGS = ["scrying_orb_polish", "blood_bargain", "infernal_patrons_pact"]
const CYCLE_B_SLUGS = ["crystal_focus", "black_gem_accumulator", "tincture_of_divination"]

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { season_id, item_slug } = await request.json()
  if (!season_id || !item_slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Fetch item
  const { data: item } = await supabase
    .from("items")
    .select("id, slug, vendor_price, vendor_weekly_limit, is_vendored")
    .eq("slug", item_slug)
    .single()

  if (!item?.is_vendored) {
    return NextResponse.json({ error: "Item not available" }, { status: 400 })
  }

  // Fetch season + verify this slug is in the current cycle
  const { data: season } = await supabase
    .from("seasons")
    .select("current_vendor_week, current_vendor_cycle")
    .eq("id", season_id)
    .single()

  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 400 })
  }

  const validSlugs = season.current_vendor_cycle === "B" ? CYCLE_B_SLUGS : CYCLE_A_SLUGS
  if (!validSlugs.includes(item_slug)) {
    return NextResponse.json({ error: "Item not in current vendor cycle" }, { status: 400 })
  }

  // Verify player is in the season and has sufficient mana
  const { data: entry } = await supabase
    .from("season_entries")
    .select("mana_balance")
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .single()

  if (!entry) {
    return NextResponse.json({ error: "Not in this season" }, { status: 403 })
  }
  if ((entry.mana_balance ?? 0) < item.vendor_price) {
    return NextResponse.json({ error: "Insufficient mana" }, { status: 400 })
  }

  // Check weekly purchase limit
  const { data: purchases } = await supabase
    .from("vendor_purchases")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("item_id", item.id)
    .eq("season_id", season_id)
    .eq("vendor_week", season.current_vendor_week ?? 1)

  const totalBought = (purchases ?? []).reduce((s, r) => s + (r.quantity ?? 0), 0)
  if (totalBought >= item.vendor_weekly_limit) {
    return NextResponse.json({ error: "Purchase limit reached for this week" }, { status: 400 })
  }

  // Deduct mana atomically — returns false if balance insufficient
  const { data: ok, error: deductError } = await supabaseAdmin.rpc("deduct_mana", {
    p_user_id: user.id,
    p_season_id: season_id,
    p_amount: item.vendor_price,
  })

  if (deductError) {
    console.error("[vendor/purchase] deduct_mana RPC error:", deductError)
    return NextResponse.json({ error: `Purchase failed: ${deductError.message}` }, { status: 500 })
  }

  if (!ok) {
    return NextResponse.json({ error: "Insufficient mana" }, { status: 400 })
  }

  // Add booster to inventory
  await supabaseAdmin.rpc("increment_inventory", {
    p_user_id: user.id,
    p_item_id: item.id,
  })

  // Log purchase
  await supabaseAdmin.from("vendor_purchases").insert({
    user_id: user.id,
    item_id: item.id,
    season_id,
    quantity: 1,
    mana_cost: item.vendor_price,
    vendor_week: season.current_vendor_week ?? 1,
    vendor_cycle: season.current_vendor_cycle ?? "A",
  })

  return NextResponse.json({ success: true })
}
