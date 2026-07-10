import type { ReactNode } from "react"

export function QuickstartExampleFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-4">
      {children}
    </div>
  )
}
