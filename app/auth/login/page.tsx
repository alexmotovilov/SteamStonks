"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Loader2 } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">

      {/* Gargoyle with form overlaid on slate */}
      <div className="relative w-full max-w-[360px] select-none">
        <img
          src="/gargoyle.png"
          alt=""
          className="w-full pointer-events-none"
          draggable={false}
        />

        {/* Form positioned over the stone slate */}
        <form
          onSubmit={handleLogin}
          className="absolute flex flex-col justify-center gap-1.5"
          style={{ top: "31%", left: "19%", width: "62%", bottom: "17%" }}
        >
          {error && (
            <p className="text-[10px] text-red-400 text-center leading-tight">{error}</p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-black/25 border border-stone-500/40 rounded text-xs text-stone-100 placeholder:text-stone-500 outline-none px-2 py-1 focus:border-stone-300/50 focus:bg-black/35 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full bg-black/25 border border-stone-500/40 rounded text-xs text-stone-100 placeholder:text-stone-500 outline-none px-2 py-1 focus:border-stone-300/50 focus:bg-black/35 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-0.5 bg-stone-900/70 hover:bg-stone-800/80 border border-stone-500/50 rounded font-display text-[11px] tracking-wide text-stone-200 py-1 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Signing in…
              </span>
            ) : "Sign In"}
          </button>
        </form>
      </div>

      {/* Sign-up link */}
      <p className="text-xs text-muted-foreground text-center -mt-1">
        {"Don't have an account? "}
        <Link href="/auth/sign-up" className="text-primary hover:underline">
          Sign up
        </Link>
      </p>

    </div>
  )
}
