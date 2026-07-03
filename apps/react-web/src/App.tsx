import type { ReactElement } from "react";

import { SortableList } from './react/sortableList'
import { BasicDrag } from './react/basicDrag'
import { DropzoneList } from './react/dropzoneList'
import { GroupedExample } from './react/groupedExample'
import { TreeExample } from './react/treeExample'

export function App(): ReactElement {
  return (
    <main className="appShell">
      <div className="examplesLayout">
        <SortableList/>
        <BasicDrag />
        <DropzoneList />
        <GroupedExample />
        <TreeExample />
      </div>
    </main>
  );
}
