import type { ReactElement } from "react";

import { SortableList } from './react/sortableList'
import { BasicDrag } from './react/basicDrag'
import { DropzoneList } from './react/dropzoneList'

export function App(): ReactElement {
  return (
    <main className="appShell">
      <SortableList/>
      <BasicDrag />
      <DropzoneList />
    </main>
  );
}
