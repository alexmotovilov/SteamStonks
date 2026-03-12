import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Target, Trophy, Users, Gamepad2, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react"

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect("/dashboard")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="h-6 w-6" />
            <span className="text-lg font-bold text-foreground">Steam Stonks</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild>
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
            Predict the Next Big
            <span className="text-primary"> Gaming Hit</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl text-pretty">
            Compete against other players by predicting the success of upcoming PC game releases. 
            Score points based on accuracy and win real prizes including gaming PCs and Steam gift cards.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/auth/sign-up">
                Start Predicting
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link href="#how-it-works">
                Learn More
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border bg-card/50">
        <div className="container py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">500+</div>
              <div className="text-sm text-muted-foreground">Active Players</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">50+</div>
              <div className="text-sm text-muted-foreground">Games Per Season</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">$2,000+</div>
              <div className="text-sm text-muted-foreground">Prize Pool</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">10</div>
              <div className="text-sm text-muted-foreground">Winners Per Season</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">How It Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Simple gameplay, big rewards. Here&apos;s how you compete for prizes.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="border-border bg-card relative">
            <div className="absolute -top-4 left-6">
              <Badge className="bg-primary text-primary-foreground text-lg px-4 py-1">1</Badge>
            </div>
            <CardHeader className="pt-8">
              <Gamepad2 className="h-10 w-10 text-primary mb-4" />
              <CardTitle className="text-foreground">Pick Your Games</CardTitle>
              <CardDescription className="text-muted-foreground">
                Browse upcoming Steam releases and select games you want to predict. 
                Community can nominate games for each season.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card relative">
            <div className="absolute -top-4 left-6">
              <Badge className="bg-primary text-primary-foreground text-lg px-4 py-1">2</Badge>
            </div>
            <CardHeader className="pt-8">
              <Target className="h-10 w-10 text-primary mb-4" />
              <CardTitle className="text-foreground">Make Predictions</CardTitle>
              <CardDescription className="text-muted-foreground">
                Predict player counts and review scores for 1 week after release 
                and at season end. Narrower ranges earn more points.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border bg-card relative">
            <div className="absolute -top-4 left-6">
              <Badge className="bg-primary text-primary-foreground text-lg px-4 py-1">3</Badge>
            </div>
            <CardHeader className="pt-8">
              <Trophy className="h-10 w-10 text-primary mb-4" />
              <CardTitle className="text-foreground">Win Prizes</CardTitle>
              <CardDescription className="text-muted-foreground">
                Top 10 players each season win physical prizes. 
                Grand prize could be a gaming PC worth $1,000+!
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Scoring Section */}
      <section className="border-y border-border bg-card/50">
        <div className="container py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4">Strategic Scoring</h2>
              <p className="text-muted-foreground mb-8">
                Our scoring system rewards bold predictions and early conviction. 
                Multiple factors contribute to your point multiplier.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">Early Lock-In Bonus</div>
                    <div className="text-sm text-muted-foreground">
                      Lock predictions early for up to 2x multiplier
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">Narrow Range Bonus</div>
                    <div className="text-sm text-muted-foreground">
                      Tighter prediction ranges earn higher multipliers
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-foreground">Contrarian Bonus</div>
                    <div className="text-sm text-muted-foreground">
                      Correct predictions far from the crowd average score extra
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Example Scoring
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Base accuracy points</span>
                  <span className="font-mono text-foreground">+150</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Early lock-in (1.5x)</span>
                  <span className="font-mono text-foreground">+75</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted-foreground">Narrow range (1.3x)</span>
                  <span className="font-mono text-foreground">+45</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium text-foreground">Total Points</span>
                  <span className="font-mono text-lg font-bold text-primary">270</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Prize Pool Section */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-4">Real Prizes, Real Competition</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every season, the top 10 players win physical prizes funded by entry fees.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Card className="border-primary bg-gradient-to-b from-primary/10 to-transparent">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/20">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <Badge className="mb-2 w-fit mx-auto">1st Place</Badge>
              <CardTitle className="text-2xl text-foreground">Gaming PC</CardTitle>
              <CardDescription className="text-muted-foreground">
                High-end prebuilt worth $800-1000
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-secondary">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="mb-2 w-fit mx-auto">2nd Place</Badge>
              <CardTitle className="text-xl text-foreground">Gaming Peripherals</CardTitle>
              <CardDescription className="text-muted-foreground">
                Monitor or high-end gear worth $300-400
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-secondary">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="mb-2 w-fit mx-auto">3rd - 10th</Badge>
              <CardTitle className="text-xl text-foreground">Steam Gift Cards</CardTitle>
              <CardDescription className="text-muted-foreground">
                $25 - $200 based on placement
              </CardDescription>
            </CardHeader>
          </Card>
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
          <Button asChild size="lg" className="text-lg px-8">
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
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm">Steam Stonks - Predict. Compete. Win.</span>
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
