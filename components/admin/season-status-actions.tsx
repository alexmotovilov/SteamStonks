"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, CheckCircle, BarChart3, Trophy, Loader2, RotateCcw, AlertTriangle } from "lucide-react"

interface SeasonStatusActionsProps {
  seasonId: string
  currentStatus: string
}

const statusFlow = {
  upcoming: { next: "active", label: "Activate Season", icon: Play, description: "Make the season available for players to join and make predictions" },
  active: { next: "scoring", label: "End Season & Start Scoring", icon: BarChart3, description: "Take final season-end snapshots (locking in each game's peak players and review score), then move the season to scoring. Nothing runs automatically — trigger this only after every game has completed its 1-week scoring window, and announce the timing to players first." },
  scoring: { next: "completed", label: "Complete Season", icon: Trophy, description: "Finalize scores and distribute prizes" },
  completed: { next: null, label: "Season Complete", icon: CheckCircle, description: "This season has ended" },
}

export function SeasonStatusActions({ seasonId, currentStatus }: SeasonStatusActionsProps) {
  const [updating, setUpdating] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const router = useRouter()

  const flow = statusFlow[currentStatus as keyof typeof statusFlow]

  // Activating and ending are the two consequential transitions (they open the
  // season to players / lock in final numbers), so both require a typed
  // confirmation. Ending additionally runs the season-end snapshot endpoint.
  const isEndStep = currentStatus === "active"
  const requiresConfirm = currentStatus === "upcoming" || currentStatus === "active"
  const confirmOk = confirmText.trim() === "Confirm"

  async function handleAdvance() {
    if (!flow.next) return
    if (requiresConfirm && !confirmOk) return
    setUpdating(true)
    setError(null)
    try {
      if (isEndStep) {
        // Runs takeSeasonEndSnapshots server-side: captures each game's
        // final peak/review numbers and flips the season active → scoring.
        const res = await fetch(`/api/admin/seasons/${seasonId}/snapshot`, { method: "POST" })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to end season")
        if ((data.gamesFailed ?? 0) > 0) {
          throw new Error(
            `${data.gamesFailed} game(s) failed to snapshot — the season was NOT moved to scoring. Resolve the issue and retry (or use Manual recovery below).`
          )
        }
      } else {
        const supabase = createClient()
        const { error: updateError } = await supabase
          .from("seasons")
          .update({ status: flow.next, updated_at: new Date().toISOString() })
          .eq("id", seasonId)
        if (updateError) throw updateError
      }
      setConfirmText("")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setUpdating(false)
    }
  }

  async function handleRollbackToActive() {
    setRollingBack(true)
    setError(null)
    try {
      const supabase = createClient()
      const targetStatus = currentStatus === "completed" ? "scoring" : "active"
      const { error: updateError } = await supabase
        .from("seasons")
        .update({ status: targetStatus, updated_at: new Date().toISOString() })
        .eq("id", seasonId)
      if (updateError) throw updateError
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to roll back status")
    } finally {
      setRollingBack(false)
    }
  }

  const Icon = flow.icon

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {/* Status Timeline */}
        <div className="flex items-center justify-between">
          {Object.entries(statusFlow).map(([status, info], index) => {
            const StatusIcon = info.icon
            const isActive = status === currentStatus
            const isPast = Object.keys(statusFlow).indexOf(status) < Object.keys(statusFlow).indexOf(currentStatus)
            return (
              <div key={status} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isActive
                      ? "border-primary bg-primary/20 text-primary"
                      : isPast
                      ? "border-success bg-success/20 text-success"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}
                >
                  <StatusIcon className="h-5 w-5" />
                </div>
                {index < Object.keys(statusFlow).length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${isPast ? "bg-success" : "bg-border"}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Labels */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Upcoming</span>
          <span className="text-muted-foreground">Active</span>
          <span className="text-muted-foreground">Scoring</span>
          <span className="text-muted-foreground">Complete</span>
        </div>
      </div>

      {/* Action */}
      <div className="pt-4 border-t border-border space-y-3">
        <p className="text-sm text-muted-foreground">{flow.description}</p>

        {flow.next ? (
          requiresConfirm ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  {isEndStep ? (
                    <>This locks in final results for every game and moves the season to <strong>scoring</strong>. Type <strong>Confirm</strong> below to proceed.</>
                  ) : (
                    <>This makes the season live — players can join and submit predictions. Type <strong>Confirm</strong> below to proceed.</>
                  )}
                </p>
              </div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type Confirm to enable"
                className="bg-input border-border text-foreground"
                autoComplete="off"
                spellCheck={false}
              />
              <Button
                onClick={handleAdvance}
                disabled={updating || rollingBack || !confirmOk}
                className="w-full"
              >
                {updating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isEndStep ? "Ending season..." : "Activating..."}</>
                ) : (
                  <><Icon className="mr-2 h-4 w-4" />{flow.label}</>
                )}
              </Button>
            </div>
          ) : (
            <Button onClick={handleAdvance} disabled={updating || rollingBack} className="w-full">
              {updating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating...</>
              ) : (
                <><Icon className="mr-2 h-4 w-4" />{flow.label}</>
              )}
            </Button>
          )
        ) : (
          <Button disabled className="w-full">
            <CheckCircle className="mr-2 h-4 w-4" />
            Season Complete
          </Button>
        )}

        {(currentStatus === "scoring" || currentStatus === "completed") && (
          <Button
            variant="outline"
            onClick={handleRollbackToActive}
            disabled={updating || rollingBack}
            className="w-full text-warning border-warning/40 hover:bg-warning/10"
          >
            {rollingBack ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rolling back...</>
            ) : (
              <><RotateCcw className="mr-2 h-4 w-4" />{currentStatus === "completed" ? "Reopen for Scoring (completed → scoring)" : "Reopen Season (scoring → active)"}</>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
