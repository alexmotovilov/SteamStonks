"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Camera, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

interface ManualSnapshotButtonProps {
  seasonId: string
  seasonName: string
  currentStatus: string
}

interface SnapshotResult {
  gamesSnapshotted: number
  gamesFailed: number
  alreadySnapshotted: string[]
}

export function ManualSnapshotButton({
  seasonId,
  seasonName,
  currentStatus,
}: ManualSnapshotButtonProps) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SnapshotResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Only show for active or scoring seasons
  if (currentStatus === "upcoming" || currentStatus === "completed") {
    return null
  }

  async function handleSnapshot() {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/admin/seasons/${seasonId}/snapshot`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Snapshot failed")
      }

      setResult(data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Alert className="border-success/50 bg-success/10">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <AlertDescription className="text-success">
            Snapshotted {result.gamesSnapshotted} game{result.gamesSnapshotted !== 1 ? "s" : ""}.
            {result.alreadySnapshotted.length > 0 && (
              <span className="text-muted-foreground">
                {" "}({result.alreadySnapshotted.length} already had snapshots.)
              </span>
            )}
            {result.gamesFailed > 0 && (
              <span className="text-warning">
                {" "}{result.gamesFailed} failed — re-run to retry.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Taking Snapshots...
              </>
            ) : (
              <>
                <Camera className="mr-2 h-4 w-4" />
                Take Season End Snapshot
              </>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Take Season End Snapshot?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will capture the current player counts and review scores for all
              games in <strong>{seasonName}</strong> as the official season-end
              record used for scoring.
              <br /><br />
              Games that already have a season_end snapshot will be skipped.
              The season status will be moved to <strong>Scoring</strong> automatically
              if all games succeed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSnapshot}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
