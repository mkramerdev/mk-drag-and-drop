import type { ReactElement } from "react";

import { SortableList } from './react/sortableList'

export function App(): ReactElement {
  return (
    <main className="appShell">
      <SortableList/>
    </main>
  );
}
