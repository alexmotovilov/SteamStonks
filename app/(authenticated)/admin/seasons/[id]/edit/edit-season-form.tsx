"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Calendar, Loader2, ArrowLeft, Trophy, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface Season {
  id: string
  name: string
  slug: string | null
  description: string | null
  start_date: string
  end_date: string
  prediction_lock_date: string | null
  entry_fee_tokens: number
  status: string
}

const statusColors: Record<string, string> = {
  upcoming: "bg-blue-500/20 text-blue-400 border-blue-500/50",
  active: "bg-success/20 text-success border-success/50",
  scoring: "bg-warning/20 text-warning border-warning/50",
  completed: "bg-muted text-muted-foreground border-border",
}

// Format a UTC date string to local datetime-local input value (YYYY-MM-DDTHH:MM)
function toDatetimeLocal(value: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  // datetime-local needs YYYY-MM-DDTHH:MM in local time
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Format a UTC date string to date input value (YYYY-MM-DD)
function toDateInput(value: string | null): string {
  if (!value) return ""
  return new Date(value).toISOString().split("T")[0]
}

export function EditSeasonForm({ season }: { season: Season }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: season.name,
    slug: season.slug ?? "",
    description: season.description ?? "",
    start_date: toDateInput(season.start_date),
    end_date: toDateInput(season.end_date),
    prediction_lock_date: toDatetimeLocal(season.prediction_lock_date),
    entry_fee_tokens: season.entry_fee_tokens,
  })

  const isCompleted = season.status === "completed"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      if (!formData.name || !formData.start_date || !formData.end_date) {
        throw new Error("Name, start date, and end date are required")
      }

      if (new Date(formData.start_date) >= new Date(formData.end_date)) {
        throw new Error("End date must be after start date")
      }

      if (
        formData.prediction_lock_date &&
        new Date(formData.prediction_lock_date) >= new Date(formData.end_date)
      ) {
        throw new Error("Prediction lock date must be before the end date")
      }

      const supabase = createClient()

      const { error: updateError } = await supabase
        .from("seasons")
        .update({
          name: formData.name,
          slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
          description: formData.description || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          prediction_lock_date: formData.prediction_lock_date || null,
          entry_fee_tokens: formData.entry_fee_tokens,
          updated_at: new Date().toISOString(),
        })
        .eq("id", season.id)

      if (updateError) {
        if (updateError.message.includes("duplicate")) {
          throw new Error("A season with this slug already exists")
        }
        throw updateError
      }

      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/admin/seasons/${season.id}`}>
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">Edit Season</h1>
              <Badge className={statusColors[season.status]}>
                {season.status.charAt(0).toUpperCase() + season.status.slice(1)}
              </Badge>
            </div>
            <p className="text-muted-foreground">{season.name}</p>
          </div>
        </div>
      </div>

      {isCompleted && (
        <Alert className="border-warning/50 bg-warning/10">
          <AlertDescription className="text-warning">
            This season is completed. Changes to dates and entry fees are saved but have no effect on scoring or rankings.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Basic Information</CardTitle>
              <CardDescription className="text-muted-foreground">
                Name and description for the season
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {saved && (
                <Alert className="border-success/50 bg-success/10">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertDescription className="text-success">
                    Changes saved successfully
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Season Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-foreground">URL Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Used in URLs. Changing this won&apos;t break existing links since routes use the season ID.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-input border-border text-foreground min-h-24"
                  placeholder="Describe this season..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Dates & Settings */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Dates & Settings</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure timing and entry requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-foreground">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-foreground">End Date *</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="bg-input border-border text-foreground"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prediction_lock_date" className="text-foreground">
                  Prediction Lock Date
                </Label>
                <Input
                  id="prediction_lock_date"
                  type="datetime-local"
                  value={formData.prediction_lock_date}
                  onChange={(e) =>
                    setFormData({ ...formData, prediction_lock_date: e.target.value })
                  }
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  After this date, players cannot modify their season_end predictions
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_fee" className="text-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Entry Fee (tokens) (Tokens)
                </Label>
                <Input
                  id="entry_fee"
                  type="number"
                  min={0}
                  value={formData.entry_fee_tokens}
                  onChange={(e) =>
                    setFormData({ ...formData, entry_fee_tokens: parseInt(e.target.value) || 0 })
                  }
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Only affects new entries — players who already joined are unaffected
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Button asChild variant="outline">
            <Link href={`/admin/seasons/${season.id}`}>Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
