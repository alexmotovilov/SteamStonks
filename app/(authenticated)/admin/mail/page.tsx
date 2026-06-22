import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AdminMailComposeWrapper } from "@/components/admin-mail-compose-wrapper"

export default async function AdminMailPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_admin) redirect("/games")

  const [itemsResult, profilesResult, historyResult] = await Promise.all([
    supabase
      .from("items")
      .select("id, name, slug, image_url")
      .eq("item_type", "booster")
      .order("name"),
    supabase
      .from("profiles")
      .select("id, display_name")
      .order("display_name"),
    supabase
      .from("mail_messages")
      .select("id, subject, target, target_user_id, created_at, is_published, profiles:created_by(display_name)")
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  return (
    <div className="container mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Mail</h1>
        <p className="text-muted-foreground">Compose and send messages to players</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compose Message</CardTitle>
          <CardDescription>Send a message to all players or a specific player</CardDescription>
        </CardHeader>
        <CardContent>
          <AdminMailComposeWrapper
            items={itemsResult.data ?? []}
            profiles={(profilesResult.data ?? []) as { id: string; display_name: string | null }[]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>{historyResult.data?.length ?? 0} messages sent</CardDescription>
        </CardHeader>
        <CardContent>
          {(!historyResult.data || historyResult.data.length === 0) ? (
            <p className="text-muted-foreground text-sm">No messages sent yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {historyResult.data.map(msg => (
                <div key={msg.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{msg.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {msg.target === "all" ? "All players" : "Specific player"}
                    </p>
                  </div>
                  <Badge variant={msg.is_published ? "default" : "secondary"} className="shrink-0 text-xs">
                    {msg.is_published ? "Sent" : "Draft"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
