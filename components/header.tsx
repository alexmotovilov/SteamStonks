"use client"

import { Suspense, useState, useEffect } from "react"
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
import { User, LogOut, Settings, Coins, Gamepad2, Menu, X } from "lucide-react"
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileScore, setMobileScore] = useState<number | null>(null)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!user || !activeSeasonId) return
    const supabase = createClient()
    supabase
      .from("season_entries")
      .select("prediction_mana_earned")
      .eq("user_id", user.id)
      .eq("season_id", activeSeasonId)
      .single()
      .then(({ data }) => {
        if (data) setMobileScore(data.prediction_mana_earned)
      })
  }, [user?.id, activeSeasonId])

  const navItems = [
    { href: "/games",    label: "Games" },
    { href: "/vendor",   label: "Vendor" },
    { href: "/archives", label: "Archives" },
    { href: "/mailbox",  label: "Mailbox" },
    { href: "/guide",    label: "Guide" },
    ...(profile?.is_admin ? [{ href: "/admin", label: "Admin" }] : []),
  ]

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

      {/* Mobile header banner — full width, replaces both desktop banners below sm */}
      <div
        className="sm:hidden absolute inset-0 pointer-events-none"
        style={{
          zIndex: 0,
          backgroundImage: "url('/mobile-header.png')",
          backgroundSize: "cover",
          backgroundPosition: "50% 100%",
          WebkitMaskImage: "linear-gradient(to bottom, black 92%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, black 92%, transparent 100%)",
        }}
      />


      {/* Mobile score overlay */}
      {user && mobileScore !== null && (
        <div
          className="sm:hidden absolute flex items-center gap-1 pointer-events-none"
          style={{ right: "calc(13.5vh + 185px)", top: "90px", zIndex: 2 }}
        >
          <img src="/icons/season-score-icon.png" alt="" style={{ width: "22px", height: "22px", opacity: 0.65, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.5))" }} />
          <span className="font-display text-xl font-semibold text-red-900" style={{ textShadow: "0 0 6px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.3)" }}>
            {mobileScore.toLocaleString()}
          </span>
        </div>
      )}

      {/* Mobile mana overlay */}
      {user && manaBalance !== null && (
        <div
          className="sm:hidden absolute flex items-center gap-1 pointer-events-none"
          style={{ right: "calc(13.5vh - 60px)", top: "90px", zIndex: 2 }}
        >
          <img src="/icons/mana-icon.png" alt="" style={{ width: "22px", height: "22px" }} />
          <span className="font-display text-xl text-cyan-200" style={{ textShadow: "0 0 8px rgba(0,0,0,1), 0 1px 4px rgba(0,0,0,1)" }}>
            {manaBalance.toLocaleString()}
          </span>
        </div>
      )}

      {/* Banner background left */}
      <div
        className="hidden sm:block"
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
            maxWidth: "none",
            transform: "translate(calc(4.8vh - 45px), 0px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Banner background right */}
      <div
        className="hidden sm:flex"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: "35%",
          height: "100%",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 0,
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
            maxWidth: "none",
            transform: "translate(-1.5vh, 0px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Invisible dashboard link over logo area in left banner */}
      <Link
        href={user ? "/dashboard" : "/"}
        aria-label="Home"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "10vh",
          height: "100%",
          zIndex: 3,
        }}
      />

      {/* Candle glow on banner-background-2 */}
      <div className="hidden sm:block" style={{
        position: "fixed",
        right: "calc(23.5vw - 70px)",
        top: "calc(4.2vh - 60px)",
        width: "110px",
        height: "90px",
        transform: "translate(50%, -50%)",
        background: "radial-gradient(ellipse at center, rgba(255,200,60,0.60) 0%, rgba(255,140,20,0.32) 35%, rgba(200,80,10,0.10) 65%, transparent 80%)",
        filter: "blur(14px)",
        zIndex: 1,
        pointerEvents: "none",
        animation: "lanternFlicker 7s ease-in-out infinite",
      }} />


      {/* Right group — absolutely anchored to header edge, immune to container max-width */}
      <div
        style={{
          position: "absolute",
          right: "calc(13.5vh + 50px)",
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

            <div className="hidden"><DropdownMenu modal={false}>
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
            </DropdownMenu></div>

            <button
              className="hidden sm:flex md:hidden items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
              style={{ width: "4vh", height: "4vh" }}
              onClick={() => setMobileMenuOpen(prev => !prev)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen
                ? <X style={{ width: "2.4vh", height: "2.4vh" }} />
                : <Menu style={{ width: "2.4vh", height: "2.4vh" }} />
              }
            </button>
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
        className="container relative flex items-center h-[136px] sm:h-[8vh]"
      >
        <div className="flex items-center" style={{ gap: "4.3vh" }}>

          {user && (
            <nav
              className="hidden md:flex items-center"
              style={{
                gap: "2.4vh",
                textShadow: "0 1px 4px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.8), 0 2px 12px rgba(0,0,0,0.9)",
                position: "relative",
                left: "calc(-1.1vh + 130px)",
              }}
            >
              {navItems.map(({ href, label }) => {
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

        {/* Mobile hamburger — center bottom */}
        <button
          className="flex sm:hidden items-center justify-center text-foreground/70 hover:text-foreground transition-colors absolute"
          style={{ bottom: "15px", left: "50%", transform: "translateX(-50%)", zIndex: 3, width: "36px", height: "36px" }}
          onClick={() => setMobileMenuOpen(prev => !prev)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen
            ? <X style={{ width: "22px", height: "22px" }} />
            : <Menu style={{ width: "22px", height: "22px" }} />
          }
        </button>
      </div>

      {/* Mobile nav menu */}
      {mobileMenuOpen && user && (
        <nav
          className="md:hidden absolute left-0 right-0 top-full z-40 flex flex-col py-2"
          style={{
            background: "rgba(8, 6, 18, 0.97)",
            borderBottom: "1px solid rgba(217, 119, 6, 0.2)",
            backdropFilter: "blur(12px)",
          }}
        >
          {navItems.map(({ href, label }) => {
            const linkClass = `flex items-center px-6 py-3.5 font-display transition-colors ${
              isActive(href)
                ? "text-amber-400 bg-amber-500/5"
                : "text-foreground/70 hover:text-foreground hover:bg-white/5"
            }`
            const linkStyle = { fontSize: "15px", letterSpacing: "0.08em" }
            if (href === "/games") {
              return (
                <PendingPredictionsIndicator key={href} user={user} href={href} className={linkClass} style={linkStyle}>
                  {label}
                </PendingPredictionsIndicator>
              )
            }
            if (href === "/mailbox") {
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
    </header>
  )
}
