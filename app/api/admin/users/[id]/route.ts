import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

// Service role client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export const runtime = "nodejs"

async function verifyAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  return profile?.is_admin ? user : null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await verifyAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id: targetUserId } = await params
  const body = await request.json()
  const { action, value } = body

  // Prevent admins from modifying their own admin/ban status
  if (targetUserId === admin.id && (action === "set_admin" || action === "set_banned")) {
    return NextResponse.json(
      { error: "You cannot modify your own admin or ban status" },
      { status: 400 }
    )
  }

  try {
    switch (action) {
      case "set_admin": {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ is_admin: Boolean(value), updated_at: new Date().toISOString() })
          .eq("id", targetUserId)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "set_banned": {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ is_banned: Boolean(value), updated_at: new Date().toISOString() })
          .eq("id", targetUserId)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "adjust_points": {
        const points = parseInt(value)
        if (isNaN(points)) {
          return NextResponse.json({ error: "Invalid points value" }, { status: 400 })
        }
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ points_balance: points, updated_at: new Date().toISOString() })
          .eq("id", targetUserId)
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      case "reset_password": {
        // Fetch the user's email from Supabase Auth via admin API
        const { data: authUser, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(targetUserId)
        if (fetchError || !authUser.user?.email) {
          return NextResponse.json({ error: "Could not find user email" }, { status: 400 })
        }
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
          authUser.user.email,
          { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auth/reset-password` }
        )
        if (error) throw error
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (err) {
    console.error("[Admin Users] Action failed:", err)
    return NextResponse.json({ error: "Action failed" }, { status: 500 })
  }
}
