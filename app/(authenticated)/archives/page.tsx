import { createClient } from "@/lib/supabase/server"
import { ArchivesClient } from "@/components/archives-client"

export default async function ArchivesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: seasons } = await supabase
    .from("seasons")
    .select("id, name, status, start_date, end_date")
    .order("start_date", { ascending: false })

  const activeSeason = seasons?.find(
    s => s.status === "active" || s.status === "upcoming"
  ) ?? null

  let activeSeasonEntries: unknown[] = []
  let activePerfectCounts: unknown[] = []

  if (activeSeason) {
    const [entriesRes, leaderboardRes] = await Promise.all([
      supabase
        .from("season_entries")
        .select("user_id, prediction_mana_earned, profiles:user_id(display_name, avatar_url)")
        .eq("season_id", activeSeason.id)
        .order("prediction_mana_earned", { ascending: false })
        .limit(50),
      supabase
        .from("leaderboards")
        .select("user_id, perfect_count")
        .eq("season_id", activeSeason.id),
    ])
    activeSeasonEntries = entriesRes.data ?? []
    activePerfectCounts = leaderboardRes.data ?? []
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display text-foreground">Archives</h1>
        <p className="text-muted-foreground font-body text-sm mt-1">
          Season leaderboards and top 8 results
        </p>
      </div>
      <ArchivesClient
        seasons={seasons ?? []}
        activeSeason={activeSeason}
        activeSeasonEntries={activeSeasonEntries as any}
        activePerfectCounts={activePerfectCounts as any}
        userId={user?.id ?? null}
      />
    </div>
  )
}
