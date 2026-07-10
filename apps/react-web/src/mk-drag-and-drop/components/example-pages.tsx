"use client"

import { useEffect, useRef, type ReactElement } from "react"
import { ExampleTabs } from "./quickstart/example-tabs"
import { BasicDrag } from "../examples/basic-drag/basic-drag-react"
import { mountBasicDrag } from "../examples/basic-drag/basic-drag-dom"
import { GroupedExample } from "../examples/groups/grouped-example-react"
import { mountGroupedExample } from "../examples/groups/grouped-example-dom"
import { KanbanExample } from "../examples/kanban/kanban-example-react"
import { mountKanbanExample } from "../examples/kanban/kanban-example-dom"
import { SortableList } from "../examples/sortable-list/sortabe-example-react"
import { mountSortableList } from "../examples/sortable-list/sortable-example-dom"
import { TreeExample } from "../examples/tree/tree-example-react"
import { mountTreeExample } from "../examples/tree/tree-example-dom"

type MountDomExample = (root: HTMLElement) => () => void

export function BasicDragLiveExampleTabs() {
  return (
    <LiveExampleTabs
      dom={<MountedDomExample mount={mountBasicDrag} />}
      react={<BasicDrag />}
    />
  )
}

export function GroupedLiveExampleTabs() {
  return (
    <LiveExampleTabs
      dom={<MountedDomExample mount={mountGroupedExample} />}
      react={<GroupedExample />}
    />
  )
}

export function KanbanLiveExampleTabs() {
  return (
    <LiveExampleTabs
      dom={<MountedDomExample mount={mountKanbanExample} />}
      react={<KanbanExample />}
    />
  )
}

export function SortableListLiveExampleTabs() {
  return (
    <LiveExampleTabs
      dom={<MountedDomExample mount={mountSortableList} />}
      react={<SortableList />}
    />
  )
}

export function TreeLiveExampleTabs() {
  return (
    <LiveExampleTabs
      dom={<MountedDomExample mount={mountTreeExample} />}
      react={<TreeExample />}
    />
  )
}

function LiveExampleTabs({
  dom,
  react,
}: {
  dom: ReactElement
  react: ReactElement
}) {
  return (
    <ExampleTabs>
      {(activeTab) => (
        <div className="examplesLayout">
          {activeTab === "dom" ? dom : react}
        </div>
      )}
    </ExampleTabs>
  )
}

function MountedDomExample({ mount }: { mount: MountDomExample }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hostRef.current) return

    return mount(hostRef.current)
  }, [mount])

  return <div ref={hostRef} className="exampleDomMount" />
}
