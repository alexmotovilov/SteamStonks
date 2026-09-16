"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { PredictionFormClient } from "@/components/prediction-form-client"
import { ScoredResultsUpper, ScoredResultsMiddle, ScoredResultsLower } from "@/components/prediction-form"
import type { ExistingPrediction } from "@/components/prediction-form"

// Natural design width of the prediction card. It's authored at this width
// (center slider column lands near the gem SVG's native 600px) and then
// uniformly scaled to fit the panel, so proportions — and the gems — never
// distort. Tune this to change the card's baseline size.
const CARD_NATURAL_W = 780
// Don't upscale past this on very large displays.
const CARD_MAX_SCALE = 1.8

// Renders children at a fixed natural width, then uniformly transform-scales
// them to fit the available box (both width and height). Scales up on large
// displays and down on small ones so the card never clips.
function ScaleToFit({ naturalWidth, maxScale = CARD_MAX_SCALE, children }: { naturalWidth: number; maxScale?: number; children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return
    const compute = () => {
      const ow = outer.clientWidth
      const oh = outer.clientHeight
      const iw = naturalWidth
      const ih = inner.scrollHeight  // natural content height at naturalWidth (transform ignored)
      if (!iw || !ih || !ow || !oh) return
      setScale(Math.min(ow / iw, oh / ih, maxScale))
    }
    const ro = new ResizeObserver(compute)
    ro.observe(outer)
    ro.observe(inner)
    compute()
    return () => ro.disconnect()
  }, [naturalWidth, maxScale])

  return (
    <div ref={outerRef} style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <div ref={innerRef} style={{ width: naturalWidth, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "center center" }}>
        {children}
      </div>
    </div>
  )
}

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
  seasonEntry: { equipment_id: string | null; equipment_tier_score: number; is_free_entry: boolean | null; vested_at: string | null } | null
  inventory: { item_id: string; quantity: number; items: { slug: string; name: string; image_url: string | null; effects: Record<string, number>; description: string } }[]
  seasonGames: { id: string; name: string; header_image_url: string | null; header_image_position: string | null; is_released: boolean; release_date: string | null; release_time_override: string | null }[]
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
  const [isMobile, setIsMobile] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

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
          ? supabase.from("season_entries").select("equipment_id, equipment_tier_score, is_free_entry, vested_at").eq("user_id", user.id).eq("season_id", seasonId).single()
          : Promise.resolve({ data: null }),
        supabase.from("items").select("id, slug, name, image_url, effects, description").eq("item_type", "booster"),
        user
          ? supabase.from("inventory").select("item_id, quantity").eq("user_id", user.id)
          : Promise.resolve({ data: [] }),
        supabase.from("games").select("id, name, header_image_url, header_image_position, is_released, release_date, release_time_override").eq("season_id", seasonId).order("release_date", { ascending: true }),
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
      // A freshly auto-created default prediction isn't in the games page's
      // predMap yet — refresh server data so the game tile reflects it.
      if (autoCreated) router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load prediction")
    }
  }, [gameId, seasonId, router])

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
  const isUnvested = !!(seasonEntry?.is_free_entry && !seasonEntry?.vested_at)
  const inset = isMobile ? "10%" : "14%"
  const canPredict = hasJoinedSeason && seasonData?.status === "active"
  const showForm = canPredict || !!data?.existingPrediction

  const predictionFormEl = !loading && !error && data && showForm ? (
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
      isUnvested={isUnvested}
      onSave={handleSave}
      onDirtyChange={setIsFormDirty}
      onRequestClose={handleRequestClose}
      mobile={isMobile}
    />
  ) : null

  // The live editable form carries its own Close button; the panel-level Close
  // is only needed for the scored view, notices, loading, and errors.
  const scoredPred = data?.existingPrediction as ExistingPrediction | null
  const liveFormShown = !!predictionFormEl && !(scoredPred?.scored_at && scoredPred.result)

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        bottom: 0,
        left: isMobile ? 0 : "48%",
        right: isMobile ? 0 : "1vw",
        zIndex: 200,
        overflow: "hidden",
        pointerEvents: "auto",
      }}
    >
      {/* Parchment background — vertically centered, overflows top/bottom */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={isMobile ? "/prediction-parchment.png" : "/prediction-card-background.png"}
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          left: "50%",
          width: isMobile ? "95%" : "105.6%",
          top: "50%",
          transform: isMobile ? "translateX(-50%) translateY(-50%)" : "translateX(-50%) translateY(calc(-50% - 25px))",
          height: "auto",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />

      {/* Shared title — the live form carries its own game-name header */}
      {!liveFormShown && (
      <div
        style={{
          position: "absolute",
          top: isMobile ? "5%" : "8%",
          left: inset,
          right: inset,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "3px 12px",
        }}
      >
        <div
          style={{ fontFamily: "var(--font-typewriter)", fontSize: "0.875rem", color: "#1c0e05", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.06em", WebkitTextStroke: "0.4px #1c0e05" }}
        >
          {loading ? "Loading…" : (game?.name as string | undefined) ?? "Prediction"}
        </div>
      </div>
      )}

      {/* Close button — bottom of parchment (hidden when the live form provides its own) */}
      {!liveFormShown && (
      <div style={{ position: "absolute", bottom: "8%", left: 0, right: 0, zIndex: 2, display: "flex", justifyContent: "center" }}>
        <button
          onClick={handleRequestClose}
          style={{
            background: "rgba(255,240,210,0.15)",
            border: "1.5px solid rgba(100,60,20,0.35)",
            cursor: "pointer",
            color: "rgba(60,30,10,0.55)",
            padding: "6px 0",
            width: "40%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color 0.15s ease, border-color 0.15s ease, background 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "rgba(60,30,10,0.9)"; e.currentTarget.style.borderColor = "rgba(100,60,20,0.7)"; e.currentTarget.style.background = "rgba(255,240,210,0.35)" }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(60,30,10,0.55)"; e.currentTarget.style.borderColor = "rgba(100,60,20,0.35)"; e.currentTarget.style.background = "rgba(255,240,210,0.15)" }}
        >
          <span style={{ fontFamily: "var(--font-typewriter)", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>Close</span>
        </button>
      </div>
      )}

      {/* Unsaved-changes confirmation strip */}
      {(showExitConfirm || !!pendingSwitchId) && (
        <div
          style={{
            position: "fixed",
            top: "calc(50% + 30px)",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(90vw, 420px)",
            zIndex: 210,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(60,25,5,0.95)",
            border: "1px solid rgba(217,119,6,0.35)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
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

      {/* Scored prediction: split into upper (active effects) and lower (4 boxes) */}
      {!loading && !error && data && (() => {
        const pred = data.existingPrediction as ExistingPrediction | null
        if (pred?.scored_at && pred.result) {
          return (
            <>
              {/* Upper section — active effects, bottom edge at ~48% */}
              <div style={{ position: "absolute", top: isMobile ? "10%" : "13%", bottom: isMobile ? "48%" : "55%", left: inset, right: inset, zIndex: 1, overflowY: "auto", overflowX: "hidden" }}>
                <ScoredResultsUpper
                  existingPrediction={pred}
                  equipmentSlug={seasonEntry?.equipment_id ?? null}
                  equipmentTierScore={seasonEntry?.equipment_tier_score ?? 0}
                  aoMarked={data.aoMarkedGameIds.includes(gameId)}
                  stampScale={isMobile ? 2.5 : 1}
                  stampBaseDelay={0}
                />
              </div>
              {/* Middle section — first prediction + combo bonus stamps */}
              <div style={{ position: "absolute", top: "59%", left: 0, right: 0, transform: "translateY(-50%)", zIndex: 1 }}>
                <ScoredResultsMiddle existingPrediction={pred} stampScale={isMobile ? 2.5 : 1} stampBaseDelay={2 * 130} />
              </div>
              {/* Lower section — 4 boxes, top edge at ~62% */}
              <div style={{ position: "absolute", top: "66%", left: inset, right: inset, zIndex: 1 }}>
                <ScoredResultsLower
                  existingPrediction={pred}
                  snapshotPlayerCount={data.weekOneSnapshot?.player_count}
                  snapshotReviewScore={data.weekOneSnapshot?.review_positive != null && data.weekOneSnapshot?.review_negative != null
                    ? Math.round((data.weekOneSnapshot.review_positive / (data.weekOneSnapshot.review_positive + data.weekOneSnapshot.review_negative)) * 100)
                    : null}
                  stampScale={isMobile ? 2.5 : 1}
                  stampBaseDelay={4 * 130}
                />
              </div>
            </>
          )
        }
        return null
      })()}

      {/* Non-scored content layer */}
      {!(() => {
        const pred = data?.existingPrediction as ExistingPrediction | null
        return !loading && !error && data && pred?.scored_at && pred.result
      })() && (() => {
        const stateNode = loading ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,230,200,0.35)" }} className="font-display">
            <div style={{ fontSize: "0.9rem" }}>Consulting the arcane…</div>
          </div>
        ) : error ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(239,68,68,0.7)", fontSize: "0.85rem" }} className="font-body">
            {error}
          </div>
        ) : (data && !showForm) ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(245,230,200,0.35)", fontSize: "0.85rem" }} className="font-body">
            {seasonData?.status !== "active" ? "Predictions are closed for this season." : "Join the season to make predictions."}
          </div>
        ) : null

        // Mobile: keep the original vertically-centered scroll layout.
        if (isMobile) {
          return (
            <div style={{ position: "absolute", top: "40%", transform: "translateY(-50%)", left: inset, right: inset, maxHeight: "72vh", zIndex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
                {stateNode}
                {predictionFormEl}
              </div>
            </div>
          )
        }

        // Desktop: scale the fixed-width card to fit the available box.
        return (
          <div style={{ position: "absolute", top: "calc(13% - 25px)", bottom: "calc(13% + 25px)", left: inset, right: inset, zIndex: 1 }}>
            {predictionFormEl ? (
              <ScaleToFit naturalWidth={CARD_NATURAL_W}>{predictionFormEl}</ScaleToFit>
            ) : (
              stateNode
            )}
          </div>
        )
      })()}
    </div>
  )
}
