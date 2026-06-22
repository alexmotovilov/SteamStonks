import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { WelcomeModal } from "@/components/welcome-modal"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, token_balance, is_admin, mana_balance")
    .eq("id", user.id)
    .single()

  const { data: season } = await supabase
    .from("seasons")
    .select("id, name")
    .eq("status", "active")
    .single()

  const { data: entry } = season
    ? await supabase
        .from("season_entries")
        .select("id")
        .eq("user_id", user.id)
        .eq("season_id", season.id)
        .single()
    : { data: null }

  return (
    <div className="min-h-screen bg-background">
      <Header
        user={user}
        profile={profile}
        manaBalance={profile?.mana_balance ?? null}
        hasJoinedActiveSeason={!!entry}
        activeSeasonName={season?.name ?? null}
        activeSeasonId={season?.id ?? null}
      />
      <WelcomeModal />
      <main className="py-6">
        {children}
      </main>
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        height: "48px",
        background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.97))",
        zIndex: 49,
        pointerEvents: "none",
      }} />
      <img
        src="/header-chain.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "fixed",
          bottom: -37,
          left: 0,
          width: "100%",
          height: "auto",
          zIndex: 50,
          pointerEvents: "none",
        }}
      />
    </div>
  )
}
