import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, token_balance, is_admin")
    .eq("id", user.id)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} profile={profile} />
      <main className="container py-6">
        {children}
      </main>
    </div>
  )
}
