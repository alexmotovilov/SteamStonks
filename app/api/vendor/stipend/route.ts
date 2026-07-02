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

  // Mark stipend as claimed for this week
  const { error: weekError } = await supabaseAdmin
    .from("season_entries")
    .update({ stipend_week_number: currentWeek })
    .eq("user_id", user.id)
    .eq("season_id", season_id)

  if (weekError) {
    console.error("[vendor/stipend] stipend_week_number update error:", weekError)
    return NextResponse.json({ error: `Stipend failed: ${weekError.message}` }, { status: 500 })
  }

  // Add mana directly to profiles.mana_balance (the live cross-season wallet)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("mana_balance")
    .eq("id", user.id)
    .single()

  const { error: manaError } = await supabaseAdmin
    .from("profiles")
    .update({ mana_balance: (profile?.mana_balance ?? 0) + STIPEND_AMOUNT })
    .eq("id", user.id)

  if (manaError) {
    console.error("[vendor/stipend] mana_balance update error:", manaError)
    // Week is already marked claimed — log but don't fail the request
  }

  return NextResponse.json({ success: true, mana_awarded: STIPEND_AMOUNT })
}
