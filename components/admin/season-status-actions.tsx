"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, CheckCircle, BarChart3, Trophy, Loader2 } from "lucide-react"

interface SeasonStatusActionsProps {
  seasonId: string
  currentStatus: string
}

const statusFlow = {
  upcoming: { next: "active", label: "Activate Season", icon: Play, description: "Make the season available for players to join and make predictions" },
  active: { next: "scoring", label: "Start Scoring", icon: BarChart3, description: "Close predictions and begin calculating scores" },
  scoring: { next: "completed", label: "Complete Season", icon: Trophy, description: "Finalize scores and distribute prizes" },
  completed: { next: null, label: "Season Complete", icon: CheckCircle, description: "This season has ended" },
}

export function SeasonStatusActions({ seasonId, currentStatus }: SeasonStatusActionsProps) {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const flow = statusFlow[currentStatus as keyof typeof statusFlow]

  async function handleStatusChange() {
    if (!flow.next) return

    setUpdating(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("seasons")
        .update({ 
          status: flow.next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", seasonId)

      if (updateError) throw updateError

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status")
    } finally {
      setUpdating(false)
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
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      isPast ? "bg-success" : "bg-border"
                    }`}
                  />
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
      <div className="pt-4 border-t border-border">
        <p className="text-sm text-muted-foreground mb-4">{flow.description}</p>
        
        {flow.next ? (
          <Button
            onClick={handleStatusChange}
            disabled={updating}
            className="w-full"
          >
            {updating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Icon className="mr-2 h-4 w-4" />
                {flow.label}
              </>
            )}
          </Button>
        ) : (
          <Button disabled className="w-full">
            <CheckCircle className="mr-2 h-4 w-4" />
            Season Complete
          </Button>
        )}
      </div>
    </div>
  )
}
