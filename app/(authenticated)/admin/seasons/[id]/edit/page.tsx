import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { EditSeasonForm } from "./edit-season-form"

export default async function EditSeasonPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: season } = await supabase
    .from("seasons")
    .select("*")
    .eq("id", id)
    .single()

  if (!season) notFound()

  return <EditSeasonForm season={season} />
}
