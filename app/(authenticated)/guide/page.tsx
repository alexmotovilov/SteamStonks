import Link from "next/link"

const NAV = [
  { label: "Overview",            href: "#overview" },
  { label: "Mana",                href: "#mana" },
  { label: "Prediction Card",     href: "#prediction-card" },
  { label: "↳ Sliders",          href: "#sliders",         indent: true },
  { label: "↳ Early Lock",       href: "#early-lock",      indent: true },
  { label: "↳ Active Effects",   href: "#active-effects",  indent: true },
  { label: "↳ Boosters",         href: "#boosters",        indent: true },
  { label: "↳ Rites",            href: "#rites",         indent: true },
  { label: "↳ Season Ladder",    href: "#ladder",            indent: true },
  { label: "Prediction Lifecycle",href: "#lifecycle" },
  { label: "Scoring",             href: "#scoring" },
  { label: "↳ Week 1 Scoring",   href: "#week-one-scoring", indent: true },
  { label: "↳ Ladder Scoring",   href: "#ladder-scoring",   indent: true },
  { label: "Equipment",           href: "#equipment" },
  { label: "Vendor",              href: "#vendor" },
  { label: "Mailbox",             href: "#mailbox" },
]

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="font-display text-2xl text-foreground tracking-wide mt-12 mb-4 pb-3 border-b border-border flex items-center gap-3 scroll-mt-24"
    >
      <span className="w-1 h-7 rounded-full bg-amber-500/60 shrink-0" />
      {children}
    </h2>
  )
}

function SubHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="font-display text-lg text-foreground tracking-wide mt-8 mb-3 flex items-center gap-2 scroll-mt-24"
    >
      <span className="w-1 h-5 rounded-full bg-purple-500/50 shrink-0" />
      {children}
    </h3>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <p className="font-body text-sm leading-relaxed text-muted-foreground">{children}</p>
}

function ManaSymbol() {
  return <img src="/icons/mana-icon.png" alt="mana" width={12} height={12} className="inline-block align-middle" />
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-emerald-400 text-xs bg-emerald-950/20 px-1 py-0.5 rounded">{children}</code>
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-3 py-2 border-b border-border/50 last:border-0">
      <span className="font-display text-xs text-foreground w-20 shrink-0">{label}</span>
      <span className="font-body text-xs text-muted-foreground flex-1">{value}</span>
      {sub && <span className="font-mono text-xs text-emerald-400 shrink-0">{sub}</span>}
    </div>
  )
}

function CalloutBubble({ number, label, section }: { number: number; label: string; section: string }) {
  return (
    <a
      href={`#${section}`}
      className="group relative w-7 h-7 rounded-full border-2 flex items-center justify-center font-display text-sm font-bold shadow-lg bg-violet-600 text-white border-violet-400 hover:bg-violet-500 hover:scale-110 transition-all duration-150 cursor-pointer"
    >
      {number}
      <span className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-2 py-1 rounded bg-[rgba(10,10,20,0.95)] border border-purple-500/30 font-display text-[10px] text-purple-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
        {label}
      </span>
    </a>
  )
}

function PredictionCardDiagram() {
  return (
    <div className="my-6">
      <div className="relative w-4/5 mx-auto rounded-xl overflow-hidden border border-border">
        <img
          src="/guide/prediction-card-guide.png"
          alt="Prognos prediction card with annotated sections"
          className="w-full h-auto block"
        />
        <div className="absolute top-[.5%] left-[6.4%]">
          <CalloutBubble number={1} label="Rites" section="rites" />
        </div>
        <div className="absolute top-[.5%] left-[48%]">
          <CalloutBubble number={2} label="Sliders" section="sliders" />
        </div>
        <div className="absolute top-[39.5%] left-[48%]">
          <CalloutBubble number={3} label="Active Effects" section="active-effects" />
        </div>
        <div className="absolute top-[67%] left-[48%]">
          <CalloutBubble number={4} label="Boosters" section="boosters" />
        </div>
        <div className="absolute top-[.5%] right-[7%]">
          <CalloutBubble number={5} label="Season Ladder" section="ladder" />
        </div>
      </div>
    </div>
  )
}

function LifecycleStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full border border-purple-500/40 bg-purple-950/30 flex items-center justify-center shrink-0">
          <span className="font-display text-xs text-purple-400">{n}</span>
        </div>
        {n < 6 && <div className="w-px flex-1 bg-border/40 mt-1" />}
      </div>
      <div className="pb-6">
        <div className="font-display text-sm text-foreground mb-1">{title}</div>
        <div className="font-body text-xs text-muted-foreground leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

export default function GuidePage() {
  return (
    <div className="flex gap-8">

      {/* Sidebar */}
      <aside className="hidden lg:block w-44 shrink-0">
        <nav className="sticky top-24 space-y-0.5">
          <div className="font-display text-[9px] text-muted-foreground/40 tracking-widest uppercase mb-3 px-2">Contents</div>
          {NAV.map(({ label, href, indent }) => (
            <a
              key={href}
              href={href}
              className={`block text-xs font-display text-muted-foreground/60 hover:text-foreground transition-colors py-1 rounded px-2 hover:bg-white/[0.04] ${indent ? "pl-5 text-[11px]" : ""}`}
            >
              {label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-16">

        {/* Page header */}
        <div className="mb-2">
          <h1 className="font-display text-4xl text-foreground tracking-wide mb-2">Player's Guide</h1>
        </div>

        {/* ── Overview ──────────────────────────────────────────── */}
        <SectionHeading id="overview">Overview</SectionHeading>
        <Body>
          Prognos is a competition of skill and foresight. Players use their industry knowledge
          and creative insight to predict the performance of upcoming PC games on Steam while building
          a ranking of what they believe will be the top 8 titles. Each season of Prognos offers the
          opportunity for players to engage in a multi-month tournament to prove their predictive
          prowess and shrewd judgement in a race to become a true PC prognosticator.
        </Body>
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">1</span>
            <div>
              <div className="font-display text-xs text-foreground">Peak player count · Week 1</div>
              <div className="font-body text-xs text-muted-foreground mt-0.5">The highest active player count recorded in the first 7 days after release.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">2</span>
            <div>
              <div className="font-display text-xs text-foreground">% Positive reviews · Week 1</div>
              <div className="font-body text-xs text-muted-foreground mt-0.5">The positive review percentage at the end of the 7-day window.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">3</span>
            <div>
              <div className="font-display text-xs text-foreground">Season Ladder</div>
              <div className="font-body text-xs text-muted-foreground mt-0.5">Rank all season games to predict the top 8 by all-time peak player count. Scored at season end.</div>
            </div>
          </div>
        </div>

        {/* ── Mana ──────────────────────────────────────────────── */}
        <SectionHeading id="mana">Mana</SectionHeading>
        <Body>
          Mana (<ManaSymbol />) is the in-game currency of Prognos. It is earned by making predictions and
          can be spent on Rites and at the vendor.
          Your mana balance persists between seasons; unspent mana carries over in full when a
          new season begins.
        </Body>
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">Earning</span>
            <div className="font-body text-xs text-muted-foreground leading-relaxed">
              Mana is awarded when predictions are scored. Base rewards range from{" "}
              <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">50 <ManaSymbol /></span>{" "}
              for a partial result up to{" "}
              <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">150 <ManaSymbol /></span>{" "}
              for a perfect result. Boosters, equipment, rites, and bonuses can add additional rewards.
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">Spending</span>
            <div className="font-body text-xs text-muted-foreground leading-relaxed">
              Mana is spent on Rites — active effects applied to individual predictions — and on
              booster items purchased from the Arcane Repository vendor each week.
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">Carry-over</span>
            <div className="font-body text-xs text-muted-foreground leading-relaxed">
              Your mana balance is tied to your account, not to a season. It does not reset at
              season end — any unspent mana rolls into the next season automatically.
            </div>
          </div>
        </div>

        {/* ── Prediction Card ───────────────────────────────────── */}
        <SectionHeading id="prediction-card">The Prediction Card</SectionHeading>
        <Body>
          Each game in the active season has a Prediction Card. Clicking a game tile on the Games page
          will open it.
        </Body>
        <PredictionCardDiagram />

        {/* Sliders */}
        <SubHeading id="sliders">Sliders</SubHeading>
        <div className="mt-4 space-y-3 text-sm font-body text-muted-foreground leading-relaxed">
          <p>
            The two sliders at the top of the card are where you pick your week 1 predictions. Drag the green gems to set your prediction range.
          </p>
          <p>
            Save/update your prediction card to confirm your selected predictions. These can be changed at any time before a game's launch or before Early Lock is enabled.
          </p>
        </div>
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-950/5 space-y-2">
            <div className="font-display text-sm text-foreground">Peak Player Count · Week 1</div>
            <Body>
              Drag the green gem to your predicted highest player count in the first 7 days after
              release. The gold tick marks and green bar show your prediction window — the actual
              value must land inside it to score. The default window is <Mono>±10%</Mono> of
              your midpoint. Boosters and equipment can affect it. 
            </Body>
          </div>
          <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-950/5 space-y-2">
            <div className="font-display text-sm text-foreground">% Positive Reviews · Week 1</div>
            <Body>
              Drag to your predicted review percentage on a linear <Mono>0–100%</Mono> scale.
              The default window is <Mono>±3</Mono>. Boosters and equipment can affect it.
            </Body>
          </div>
        </div>
        
        {/* Early Lock */}
        <SubHeading id="early-lock">Early Lock</SubHeading>
        <Body>
          Before a game launches you can voluntarily freeze your sliders to earn a mana bonus.
          The <span className="text-amber-400">Early Lock</span> button appears directly below the
          week 1 sliders on the prediction card — it is only available after you have saved a
          prediction and while the game has not yet released.
        </Body>
        <div className="mt-4 space-y-2">
          <div className="p-4 rounded-lg border border-amber-500/20 bg-amber-950/5 space-y-2">
            <div className="font-display text-sm text-amber-400">How the bonus is calculated</div>
            <Body>
              The bonus scales linearly from <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+0 <ManaSymbol /></span> to <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+25 <ManaSymbol /></span> based on
              how far in advance of release you lock. Locking two or more weeks before release earns
              the full <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+25 <ManaSymbol /></span>. Locking on the day of release earns nothing. Everything
              in between is proportional — the earlier you lock, the more you earn.
            </Body>
          </div>
          <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
            <div className="font-display text-sm text-foreground">What locks and what stays editable</div>
            <div className="mt-2 space-y-1.5">
              {[
                { label: "Locked",    items: ["Peak player count slider", "% Positive reviews slider"] },
                { label: "Editable",  items: ["Boosters", "Rites", "Season Ladder"] },
              ].map(({ label, items }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className={`font-display text-[10px] tracking-widest uppercase shrink-0 w-14 mt-0.5 ${label === "Locked" ? "text-red-400/70" : "text-emerald-400/70"}`}>{label}</span>
                  <span className="font-body text-xs text-muted-foreground">{items.join(" · ")}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 rounded-lg border border-purple-500/15 bg-purple-950/10 space-y-2">
            <div className="font-display text-sm text-foreground">Undoing an early lock</div>
            <Body>
              The <span className="text-foreground">Temporal Translocation</span> rite (100 <ManaSymbol />) removes
              an active early lock and restores full slider access. The early lock bonus is forfeited when you
              unlock — the bonus is recalculated from zero if you choose to lock again.
            </Body>
          </div>
        </div>
        <div className="mt-3">
          <Body>
            <strong className="text-foreground">The early lock bonus is guaranteed after scoring regardless of your prediction result</strong> — it is added to your total reward even on a missed prediction.
          </Body>
        </div>

        {/* Active Effects */}
        <SubHeading id="active-effects">Active Effects</SubHeading>
        <Body>
          Between the sliders and the booster inventory you'll find the Active Effects list — a live
          summary of every modifier currently applied to your prediction. It updates as you add
          boosters, perform rites, and equip items.
        </Body>
        <div className="mt-4 space-y-2">
          {[
            { color: "bg-emerald-400", text: "text-emerald-400", label: "Green", meaning: "An advantage conferred to your prediction, a slider window is being widened (e.g. Players +10%, Reviews +2). Wider windows make it easier to land your prediction." },
            { color: "bg-red-400",     text: "text-red-400",     label: "Red",   meaning: "Penalties to your prediction (e.g. Blood Bargain narrows the players window by 3%). These are trade-offs you've deliberately accepted from a booster." },
            { color: "bg-cyan-400",    text: "text-cyan-300",    label: "Cyan",  meaning: "Mana bonuses and the first prediction bonus. A flat mana amount is being added to your potential reward." },
            { color: "bg-amber-400",   text: "text-amber-400",   label: "Amber", meaning: "Loot drop bonuses and booster slot bonuses.Extra drops from equipment or boosters, and extra slots from the Sigil of Multiplicity rite or Clockwork Familiar." },
            { color: "bg-amber-600",   text: "text-amber-600",   label: "Gold",  meaning: "Auspicious Omens mark: this game has been marked for the top 8. A special badge also appears on the game's ladder tile." },
          ].map(({ color, text, label, meaning }) => (
            <div key={label} className="flex gap-3 p-3 rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-1.5 shrink-0 w-16">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                <span className={`font-display text-xs ${text}`}>{label}</span>
              </div>
              <p className="font-body text-xs text-muted-foreground leading-relaxed">{meaning}</p>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Body>
            Sources that can add entries: your equipped item (always shown if you have equipment), applied
            boosters (one entry per effect per booster), and performed rites — Eldritch Wager, Sigil of
            Multiplicity, and Auspicious Omens each contribute their own rows.
          </Body>
        </div>
        <div className="mt-3">
          <Body>
            <strong className="text-foreground">Bonuses to total reward are guaranteed after 1 week scoring regardless of prediction results. You receive these even on a missed prediction.</strong>
          </Body>
        </div>

        {/* Boosters */}
        <SubHeading id="boosters">Boosters</SubHeading>
        <Body>
          Boosters are single-use items that modify your prediction for one game.
          Your current booster inventory appears below the active effects list.
        </Body>
        <div className="mt-4 space-y-3 text-sm font-body text-muted-foreground leading-relaxed">
          <p>
            The <span className="text-amber-400 font-display text-xs">booster slots</span> (small squares above the inventory grid) show how many boosters you can apply (2 by default).
            The Sigil of Multiplicity rite or Clockwork Familiar equipment (Tier II+) can add additional slots.
          </p>
          <p>
            Click a booster tile to add it to an empty booster slot. The booster's effect(s) will be shown in the active effects list. Save/update your prediction to apply the selected boosters.
          </p>
          <p>
            <strong className="text-foreground">Applied boosters are consumed from your inventory and cannot be removed from the booster slot after prediction card has been saved/updated.</strong>
          </p>
          </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { slug: "Scrying Orb Polish",       image: "/items/scrying-orb-polish.png",       effect: "Players window +10%" },
            { slug: "Crystal Focus",             image: "/items/crystal-focus.png",             effect: "Reviews window +2" },
            { slug: "Evocation Distillate",      image: "/items/evocation-distillate.png",      effect: "+25 mana total reward" },
            { slug: "Thaumaturgic Concentrate",  image: "/items/thaumaturgic-concentrate.png",  effect: "+50 mana total reward" },
            { slug: "Blood Bargain",             image: "/items/blood-bargain.png",             effect: "Reviews window +3, Players window −3%" },
            { slug: "Black Gem Accumulator",     image: "/items/black-gem-accumulator.png",     effect: "Players window −5%, +75 mana if players correct" },
            { slug: "Infernal Patron's Pact",    image: "/items/infernal-patrons-pact.png",     effect: "Reviews window −1, +1 drop total reward" },
            { slug: "Tincture of Divination",    image: "/items/tincture-of-divination.png",    effect: "Players +10%, Reviews +5" },
          ].map(({ slug, image, effect }) => (
            <div key={slug} className="flex items-center gap-3 p-2.5 rounded border border-amber-500/15 bg-amber-950/10">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-amber-500/20 bg-purple-950/20 shrink-0">
                <img src={image} alt={slug} className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-display text-xs text-amber-400">{slug}</div>
                <div className="font-body text-[11px] text-muted-foreground mt-0.5">{effect}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Rites */}
        <SubHeading id="rites">Rites</SubHeading>
        <Body>
          Rites are special abilities in the left column. Each costs mana from your spendable balance.
          Click a rite circle to see its description, then confirm activation.
        </Body>
        <div className="mt-4 space-y-2">
          {[
            { name: "Ritual of Augury",      cost: "10",       reusable: true,  image: "/rites/ritual-of-augury.png",       text: "Reveals a heatmap on both sliders showing where other players have placed their predictions. Active for 2 minutes. Can be used multiple times." },
            { name: "Eldritch Wager",        cost: "30",       reusable: false, image: "/rites/eldritch-wager.png",         text: "Adds +25 mana to your reward for each correct metric, additional +25 mana if both are correct. One use per prediction." },
            { name: "Sigil of Multiplicity", cost: "50",       reusable: false, image: "/rites/sigil-of-multiplicity.png",  text: "Unlocks a third booster slot for this prediction. One use per prediction." },
            { name: "Temporal Translocation",cost: "100",      reusable: false, image: "/rites/temporal-translocation.png", text: "Removes your early lock, letting you update your sliders again. Only available if you have an active early lock." },
            { name: "Auspicious Omens",      cost: "variable", reusable: false, image: "/rites/auspicious-omens.png",       text: <>Marks this game for an  optional all-or-nothing side bet on your season ladder.  Every marked game must finish in the Top 8 to collect the reward. The more marks you place correctly, the larger the bonus. Each additional mark costs more mana.</> },
          ].map(({ name, cost, reusable, image, text }) => (
            <div key={name} className="flex gap-3 p-3 rounded-lg border border-purple-500/15 bg-purple-950/10">
              <div className="w-10 h-10 rounded-full border border-purple-500/30 bg-purple-950/30 overflow-hidden shrink-0">
                <img src={image} alt={name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-xs text-foreground">{name}</span>
                  <span className="font-body text-[10px] text-cyan-400 inline-flex items-center gap-0.5">{cost} <ManaSymbol /></span>
                  {reusable && <span className="font-display text-[9px] text-emerald-400/60 border border-emerald-500/20 px-1.5 py-0.5 rounded">reusable</span>}
                </div>
                <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">{text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Ladder */}
        <SubHeading id="ladder">Season Ladder</SubHeading>
        <Body>
          The ladder shows games ranked by predicted all-time peak player count at the end of the season (highest at the top). Only the top 8 positions will be scored, games left in the 9th position (red tile) will be removed from the ladder.
        </Body>
        <div className="mt-4 space-y-2 font-body text-sm text-muted-foreground leading-relaxed">
          <p>Drag game tiles to reorder at any time before the game's launch. Released games (shown greyed out) have their position relative to other released games locked and cannot be moved.</p>
          <p>The <span style={{ color: "#9D84D4" }}>★</span> badge on a tile means you've marked that game with Auspicious Omens.</p>
        </div>
        {/* ── Lifecycle ─────────────────────────────────────────── */}
        <SectionHeading id="lifecycle">Prediction Lifecycle</SectionHeading>
        <div className="mt-2">
          <LifecycleStep n={1} title="Set">
            Drag both sliders to your predictions. Apply any boosters or rites. Arrange your ladder ranking.
          </LifecycleStep>
          <LifecycleStep n={2} title="Save">
            Click <span className="text-foreground">Save Prediction</span>. Boosters are consumed from your
            inventory at this point and cannot be removed. You can still update slider values until the game releases.
          </LifecycleStep>
          <LifecycleStep n={3} title="Early Lock (optional)">
            Click <span className="text-amber-400">Early Lock</span> to voluntarily freeze your sliders before
            the game releases. You earn a mana bonus up to <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+25 <ManaSymbol /></span> — the earlier you lock, the
            larger the bonus. Boosters, rites, and the ladder remain editable. Use Temporal Translocation to undo.
            {" "}<strong className="text-foreground">The early lock bonus is applied to your total reward and will be awarded after scoring regardless of prediction result.</strong>
          </LifecycleStep>
          <LifecycleStep n={4} title="Release">
            When the game launches, your prediction automatically locks. No further changes to sliders,
            boosters, rites, or ladder position relative to other released games.
          </LifecycleStep>
          <LifecycleStep n={5} title="Scoring window">
            The score-calculator checks all Steam snapshots from the 7 days after release and finds the
            highest player count recorded. It also collects the positive review score at the end of the 7-day window.
          </LifecycleStep>
          <LifecycleStep n={6} title="Result">
            Your prediction is scored. A message arrives in your <Link href="/mailbox" className="text-purple-400 hover:text-purple-300 transition-colors">Mailbox</Link> with
            a full breakdown. Claim your rewards from the mailbox.
          </LifecycleStep>
        </div>

        {/* ── Scoring ───────────────────────────────────────────── */}
        <SectionHeading id="scoring">Scoring</SectionHeading>
        <Body>
          Prognos has two distinct scoring phases. Week 1 predictions are scored individually as
          each game releases throughout the season. Season Ladder scoring happens once at season
          end, when all games have released and the final standings are determined.
        </Body>

        {/* Week 1 Scoring */}
        <SubHeading id="week-one-scoring">Week 1 Scoring</SubHeading>
        <div className="rounded-xl border border-border overflow-hidden mt-2">
          <div className="grid grid-cols-3 bg-muted/20 border-b border-border">
            {["Result", "Condition", "Base mana"].map(h => (
              <div key={h} className="p-3 font-display text-[10px] text-muted-foreground/60 tracking-widest uppercase">{h}</div>
            ))}
          </div>
          {[
            ["Perfect", "Both metrics within window", "+150"],
            ["Partial",  "One metric within window",   "+50"],
            ["Missed",  "Neither metric correct",      "+0"],
          ].map(([result, cond, mana]) => (
            <div key={result} className="grid grid-cols-3 border-b border-border/50 last:border-0">
              <div className={`p-3 font-display text-xs ${result === "Perfect" ? "text-emerald-400" : result === "Partial" ? "text-amber-400" : "text-muted-foreground/50"}`}>{result}</div>
              <div className="p-3 font-body text-xs text-muted-foreground">{cond}</div>
              <div className="p-3 font-body text-xs text-cyan-400 flex items-center gap-1">{mana} <ManaSymbol /></div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card/50 space-y-2">
          <div className="font-display text-xs text-foreground mb-3">Additional mana on top of base</div>
          {([
            ["Early lock bonus", <>Up to <span className="font-body text-cyan-400 inline-flex items-center gap-0.5">+25 <ManaSymbol /></span> — grows linearly over 2 weeks before release</>],
            ["Equipment",        "Depends on your equipment and tier"],
            ["Boosters",         "Depends on applied boosters"],
            ["Eldritch Wager",   <><span className="font-body text-cyan-400 inline-flex items-center gap-0.5">+25 <ManaSymbol /></span> per correct metric, additional <span className="font-body text-cyan-400 inline-flex items-center gap-0.5">+25 <ManaSymbol /></span> if both correct</>],
            ["First prediction", <><span className="font-body text-cyan-400 inline-flex items-center gap-0.5">+50 <ManaSymbol /></span> on your very first scored prediction this season</>],
          ] as [string, React.ReactNode][]).map(([label, desc]) => (
            <div key={label} className="flex items-baseline gap-3 py-2 border-b border-border/50 last:border-0">
              <span className="font-display text-xs text-foreground w-20 shrink-0">{label}</span>
              <span className="font-body text-xs text-muted-foreground flex-1">{desc}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card/50">
          <div className="font-display text-xs text-foreground mb-3">Loot drops</div>
          <Body>
            Perfect predictions award two drops; Partial award one (equipment/boosters may add more).
            Drops arrive as mystery items in your Mailbox. Open them to reveal and claim the contents.
          </Body>
        </div>

        <div className="mt-4 p-4 rounded-lg border border-amber-500/15 bg-amber-950/10">
          <div className="font-display text-xs text-amber-400 mb-2">Season Score vs Mana Balance</div>
          <Body>
            Every mana you earn from scoring is added to both your <span className="text-foreground">Season Score</span> (leaderboard rank, never decreases)
            and your <span className="text-foreground">Mana Balance</span> (spendable wallet — used for rites and the vendor).
            The weekly stipend of <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+15 <ManaSymbol /></span> goes to your balance only.
          </Body>
        </div>

        {/* Season Ladder Scoring */}
        <SubHeading id="ladder-scoring">Season Ladder Scoring</SubHeading>
        <Body>
          At the end of the season, your ladder ranking is compared against the actual final peak
          player counts for all season games. Two scoring methods apply simultaneously.
        </Body>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card/50 space-y-2">
          <div className="font-display text-xs text-foreground mb-1">Binary scoring</div>
          <Body>
            Each game whose rank in your ladder exactly matches its actual final rank earns{" "}
            <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+50 <ManaSymbol /></span>. If you ranked a game at #3
            and it finishes #3 overall, you earn the bonus for that exact match.
          </Body>
        </div>

        <div className="mt-3 p-4 rounded-lg border border-purple-500/15 bg-purple-950/10">
          <div className="font-display text-xs text-foreground mb-2">Sequence scoring (LCS)</div>
          <Body>
            Beyond exact matches, the longest consecutive run of correctly ordered games in your
            ladder earns an escalating bonus — even if those games aren't in the exact right
            positions overall, as long as they appear in the correct order relative to each other.
          </Body>
          <table className="w-full text-sm border-collapse mt-3">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-display text-xs text-muted-foreground/60 tracking-widest uppercase">Run length</th>
                <th className="text-right py-2 font-display text-xs text-muted-foreground/60 tracking-widest uppercase">Bonus mana</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["2 games", "+50"],
                ["3 games", "+100"],
                ["4 games", "+150"],
                ["5 games", "+250"],
                ["6 games", "+350"],
                ["7 games", "+500"],
                ["8 games", "+700"],
              ].map(([run, bonus]) => (
                <tr key={run} className="border-b border-border/50">
                  <td className="py-1.5 font-body text-xs text-muted-foreground">{run}</td>
                  <td className="py-1.5 font-body text-xs text-cyan-400 text-right"><span className="inline-flex items-center justify-end gap-1">{bonus} <ManaSymbol /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 p-4 rounded-lg border border-amber-500/15 bg-amber-950/10">
          <div className="font-display text-xs text-amber-400 mb-2">Auspicious Omens (ladder)</div>
          <Body>
            If you used Auspicious Omens to mark games during the season, those marks are evaluated
            at season end against the final Top 8. <strong className="text-foreground">If any marked game
            fails to reach the Top 8, all Auspicious Omens rewards are forfeited.</strong>
          </Body>
          <table className="w-full text-sm border-collapse mt-3">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-display text-xs text-muted-foreground/60 tracking-widest uppercase">Marks correct</th>
                <th className="text-right py-2 font-display text-xs text-muted-foreground/60 tracking-widest uppercase">Reward</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["1 of 1", "+10"],
                ["2 of 2", "+30"],
                ["3 of 3", "+60"],
                ["4 of 4", "+100"],
                ["5 of 5", "+150"],
                ["6 of 6", "+210"],
                ["7 of 7", "+280"],
                ["8 of 8", "+360"],
              ].map(([marks, reward]) => (
                <tr key={marks} className="border-b border-border/50">
                  <td className="py-1.5 font-body text-xs text-muted-foreground">{marks}</td>
                  <td className="py-1.5 font-body text-xs text-right text-cyan-400">
                    <span className="inline-flex items-center justify-end gap-1">{reward} <ManaSymbol /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <Body>
            Your ladder scoring breakdown arrives in your Mailbox at the end of the season.
            Ladder mana and score are applied automatically. 
          </Body>
        </div>

        {/* ── Equipment ─────────────────────────────────────────── */}
        <SectionHeading id="equipment">Equipment</SectionHeading>
        <Body>
          When you join a season you choose one piece of equipment. It stays with you for the entire
          season and gets stronger as you make successful predictions.
        </Body>
        <div className="mt-4 rounded-xl border border-border overflow-hidden">
          <div className="grid grid-cols-4 bg-muted/20 border-b border-border">
            {["Equipment", "Tier I (0–2)", "Tier II (3–5)", "Tier III (6+)"].map(h => (
              <div key={h} className="p-3 font-display text-[10px] text-muted-foreground/60 tracking-widest uppercase">{h}</div>
            ))}
          </div>
          {/* Seer's Spectacles — emerald for window bonuses */}
          <div className="grid grid-cols-4 border-b border-border/50">
            <div className="p-3 font-display text-xs text-purple-400">Seer&apos;s Spectacles</div>
            {([
              "Players window +3% · Reviews window +1",
              "Players window +5% · Reviews window +2",
              "Players window +10% · Reviews window +5",
            ] as const).map((text, i) => (
              <div key={i} className="p-3 font-body text-xs text-emerald-400">{text}</div>
            ))}
          </div>
          {/* Arcanum Esoterica — cyan + mana symbol for mana values */}
          <div className="grid grid-cols-4 border-b border-border/50">
            <div className="p-3 font-display text-xs text-purple-400">Arcanum Esoterica</div>
            <div className="p-3 font-body text-xs text-cyan-400">
              <span className="font-body inline-flex items-center gap-0.5">+15 <ManaSymbol /></span>
              {" "}per correct metric
            </div>
            <div className="p-3 font-body text-xs text-cyan-400">
              <span className="font-body inline-flex items-center gap-0.5">+25 <ManaSymbol /></span>
              {" "}per correct metric · <span className="font-body inline-flex items-center gap-0.5">+25 <ManaSymbol /></span>
              {" "}if both correct
            </div>
            <div className="p-3 font-body text-xs text-cyan-400">
              <span className="font-body inline-flex items-center gap-0.5">+25 <ManaSymbol /></span>
              {" "}per correct metric · <span className="font-body inline-flex items-center gap-0.5">+25 <ManaSymbol /></span>
              {" "}if both correct · <span className="font-body inline-flex items-center gap-0.5">+50 <ManaSymbol /></span>
              {" "}total reward
            </div>
          </div>
          {/* Clockwork Familiar — amber for drops and booster slots */}
          <div className="grid grid-cols-4">
            <div className="p-3 font-display text-xs text-purple-400">Clockwork Familiar</div>
            {([
              "+1 drop per correct metric",
              "+1 drop per correct metric · +1 booster slot",
              "+1 booster slot · +2 drops total reward",
            ] as const).map((text, i) => (
              <div key={i} className="p-3 font-body text-xs text-amber-400">{text}</div>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Body>Tier advances on every Perfect or Partial prediction result.</Body>
        </div>

        {/* ── Vendor ────────────────────────────────────────────── */}
        <SectionHeading id="vendor">Vendor</SectionHeading>
        <Body>
          The <Link href="/vendor" className="text-purple-400 hover:text-purple-300 transition-colors">Vendor page</Link> offers
          a rotating selection of boosters for purchase using your mana balance. Stock resets every Monday at midnight UTC.
        </Body>
        <div className="mt-3">
          <Body>
            You also receive a <span className="font-body text-xs text-cyan-400 inline-flex items-center gap-0.5">+15 <ManaSymbol /></span> weekly stipend to your spendable mana balance while enrolled in an active season. <strong className="text-foreground">This stipend does not contribute to your season score.</strong>
          </Body>
        </div>

        {/* ── Mailbox ───────────────────────────────────────────── */}
        <SectionHeading id="mailbox">Mailbox</SectionHeading>
        <Body>
          Your <Link href="/mailbox" className="text-purple-400 hover:text-purple-300 transition-colors">Mailbox</Link> receives two types of messages.
        </Body>
        <div className="mt-4 space-y-3">
          <div className="p-4 rounded-lg border border-border bg-card/50">
            <div className="font-display text-sm text-foreground mb-2">Admin messages</div>
            <Body>Communication and special rewards from the Prognos team. Attached boosters can be claimed directly from the message.</Body>
          </div>
          <div className="p-4 rounded-lg border border-purple-500/15 bg-purple-950/10">
            <div className="font-display text-sm text-foreground mb-2">Scoring results</div>
            <Body>After each prediction is scored you receive a detailed breakdown showing your result, the actual values, and a full mana breakdown. These messages contain:</Body>
            <ul className="mt-2 space-y-1.5">
              {[
                { label: "Claim Mana", text: "Adds your earned mana to your spendable balance and registers the score." },
                { label: "Mystery drops", text: "If earned, click Open to roll the loot table and reveal your items." },
              ].map(({ label, text }) => (
                <li key={label} className="flex items-start gap-2 font-body text-xs text-muted-foreground">
                  <span className="text-emerald-400 shrink-0">→</span>
                  <span><span className="text-foreground">{label}</span> — {text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Back to top */}
        <div className="mt-12 pt-6 border-t border-border text-center">
          <a href="#overview" className="font-display text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors">↑ Back to top</a>
        </div>
      </div>
    </div>
  )
}
