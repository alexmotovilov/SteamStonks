import { NextRequest, NextResponse } from "next/server"
import { getAppDetails, getPlayerCount, getReviewSummary, calculateReviewPercentage } from "@/lib/steam"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appid: string }> }
) {
  const { appid } = await params
  const appId = parseInt(appid)

  if (isNaN(appId)) {
    return NextResponse.json({ error: "Invalid app ID" }, { status: 400 })
  }

  try {
    const [details, playerCount, reviews] = await Promise.all([
      getAppDetails(appId),
      getPlayerCount(appId),
      getReviewSummary(appId),
    ])

    if (!details) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 })
    }

    const reviewPercentage = reviews
      ? calculateReviewPercentage(reviews.total_positive, reviews.total_negative)
      : null

    return NextResponse.json({
      appid: appId,
      name: details.name,
      header_image: details.header_image,
      short_description: details.short_description,
      developers: details.developers || [],
      publishers: details.publishers || [],
      genres: details.genres?.map((g) => g.description) || [],
      release_date: details.release_date?.date || null,
      coming_soon: details.release_date?.coming_soon || false,
      player_count: playerCount,
      reviews: reviews
        ? {
            score: reviews.review_score,
            description: reviews.review_score_desc,
            positive: reviews.total_positive,
            negative: reviews.total_negative,
            total: reviews.total_reviews,
            percentage: reviewPercentage,
          }
        : null,
    })
  } catch (error) {
    console.error(`[API] Failed to get game ${appId}:`, error)
    return NextResponse.json({ error: "Failed to fetch game details" }, { status: 500 })
  }
}
