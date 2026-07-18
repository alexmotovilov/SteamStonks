import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const runtime = "nodejs"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { data: season, error } = await supabase
      .from("seasons")
      .select("id, current_vendor_week, current_vendor_cycle, last_vendor_reset_at")
      .eq("status", "active")
      .single()

    if (error || !season) {
      return NextResponse.json({ skipped: "no active season" })
    }

    // Guard: only reset if last reset was more than 6 days ago (prevents double-firing)
    if (season.last_vendor_reset_at) {
      const lastReset = new Date(season.last_vendor_reset_at)
      const hoursSince = (Date.now() - lastReset.getTime()) / 1000 / 3600
      if (hoursSince < 144) {
        return NextResponse.json({ skipped: "reset already ran this week", hours_since: hoursSince.toFixed(1) })
      }
    }

    const newWeek = (season.current_vendor_week ?? 1) + 1
    const newCycle = (season.current_vendor_cycle ?? "A") === "A" ? "B" : "A"

    const { error: updateError } = await supabase
      .from("seasons")
      .update({
        current_vendor_week: newWeek,
        current_vendor_cycle: newCycle,
        last_vendor_reset_at: new Date().toISOString(),
      })
      .eq("id", season.id)

    if (updateError) {
      console.error("[vendor-reset] update error:", updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log(`[vendor-reset] season ${season.id}: week ${season.current_vendor_week} → ${newWeek}, cycle ${season.current_vendor_cycle} → ${newCycle}`)
    return NextResponse.json({ success: true, new_week: newWeek, new_cycle: newCycle })
  } catch (err: any) {
    console.error("[vendor-reset] unexpected error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
