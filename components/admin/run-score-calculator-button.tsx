"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Calculator, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

interface ScoreResult {
  weekOnePredictionsScored: number
  ladderRankingsScored: number
  errors: number
}

export function RunScoreCalculatorButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/admin/run-score-calculator", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Score calculator failed")
      setResult(data)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Score calculator failed")
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
            Scored {result.weekOnePredictionsScored} prediction{result.weekOnePredictionsScored !== 1 ? "s" : ""} and {result.ladderRankingsScored} ladder ranking{result.ladderRankingsScored !== 1 ? "s" : ""}.
            {result.errors > 0 && <span className="text-warning"> {result.errors} error{result.errors !== 1 ? "s" : ""} — check server logs.</span>}
          </AlertDescription>
        </Alert>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full" disabled={running}>
            {running ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Running...</>
            ) : (
              <><Calculator className="mr-2 h-4 w-4" />Run Score Calculator</>
            )}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Run Score Calculator?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will score all unscored predictions and ladder rankings for seasons currently in <strong>scoring</strong> status, and send mailbox results to players. This is the same job the daily cron runs at 07:00 UTC.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRun}>Run Now</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
