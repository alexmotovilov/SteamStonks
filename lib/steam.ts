// Steam API Integration
// Documentation: https://partner.steamgames.com/doc/webapi

const STEAM_API_BASE = "https://api.steampowered.com"
const STEAM_STORE_BASE = "https://store.steampowered.com"

export interface SteamPlayerCount {
  player_count: number
}

export interface SteamAppDetails {
  type: string
  name: string
  steam_appid: number
  required_age: number
  is_free: boolean
  detailed_description: string
  about_the_game: string
  short_description: string
  header_image: string
  developers?: string[]
  publishers?: string[]
  release_date?: {
    coming_soon: boolean
    date: string
  }
  genres?: { id: string; description: string }[]
  categories?: { id: number; description: string }[]
}

export interface SteamReviewSummary {
  review_score: number
  review_score_desc: string
  total_positive: number
  total_negative: number
  total_reviews: number
}

/**
 * Get the current number of players for a game
 * @param appId Steam App ID
 */
export async function getPlayerCount(appId: number): Promise<number | null> {
  try {
    const url = `${STEAM_API_BASE}/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`
    const response = await fetch(url, { next: { revalidate: 60 } }) // Cache for 1 minute
    
    if (!response.ok) {
      console.error(`[Steam API] Failed to get player count for ${appId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    return data.response?.player_count ?? null
  } catch (error) {
    console.error(`[Steam API] Error getting player count for ${appId}:`, error)
    return null
  }
}

/**
 * Get detailed app info from Steam Store API
 * @param appId Steam App ID
 */
export async function getAppDetails(appId: number): Promise<SteamAppDetails | null> {
  try {
    const url = `${STEAM_STORE_BASE}/api/appdetails?appids=${appId}`
    const response = await fetch(url, { next: { revalidate: 3600 } }) // Cache for 1 hour

    if (!response.ok) {
      console.error(`[Steam API] Failed to get app details for ${appId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    
    if (!data[appId]?.success) {
      return null
    }

    return data[appId].data as SteamAppDetails
  } catch (error) {
    console.error(`[Steam API] Error getting app details for ${appId}:`, error)
    return null
  }
}

/**
 * Get review summary for a game
 * @param appId Steam App ID
 */
export async function getReviewSummary(appId: number): Promise<SteamReviewSummary | null> {
  try {
    const url = `${STEAM_STORE_BASE}/appreviews/${appId}?json=1&language=all&purchase_type=all`
    const response = await fetch(url, { next: { revalidate: 3600 } }) // Cache for 1 hour

    if (!response.ok) {
      console.error(`[Steam API] Failed to get reviews for ${appId}: ${response.status}`)
      return null
    }

    const data = await response.json()
    
    if (!data.success) {
      return null
    }

    const summary = data.query_summary
    return {
      review_score: summary.review_score,
      review_score_desc: summary.review_score_desc,
      total_positive: summary.total_positive,
      total_negative: summary.total_negative,
      total_reviews: summary.total_reviews,
    }
  } catch (error) {
    console.error(`[Steam API] Error getting reviews for ${appId}:`, error)
    return null
  }
}

/**
 * Search for games by name (uses Steam Store search)
 * Note: This is an unofficial endpoint
 * @param query Search term
 */
export async function searchGames(query: string): Promise<Array<{ appid: number; name: string }>> {
  try {
    const url = `${STEAM_STORE_BASE}/api/storesearch/?term=${encodeURIComponent(query)}&cc=us&l=en`
    const response = await fetch(url, { next: { revalidate: 300 } }) // Cache for 5 minutes

    if (!response.ok) {
      console.error(`[Steam API] Failed to search for "${query}": ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.items?.map((item: { id: number; name: string }) => ({
      appid: item.id,
      name: item.name,
    })) || []
  } catch (error) {
    console.error(`[Steam API] Error searching for "${query}":`, error)
    return []
  }
}

/**
 * Calculate review percentage (positive reviews / total reviews)
 */
export function calculateReviewPercentage(positive: number, negative: number): number {
  const total = positive + negative
  if (total === 0) return 0
  return Math.round((positive / total) * 100 * 100) / 100 // Round to 2 decimal places
}

/**
 * Parse Steam release date string to Date object
 * Steam dates can be in various formats: "Mar 15, 2024", "Q1 2024", "Coming Soon", etc.
 */
export function parseReleaseDate(dateStr: string): { date: Date | null; estimated: boolean } {
  if (!dateStr || dateStr.toLowerCase().includes("coming soon") || dateStr.toLowerCase().includes("tba")) {
    return { date: null, estimated: true }
  }

  // Try to parse quarter format (Q1 2024, etc.)
  const quarterMatch = dateStr.match(/Q(\d)\s*(\d{4})/)
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1])
    const year = parseInt(quarterMatch[2])
    const month = (quarter - 1) * 3 // Q1 = Jan, Q2 = Apr, etc.
    return { date: new Date(year, month, 15), estimated: true }
  }

  // Try standard date parse
  const parsed = new Date(dateStr)
  if (!isNaN(parsed.getTime())) {
    return { date: parsed, estimated: false }
  }

  return { date: null, estimated: true }
}
