"use client"

console.log("[v0] NewSeasonPage module loaded")

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar, Loader2, ArrowLeft, Trophy } from "lucide-react"
import Link from "next/link"

export default function NewSeasonPage() {
  console.log("[v0] NewSeasonPage component rendering")
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    start_date: "",
    end_date: "",
    prediction_lock_date: "",
    entry_fee_points: 100,
  })

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
    setFormData({ ...formData, name, slug })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Validation
      if (!formData.name || !formData.start_date || !formData.end_date) {
        throw new Error("Name, start date, and end date are required")
      }

      if (new Date(formData.start_date) >= new Date(formData.end_date)) {
        throw new Error("End date must be after start date")
      }

      const supabase = createClient()
      
      const { error: insertError } = await supabase.from("seasons").insert({
        name: formData.name,
        slug: formData.slug || formData.name.toLowerCase().replace(/\s+/g, "-"),
        description: formData.description || null,
        start_date: formData.start_date,
        end_date: formData.end_date,
        prediction_lock_date: formData.prediction_lock_date || null,
        entry_fee_points: formData.entry_fee_points,
        status: "upcoming",
      })

      if (insertError) {
        if (insertError.message.includes("duplicate")) {
          throw new Error("A season with this slug already exists")
        }
        throw insertError
      }

      router.push("/admin/seasons")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create season")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/seasons">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create Season</h1>
            <p className="text-muted-foreground">Set up a new seasonal competition</p>
          </div>
        </div>
      </div>

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

              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Season Name *</Label>
                <Input
                  id="name"
                  placeholder="Summer 2026"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug" className="text-foreground">URL Slug</Label>
                <Input
                  id="slug"
                  placeholder="summer-2026"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-generated from name. Used in URLs.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Predict the biggest releases of the summer season..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-input border-border text-foreground min-h-24"
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
                  onChange={(e) => setFormData({ ...formData, prediction_lock_date: e.target.value })}
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  After this date, players cannot modify their predictions
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entry_fee" className="text-foreground flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  Entry Fee (Points)
                </Label>
                <Input
                  id="entry_fee"
                  type="number"
                  min={0}
                  value={formData.entry_fee_points}
                  onChange={(e) => setFormData({ ...formData, entry_fee_points: parseInt(e.target.value) || 0 })}
                  className="bg-input border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">
                  Points deducted from player balance when joining. Set to 0 for free entry.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4 mt-6">
          <Button asChild variant="outline">
            <Link href="/admin/seasons">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Season"
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
