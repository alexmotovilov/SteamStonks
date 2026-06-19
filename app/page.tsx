import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, CheckCircle2 } from "lucide-react"

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* Left-side vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.1) .5%, transparent 1%)",
            zIndex: 1,
          }}
        />
        {/* Darkening vignette around logo area */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              "radial-gradient(ellipse 28% 200% at 8% 50%, transparent 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0.60) 100%)",
              "radial-gradient(ellipse 16% 160% at 1% 50%, transparent 0%, rgba(0,0,0,0.25) 70%)",
            ].join(", "),
          }}
        />
        {/* Rightward fade */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to right, transparent 0%, transparent 24%, rgba(10,10,16,0.85) 40%, rgba(10,10,16,0.98) 46%)",
          }}
        />
        {/* Parchment behind logo */}
        <img
          src="/parchment.png"
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            height: "63px",
            width: "95px",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div className="container relative flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center pr-4 h-16">
            <img
              src="/icons/game-name-logo.png"
              alt="Prognos"
              style={{
                height: "56px",
                width: "auto",
                marginLeft: "6px",
                position: "relative",
                zIndex: 1,
                filter: "drop-shadow(0 0 6px rgba(157,132,212,0.35)) drop-shadow(0 0 1px rgba(200,180,255,0.2)) drop-shadow(-4px 3px 3px rgba(0,0,0,1))",
              }}
            />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild style={{ backgroundColor: "#67e8f9", borderColor: "#67e8f9" }}>
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-24 sm:py-32">
        <div className="flex flex-col items-center text-center gap-8">
          <Badge variant="secondary" className="text-sm">
            Season 1 Coming Soon
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl max-w-4xl text-balance">
            Can You Predict Whether the Next Big Game Will {" "}
 <span className="text-cyan-300">Prosper</span> <span className="text-foreground">or</span> <span className="text-red-600">Perish</span><span className="text-foreground">?</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl text-pretty">
            Steel yourself for a challenge like no other. In Prognos, your knowledge of PC gaming and industry intuition will be tested in a fierce battle for divining dominance. Can you unravel the future of games yet to come and prove yourself worthy of the gaming gear and glory that awaits the victors? Weave your prophecies and prepare...for Prognos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="text-lg px-8" style={{ backgroundColor: "#67e8f9", borderColor: "#67e8f9" }}>
              <Link href="/auth/sign-up">
                Start Predicting
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <a href="#how-it-works">Learn More</a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60 max-w-md">
            Participants are limited to the contiguous United States (excluding HI and AK). Must be 18 years or older to play. See terms and conditions for full contest rules.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            All successful seers shall follow these three steps on their path to seizing supremacy:
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { label: "Prepare", img: "/homepage/prepare.png", color: "#9D84D4", desc: "Knowledge is the cornerstone of a master prognosticator. Watch trailers, gameplay footage, and early impressions. Follow industry trends, learn developer history, and join gaming communities. Finally, craft the informed opinions needed to guide your hand. Only through a complete understanding can you hope to see the strands of a game's fate." },
            { label: "Predict", img: "/homepage/predict.png", color: "#4ade80", desc: "For each game featured in the season, you will predict its first-week peak player count and positive review percentage ahead of its Steam release. Employ boosters and rites to push your edge further. Build your own Top 8 ranking for games with the highest season-long peak player count, giving you the chance to rocket through the leaderboard in the final moments." },
            { label: "Prevail", img: "/homepage/prevail.png", color: "#f59e0b", desc: "Earn mana on your predictions and rise to the top of the season leaderboard. The best players win real prizes including PC gear and Steam giftcards. For the ultimate competitors, 1-in-500 players will be rewarded with a new gaming rig. If your fortunes flounder, do not despair: your mana balance and inventory carry over, allowing you to start the next season on a strong foot." },
          ].map(({ label, img, color, desc }) => (
            <div key={label} className="group relative rounded-xl overflow-hidden border border-border h-80">
              {/* Background image */}
              <img src={img} alt={label} className="absolute inset-0 w-full h-full object-cover" />

              {/* Permanent bottom-left vignette */}
              <div
                className="absolute inset-0"
                style={{ background: "radial-gradient(ellipse at bottom left, rgba(0,0,0,0.82) 0%, transparent 72%)" }}
              />

              {/* Hover vignette — fades in on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 35%, rgba(0,0,0,0.98) 100%)" }}
              />

              {/* Default: large single word */}
              <div
                className="absolute inset-x-0 bottom-0 z-10 p-5 group-hover:opacity-0 transition-opacity duration-200"
                style={{ textShadow: "0 2px 8px rgba(0,0,0,0.8)" }}
              >
                <div className="font-display text-4xl font-bold" style={{ color: "white", textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.6)" }}>{label}</div>
              </div>

              {/* Hover: description + label */}
              <div className="absolute inset-x-0 bottom-0 z-10 p-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="font-body text-sm text-stone-200 leading-snug mb-3 text-justify">{desc}</div>
                <div className="font-display text-2xl font-bold" style={{ color, textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 4px 16px rgba(0,0,0,0.6)" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Scoring Section */}
      <section className="border-y border-border bg-card/50">
        <div className="container py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Mana-Powered Scoring</h2>
              <p className="text-muted-foreground mb-8 text-justify">
                All mana earned contributes to your season score. Receive it for predictive accuracy and cunning use of active effects. Spend it to weave arcane magicks and purchase powerful tools that enhance your predictions further. Clever use of resources will make you a more formidable contestant as every decision shapes your standing.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#9D84D4" }} />
                  <div>
                    <div className="font-medium text-foreground">Week 1 Predictions</div>
                    <div className="text-sm text-muted-foreground">
                      Each game has two metrics: Week 1 peak player count and positive review score. Lock in . Either way, you're building mana.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#9D84D4" }} />
                  <div>
                    <div className="font-medium text-foreground">The Season Ladder</div>
                    <div className="text-sm text-muted-foreground">
                      Every season culminates in a Ladder reckoning — rank your top 8 games by predicted all-time peak players. Exact matches and long sequences earn massive mana payouts. A single well-called ladder can flip the entire standings.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#9D84D4" }} />
                  <div>
                    <div className="font-medium text-foreground">Equipment</div>
                    <div className="text-sm text-muted-foreground">
                      Choose a piece of arcane equipment at season start — each offers a distinct playstyle. As your equipment gains power through successful predictions, its benefits grow stronger, rewarding consistent play over the course of the season.
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "#9D84D4" }} />
                  <div>
                    <div className="font-medium text-foreground">Boosters & Rites</div>
                    <div className="text-sm text-muted-foreground">
                      Spend mana on consumable boosters and powerful rites to modify individual predictions — widen your windows, multiply your rewards, or divine where other players are calling it. True skill shows in how you deploy them.
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-xl overflow-hidden border border-border shadow-2xl">
              <img
                src="/guide/prediction-card-guide.png"
                alt="Prognos prediction card"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border bg-card/50">
        <div className="container py-24 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Prove Your Game Knowledge?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of players competing to predict the next gaming hits. 
            Season 1 registration opens soon.
          </p>
          <Button asChild size="lg" className="text-lg px-8" style={{ backgroundColor: "#67e8f9", borderColor: "#67e8f9" }}>
            <Link href="/auth/sign-up">
              Create Your Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <img src="/icons/game-name-logo.png" alt="Prognos" style={{ height: "36px", width: "auto", opacity: 0.7 }} />
              <span className="text-sm font-display" style={{ color: "#9D84D4" }}>Prepare. Predict. Prevail.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/rules" className="hover:text-foreground transition-colors">Rules</Link>
              <Link href="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
