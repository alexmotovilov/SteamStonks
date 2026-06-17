import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VendorShop, type InventoryItem } from "@/components/vendor-shop"
import { StipendBanner } from "@/components/stipend-banner"
import { VendorCountdown } from "@/components/vendor-countdown"

const CYCLE_A_SLUGS = ["scrying_orb_polish", "blood_bargain", "infernal_patrons_pact"]
const CYCLE_B_SLUGS = ["crystal_focus", "black_gem_accumulator", "tincture_of_divination"]

export default async function VendorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: season } = await supabase
    .from("seasons")
    .select("id, current_vendor_week, current_vendor_cycle, last_vendor_reset_at")
    .eq("status", "active")
    .single()

  const [{ data: entry }, { data: profile }] = await Promise.all([
    season
      ? supabase
          .from("season_entries")
          .select("stipend_week_number")
          .eq("user_id", user.id)
          .eq("season_id", season.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("mana_balance")
      .eq("id", user.id)
      .single(),
  ])

  if (!season || !entry) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-display text-foreground">The Arcane Vendor</h1>
        <p className="text-muted-foreground font-body">
          {!season ? "No active season — the vendor is closed." : "Join the active season to access the vendor."}
        </p>
      </div>
    )
  }

  const cycle = ((season.current_vendor_cycle as string) || "A") as "A" | "B"
  const cycleSlugs = cycle === "A" ? CYCLE_A_SLUGS : CYCLE_B_SLUGS

  const { data: items } = await supabase
    .from("items")
    .select("id, slug, name, description, image_url, vendor_price, vendor_weekly_limit, effects")
    .eq("is_vendored", true)
    .in("slug", cycleSlugs)

  const { data: purchases } = await supabase
    .from("vendor_purchases")
    .select("item_id, quantity")
    .eq("user_id", user.id)
    .eq("season_id", season.id)
    .eq("vendor_week", season.current_vendor_week ?? 1)

  const purchasedByItemId: Record<string, number> = {}
  for (const p of purchases ?? []) {
    purchasedByItemId[p.item_id] = (purchasedByItemId[p.item_id] ?? 0) + (p.quantity ?? 0)
  }

  // Get all booster item definitions so every booster is always visible (qty 0 = out of stock)
  const { data: allBoosters } = await supabase
    .from("items")
    .select("id, slug, name, image_url, effects, description, item_type")
    .eq("item_type", "booster")

  const { data: ownedInventory } = await supabase
    .from("inventory")
    .select("item_id, quantity")
    .eq("user_id", user.id)

  const ownedMap = new Map((ownedInventory ?? []).map(i => [i.item_id, i.quantity]))
  const inventory = (allBoosters ?? []).map(item => ({
    item_id: item.id,
    quantity: ownedMap.get(item.id) ?? 0,
    items: {
      slug: item.slug,
      name: item.name,
      image_url: item.image_url,
      effects: item.effects,
      description: item.description,
      item_type: item.item_type,
    },
  }))

  const stipendClaimable = (entry.stipend_week_number ?? 0) < (season.current_vendor_week ?? 1)

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-display text-foreground">Arcane Repository</h1>
        <VendorCountdown />
      </div>

      <StipendBanner claimable={stipendClaimable} seasonId={season.id} />

      <VendorShop
        items={items ?? []}
        purchasedCounts={purchasedByItemId}
        manaBalance={profile?.mana_balance ?? 0}
        seasonId={season.id}
        vendorWeek={season.current_vendor_week ?? 1}
        vendorCycle={cycle}
        inventory={(inventory ?? []) as unknown as InventoryItem[]}
      />
    </div>
  )
}
