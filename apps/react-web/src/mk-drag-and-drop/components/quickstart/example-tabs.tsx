"use client"

import { useState, type ReactNode } from "react"
import { highlight } from "sugar-high"
import { cn } from "@repo/shared"

type ExampleTab = {
  label: string
  value: string
}

const tabs: ExampleTab[] = [
  { label: "DOM", value: "dom" },
  { label: "React", value: "react" },
]

const defaultTab = "dom"

export function ExampleTabs({
  children,
}: {
  children: (activeTab: string) => ReactNode
}) {
  const [activeTab, setActiveTab] = useState(defaultTab)

  return (
    <div className="not-prose my-6 overflow-hidden rounded-md border border-border bg-card">
      <TabList activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="p-4">{children(activeTab)}</div>
    </div>
  )
}

export function CodeTabs({
  domCode,
  reactCode,
}: {
  domCode: string
  reactCode: string
}) {
  return (
    <ExampleTabs>
      {(activeTab) => (
        <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-4 text-sm">
          <code
            dangerouslySetInnerHTML={{
              __html: highlight(activeTab === "dom" ? domCode : reactCode),
            }}
          />
        </pre>
      )}
    </ExampleTabs>
  )
}

function TabList({
  activeTab,
  onTabChange,
}: {
  activeTab: string
  onTabChange: (value: string) => void
}) {
  return (
    <div className="flex border-b border-border bg-muted/20 px-2 pt-2">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={cn(
            "cursor-pointer rounded-t-md border border-transparent border-b-transparent px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            activeTab === tab.value &&
              "border-border border-b-card bg-card text-foreground"
          )}
          onClick={() => onTabChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
