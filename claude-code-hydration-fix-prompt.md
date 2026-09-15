# Task: Fix Radix hydration mismatch on /games page

## Error
The /games page throws a React hydration mismatch on the Tabs component:

```
aria-controls="radix-_R_4inebn9erlb_-content-current"  (client)
aria-controls="radix-_R_iatpet9erlb_-content-current"  (server)
```

This happens because Radix generates IDs based on component tree order during SSR,
and the new prediction data fetching code added above the Tabs component shifted
the hook/component count between server and client renders.

## Root cause
`app/(authenticated)/games/page.tsx` is a server component that passes data to a
client component containing the Tabs. The Tabs component (from shadcn/ui) uses
Radix UI internally which generates IDs that must match between server and client.
When a server component renders differently than expected on the client, Radix IDs shift.

## Fix
Extract the entire Tabs section (everything from `<Tabs ...>` to `</Tabs>`) from
`app/(authenticated)/games/page.tsx` into a new client component:

**New file: `components/games-tabs.tsx`**

```tsx
"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
// ... import everything else needed for the tabs content

interface GamesTabsProps {
  // Pass all required data as props from the server component
  // e.g. currentGames, pastGames, allGames, predMap, user, etc.
}

export function GamesTabs({ ... }: GamesTabsProps) {
  return (
    <Tabs defaultValue="current" className="space-y-6">
      {/* all existing tabs content here */}
    </Tabs>
  )
}
```

Then in `app/(authenticated)/games/page.tsx`, replace the `<Tabs>` block with:
```tsx
<GamesTabs
  currentGames={currentGames}
  pastGames={pastGames}
  allGames={allGames}
  predMap={predMap}
  // ... any other data the tabs need
/>
```

## Rules
- The server component (`games/page.tsx`) handles ALL data fetching — do not move
  any Supabase queries into the client component
- Pass everything as props to `GamesTabs`
- The `GamesTabs` component must have `"use client"` at the top
- Do not use `dynamic()` with `ssr: false` here — a proper client component boundary
  is the correct fix, not skipping SSR entirely
- Do not change any of the tab content, styling, or game tile rendering logic
- Do not change the prediction data fetching that was just added

## Verification
- Run `npx tsc --noEmit` — no new TypeScript errors
- Navigate to /games in the browser — no hydration mismatch in console
- All three tabs (Active Season / Past / All) still work correctly
- Prediction bands still appear on game tiles
