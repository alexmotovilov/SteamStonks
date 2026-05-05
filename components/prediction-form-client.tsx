"use client"

import dynamic from "next/dynamic"
import type { ComponentProps } from "react"
import type { PredictionForm as PredictionFormType } from "@/components/prediction-form"

const PredictionFormDynamic = dynamic(
  () => import("@/components/prediction-form").then(m => m.PredictionForm),
  {
    ssr: false,
    loading: () => (
      <div className="h-48 rounded-lg border border-border bg-secondary/20 animate-pulse" />
    ),
  }
)

export function PredictionFormClient(
  props: ComponentProps<typeof PredictionFormType>
) {
  return <PredictionFormDynamic {...props} />
}
