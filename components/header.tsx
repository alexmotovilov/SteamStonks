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
import { SeasonScoreBadge } from "@/components/season-score-badge"

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

  // All sizes in vh only — one unit, one scaling axis.
  // Horizontal measurements converted: Xvw → X*1.778vh (1920/1080 aspect ratio baseline).
  // This means every dimension responds identically to zoom so nothing shifts.
  const H         = "8vh"
  const LOGO_H    = "6.4vh"
  const PARCH_H   = "7.7vh"
  const BANNER_H  = "8.4vh"

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{ background: "transparent" }}
    >
      {/* Left-side vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) .5%, transparent 1%)",
          zIndex: 1,
        }}
      />

      {/* Banner background left */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "35%",
          height: "100%",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          WebkitMaskImage: "linear-gradient(to right, black 80%, transparent 90%), linear-gradient(to bottom, black 80%, transparent 96%)",
          WebkitMaskComposite: "destination-in",
          maskImage: "linear-gradient(to right, black 80%, transparent 90%), linear-gradient(to bottom, black 80%, transparent 96%)",
          maskComposite: "intersect",
        }}
      >
        <img
          src="/banner-background.png"
          alt=""
          aria-hidden="true"
          style={{
            height: BANNER_H,
            width: "auto",
            transform: "translate(4.8vh, 0px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Banner background right */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "35%",
          height: "100%",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
          display: "flex",
          justifyContent: "flex-end",
          WebkitMaskImage: "linear-gradient(to left, black 75%, transparent 80%), linear-gradient(to bottom, black 80%, transparent 96%)",
          WebkitMaskComposite: "destination-in",
          maskImage: "linear-gradient(to left, black 75%, transparent 80%), linear-gradient(to bottom, black 80%, transparent 96%)",
          maskComposite: "intersect",
        }}
      >
        <img
          src="/banner-background-2.png"
          alt=""
          aria-hidden="true"
          style={{
            height: BANNER_H,
            width: "auto",
            transform: "translate(-1.5vh, 0px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Parchment behind logo */}
      <img
        src="/parchment.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: PARCH_H,
          width: "auto",
          pointerEvents: "none",
          zIndex: 0,
          WebkitMaskImage: "linear-gradient(to bottom, black 80%, transparent 90%)",
          maskImage: "linear-gradient(to bottom, black 80%, transparent 90%)",
        }}
      />

      {/* Right group — absolutely anchored to header edge, immune to container max-width */}
      <div
        style={{
          position: "absolute",
          right: "13.5vh",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: "1.5vh",
        }}
      >
        {user ? (
          <>
            {user && <Suspense fallback={null}><SeasonScoreBadge user={user} activeSeasonId={activeSeasonId} /></Suspense>}
            {user && <Suspense fallback={null}><SeasonPointsBadge manaBalance={manaBalance} /></Suspense>}

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative rounded-full"
                  style={{ width: "4.5vh", height: "4.5vh", padding: 0 }}
                  suppressHydrationWarning
                >
                  <Avatar style={{ width: "4.5vh", height: "4.5vh" }}>
                    <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.display_name || "User"} />
                    <AvatarFallback className="bg-primary text-primary-foreground" style={{ fontSize: "1.5vh" }}>
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

      {/* Main content row */}
      <div
        className="container relative flex items-center"
        style={{ height: H }}
      >
        <div className="flex items-center" style={{ gap: "4.3vh" }}>
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center" style={{ paddingRight: "2.4vh", height: H }}>
              <img
                src="/icons/game-name-logo.png"
                alt="Prognos"
                style={{
                  height: LOGO_H,
                  width: "auto",
                  marginLeft: "0.7vh",
                  marginTop: "-1.5vh",
                  position: "relative",
                  zIndex: 1,
                  filter: "drop-shadow(0 0 6px rgba(157,132,212,0.35)) drop-shadow(0 0 1px rgba(200,180,255,0.2)) drop-shadow(-4px 3px 3px rgba(0,0,0,1))",
                }}
              />
            </Link>
          </div>

          {user && (
            <nav
              className="hidden md:flex items-center"
              style={{
                gap: "2.4vh",
                textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8), 0 2px 12px rgba(0,0,0,0.9)",
                position: "relative",
                left: "-1.1vh",
              }}
            >
              {[
                { href: "/games",    label: "Games" },
                { href: "/vendor",   label: "Vendor" },
                { href: "/archives", label: "Archives" },
                { href: "/mailbox",  label: "Mailbox" },
                { href: "/guide",    label: "Guide" },
                ...(profile?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
              ].map(({ href, label }) => {
                const linkClass = `font-display transition-colors ${
                  isActive(href)
                    ? "text-amber-400 font-semibold"
                    : "text-foreground/70 hover:text-foreground"
                }`
                const linkStyle = { fontSize: "1.7vh" }
                if (href === "/games" && user) {
                  return (
                    <PendingPredictionsIndicator key={href} user={user} href={href} className={linkClass} style={linkStyle}>
                      {label}
                    </PendingPredictionsIndicator>
                  )
                }
                if (href === "/mailbox" && user) {
                  return (
                    <MailboxIndicator key={href} user={user} href={href} className={linkClass} style={linkStyle}>
                      {label}
                    </MailboxIndicator>
                  )
                }
                return (
                  <Link key={href} href={href} className={linkClass} style={linkStyle}>
                    {label}
                  </Link>
                )
              })}
            </nav>
          )}
        </div>

        {/* Join season CTA */}
        {user && !hasJoinedActiveSeason && activeSeasonName && activeSeasonId && (
          <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 2 }}>
            <Link
              href={`/seasons/${activeSeasonId}`}
              className="pointer-events-auto flex items-center gap-1.5 rounded-lg font-display tracking-wide bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/18 transition-colors whitespace-nowrap"
              style={{ fontSize: "1.5vh", padding: "0.5vh 1.9vh" }}
            >
              Join {activeSeasonName} →
            </Link>
          </div>
        )}

      </div>
    </header>
  )
}
