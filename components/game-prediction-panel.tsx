"use client"

import { useCallback, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { PredictionFormClient } from "@/components/prediction-form-client"
import { X } from "lucide-react"

interface GamePredictionPanelProps {
  gameId: string
  seasonId: string
  onClose: () => void
  onDirtyChange?: (dirty: boolean) => void
  pendingSwitchId?: string | null
  onSwitchConfirm?: () => void
  onSwitchCancel?: () => void
}

type PanelData = {
  game: Record<string, unknown>
  seasonData: Record<string, unknown>
  existingPrediction: Record<string, unknown> | null
  weekOneSnapshot: { player_count: number | null; review_positive: number | null; review_negative: number | null; captured_at: string | null } | null
  seasonEntry: { equipment_id: string | null; equipment_tier_score: number } | null
  inventory: { item_id: string; quantity: number; items: { slug: string; name: string; image_url: string | null; effects: Record<string, number>; description: string } }[]
  seasonGames: { id: string; name: string; header_image_url: string | null; header_image_position: string | null; is_released: boolean; release_date: string | null }[]
  aoMarkCount: number
  aoMarkedGameIds: string[]
  predictedGameIds: string[]
  existingLadder: string[]
  lockedLadderGameIds: string[]
}

export function GamePredictionPanel({ gameId, seasonId, onClose, onDirtyChange, pendingSwitchId, onSwitchConfirm, onSwitchCancel }: GamePredictionPanelProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<PanelData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFormDirty, setIsFormDirty] = useState(false)
  const [showExitConfirm, setShowExitConfirm] = useState(false)

  useEffect(() => { onDirtyChange?.(isFormDirty) }, [isFormDirty, onDirtyChange])
  useEffect(() => { if (!isFormDirty) setShowExitConfirm(false) }, [isFormDirty])

  const handleRequestClose = useCallback(() => {
    if (isFormDirty) { setShowExitConfirm(true); return }
    onClose()
  }, [isFormDirty, onClose])

  const handleConfirmExit = useCallback(() => {
    setShowExitConfirm(false)
    if (pendingSwitchId) onSwitchConfirm?.()
    else onClose()
  }, [pendingSwitchId, onSwitchConfirm, onClose])

  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false)
    if (pendingSwitchId) onSwitchCancel?.()
  }, [pendingSwitchId, onSwitchCancel])

  const fetchData = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const [
        gameRes,
        seasonRes,
        predRes,
        snapshotRes,
        entryRes,
        boostersRes,
        inventoryRes,
        seasonGamesRes,
        aoRitesRes,
        aoMarkedRes,
        playerPredsRes,
        ladderRes,
      ] = await Promise.all([
        supabase.from("games").select("*").eq("id", gameId).single(),
        supabase.from("seasons").select("*").eq("id", seasonId).single(),
        user
          ? supabase.from("predictions").select("*").eq("user_id", user.id).eq("game_id", gameId).eq("season_id", seasonId).eq("prediction_type", "week_one").single()
          : Promise.resolve({ data: null }),
        supabase.from("game_snapshots").select("player_count, review_positive, review_negative, captured_at").eq("game_id", gameId).eq("snapshot_type", "week_after_release").order("captured_at", { ascending: false }).limit(1).single(),
        user
          ? supabase.from("season_entries").select("equipment_id, equipment_tier_score").eq("user_id", user.id).eq("season_id", seasonId).single()
          : Promise.resolve({ data: null }),
        supabase.from("items").select("id, slug, name, image_url, effects, description").eq("item_type", "booster"),
        user
          ? supabase.from("inventory").select("item_id, quantity").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        supabase.from("games").select("id, name, header_image_url, header_image_position, is_released, release_date").eq("season_id", seasonId).order("release_date", { ascending: true }),
        user
          ? supabase.from("rite_history").select("id").eq("user_id", user.id).eq("season_id", seasonId).eq("rite_slug", "auspicious_omens")
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from("predictions").select("game_id").eq("user_id", user.id).eq("season_id", seasonId).eq("ao_marked", true)
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from("predictions").select("game_id").eq("user_id", user.id).eq("season_id", seasonId)
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from("ladder_rankings").select("ranked_games, locked_game_ids").eq("user_id", user.id).eq("season_id", seasonId).single()
          : Promise.resolve({ data: null }),
      ])

      const allBoosters = boostersRes.data ?? []
      const ownedInventory = inventoryRes.data ?? []
      const ownedMap = new Map((ownedInventory as { item_id: string; quantity: number }[]).map(i => [i.item_id, i.quantity]))
      const inventory = allBoosters.map((item: Record<string, unknown>) => ({
        item_id: item.id as string,
        quantity: ownedMap.get(item.id as string) ?? 0,
        items: {
          slug: item.slug as string,
          name: item.name as string,
          image_url: item.image_url as string | null,
          effects: item.effects as Record<string, number>,
          description: item.description as string,
        },
      }))

      // Auto-create a default prediction row on first open so rites are usable immediately.
      let existingPrediction = predRes.data ?? null
      let autoCreated = false
      if (!existingPrediction && user && entryRes.data) {
        const season = seasonRes.data as Record<string, unknown> | null
        const game = gameRes.data as Record<string, unknown> | null
        const isActive = season?.status === "active"
        const launchTime = game?.release_time_override
          ? new Date(game.release_time_override as string)
          : game?.release_date ? new Date(game.release_date as string) : null
        const isReleased = !!game?.is_released || (launchTime !== null && launchTime <= new Date())
        if (isActive && !isReleased) {
          const { data: newPred } = await supabase
            .from("predictions")
            .insert({
              user_id: user.id,
              game_id: gameId,
              season_id: seasonId,
              prediction_type: "week_one",
              players_midpoint: 10000,
              reviews_midpoint: 75,
              players_window_low: 9000,
              players_window_high: 11000,
              reviews_window_low: 72,
              reviews_window_high: 78,
              applied_boosters: [],
              updated_at: new Date().toISOString(),
            })
            .select("*")
            .single()
          existingPrediction = newPred ?? null
          autoCreated = true
        }
      }

      const fetchedPredictedIds = ((playerPredsRes.data ?? []) as { game_id: string | null }[])
        .map(p => p.game_id).filter((id): id is string => Boolean(id))

      setData({
        game: gameRes.data ?? {},
        seasonData: seasonRes.data ?? {},
        existingPrediction,
        weekOneSnapshot: snapshotRes.data ?? null,
        seasonEntry: entryRes.data ?? null,
        inventory,
        seasonGames: (seasonGamesRes.data ?? []) as PanelData["seasonGames"],
        aoMarkCount: (aoRitesRes.data ?? []).length,
        aoMarkedGameIds: ((aoMarkedRes.data ?? []) as { game_id: string | null }[]).map(p => p.game_id).filter((id): id is string => Boolean(id)),
        predictedGameIds: autoCreated && !fetchedPredictedIds.includes(gameId)
          ? [...fetchedPredictedIds, gameId]
          : fetchedPredictedIds,
        existingLadder: ((ladderRes.data as { ranked_games?: string[] } | null)?.ranked_games ?? []),
        lockedLadderGameIds: ((ladderRes.data as { locked_game_ids?: string[] } | null)?.locked_game_ids ?? []),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prediction")
    }
  }, [gameId, seasonId])

  // Initial load
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  // After a save: re-fetch silently so existingPrediction updates and early lock becomes available
  const handleSave = useCallback(() => {
    fetchData()
  }, [fetchData])

  const game = data?.game
  const seasonData = data?.seasonData
  const seasonEntry = data?.seasonEntry
  const hasJoinedSeason = !!seasonEntry
  const canPredict = hasJoinedSeason && seasonData?.status === "active"
  const showForm = canPredict || !!data?.existingPrediction

  return (
    <div
      style={{
        position: "fixed",
        top: "calc(9vh + 10px)",
        left: "51%",
        right: "1vw",
        height: "calc(70vh - 25px)",
        zIndex: 30,
        background: "radial-gradient(ellipse at 50% 0%, rgba(24,8,40,0.78) 0%, rgba(14,6,28,0.82) 65%)",
        border: "1px solid rgba(157,132,212,0.25)",
        borderRadius: "8px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.95), 0 0 40px rgba(80,30,140,0.15)",
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "3px 12px",
          flexShrink: 0,
        }}
      >
        <div
          className="font-display"
          style={{ fontSize: "0.875rem", color: "#f5e6c8", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
        >
          {loading ? "Loading…" : (game?.name as string | undefined) ?? "Prediction"}
        </div>
        <button
          onClick={handleRequestClose}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(245,230,200,0.5)", padding: "4px", borderRadius: "4px",
            display: "flex", alignItems: "center", transition: "color 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f5e6c8")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(245,230,200,0.5)")}
        >
          <X size={18} />
        </button>
      </div>

      {/* Unsaved-changes confirmation strip — absolute so it doesn't shift content */}
      {(showExitConfirm || !!pendingSwitchId) && (
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            right: 0,
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 16px 7px",
            background: "rgba(60,25,5,0.92)",
            borderTop: "1px solid rgba(217,119,6,0.25)",
            borderBottom: "1px solid rgba(217,119,6,0.25)",
            backdropFilter: "blur(4px)",
          }}
        >
          <span
            className="font-body"
            style={{ fontSize: "0.72rem", color: "rgba(251,191,36,0.78)", letterSpacing: "0.01em" }}
          >
            {pendingSwitchId ? "Unsaved changes · switch games without saving?" : "Unsaved changes · exit without saving?"}
          </span>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              onClick={handleCancelExit}
              className="font-display"
              style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(245,230,200,0.40)", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(245,230,200,0.70)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(245,230,200,0.40)")}
            >
              Stay
            </button>
            <button
              onClick={handleConfirmExit}
              className="font-display"
              style={{ fontSize: "0.6rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(251,191,36,0.85)", background: "rgba(120,53,15,0.35)", border: "1px solid rgba(217,119,6,0.35)", cursor: "pointer", padding: "2px 10px", borderRadius: "4px" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(120,53,15,0.55)"; e.currentTarget.style.color = "rgba(251,191,36,1)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(120,53,15,0.35)"; e.currentTarget.style.color = "rgba(251,191,36,0.85)" }}
            >
              {pendingSwitchId ? "Switch" : "Exit"}
            </button>
          </div>
        </div>
      )}

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {loading && (
            <div
              style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,230,200,0.35)" }}
              className="font-display"
            >
              <div style={{ fontSize: "0.9rem" }}>Consulting the arcane…</div>
            </div>
          )}

          {!loading && error && (
            <div
              style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(239,68,68,0.7)", fontSize: "0.85rem" }}
              className="font-body"
            >
              {error}
            </div>
          )}

          {!loading && !error && data && showForm && (
            <PredictionFormClient
              gameId={gameId}
              gameName={game?.name as string}
              seasonId={seasonId}
              seasonStatus={seasonData?.status as string}
              existingPrediction={data.existingPrediction as Parameters<typeof PredictionFormClient>[0]["existingPrediction"]}
              isReleased={(game?.is_released as boolean) || (() => {
                const t = game?.release_time_override
                  ? new Date(game.release_time_override as string)
                  : game?.release_date ? new Date(game.release_date as string) : null
                return t !== null && t <= new Date()
              })()}
              releaseDate={(game?.release_date as string | null) ?? null}
              predictionLockDate={(seasonData?.prediction_lock_date as string | null) ?? null}
              snapshotPlayerCount={data.weekOneSnapshot?.player_count}
              snapshotReviewPositive={data.weekOneSnapshot?.review_positive}
              snapshotReviewNegative={data.weekOneSnapshot?.review_negative}
              snapshotCapturedAt={data.weekOneSnapshot?.captured_at}
              equipmentSlug={seasonEntry?.equipment_id ?? null}
              equipmentTierScore={seasonEntry?.equipment_tier_score ?? 0}
              ladderGames={data.seasonGames}
              existingLadder={data.existingLadder}
              lockedLadderGameIds={data.lockedLadderGameIds}
              aoMarkCount={data.aoMarkCount}
              aoMarkedGameIds={data.aoMarkedGameIds}
              predictedGameIds={data.predictedGameIds}
              inventory={data.inventory}
              onSave={handleSave}
              onDirtyChange={setIsFormDirty}
            />
          )}

          {!loading && !error && data && !showForm && (
            <div
              style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,230,200,0.35)", fontSize: "0.85rem" }}
              className="font-body"
            >
              {seasonData?.status !== "active"
                ? "Predictions are closed for this season."
                : "Join the season to make predictions."}
            </div>
          )}
        </div>
    </div>
  )
}
