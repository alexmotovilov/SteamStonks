import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })

  const { protocol, host } = new URL(request.url)
  const baseUrl = `${protocol}//${host}`

  const response = await fetch(`${baseUrl}/api/cron/score-calculator`, {
    headers: { Authorization: `Bearer ${cronSecret}` },
  })

  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    return NextResponse.json({ error: `Score calculator returned invalid response: ${text.slice(0, 200)}` }, { status: 500 })
  }

  return NextResponse.json(data, { status: response.status })
}
