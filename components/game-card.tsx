import Link from "next/link"
import Image from "next/image"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, ThumbsUp, Calendar, Target } from "lucide-react"

interface GameCardProps {
  game: {
    id: string
    steam_appid: number
    name: string
    header_image_url: string | null
    release_date: string | null
    release_date_estimated: boolean
    genres: string[] | null
    developer: string | null
    is_released: boolean
    peak_24h_player_count: number | null
    review_score_positive: number | null
    review_score_negative: number | null
  }
  seasonId?: string
  hasPrediction?: boolean
  dimmed?: boolean
}

export function GameCard({ game, seasonId, hasPrediction, dimmed }: GameCardProps) {
  const reviewPercentage = game.review_score_positive && game.review_score_negative
    ? Math.round((game.review_score_positive / (game.review_score_positive + game.review_score_negative)) * 100)
    : null

  const releaseDate = game.release_date
    ? new Date(game.release_date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "TBA"

  return (
    <Card className={`overflow-hidden border-border bg-card transition-colors group ${dimmed ? "opacity-50 grayscale hover:opacity-70" : "hover:border-primary/50"}`}>
      <CardHeader className="p-0">
        <div className="relative aspect-[460/215] overflow-hidden">
          {game.header_image_url ? (
            <Image
              src={game.header_image_url}
              alt={game.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <span className="text-muted-foreground">No Image</span>
            </div>
          )}
          {game.is_released ? (
            <Badge className="absolute top-2 right-2 bg-success text-success-foreground">
              Released
            </Badge>
          ) : (
            <Badge variant="secondary" className="absolute top-2 right-2">
              Upcoming
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground line-clamp-1 text-lg">
            {game.name}
          </h3>
          {game.developer && (
            <p className="text-sm text-muted-foreground line-clamp-1">
              {game.developer}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {(game.genres || [])
            .filter((g): g is string => g !== null && g !== undefined && typeof g === "string" && g.trim().length > 0)
            .slice(0, 3)
            .map((genre, index) => (
              <Badge key={`genre-${game.id}-${index}`} variant="outline" className="text-xs">
                {genre}
              </Badge>
            ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{releaseDate}</span>
            {game.release_date_estimated && <span className="text-xs">(est.)</span>}
          </div>
          
          {game.is_released && (
            <div className="flex items-center gap-3">
              {game.peak_24h_player_count !== null && (
                <div className="flex items-center gap-1 text-muted-foreground" title="24h Peak Players">
                  <Users className="h-4 w-4" />
                  <span>{game.peak_24h_player_count.toLocaleString()}</span>
                </div>
              )}
              {reviewPercentage !== null && (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <ThumbsUp className="h-4 w-4" />
                  <span>{reviewPercentage}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <Button asChild className="w-full" variant={dimmed ? "ghost" : hasPrediction ? "outline" : "default"}>
          <Link href={`/games/${game.id}${seasonId ? `?season=${seasonId}` : ""}`}>
            <Target className="mr-2 h-4 w-4" />
            {dimmed ? "View Results" : hasPrediction ? "View Prediction" : "Make Prediction"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
