"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"
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
import { User, LogOut, Settings, Coins, Gamepad2 } from "lucide-react"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import { SeasonPointsBadge } from "@/components/season-points-badge"

import { EquipmentBadge } from "@/components/equipment-badge"
import { PendingPredictionsIndicator } from "@/components/pending-predictions-indicator"
import { MailboxIndicator } from "@/components/mailbox-indicator"

interface HeaderProps {
  user: SupabaseUser | null
  profile?: {
    display_name: string | null
    avatar_url: string | null
    token_balance: number
    is_admin: boolean
  } | null
  manaBalance?: number | null
  hasJoinedActiveSeason?: boolean
  activeSeasonName?: string | null
  activeSeasonId?: string | null
}

export function Header({ user, profile, manaBalance = null, hasJoinedActiveSeason = true, activeSeasonName = null, activeSeasonId = null }: HeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")
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
      {/* Darkening vignette around logo area */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: [
            "radial-gradient(ellipse 28% 200% at 8% 50%, transparent 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.60) 100%)",
            "radial-gradient(ellipse 16% 160% at 1% 50%, transparent 0%, rgba(0,0,0,0.25) 70%)",
          ].join(", "),
        }}
      />
      {/* Rightward fade */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, transparent 0%, transparent 24%, rgba(10,10,16,0.85) 40%, rgba(10,10,16,0.98) 46%)",
        }}
      />
      <div className="container relative flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center pr-4">
              <img
                src="/icons/game-name-logo.png"
                alt="Prognos"
                style={{
                  height: "56px",
                  width: "auto",
                  marginLeft: "18px",
                  filter: "drop-shadow(0 0 6px rgba(157,132,212,0.35)) drop-shadow(0 0 2px rgba(200,180,255,0.2))",
                }}
              />
            </Link>
          </div>

          {user && (
            <nav className="hidden md:flex items-center gap-4">
              {[
                { href: "/games",    label: "Games" },
                { href: "/vendor",   label: "Vendor" },
                { href: "/archives", label: "Archives" },
                { href: "/mailbox",  label: "Mailbox" },
                ...(profile?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
              ].map(({ href, label }) => {
                const linkClass = `text-sm font-display transition-colors ${
                  isActive(href)
                    ? "text-amber-400 font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`
                if (href === "/games" && user) {
                  return (
                    <PendingPredictionsIndicator key={href} user={user} href={href} className={linkClass}>
                      {label}
                    </PendingPredictionsIndicator>
                  )
                }
                if (href === "/mailbox" && user) {
                  return (
                    <MailboxIndicator key={href} user={user} href={href} className={linkClass}>
                      {label}
                    </MailboxIndicator>
                  )
                }
                return (
                  <Link key={href} href={href} className={linkClass}>
                    {label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Join season CTA — only when player hasn't joined the active season */}
              {user && !hasJoinedActiveSeason && activeSeasonName && activeSeasonId && (
                <Link
                  href={`/seasons/${activeSeasonId}`}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-display text-xs tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18 transition-colors whitespace-nowrap"
                >
                  Join {activeSeasonName} →
                </Link>
              )}
              {/* Equipment badge (purple) — current equipment + tier */}
              {user && <Suspense fallback={null}><EquipmentBadge user={user} /></Suspense>}
              {/* Spendable mana balance (cyan) */}
              {user && <Suspense fallback={null}><SeasonPointsBadge manaBalance={manaBalance} /></Suspense>}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full" suppressHydrationWarning>
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
