"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2 } from "lucide-react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${window.location.origin}/dashboard`,
        data: {
          display_name: displayName,
        },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/auth/sign-up-success")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="relative w-full max-w-md">
        {/* Gargoyle + speech bubble — absolutely positioned to the left of the card */}
        <div className="absolute right-full bottom-0 hidden md:flex flex-col items-center pr-6" style={{ width: "320px" }}>
          {/* Speech bubble */}
          <div
            className="relative rounded-xl border px-4 py-3 text-sm font-body text-white w-full text-center mb-2"
            style={{ backdropFilter: "blur(4px)", borderColor: "#C4A882", backgroundColor: "rgba(196,168,130,0.25)" }}
          >
            Prognos staff will{" "}
            <span className="text-red-400 font-semibold">NEVER</span> ask you for your password. Do not share it with anybody.
            {/* Tail pointing down */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-full"
              style={{
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "10px solid #C4A882",
              }}
            />
          </div>
          <img
            src="/other-gargoyle.png"
            alt=""
            style={{ width: "100%", height: "auto" }}
          />
        </div>

      <Card className="w-full border-border bg-card">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <img src="/icons/game-name-logo.png" alt="Prognos" style={{ height: "80px", width: "auto", filter: "drop-shadow(0 0 8px rgba(157,132,212,0.5))" }} />
          </div>
          <CardTitle className="text-xl text-foreground">Create an account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Greetings, oracular aspirant. Welcome to Prognos.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSignUp}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayName" className="text-foreground">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Public Username Here"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  )
}
