import { NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { prediction_id, season_id, new_boosters, previous_boosters } = await request.json()

  // Verify the prediction belongs to this user
  const { data: prediction } = await supabase
    .from("predictions")
    .select("id, user_id, applied_boosters, is_locked, scored_at")
    .eq("id", prediction_id)
    .single()

  if (!prediction || prediction.user_id !== user.id) {
    return NextResponse.json({ error: "Prediction not found" }, { status: 404 })
  }

  if (prediction.is_locked || prediction.scored_at) {
    return NextResponse.json({ error: "Prediction is locked" }, { status: 400 })
  }

  // Determine which boosters are being added and removed
  const prev = (previous_boosters ?? prediction.applied_boosters ?? []) as string[]
  const next = (new_boosters ?? []) as string[]

  const toReturn = prev.filter((s: string) => !next.includes(s))
  const toConsume = next.filter((s: string) => !prev.includes(s))

  // Get item IDs for slugs
  const allSlugs = [...new Set([...toReturn, ...toConsume])]
  if (allSlugs.length === 0) {
    return NextResponse.json({ success: true, message: "No booster changes" })
  }

  const { data: items } = await supabaseAdmin
    .from("items")
    .select("id, slug")
    .in("slug", allSlugs)

  if (!items) return NextResponse.json({ error: "Items not found" }, { status: 400 })

  const slugToId = Object.fromEntries(items.map(i => [i.slug, i.id]))

  // Return previously applied boosters to inventory
  for (const slug of toReturn) {
    const itemId = slugToId[slug]
    if (!itemId) continue
    await supabaseAdmin.rpc("increment_inventory", {
      p_user_id: user.id,
      p_item_id: itemId,
    })
  }

  // Consume newly applied boosters from inventory
  for (const slug of toConsume) {
    const itemId = slugToId[slug]
    if (!itemId) continue

    const { data: success } = await supabaseAdmin.rpc("consume_inventory_item", {
      p_user_id: user.id,
      p_item_id: itemId,
      p_quantity: 1,
    })

    if (!success) {
      // Rollback — return any already-consumed boosters this iteration
      for (const returnSlug of toConsume.slice(0, toConsume.indexOf(slug))) {
        const returnId = slugToId[returnSlug]
        if (returnId) {
          await supabaseAdmin.rpc("increment_inventory", {
            p_user_id: user.id,
            p_item_id: returnId,
          })
        }
      }
      // Also re-consume the returned boosters
      for (const returnSlug of toReturn) {
        const returnId = slugToId[returnSlug]
        if (returnId) {
          await supabaseAdmin.rpc("consume_inventory_item", {
            p_user_id: user.id,
            p_item_id: returnId,
            p_quantity: 1,
          })
        }
      }
      return NextResponse.json(
        { error: `Insufficient ${slug} in inventory` },
        { status: 400 }
      )
    }
  }

  return NextResponse.json({ success: true, returned: toReturn, consumed: toConsume })
}
