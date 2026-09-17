import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { VendorShop, type InventoryItem } from "@/components/vendor-shop"
import { VendorCountdown } from "@/components/vendor-countdown"
import { NoScroll } from "@/components/no-scroll"
import { CrystalBulletinBoard } from "@/components/crystal-bulletin-board"
import Link from "next/link"

const CYCLE_A_SLUGS = ["scrying_orb_polish", "blood_bargain", "infernal_patrons_pact"]
const CYCLE_B_SLUGS = ["crystal_focus", "black_gem_accumulator", "tincture_of_divination"]

export default async function VendorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: season } = await supabase
    .from("seasons")
    .select("id, current_vendor_week, current_vendor_cycle, last_vendor_reset_at, entry_fee_tokens")
    .eq("status", "active")
    .single()

  const [{ data: entry }, { data: profile }] = await Promise.all([
    season
      ? supabase
          .from("season_entries")
          .select("stipend_week_number, is_free_entry, vested_at")
          .eq("user_id", user.id)
          .eq("season_id", season.id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("mana_balance, token_balance")
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
  const isUnvested = !!(entry as { is_free_entry?: boolean | null; vested_at?: string | null }).is_free_entry &&
    !(entry as { is_free_entry?: boolean | null; vested_at?: string | null }).vested_at

  return (
    <>
      <NoScroll />

      {isUnvested && (
        <div className="free-entry-panel fixed z-30 flex flex-col items-center gap-3 px-5 py-3 top-[calc(30vh+15px)] right-[10px] w-[33vw] md:left-1/2 md:right-auto md:top-[calc(var(--header-height,64px)+106px)] md:w-full md:max-w-[min(45vw,280px)] md:-translate-x-1/2">
          {/* Background layer — faded to transparent at the edges */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-xl bg-[rgba(10,5,25,0.7)] backdrop-blur-sm"
            style={{
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 60%, transparent 100%)",
              WebkitMaskComposite: "destination-in",
              maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 60%, transparent 100%)",
              maskComposite: "intersect",
            }}
          />
          <div className="relative w-full min-w-0 text-center">
            <p className="font-display text-xs text-purple-300 tracking-wide mb-0.5">Free Entry</p>
            <p className="font-body text-[11px] md:text-[13px] text-purple-100/90 leading-snug">Vest to unlock the Season Ladder, Auspicious Omens, equipment, and the weekly stipend.</p>
          </div>
          <Link
            href="/dashboard?vest=1"
            className="relative font-display text-[11px] md:text-xs px-5 py-2.5 rounded-xl border border-amber-500/50 bg-purple-950/30 text-amber-300 hover:bg-purple-950/50 hover:border-amber-400/70 transition-colors tracking-wide text-center cursor-pointer"
          >
            <span className="md:hidden">Vest now</span>
            <span className="hidden md:inline">Vest your season entry now.</span>
          </Link>
        </div>
      )}

      {/* Desktop-only: bulletin board, restock sign, countdown */}
      <div className="hidden md:block">
        <CrystalBulletinBoard className="vendor-blur bag-blur" tabletSrc="/crystal-tablet-2.png" top="calc(9.3vh + 50px)" right="calc(6.25vw + 140px)" width="27vw" />
        <img
          src="/restock-sign.png"
          alt=""
          className="vendor-blur bag-blur"
          style={{ position: "fixed", top: "calc(7.4vh + 40px)", right: "calc(49vw + 170px)", width: "17.4vw", height: "auto", zIndex: 10, pointerEvents: "none" }}
          draggable={false}
        />
        <div className="vendor-blur bag-blur" style={{ position: "fixed", top: "calc(16.2vh + 45px)", right: "calc(49.4vw + 172px)", width: "8.3vw", zIndex: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <VendorCountdown />
        </div>
      </div>

      {/* VendorShop — renders desktop layout (with internal scaling) and mobile layout */}
      <VendorShop
        items={items ?? []}
        purchasedCounts={purchasedByItemId}
        manaBalance={profile?.mana_balance ?? 0}
        seasonId={season.id}
        vendorWeek={season.current_vendor_week ?? 1}
        vendorCycle={cycle}
        stipendClaimable={stipendClaimable}
        isUnvested={isUnvested}
        inventory={(inventory ?? []) as unknown as InventoryItem[]}
      />
    </>
  )
}
