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

  const { game_id, season_id, prediction_id } = await request.json()

  if (!game_id || !season_id) {
    return NextResponse.json({ error: "game_id and season_id required" }, { status: 400 })
  }

  // Verify prediction belongs to user (if provided)
  if (prediction_id) {
    const { data: pred } = await supabase
      .from("predictions")
      .select("id, user_id")
      .eq("id", prediction_id)
      .single()

    if (!pred || pred.user_id !== user.id) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 })
    }
  }

  // Deduct 10 mana from spending balance via auth client (SECURITY DEFINER RPC)
  const { data: ok } = await supabase.rpc("deduct_mana", {
    p_user_id:   user.id,
    p_season_id: season_id,
    p_amount:    10,
  })

  if (!ok) {
    return NextResponse.json({ error: "Insufficient mana" }, { status: 400 })
  }

  // Log to rite_history (service role bypasses RLS)
  await supabaseAdmin.from("rite_history").insert({
    user_id:       user.id,
    season_id,
    prediction_id: prediction_id ?? null,
    rite_slug:     "ritual_of_augury",
    mana_cost:     10,
  })

  // Query all OTHER players' predictions for this game+season
  const { data: otherPredictions } = await supabase
    .from("predictions")
    .select("players_midpoint, reviews_midpoint")
    .eq("game_id", game_id)
    .eq("season_id", season_id)
    .neq("user_id", user.id)
    .not("players_midpoint", "is", null)
    .not("reviews_midpoint", "is", null)

  const preds = otherPredictions ?? []
  const sparse = preds.length < 3

  return NextResponse.json({
    players_midpoints: preds.map(p => p.players_midpoint as number),
    reviews_midpoints: preds.map(p => p.reviews_midpoint as number),
    sparse,
  })
}
