import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"

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
    .select("display_name, avatar_url, token_balance, is_admin")
    .eq("id", user.id)
    .single()

  // Get active season points total directly from predictions
  // so it's always current regardless of leaderboard cron timing
  const { data: activeSeason } = await supabase
    .from("seasons")
    .select("id")
    .eq("status", "active")
    .single()

  let seasonPoints = 0
  if (activeSeason) {
    const { data: scoredPredictions } = await supabase
      .from("predictions")
      .select("final_points")
      .eq("user_id", user.id)
      .eq("season_id", activeSeason.id)
      .not("final_points", "is", null)

    seasonPoints = (scoredPredictions ?? []).reduce(
      (sum, p) => sum + (p.final_points ?? 0), 0
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} profile={profile} seasonPoints={activeSeason ? seasonPoints : null} />
      <main className="container py-6">
        {children}
      </main>
    </div>
  )
}
