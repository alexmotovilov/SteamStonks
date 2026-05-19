import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const STIPEND_AMOUNT = 15

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { season_id } = await request.json()
  if (!season_id) return NextResponse.json({ error: "Missing season_id" }, { status: 400 })

  const { data: season } = await supabase
    .from("seasons")
    .select("current_vendor_week")
    .eq("id", season_id)
    .single()

  if (!season) return NextResponse.json({ error: "Season not found" }, { status: 400 })

  const { data: entry } = await supabase
    .from("season_entries")
    .select("stipend_week_number")
    .eq("user_id", user.id)
    .eq("season_id", season_id)
    .single()

  if (!entry) return NextResponse.json({ error: "Not in this season" }, { status: 403 })

  const currentWeek = season.current_vendor_week ?? 1
  if ((entry.stipend_week_number ?? 0) >= currentWeek) {
    return NextResponse.json({ error: "Already claimed this week" }, { status: 400 })
  }

  const { error: rpcError } = await supabaseAdmin.rpc("add_weekly_stipend", {
    p_user_id:    user.id,
    p_season_id:  season_id,
    p_amount:     STIPEND_AMOUNT,
    p_week_number: currentWeek,
  })

  if (rpcError) {
    console.error("[vendor/stipend] add_weekly_stipend error:", rpcError)
    return NextResponse.json({ error: `Stipend failed: ${rpcError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, mana_awarded: STIPEND_AMOUNT })
}
