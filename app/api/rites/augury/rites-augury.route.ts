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

  const { game_id, season_id } = await request.json()

  // Verify player is in the season
  const { data: entry } = await supabase
    .from("season_entries")
    .select("mana_balance")
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .single()

  if (!entry) return NextResponse.json({ error: "Not in this season" }, { status: 403 })
  if ((entry.mana_balance ?? 0) < 10) return NextResponse.json({ error: "Insufficient mana (need 10)" }, { status: 400 })

  // Deduct mana atomically
  const { data: success } = await supabaseAdmin.rpc("deduct_mana", {
    p_user_id:   user.id,
    p_season_id: season_id,
    p_amount:    10,
  })
  if (!success) return NextResponse.json({ error: "Insufficient mana" }, { status: 400 })

  // Log rite
  const { data: existingPred } = await supabase
    .from("predictions")
    .select("id, applied_rites")
    .eq("user_id", user.id)
    .eq("game_id", game_id)
    .eq("season_id", season_id)
    .single()

  await supabaseAdmin.from("rite_history").insert({
    user_id:       user.id,
    prediction_id: existingPred?.id ?? null,
    season_id,
    rite_slug:     "ritual_of_augury",
    mana_cost:     10,
  })

  if (existingPred) {
    await supabaseAdmin
      .from("predictions")
      .update({
        applied_rites: {
          ...(existingPred.applied_rites ?? {}),
          ritual_of_augury: new Date().toISOString(),
        }
      })
      .eq("id", existingPred.id)
  }

  // Fetch all current prediction midpoints for this game/season
  const { data: allPredictions } = await supabaseAdmin
    .from("predictions")
    .select("players_midpoint, reviews_midpoint")
    .eq("game_id", game_id)
    .eq("season_id", season_id)
    .not("players_midpoint", "is", null)

  const players_midpoints = (allPredictions ?? []).map(p => p.players_midpoint).filter(Boolean) as number[]
  const reviews_midpoints = (allPredictions ?? []).map(p => p.reviews_midpoint).filter(Boolean) as number[]

  return NextResponse.json({ players_midpoints, reviews_midpoints })
}
