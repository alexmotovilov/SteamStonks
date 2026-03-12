"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
import { Loader2, Trophy } from "lucide-react"

interface JoinSeasonButtonProps {
  seasonId: string
  entryFee: number
  currentBalance: number
}

export function JoinSeasonButton({ seasonId, entryFee, currentBalance }: JoinSeasonButtonProps) {
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const canAfford = currentBalance >= entryFee

  async function handleJoin() {
    if (!canAfford) return

    setJoining(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error("You must be logged in to join a season")
      }

      // Deduct points from balance
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          points_balance: currentBalance - entryFee,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (updateError) throw updateError

      // Create season entry
      const { error: entryError } = await supabase
        .from("season_entries")
        .insert({
          season_id: seasonId,
          user_id: user.id,
          points_paid: entryFee,
        })

      if (entryError) {
        // Rollback points deduction
        await supabase
          .from("profiles")
          .update({ points_balance: currentBalance })
          .eq("id", user.id)
        throw entryError
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join season")
    } finally {
      setJoining(false)
    }
  }

  if (!canAfford) {
    return (
      <Button disabled>
        <Trophy className="mr-2 h-4 w-4" />
        Insufficient Points ({currentBalance}/{entryFee})
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>
          <Trophy className="mr-2 h-4 w-4" />
          Join Season ({entryFee} pts)
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Join this Season?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This will deduct <strong>{entryFee} points</strong> from your balance.
            <br /><br />
            Your current balance: <strong>{currentBalance} points</strong>
            <br />
            Balance after joining: <strong>{currentBalance - entryFee} points</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleJoin} disabled={joining}>
            {joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : (
              "Confirm & Join"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
