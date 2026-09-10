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

  const { season_id, equipment_id } = await request.json()
  if (!season_id || !equipment_id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Fetch the player's season entry — must be a free unvested entry
  const { data: entry } = await supabase
    .from("season_entries")
    .select("id, is_free_entry, vested_at")
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .single()

  if (!entry) return NextResponse.json({ error: "Not in this season" }, { status: 403 })
  if (!entry.is_free_entry) return NextResponse.json({ error: "Not a free entry" }, { status: 400 })
  if (entry.vested_at) return NextResponse.json({ error: "Already vested" }, { status: 409 })

  // Fetch season — must be active
  const { data: season } = await supabase
    .from("seasons")
    .select("status, entry_fee_tokens")
    .eq("id", season_id)
    .single()

  if (!season || season.status !== "active") {
    return NextResponse.json({ error: "Season is not active" }, { status: 400 })
  }

  // Check token balance
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("token_balance")
    .eq("id", user.id)
    .single()

  if (!profile || (profile.token_balance ?? 0) < season.entry_fee_tokens) {
    return NextResponse.json({ error: "Insufficient tokens" }, { status: 400 })
  }

  // Count retroactive equipment tier: scored perfect/partial predictions this season
  const { count: retroactiveCount } = await supabaseAdmin
    .from("predictions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .in("result", ["perfect", "partial"])
    .not("scored_at", "is", null)

  const tierScore = retroactiveCount ?? 0

  // Atomic guarded vest: update WHERE vested_at IS NULL
  // 0 rows updated = concurrent request already vested
  const { data: updated, error: vestError } = await supabaseAdmin
    .from("season_entries")
    .update({
      vested_at: new Date().toISOString(),
      tokens_paid: season.entry_fee_tokens,
      equipment_id,
      equipment_tier_score: tierScore,
    })
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .is("vested_at", null)
    .select("id")

  if (vestError) {
    console.error("[vest] Failed to vest:", vestError)
    return NextResponse.json({ error: "Failed to vest" }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: "Already vested" }, { status: 409 })
  }

  // Deduct tokens
  await supabaseAdmin
    .from("profiles")
    .update({ token_balance: (profile.token_balance ?? 0) - season.entry_fee_tokens })
    .eq("id", user.id)

  return NextResponse.json({ success: true, equipmentTierScore: tierScore })
}
