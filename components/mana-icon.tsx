import { cn } from "@/lib/utils"

interface ManaIconProps {
  size?: number
  className?: string
}

export function ManaIcon({ size = 16, className }: ManaIconProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icons/mana-icon.png"
      alt="mana"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
    />
  )
}
