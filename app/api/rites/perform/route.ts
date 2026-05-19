import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Fixed mana costs per rite slug (ritual_of_augury has its own route)
const RITE_COSTS: Record<string, number> = {
  eldritch_wager:        30,
  sigil_of_multiplicity: 50,
  temporal_translocation: 100,
  auspicious_omens:      0, // dynamic — caller passes mana_cost
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prediction_id, season_id, rite_slug, mana_cost } = await request.json()

  if (!prediction_id || !season_id || !rite_slug) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  if (!(rite_slug in RITE_COSTS)) {
    return NextResponse.json({ error: "Unknown rite" }, { status: 400 })
  }

  // Verify the prediction exists and belongs to this user
  const { data: prediction } = await supabase
    .from("predictions")
    .select("id, user_id, applied_rites")
    .eq("id", prediction_id)
    .single()

  if (!prediction || prediction.user_id !== user.id) {
    return NextResponse.json({ error: "Prediction not found" }, { status: 404 })
  }

  const cost = rite_slug === "auspicious_omens"
    ? (typeof mana_cost === "number" ? mana_cost : 10)
    : RITE_COSTS[rite_slug]

  // Deduct mana from the player's spendable balance
  if (cost > 0) {
    const { data: ok } = await supabase.rpc("deduct_mana", {
      p_user_id:   user.id,
      p_season_id: season_id,
      p_amount:    cost,
    })
    if (!ok) {
      return NextResponse.json({ error: "Insufficient mana" }, { status: 400 })
    }
  }

  // Temporal Translocation: nullify early lock so sliders become editable again
  if (rite_slug === "temporal_translocation") {
    const { error: unlockError } = await supabaseAdmin
      .from("predictions")
      .update({ early_locked_at: null, mana_early_lock: 0 })
      .eq("id", prediction_id)
      .eq("user_id", user.id)

    if (unlockError) {
      console.error("[Temporal Translocation] Failed to remove early lock:", unlockError)
      return NextResponse.json({ error: "Failed to remove early lock" }, { status: 500 })
    }
  }

  // Log the rite to rite_history (service role — bypasses RLS)
  await supabaseAdmin.from("rite_history").insert({
    user_id:       user.id,
    season_id,
    prediction_id,
    rite_slug,
    mana_cost:     cost,
  })

  // Record rite on the prediction's applied_rites map
  const currentRites = (prediction.applied_rites as Record<string, string>) ?? {}
  await supabaseAdmin
    .from("predictions")
    .update({ applied_rites: { ...currentRites, [rite_slug]: new Date().toISOString() } })
    .eq("id", prediction_id)

  return NextResponse.json({ success: true, mana_deducted: cost })
}
