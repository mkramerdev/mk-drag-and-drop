import type { ReactElement } from "react";

import { DragProvider } from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useSortable } from "@mk-drag-and-drop/react/use-sortable";
import { Menu } from "lucide-react";
import { centerToCenter } from "@mk-drag-and-drop/core";

const items = ["1", "2", "3", "4", "5"];

export function SortableList(): ReactElement {
  return (
    <DragProvider
      targetingAlgorithm={centerToCenter}
      dragOverlay={({ itemId }) => (
        <div className="sortableOverlay">
            <div className="dragListHandle">
                <Menu />
            </div> 
            <span>Item {itemId}</span>
        </div>
      )}
    >
      <div className="sortableParent">
        {items.map((itemId) => (
          <SortableItem key={itemId} itemId={itemId} />
        ))}
      </div>
    </DragProvider>
  );
}

function SortableItem({ itemId }: { itemId: string }): ReactElement {
    const sortable = useSortable({ itemId });
    const dragHandle = useDragHandle()

    return (
        <div {...sortable} className="sortableItem">
            <div {...dragHandle} className="dragListHandle">
                <Menu />
            </div> 
            <span>Item {itemId}</span>   
        </div>
    );
}
