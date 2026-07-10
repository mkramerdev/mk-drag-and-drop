"use client"

import { useEffect, useRef } from "react"
import { CodeTabs, ExampleTabs } from "./example-tabs"
import { QuickstartExampleFrame } from "./example-preview-frame"
import {
  basicDragDomCode,
  mountBasicDragDomDemo,
  type MountedBasicDragDomDemo,
} from "./basic-drag/dom"
import {
  BasicDragReactDemo,
  basicDragReactCode,
} from "./basic-drag/react"

export function BasicDragCodeTabs() {
  return (
    <CodeTabs domCode={basicDragDomCode} reactCode={basicDragReactCode} />
  )
}

export function BasicDragExampleTabs() {
  return (
    <ExampleTabs>
      {(activeTab) =>
        activeTab === "dom" ? (
          <QuickstartExampleFrame>
            <BasicDragDomDemo />
          </QuickstartExampleFrame>
        ) : (
          <QuickstartExampleFrame>
            <BasicDragReactDemo />
          </QuickstartExampleFrame>
        )
      }
    </ExampleTabs>
  )
}

function BasicDragDomDemo() {
  const hostRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<MountedBasicDragDomDemo | null>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const demo = mountBasicDragDomDemo(hostRef.current)
    demoRef.current = demo

    return () => {
      demo.destroy()
      demoRef.current = null
    }
  }, [])

  return <div ref={hostRef} />
}
