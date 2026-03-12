import { NextRequest, NextResponse } from "next/server"
import { searchGames, getAppDetails } from "@/lib/steam"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 })
  }

  try {
    const results = await searchGames(query)
    
    // Fetch details for first 10 results to get images and release dates
    const detailedResults = await Promise.all(
      results.slice(0, 10).map(async (game) => {
        const details = await getAppDetails(game.appid)
        return {
          appid: game.appid,
          name: game.name,
          header_image: details?.header_image || null,
          release_date: details?.release_date?.date || null,
          coming_soon: details?.release_date?.coming_soon || false,
        }
      })
    )

    return NextResponse.json({ games: detailedResults })
  } catch (error) {
    console.error("[API] Steam search error:", error)
    return NextResponse.json({ error: "Failed to search games" }, { status: 500 })
  }
}
