"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { createClient as createAdminClient } from "@supabase/supabase-js"
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
import { Loader2, Coins, Package } from "lucide-react"

interface JoinSeasonButtonProps {
  seasonId: string
  entryFee: number
  currentBalance: number  // token_balance from profiles
}

// Starter kit items awarded on season join
const STARTER_KIT_SLUGS = [
  "evocation_distillate",
  "crystal_focus",
  "scrying_orb_polish",
]

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
      if (!user) throw new Error("You must be logged in to join a season")

      // 1. Deduct entry fee tokens from profiles.token_balance
      const { error: tokenError } = await supabase
        .from("profiles")
        .update({
          token_balance: currentBalance - entryFee,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (tokenError) throw tokenError

      // 2. Create season entry with initial mana balance = 0
      //    equipment_id will be set when the player chooses equipment (Phase 2)
      const { error: entryError } = await supabase
        .from("season_entries")
        .insert({
          season_id:                    seasonId,
          user_id:                      user.id,
          tokens_paid:                  entryFee,
          prediction_mana_earned:       0,
          mana_balance:                 0,
          equipment_tier_score:         0,
          stipend_week_number:          0,
          starter_kit_claimed:          false,
          first_prediction_bonus_claimed: false,
        })

      if (entryError) {
        // Rollback token deduction
        await supabase
          .from("profiles")
          .update({ token_balance: currentBalance })
          .eq("id", user.id)
        throw entryError
      }

      // 3. Award starter kit via API route (needs service role for inventory)
      const res = await fetch("/api/seasons/join/starter-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ season_id: seasonId }),
      })

      if (!res.ok) {
        // Non-fatal — log but don't block the join
        console.error("[Join Season] Failed to award starter kit:", await res.text())
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
        <Coins className="mr-2 h-4 w-4" />
        Insufficient Tokens ({currentBalance}/{entryFee})
      </Button>
    )
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button>
          <Coins className="mr-2 h-4 w-4" />
          Join Season ({entryFee} tokens)
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">Join this Season?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground" asChild>
            <div className="space-y-3">
              <p>
                This will deduct <strong className="text-amber-400">{entryFee} tokens</strong> from your balance.
              </p>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Current balance</span>
                  <span className="text-amber-400 font-medium">{currentBalance} tokens</span>
                </div>
                <div className="flex justify-between">
                  <span>After joining</span>
                  <span className="text-foreground font-medium">{currentBalance - entryFee} tokens</span>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-950/20 border border-amber-500/20 text-sm">
                <Package className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span className="text-amber-300">
                  You'll receive a starter kit: 1× Evocation Distillate, 1× Crystal Focus, 1× Scrying Orb Polish
                </span>
              </div>
            </div>
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
