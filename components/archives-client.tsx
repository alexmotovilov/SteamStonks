"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronDown } from "lucide-react"

// --- Types ---

interface Season {
  id: string
  name: string
  status: string
  start_date: string | null
  end_date: string | null
}

interface SeasonEntry {
  user_id: string
  prediction_mana_earned: number | null
  profiles: unknown  // Supabase may return object or array depending on FK direction
}

interface PerfectCount {
  user_id: string
  perfect_count: number | null
}

interface LadderResult {
  user_id: string
  total_mana: number | null
  binary_mana: number | null
  sequence_mana: number | null
  profiles: unknown
}

interface PastSeasonData {
  entries: SeasonEntry[]
  perfectCounts: PerfectCount[]
  ladderResults: LadderResult[]
}

interface ArchivesClientProps {
  seasons: Season[]
  activeSeason: Season | null
  activeSeasonEntries: SeasonEntry[]
  activePerfectCounts: PerfectCount[]
  userId: string | null
}

// --- Helpers ---

const MEDALS = ["🥇", "🥈", "🥉"]

function resolveProfile(profiles: unknown): { display_name: string | null; avatar_url: string | null } {
  // Supabase may return the joined row as an object or as a single-element array
  const p = Array.isArray(profiles) ? profiles[0] : profiles
  if (!p || typeof p !== "object") return { display_name: null, avatar_url: null }
  const row = p as Record<string, unknown>
  return {
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    avatar_url:   typeof row.avatar_url   === "string" ? row.avatar_url   : null,
  }
}

function displayName(profiles: unknown): string {
  return resolveProfile(profiles).display_name ?? "Unknown"
}

function avatarUrl(profiles: unknown): string | null {
  return resolveProfile(profiles).avatar_url
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[10px] font-display">Active</Badge>
  if (status === "upcoming")
    return <Badge variant="secondary" className="text-[10px] font-display">Upcoming</Badge>
  if (status === "scoring")
    return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 text-[10px] font-display">Scoring</Badge>
  return <Badge variant="outline" className="text-[10px] font-display text-muted-foreground">Completed</Badge>
}

// --- Leaderboard table ---

function LeaderboardTable({
  entries,
  perfectCounts,
  userId,
}: {
  entries: SeasonEntry[]
  perfectCounts: PerfectCount[]
  userId: string | null
}) {
  const perfMap: Record<string, number> = {}
  for (const p of perfectCounts) perfMap[p.user_id] = p.perfect_count ?? 0

  if (entries.length === 0) {
    return (
      <div className="px-4 py-10 text-center font-body text-sm text-muted-foreground">
        No predictions have been scored yet this season.
        <br />Check back after the first games release!
      </div>
    )
  }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-display text-muted-foreground/40 tracking-widest uppercase border-b border-border/50">
        <span className="w-8 shrink-0 text-right">#</span>
        <span className="w-6 shrink-0" />
        <span className="flex-1">Player</span>
        <span className="shrink-0">Mana Earned</span>
        <span className="w-14 text-right shrink-0">Perfect</span>
      </div>
      <div className="divide-y divide-border/30">
        {entries.map((entry, idx) => {
          const rank = idx + 1
          const isMe = entry.user_id === userId
          const name = displayName(entry.profiles)
          const avatar = avatarUrl(entry.profiles)
          const mana = entry.prediction_mana_earned ?? 0
          const perfect = perfMap[entry.user_id] ?? 0

          return (
            <div
              key={entry.user_id}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                isMe
                  ? "bg-purple-950/30 border-l-2 border-purple-500"
                  : idx % 2 === 1
                  ? "bg-white/[0.015]"
                  : ""
              }`}
            >
              {/* Rank */}
              <span className={`font-display text-sm w-8 text-right shrink-0 ${rank <= 3 ? "text-base" : "text-muted-foreground/60"}`}>
                {rank <= 3 ? MEDALS[rank - 1] : `#${rank}`}
              </span>

              {/* Avatar */}
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={avatar ?? undefined} />
                <AvatarFallback className="text-[9px] bg-purple-950/60 text-purple-300">
                  {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              {/* Name */}
              <span className={`flex-1 text-sm truncate ${
                isMe ? "text-purple-300 font-medium"
                : rank <= 3 ? "text-foreground font-medium"
                : "text-muted-foreground"
              }`}>
                {name}{isMe && <span className="ml-1.5 text-[10px] text-purple-500/60 font-body">(you)</span>}
              </span>

              {/* Mana */}
              <div className="flex items-center gap-1 shrink-0">
                <img src="/icons/mana-icon.png" alt="" style={{ width: 11, height: 11 }} />
                <span className="font-display text-xs text-cyan-300">{mana.toLocaleString()}</span>
              </div>

              {/* Perfect count */}
              <span className="w-14 text-right shrink-0 font-display text-xs">
                {perfect > 0
                  ? <span className="text-emerald-600">{perfect} ✓</span>
                  : <span className="text-muted-foreground/30">—</span>
                }
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Ladder results table ---

function LadderTable({ results }: { results: LadderResult[] }) {
  if (results.length === 0) {
    return (
      <div className="px-4 py-10 text-center font-body text-sm text-muted-foreground">
        No ladder results available.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-display text-muted-foreground/40 tracking-widest uppercase border-b border-border/50">
        <span className="w-8 shrink-0 text-right">#</span>
        <span className="flex-1">Player</span>
        <span className="w-28 text-right shrink-0">Ladder Mana</span>
        <span className="w-16 text-right shrink-0">Binary</span>
        <span className="w-16 text-right shrink-0">Sequence</span>
      </div>
      <div className="divide-y divide-border/30">
        {results.map((r, idx) => (
          <div
            key={r.user_id}
            className={`flex items-center gap-3 px-4 py-2.5 ${idx % 2 === 1 ? "bg-white/[0.015]" : ""}`}
          >
            <span className={`font-display text-sm w-8 text-right shrink-0 ${idx <= 2 ? "text-base" : "text-muted-foreground/60"}`}>
              {idx <= 2 ? MEDALS[idx] : `#${idx + 1}`}
            </span>
            <span className="flex-1 text-sm text-muted-foreground truncate">
              {displayName(r.profiles)}
            </span>
            <div className="flex items-center gap-1 w-28 justify-end shrink-0">
              <img src="/icons/mana-icon.png" alt="" style={{ width: 11, height: 11 }} />
              <span className="font-display text-xs text-cyan-300">{(r.total_mana ?? 0).toLocaleString()}</span>
            </div>
            <span className="font-display text-xs text-muted-foreground/60 w-16 text-right shrink-0">
              +{r.binary_mana ?? 0}
            </span>
            <span className="font-display text-xs text-muted-foreground/60 w-16 text-right shrink-0">
              +{r.sequence_mana ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main client component ---

export function ArchivesClient({
  seasons,
  activeSeason,
  activeSeasonEntries,
  activePerfectCounts,
  userId,
}: ArchivesClientProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(activeSeason ? [activeSeason.id] : [])
  )
  const [pastData, setPastData] = useState<Record<string, PastSeasonData>>({})
  const [loading, setLoading] = useState<Set<string>>(new Set())
  const [activeTabs, setActiveTabs] = useState<Record<string, "leaderboard" | "ladder">>({})

  async function toggleSeason(seasonId: string, status: string) {
    if (expanded.has(seasonId)) {
      setExpanded(prev => { const s = new Set(prev); s.delete(seasonId); return s })
      return
    }
    setExpanded(prev => new Set([...prev, seasonId]))

    // Lazy-load past season data the first time it's expanded
    const isPast = status !== "active" && status !== "upcoming"
    if (isPast && !pastData[seasonId]) {
      setLoading(prev => new Set([...prev, seasonId]))
      const supabase = createClient()

      const [entriesRes, perfRes, ladderRes] = await Promise.all([
        supabase
          .from("season_entries")
          .select("user_id, prediction_mana_earned, profiles:user_id(display_name, avatar_url)")
          .eq("season_id", seasonId)
          .order("prediction_mana_earned", { ascending: false })
          .limit(50),
        supabase
          .from("leaderboards")
          .select("user_id, perfect_count")
          .eq("season_id", seasonId),
        status === "completed"
          ? supabase
              .from("ladder_rankings")
              .select("user_id, total_mana, binary_mana, sequence_mana, profiles:user_id(display_name)")
              .eq("season_id", seasonId)
              .order("total_mana", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] as LadderResult[] }),
      ])

      setPastData(prev => ({
        ...prev,
        [seasonId]: {
          entries:      (entriesRes.data ?? []) as unknown as SeasonEntry[],
          perfectCounts: (perfRes.data  ?? []) as PerfectCount[],
          ladderResults: (ladderRes.data ?? []) as LadderResult[],
        },
      }))
      setLoading(prev => { const s = new Set(prev); s.delete(seasonId); return s })
    }
  }

  if (seasons.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground font-body">
        No seasons found.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {seasons.map(season => {
        const isActive = season.id === activeSeason?.id
        const isExpanded = expanded.has(season.id)
        const isLoading = loading.has(season.id)
        const isCompleted = season.status === "completed"
        const tab = activeTabs[season.id] ?? "leaderboard"

        const data: PastSeasonData | undefined = isActive
          ? { entries: activeSeasonEntries, perfectCounts: activePerfectCounts, ladderResults: [] }
          : pastData[season.id]

        const entryCount = isActive
          ? activeSeasonEntries.length
          : data?.entries.length ?? null

        return (
          <div key={season.id} className="border border-border rounded-xl overflow-hidden">

            {/* Accordion header */}
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
              onClick={() => toggleSeason(season.id, season.status)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-wrap">
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isExpanded ? "rotate-0" : "-rotate-90"
                  }`}
                />
                <span className="font-display text-sm text-foreground">{season.name}</span>
                <StatusBadge status={season.status} />
                {entryCount !== null && (
                  <span className="text-xs text-muted-foreground/50 font-body">
                    {entryCount} {entryCount === 1 ? "player" : "players"}
                  </span>
                )}
              </div>
              {season.start_date && (
                <span className="text-[10px] text-muted-foreground/30 font-body shrink-0 ml-2">
                  {new Date(season.start_date).getFullYear()}
                </span>
              )}
            </div>

            {/* Expanded body */}
            {isExpanded && (
              <div className="border-t border-border">
                {isLoading ? (
                  <div className="px-4 py-10 text-center font-body text-sm text-muted-foreground animate-pulse">
                    Loading…
                  </div>
                ) : data ? (
                  <>
                    {/* Tab bar — only for completed seasons */}
                    {isCompleted && (
                      <div className="flex border-b border-border">
                        {(["leaderboard", "ladder"] as const).map(t => (
                          <button
                            key={t}
                            onClick={e => {
                              e.stopPropagation()
                              setActiveTabs(prev => ({ ...prev, [season.id]: t }))
                            }}
                            className={`font-display text-[10px] tracking-widest uppercase px-4 py-2.5 border-b-2 transition-colors ${
                              tab === t
                                ? "border-purple-500 text-purple-400"
                                : "border-transparent text-muted-foreground/40 hover:text-muted-foreground"
                            }`}
                          >
                            {t === "leaderboard" ? "Leaderboard" : "Top 8 Ladder"}
                          </button>
                        ))}
                      </div>
                    )}

                    {(!isCompleted || tab === "leaderboard") && (
                      <LeaderboardTable
                        entries={data.entries}
                        perfectCounts={data.perfectCounts}
                        userId={userId}
                      />
                    )}
                    {isCompleted && tab === "ladder" && (
                      <LadderTable results={data.ladderResults} />
                    )}
                  </>
                ) : (
                  <div className="px-4 py-10 text-center font-body text-sm text-muted-foreground">
                    No data available.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
