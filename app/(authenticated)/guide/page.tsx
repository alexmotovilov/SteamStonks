import Link from "next/link"

const NAV = [
  { label: "Overview",            href: "#overview" },
  { label: "Prediction Card",     href: "#prediction-card" },
  { label: "↳ Sliders",          href: "#sliders",       indent: true },
  { label: "↳ Boosters",         href: "#boosters",      indent: true },
  { label: "↳ Rites",            href: "#rites",         indent: true },
  { label: "↳ Season Ladder",    href: "#ladder",          indent: true },
  { label: "↳ Ladder Scoring",   href: "#ladder-scoring",  indent: true },
  { label: "Prediction Lifecycle",href: "#lifecycle" },
  { label: "Scoring",             href: "#scoring" },
  { label: "Equipment",           href: "#equipment" },
  { label: "Vendor & Inventory",  href: "#vendor" },
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
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-[rgba(10,10,20,0.95)] border border-purple-500/30 font-display text-[10px] text-purple-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-lg">
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
        <div className="absolute top-[8%] left-[7%]">
          <CalloutBubble number={1} label="Rites" section="rites" />
        </div>
        <div className="absolute top-[8%] left-[49%]">
          <CalloutBubble number={2} label="Sliders" section="sliders" />
        </div>
        <div className="absolute top-[38%] left-[49%]">
          <CalloutBubble number={3} label="Active Effects" section="sliders" />
        </div>
        <div className="absolute top-[62%] left-[49%]">
          <CalloutBubble number={4} label="Boosters" section="boosters" />
        </div>
        <div className="absolute top-[8%] right-[7%]">
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
          <p className="font-body text-sm text-muted-foreground">Everything you need to know to compete in Prognos.</p>
        </div>

        {/* ── Overview ──────────────────────────────────────────── */}
        <SectionHeading id="overview">Overview</SectionHeading>
        <Body>
          Prognos is a prediction competition where players forecast the performance of upcoming PC
          games on Steam. Each season, a selection of upcoming games is chosen. You set predictions,
          earn mana when you're right, and compete on the season leaderboard.
        </Body>
        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">1</span>
            <div>
              <div className="font-display text-xs text-foreground">Peak player count · Week 1</div>
              <div className="font-body text-xs text-muted-foreground mt-0.5">The highest concurrent player count recorded on Steam in the first 7 days after release.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">2</span>
            <div>
              <div className="font-display text-xs text-foreground">% Positive reviews · Week 1</div>
              <div className="font-body text-xs text-muted-foreground mt-0.5">The positive review percentage from the most recent Steam snapshot within the 7-day window.</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50">
            <span className="font-display text-xs text-cyan-400 shrink-0 mt-0.5">3</span>
            <div>
              <div className="font-display text-xs text-foreground">Season Ladder</div>
              <div className="font-body text-xs text-muted-foreground mt-0.5">Rank all season games by predicted all-time peak player count. Scored at season end.</div>
            </div>
          </div>
        </div>

        {/* ── Prediction Card ───────────────────────────────────── */}
        <SectionHeading id="prediction-card">The Prediction Card</SectionHeading>
        <Body>
          Each game in the active season has a Prediction Card. Click any game tile on the Games page
          to open it. The card is divided into three columns.
        </Body>
        <PredictionCardDiagram />

        {/* Sliders */}
        <SubHeading id="sliders">Sliders</SubHeading>
        <Body>
          The two sliders in the center column are where you set your prediction values.
        </Body>
        <div className="mt-4 space-y-4">
          <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-950/5 space-y-2">
            <div className="font-display text-sm text-foreground">Peak Player Count · Week 1</div>
            <Body>
              Drag the green gem to your predicted highest player count in the first 7 days after
              release. The scale is <em>logarithmic</em> — small adjustments at low values are easy,
              while the right end covers millions for major releases. The gold tick marks and green
              bar show your prediction window — the actual value must land inside it to score.
            </Body>
          </div>
          <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-950/5 space-y-2">
            <div className="font-display text-sm text-foreground">% Positive Reviews · Week 1</div>
            <Body>
              Drag to your predicted review percentage on a linear <Mono>0–100%</Mono> scale.
              The default window is <Mono>±3%</Mono>. Boosters and equipment can widen it.
            </Body>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg border border-border bg-muted/10">
          <div className="font-display text-[10px] text-muted-foreground/50 tracking-widest uppercase mb-2">Workflow</div>
          <ol className="space-y-1">
            {[
              "Drag the gem to your prediction",
              "Watch the window range update below the slider",
              "Apply boosters or equipment to widen the window if needed",
              "Click Save Prediction to record your values",
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-2 font-body text-xs text-muted-foreground">
                <span className="font-display text-[10px] text-muted-foreground/40 shrink-0 mt-0.5">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        {/* Boosters */}
        <SubHeading id="boosters">Boosters</SubHeading>
        <Body>
          Boosters are single-use items that modify your prediction for one game.
          They appear as tiles below the sliders.
        </Body>
        <div className="mt-4 space-y-3 text-sm font-body text-muted-foreground leading-relaxed">
          <p>
            The <span className="text-amber-400 font-display text-xs">booster slots</span> (small squares above the grid) show how many boosters you can apply — 2 by default.
            The Sigil of Multiplicity rite or Clockwork Familiar equipment (Tier II+) can add a third slot.
          </p>
          <p>
            To apply a booster: click its tile. The amber border confirms it's active.
            Applied boosters are <strong className="text-foreground">consumed from your inventory when you save</strong> and cannot be removed after saving.
          </p>
          <p>
            The <Mono>×N</Mono> badge on each tile shows how many you have in stock.
            Hover over any booster to see its effect.
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { slug: "Scrying Orb Polish",       effect: "Players window +10%" },
            { slug: "Crystal Focus",             effect: "Reviews window +2" },
            { slug: "Evocation Distillate",      effect: "+25 mana total reward" },
            { slug: "Thaumaturgic Concentrate",  effect: "+50 mana total reward" },
            { slug: "Blood Bargain",             effect: "Reviews window +3, −15 mana reward" },
            { slug: "Black Gem Accumulator",     effect: "Players window −5%, +75 mana if players correct" },
            { slug: "Infernal Patron's Pact",    effect: "Reviews window −1, +1 drop total reward" },
            { slug: "Tincture of Divination",    effect: "Players +10%, Reviews +5" },
          ].map(({ slug, effect }) => (
            <div key={slug} className="p-2.5 rounded border border-amber-500/15 bg-amber-950/10">
              <div className="font-display text-xs text-amber-400">{slug}</div>
              <div className="font-body text-[11px] text-muted-foreground mt-0.5">{effect}</div>
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
            { name: "Ritual of Augury",      cost: "10 mana",       reusable: true,  text: "Reveals a heatmap on both sliders showing where other players have placed their predictions. Active for 2 minutes. Can be used multiple times." },
            { name: "Eldritch Wager",        cost: "30 mana",       reusable: false, text: "Adds +25 mana to your reward for each correct metric, and +25 more if both are correct. One use per prediction." },
            { name: "Sigil of Multiplicity", cost: "50 mana",       reusable: false, text: "Unlocks a third booster slot for this prediction. One use." },
            { name: "Temporal Translocation",cost: "100 mana",      reusable: false, text: "Removes your early lock, letting you update your sliders again. Only available if you have an active early lock." },
            { name: "Auspicious Omens",      cost: "variable mana", reusable: false, text: "Marks this game as your pick for the Top 8 season ladder. Marks are all-or-nothing — if any marked game misses the top 8, all Auspicious Omens rewards are forfeited. Each additional mark costs more mana." },
          ].map(({ name, cost, reusable, text }) => (
            <div key={name} className="flex gap-3 p-3 rounded-lg border border-purple-500/15 bg-purple-950/10">
              <div className="w-10 h-10 rounded-full border border-purple-500/30 bg-purple-950/30 flex items-center justify-center shrink-0">
                <span className="font-display text-[9px] text-purple-400/60">✦</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-display text-xs text-foreground">{name}</span>
                  <span className="font-mono text-[10px] text-cyan-400">{cost}</span>
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
          The right column shows all season games ranked by your predicted all-time peak player count —
          highest at the top. Drag tiles to reorder at any time before the season ends.
        </Body>
        <div className="mt-4 space-y-2 font-body text-sm text-muted-foreground leading-relaxed">
          <p>Released games (shown greyed out) have their positions locked and cannot be moved.</p>
          <p>The <span className="text-amber-400">★</span> gold-ring badge on a tile means you've marked that game with Auspicious Omens.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg border border-border bg-card/50">
            <div className="font-display text-xs text-foreground mb-1">Binary scoring</div>
            <div className="font-body text-xs text-muted-foreground">Each exact rank match earns <Mono>+50 mana</Mono> score.</div>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card/50">
            <div className="font-display text-xs text-foreground mb-1">Sequence scoring</div>
            <div className="font-body text-xs text-muted-foreground">Consecutive correct runs earn escalating bonuses — up to <Mono>+700 mana</Mono> for 8 in a row.</div>
          </div>
        </div>

        {/* ── Ladder Scoring ────────────────────────────────────── */}
        <SubHeading id="ladder-scoring">Ladder Scoring</SubHeading>
        <Body>
          At the end of the season, your ladder ranking is compared against the actual final peak
          player counts for all season games. Two scoring methods apply simultaneously.
        </Body>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card/50 space-y-2">
          <div className="font-display text-xs text-foreground mb-1">Binary scoring</div>
          <Body>
            Each game whose rank in your ladder exactly matches its actual final rank earns{" "}
            <Mono>+50 mana</Mono> and <Mono>+50 season score</Mono>. If you ranked a game at #3
            and it finishes #3 overall, you earn +50 for that exact match.
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
                  <td className="py-1.5 font-display text-xs text-amber-400 text-right">{bonus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 p-4 rounded-lg border border-amber-500/15 bg-amber-950/10">
          <div className="font-display text-xs text-amber-400 mb-2">Auspicious Omens (ladder)</div>
          <Body>
            If you used Auspicious Omens to mark games during the season, those marks are evaluated
            at season end against the final Top 8. The reward is all-or-nothing — if any marked game
            fails to reach the Top 8, all Auspicious Omens rewards are forfeited.
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
                ["Any miss", "+0"],
              ].map(([marks, reward]) => (
                <tr key={marks} className={`border-b border-border/50 ${marks === "Any miss" ? "opacity-50" : ""}`}>
                  <td className="py-1.5 font-body text-xs text-muted-foreground">{marks}</td>
                  <td className={`py-1.5 font-display text-xs text-right ${marks === "Any miss" ? "text-muted-foreground" : "text-amber-400"}`}>{reward}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <Body>
            Your ladder scoring breakdown arrives in your Mailbox at the end of the season.
            Ladder mana and score are applied automatically — no claim required since the
            season has ended and your balance carries into the next season.
          </Body>
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
            the game releases. You earn a mana bonus up to <Mono>+25 mana</Mono> — the earlier you lock, the
            larger the bonus. Boosters, rites, and the ladder remain editable. Use Temporal Translocation to undo.
          </LifecycleStep>
          <LifecycleStep n={4} title="Release">
            When the game launches, your prediction automatically locks. No further changes to sliders or
            boosters. Rites and the ladder remain open until the season ends.
          </LifecycleStep>
          <LifecycleStep n={5} title="Scoring window">
            The score-calculator checks all Steam snapshots from the 7 days after release and finds the
            highest player count recorded. It also reads the most recent review score in that window.
          </LifecycleStep>
          <LifecycleStep n={6} title="Result">
            Your prediction is scored. A message arrives in your <Link href="/mailbox" className="text-purple-400 hover:text-purple-300 transition-colors">Mailbox</Link> with
            a full breakdown. Claim your mana from the mailbox — it deposits to your balance and season score.
          </LifecycleStep>
        </div>

        {/* ── Scoring ───────────────────────────────────────────── */}
        <SectionHeading id="scoring">Scoring</SectionHeading>
        <div className="rounded-xl border border-border overflow-hidden mt-2">
          <div className="grid grid-cols-3 bg-muted/20 border-b border-border">
            {["Result", "Condition", "Base mana"].map(h => (
              <div key={h} className="p-3 font-display text-[10px] text-muted-foreground/60 tracking-widest uppercase">{h}</div>
            ))}
          </div>
          {[
            ["Perfect", "Both metrics within window", "+150 mana"],
            ["Partial",  "One metric within window",   "+50 mana"],
            ["Missed",  "Neither metric correct",      "+0 mana"],
          ].map(([result, cond, mana]) => (
            <div key={result} className="grid grid-cols-3 border-b border-border/50 last:border-0">
              <div className={`p-3 font-display text-xs ${result === "Perfect" ? "text-emerald-400" : result === "Partial" ? "text-amber-400" : "text-muted-foreground/50"}`}>{result}</div>
              <div className="p-3 font-body text-xs text-muted-foreground">{cond}</div>
              <div className="p-3 font-mono text-xs text-cyan-400">{mana}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card/50 space-y-2">
          <div className="font-display text-xs text-foreground mb-3">Additional mana on top of base</div>
          {[
            ["Early lock bonus", "Up to +25 mana — grows linearly over 2 weeks before release"],
            ["Equipment",        "Depends on your equipment and tier"],
            ["Boosters",         "Depends on applied boosters"],
            ["Eldritch Wager",   "+25 mana per correct metric, +25 if both"],
            ["First prediction", "+50 mana on your very first scored prediction this season"],
          ].map(([label, desc]) => (
            <StatRow key={label} label={label} value={desc} />
          ))}
        </div>

        <div className="mt-4 p-4 rounded-lg border border-border bg-card/50">
          <div className="font-display text-xs text-foreground mb-3">Loot drops</div>
          <Body>
            Perfect predictions award 2 drops; Partial awards 1 (equipment may add more).
            Drops arrive as mystery items in your Mailbox — open them to reveal and claim the contents.
          </Body>
        </div>

        <div className="mt-4 p-4 rounded-lg border border-amber-500/15 bg-amber-950/10">
          <div className="font-display text-xs text-amber-400 mb-2">Season Score vs Mana Balance</div>
          <Body>
            Every mana you earn from scoring is added to both your <span className="text-foreground">Season Score</span> (leaderboard rank, never decreases)
            and your <span className="text-foreground">Mana Balance</span> (spendable wallet — used for rites and the vendor).
            The weekly stipend of <Mono>+15 mana</Mono> goes to your balance only.
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
          {[
            {
              name: "Seer's Spectacles",
              t0: "Players +5% window",
              t3: "Players +10% window",
              t6: "Players +10%, +25 mana if players correct",
            },
            {
              name: "Arcanum Esoterica",
              t0: "+15 mana if both correct",
              t3: "+25 mana if both correct",
              t6: "+50 mana if both correct",
            },
            {
              name: "Clockwork Familiar",
              t0: "+1 drop if players correct",
              t3: "+1 booster slot · +1 drop if players correct",
              t6: "+1 booster slot · +2 drops total",
            },
          ].map(({ name, t0, t3, t6 }) => (
            <div key={name} className="grid grid-cols-4 border-b border-border/50 last:border-0">
              <div className="p-3 font-display text-xs text-purple-400">{name}</div>
              {[t0, t3, t6].map((text, i) => (
                <div key={i} className="p-3 font-body text-xs text-muted-foreground">{text}</div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Body>Tier advances on every Perfect or Partial prediction result.</Body>
        </div>

        {/* ── Vendor ────────────────────────────────────────────── */}
        <SectionHeading id="vendor">Vendor & Inventory</SectionHeading>
        <Body>
          The <Link href="/vendor" className="text-purple-400 hover:text-purple-300 transition-colors">Vendor page</Link> rotates
          weekly between two inventories (Week A / Week B). Each week a selection of boosters is available
          for purchase using your mana balance. Stock resets every Monday at midnight UTC.
        </Body>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-border bg-card/50">
            <div className="font-display text-xs text-amber-400 mb-2">Week A</div>
            <ul className="space-y-1 font-body text-xs text-muted-foreground">
              <li>Scrying Orb Polish — 15 mana</li>
              <li>Blood Bargain — 30 mana</li>
              <li>Infernal Patron's Pact — 25 mana</li>
            </ul>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card/50">
            <div className="font-display text-xs text-amber-400 mb-2">Week B</div>
            <ul className="space-y-1 font-body text-xs text-muted-foreground">
              <li>Crystal Focus — 20 mana</li>
              <li>Black Gem Accumulator — 20 mana</li>
              <li>Tincture of Divination — 75 mana</li>
            </ul>
          </div>
        </div>
        <div className="mt-3">
          <Body>
            You also receive a <Mono>+15 mana</Mono> weekly stipend to your spendable balance while enrolled in an active season.
            Carry-over limits apply to booster quantities between seasons.
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
            <Body>News, announcements, and special booster rewards from the Prognos team. Attached boosters can be claimed directly from the message.</Body>
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
