import type { ReactElement } from "react";

import { SortableList } from './react/sortableList'
import { SortablePerformanceExample } from './react/sortablePerformanceExample'
import { BasicDrag } from './react/basicDrag'
import { DropzoneList } from './react/dropzoneList'
import { GroupedExample } from './react/groupedExample'
import { KanbanExample } from './react/kanbanExample'
import { TreeExample } from './react/treeExample'

type ExampleRoute = "examples" | "sortable-10k" | "not-found";

export function App(): ReactElement {
  const route = getCurrentRoute();

  return (
    <main className="appShell">
      {route === "sortable-10k" ? (
        <SortablePerformanceExample />
      ) : route === "examples" ? (
        <div className="examplesLayout">
          <SortableList/>
          <BasicDrag />
          <DropzoneList />
          <KanbanExample />
          <GroupedExample />
          <TreeExample />
        </div>
      ) : (
        <section className="examplePanel">
          <h2 className="exampleTitle">Not found</h2>
        </section>
      )}
    </main>
  );
}

function getCurrentRoute(): ExampleRoute {
  if (window.location.pathname === "/" || window.location.pathname === "") {
    return "examples";
  }

  if (window.location.pathname === "/sortable-10k") {
    return "sortable-10k";
  }

  return "not-found";
}
