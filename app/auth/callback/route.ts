import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  // Supabase may hand the redirect back an explicit error (e.g. expired link).
  const authError = searchParams.get("error_description") ?? searchParams.get("error")

  // Only honour a relative in-app path to avoid open redirects.
  const nextParam = searchParams.get("next")
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
    ? nextParam
    : "/dashboard"

  if (!authError) {
    const supabase = await createClient()

    if (code) {
      // PKCE flow: requires the code_verifier cookie set by signUp on this
      // same origin. Fails if the link is opened on a different origin/browser.
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    } else if (tokenHash && type) {
      // token_hash flow: verify directly, no code_verifier needed — this is the
      // graceful fallback when the PKCE code exchange isn't available.
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      if (!error) return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
