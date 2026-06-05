import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

export function ScoreIcon({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <Trophy
      className={cn("text-amber-500 shrink-0", className)}
      style={{ width: size, height: size }}
    />
  )
}
