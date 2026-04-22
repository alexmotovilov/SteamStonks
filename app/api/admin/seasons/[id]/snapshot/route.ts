import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { takeSeasonEndSnapshots } from "@/lib/season-snapshot"

// Service role client for snapshot writes (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: seasonId } = await params

  // Verify the caller is a logged-in admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Verify the season exists and is in a valid state to snapshot
  const { data: season } = await supabaseAdmin
    .from("seasons")
    .select("id, name, status, end_date")
    .eq("id", seasonId)
    .single()

  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 })
  }

  if (season.status === "completed") {
    return NextResponse.json(
      { error: "Season is already completed" },
      { status: 400 }
    )
  }

  if (season.status === "upcoming") {
    return NextResponse.json(
      { error: "Season has not started yet" },
      { status: 400 }
    )
  }

  console.log(`[Admin Snapshot] Manual season_end snapshot triggered for "${season.name}" by ${user.id}`)

  try {
    const result = await takeSeasonEndSnapshots(supabaseAdmin, seasonId)

    return NextResponse.json({
      message: "Season end snapshot complete",
      ...result,
    })
  } catch (error) {
    console.error("[Admin Snapshot] Unexpected error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
