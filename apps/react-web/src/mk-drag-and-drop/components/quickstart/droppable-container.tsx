"use client"

import { useEffect, useRef } from "react"
import { CodeTabs, ExampleTabs } from "./example-tabs"
import { QuickstartExampleFrame } from "./example-preview-frame"
import {
  droppableContainerDomCode,
  mountDroppableContainerDomDemo,
  type MountedDroppableContainerDomDemo,
} from "./droppable-container/dom"
import {
  DroppableContainerReactDemo,
  droppableContainerReactCode,
} from "./droppable-container/react"

export function DroppableContainerCodeTabs() {
  return (
    <CodeTabs
      domCode={droppableContainerDomCode}
      reactCode={droppableContainerReactCode}
    />
  )
}

export function DroppableContainerExampleTabs() {
  return (
    <ExampleTabs>
      {(activeTab) =>
        activeTab === "dom" ? (
          <QuickstartExampleFrame>
            <DroppableContainerDomDemo />
          </QuickstartExampleFrame>
        ) : (
          <QuickstartExampleFrame>
            <DroppableContainerReactDemo />
          </QuickstartExampleFrame>
        )
      }
    </ExampleTabs>
  )
}

function DroppableContainerDomDemo() {
  const hostRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<MountedDroppableContainerDomDemo | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const demo = mountDroppableContainerDomDemo(hostRef.current)
    demoRef.current = demo

    return () => {
      demo.destroy()
      demoRef.current = null
    }
  }, [])

  return <div ref={hostRef} className="flex flex-col items-center gap-3 sm:flex-row" />
}
