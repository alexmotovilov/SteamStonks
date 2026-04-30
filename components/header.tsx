"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TrendingUp, User, LogOut, Settings, Coins, Gamepad2 } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { SeasonPointsBadge } from "@/components/season-points-badge"

interface HeaderProps {
  user: SupabaseUser | null
  profile?: {
    display_name: string | null
    avatar_url: string | null
    token_balance: number
    is_admin: boolean
  } | null
}

export function Header({ user, profile }: HeaderProps) {
  const router = useRouter()
  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || "??"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-6 w-6" />
            <span className="text-lg font-bold text-foreground">Steam Stonks</span>
          </Link>

          {user && (
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/seasons"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Seasons
              </Link>
              <Link
                href="/games"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Games
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Leaderboard
              </Link>
              {profile?.is_admin && (
                <Link
                  href="/admin"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Season points badge — fetches client-side to avoid hydration mismatch */}
              {user && <SeasonPointsBadge user={user} />}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || "User"} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {profile?.display_name || "Player"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {/* Token balance in dropdown — relevant but not primary */}
                  <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                    <Coins className="h-4 w-4" />
                    <span>{profile?.token_balance?.toLocaleString() || 0} tokens</span>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/predictions" className="cursor-pointer">
                      <Gamepad2 className="mr-2 h-4 w-4" />
                      My Predictions
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost">
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
