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

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{ background: "transparent" }}
    >
      {/* Left panel — arch shape with soft edges (blur bleeds into center + bottom) */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, filter: "blur(10px)" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(1,2,1,0.97)",
            clipPath: "polygon(0% 0%, 48% 0%, 43% 25%, 38% 50%, 35% 75%, 33% 100%, 0% 100%)",
          }} />
        </div>
      </div>
      {/* Right panel — arch shape with soft edges (blur bleeds into center + bottom) */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, filter: "blur(10px)" }}>
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(6,7,7,0.97)",
            clipPath: "polygon(52% 0%, 100% 0%, 100% 100%, 67% 100%, 65% 75%, 62% 50%, 57% 25%)",
          }} />
        </div>
      </div>
      {/* Left-side vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) .5%, transparent 1%)",
          zIndex: 1,
        }}
      />
      {/* Banner background — stone wall, behind parchment */}
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
          WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
        }}
      >
        <img
          src="/banner-background.png"
          alt=""
          aria-hidden="true"
          style={{
            height: "68px",
            width: "auto",
            transform: "translate(38px, 0px)",
            pointerEvents: "none",
          }}
        />
      </div>
      {/* Banner background right — stone arch, behind right-side badges */}
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
          WebkitMaskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 85%, transparent 100%)",
        }}
      >
        <img
          src="/banner-background-2.png"
          alt=""
          aria-hidden="true"
          style={{
            height: "72px",
            width: "auto",
            transform: "translate(-12px, 0px)",
            pointerEvents: "none",
          }}
        />
      </div>
      {/* Parchment — fixed to header left, independent of logo position */}
      <img
        src="/parchment.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: "63px",
          width: "95px",
          pointerEvents: "none",
          zIndex: 0,
          WebkitMaskImage: "linear-gradient(to bottom, black 90%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 90%, transparent 100%)",
        }}
      />
      <div className="container relative flex h-16 items-center">
        <div className="flex items-center gap-6">
          <div className="flex items-center">
            <Link href={user ? "/dashboard" : "/"} className="flex items-center pr-4 h-16">
              <img
                src="/icons/game-name-logo.png"
                alt="Prognos"
                style={{
                  height: "56px",
                  width: "auto",
                  marginLeft: "6px",
                  marginTop: "-6px",
                  position: "relative",
                  zIndex: 1,
                  filter: "drop-shadow(0 0 6px rgba(157,132,212,0.35)) drop-shadow(0 0 1px rgba(200,180,255,0.2)) drop-shadow(-4px 3px 3px rgba(0,0,0,1))",
                }}
              />
            </Link>
          </div>

          {user && (
            <nav className="hidden md:flex items-center gap-4" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8), 0 2px 12px rgba(0,0,0,0.9)" }}>
              {[
                { href: "/games",    label: "Games" },
                { href: "/vendor",   label: "Vendor" },
                { href: "/archives", label: "Archives" },
                { href: "/mailbox",  label: "Mailbox" },
                { href: "/guide",    label: "Guide" },
                ...(profile?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
              ].map(({ href, label }) => {
                const linkClass = `text-sm font-display transition-colors ${
                  isActive(href)
                    ? "text-amber-400 font-semibold"
                    : "text-foreground/70 hover:text-foreground"
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
      </div>

      {/* Right badges — absolutely anchored to header right edge so position is zoom-invariant */}
      <div style={{ position: "absolute", right: "164px", top: "50%", transform: "translateY(-50%)", zIndex: 10, display: "flex", alignItems: "center", gap: "16px" }}>
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
            {/* Season score + rank on goblin scroll */}
            {user && <Suspense fallback={null}><SeasonScoreBadge user={user} activeSeasonId={activeSeasonId} /></Suspense>}
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
    </header>
  )
}
