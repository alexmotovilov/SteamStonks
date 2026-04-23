import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldBan } from "lucide-react"

export default function BannedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-destructive/10 w-fit">
            <ShieldBan className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-foreground">Account Suspended</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your account has been suspended and you no longer have access to SteamStonks.
          </p>
          <p className="text-sm text-muted-foreground">
            If you believe this is a mistake, please contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
