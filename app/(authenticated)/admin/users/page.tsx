"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Shield,
  ShieldBan,
  ShieldCheck,
  KeyRound,
  Coins,
  Search,
  Loader2,
  CheckCircle2,
  Users,
} from "lucide-react"

interface UserProfile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  token_balance: number
  is_admin: boolean
  is_banned: boolean
  created_at: string
  prediction_count?: number
}

type ActionResult = { userId: string; success: boolean; message: string }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pointsInputs, setPointsInputs] = useState<Record<string, string>>({})
  const [pointsDialogOpen, setPointsDialogOpen] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })

    if (!profiles) { setLoading(false); return }

    // Get prediction counts per user
    const { data: predCounts } = await supabase
      .from("predictions")
      .select("user_id")

    const countMap: Record<string, number> = {}
    for (const p of predCounts || []) {
      countMap[p.user_id] = (countMap[p.user_id] || 0) + 1
    }

    setUsers(profiles.map((p) => ({ ...p, prediction_count: countMap[p.id] || 0 })))
    setLoading(false)
  }

  async function performAction(userId: string, action: string, value?: string | number | boolean) {
    setActionLoading(`${userId}-${action}`)
    setResult(null)

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, value }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Action failed")

      const messages: Record<string, string> = {
        set_admin: value ? "Admin access granted" : "Admin access revoked",
        set_banned: value ? "User banned" : "User unbanned",
        adjust_tokens: `Token balance updated`,
        reset_password: "Password reset email sent",
      }

      setResult({ userId, success: true, message: messages[action] || "Done" })
      await fetchUsers()
    } catch (err) {
      setResult({
        userId,
        success: false,
        message: err instanceof Error ? err.message : "Action failed",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase()
    return (
      u.display_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.id.includes(q)
    )
  })

  const isLoading = (userId: string, action: string) =>
    actionLoading === `${userId}-${action}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Users</h1>
          <p className="text-muted-foreground">
            {users.length} registered user{users.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Result banner */}
      {result && (
        <Alert variant={result.success ? "default" : "destructive"}
          className={result.success ? "border-success/50 bg-success/10" : ""}
        >
          {result.success && <CheckCircle2 className="h-4 w-4 text-success" />}
          <AlertDescription className={result.success ? "text-success" : ""}>
            {result.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Users list */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Users ({filteredUsers.length})</CardTitle>
          <CardDescription className="text-muted-foreground">
            Click actions to manage individual accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No users found</p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => {
                const initials = user.display_name?.slice(0, 2).toUpperCase() ?? "??"
                const joinDate = new Date(user.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })

                return (
                  <div
                    key={user.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      user.is_banned
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border bg-secondary/20"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* User info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-foreground truncate">
                              {user.display_name || "No name"}
                            </span>
                            {user.is_admin && (
                              <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                                Admin
                              </Badge>
                            )}
                            {user.is_banned && (
                              <Badge variant="destructive" className="text-xs">
                                Banned
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground truncate">
                            @{user.username || "no-username"} · Joined {joinDate}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {user.token_balance.toLocaleString()} tokens · {user.prediction_count} predictions
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 shrink-0">

                        {/* Toggle Admin */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!actionLoading}
                              title={user.is_admin ? "Revoke admin" : "Grant admin"}
                            >
                              {isLoading(user.id, "set_admin") ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.is_admin ? (
                                <ShieldCheck className="h-4 w-4 text-primary" />
                              ) : (
                                <Shield className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="ml-1.5 hidden sm:inline">
                                {user.is_admin ? "Admin" : "Make Admin"}
                              </span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">
                                {user.is_admin ? "Revoke admin access?" : "Grant admin access?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                {user.is_admin
                                  ? `${user.display_name} will lose access to all admin tools.`
                                  : `${user.display_name} will gain full access to all admin tools including user management.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => performAction(user.id, "set_admin", !user.is_admin)}
                              >
                                Confirm
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Toggle Ban */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!!actionLoading}
                              className={user.is_banned ? "border-destructive/50 text-destructive" : ""}
                              title={user.is_banned ? "Unban user" : "Ban user"}
                            >
                              {isLoading(user.id, "set_banned") ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShieldBan className="h-4 w-4" />
                              )}
                              <span className="ml-1.5 hidden sm:inline">
                                {user.is_banned ? "Unban" : "Ban"}
                              </span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">
                                {user.is_banned ? "Unban this user?" : "Ban this user?"}
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                {user.is_banned
                                  ? `${user.display_name} will regain access to SteamStonks.`
                                  : `${user.display_name} will be immediately locked out of SteamStonks.`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className={!user.is_banned ? "bg-destructive hover:bg-destructive/90" : ""}
                                onClick={() => performAction(user.id, "set_banned", !user.is_banned)}
                              >
                                {user.is_banned ? "Unban" : "Ban User"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Adjust Tokens */}
                        <Dialog
                          open={pointsDialogOpen === user.id}
                          onOpenChange={(open) => {
                            setPointsDialogOpen(open ? user.id : null)
                            if (open) setPointsInputs((p) => ({ ...p, [user.id]: String(user.token_balance) }))
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={!!actionLoading} title="Adjust points">
                              {isLoading(user.id, "adjust_tokens") ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Coins className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="ml-1.5 hidden sm:inline">Points</span>
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-card border-border">
                            <DialogHeader>
                              <DialogTitle className="text-foreground">Adjust Token Balance</DialogTitle>
                              <DialogDescription className="text-muted-foreground">
                                Set the exact token balance for {user.display_name}. Current: {user.token_balance.toLocaleString()} tokens.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2 py-2">
                              <Label className="text-foreground">New Balance</Label>
                              <Input
                                type="number"
                                min={0}
                                value={pointsInputs[user.id] ?? user.token_balance}
                                onChange={(e) =>
                                  setPointsInputs((p) => ({ ...p, [user.id]: e.target.value }))
                                }
                                className="bg-input border-border text-foreground"
                              />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setPointsDialogOpen(null)}>
                                Cancel
                              </Button>
                              <Button
                                onClick={async () => {
                                  await performAction(user.id, "adjust_tokens", pointsInputs[user.id])
                                  setPointsDialogOpen(null)
                                }}
                              >
                                Save
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Password Reset */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={!!actionLoading} title="Send password reset">
                              {isLoading(user.id, "reset_password") ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <KeyRound className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="ml-1.5 hidden sm:inline">Reset PW</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">
                                Send password reset email?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground">
                                A password reset link will be sent to {user.display_name}&apos;s registered email address.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => performAction(user.id, "reset_password")}
                              >
                                Send Email
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
