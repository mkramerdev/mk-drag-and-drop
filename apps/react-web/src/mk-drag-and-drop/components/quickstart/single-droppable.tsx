"use client"

import { useEffect, useRef } from "react"
import { CodeTabs, ExampleTabs } from "./example-tabs"
import { QuickstartExampleFrame } from "./example-preview-frame"
import {
  mountSingleDroppableDomDemo,
  singleDroppableDomCode,
  type MountedSingleDroppableDomDemo,
} from "./single-droppable/dom"
import {
  SingleDroppableReactDemo,
  singleDroppableReactCode,
} from "./single-droppable/react"

export function SingleDroppableCodeTabs() {
  return (
    <CodeTabs
      domCode={singleDroppableDomCode}
      reactCode={singleDroppableReactCode}
    />
  )
}

export function SingleDroppableExampleTabs() {
  return (
    <ExampleTabs>
      {(activeTab) =>
        activeTab === "dom" ? (
          <QuickstartExampleFrame>
            <SingleDroppableDomDemo />
          </QuickstartExampleFrame>
        ) : (
          <QuickstartExampleFrame>
            <SingleDroppableReactDemo />
          </QuickstartExampleFrame>
        )
      }
    </ExampleTabs>
  )
}

function SingleDroppableDomDemo() {
  const hostRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<MountedSingleDroppableDomDemo | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const demo = mountSingleDroppableDomDemo(hostRef.current)
    demoRef.current = demo

    return () => {
      demo.destroy()
      demoRef.current = null
    }
  }, [])

  return <div ref={hostRef} className="flex flex-col items-center gap-3 sm:flex-row" />
}
