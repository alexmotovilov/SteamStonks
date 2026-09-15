import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
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

  // Idempotent welcome mail — unique partial index (migration 020) prevents duplicates
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  await supabaseAdmin.from("mail_messages").insert({
    message_type: "welcome",
    subject: "Welcome to Prognos",
    body: "Greetings, aspirant. Prognos is a contest that favors the informed, so be sure to read the Guide before beginning your journey. We would like to thank you for joining us in this inaugural season. Claim your introductory bonus and prepare to Prognos.\n\n-Prognos Team",
    target_user_id: user.id,
    target: "user",
    is_published: true,
    mana_reward: 50,
    season_id: null,
  })
  // Errors are intentionally ignored — a unique-constraint violation means the mail already exists

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
