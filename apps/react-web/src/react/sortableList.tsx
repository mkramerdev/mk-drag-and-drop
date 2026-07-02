import type { ReactElement } from "react";

import {
    DragProvider,
    type SortablePlacement,
} from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useSortable } from "@mk-drag-and-drop/react/use-sortable";
import { Menu } from "lucide-react";
import { centerToCenter } from "@mk-drag-and-drop/core";

const defaultItems = ["1", "2", "3", "4", "5"];
const storageKey = "mk-drag-and-drop:sortable-items:v2";
const sortableGroup = "sortable-demo";
const isolatedSortableGroup = "isolated-sortable-demo";
const items = loadItems();

export function SortableList(): ReactElement {
  return (
    <DragProvider
      targetingAlgorithm={centerToCenter}
      onDrop={({ itemId }, { getSortablePlacement }) => {
        const placement = getSortablePlacement(itemId);

        if (placement) {
            persistPlacement(placement);
        }
      }}
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
    const sortable = useSortable({
        itemId,
        group: getSortableGroup(itemId),
    });
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

function getSortableGroup(itemId: string): string {
    return itemId === "3" ? isolatedSortableGroup : sortableGroup;
}

function loadItems(): string[] {
    try {
        const serializedItems = localStorage.getItem(storageKey);

        if (!serializedItems) {
            return [...defaultItems];
        }

        const parsedItems: unknown = JSON.parse(serializedItems);

        if (!Array.isArray(parsedItems)) {
            return [...defaultItems];
        }

        const restoredItems = parsedItems.filter(
            (item): item is string => typeof item === "string",
        );

        return normalizeItems(restoredItems);
    } catch {
        return [...defaultItems];
    }
}

function persistPlacement(placement: SortablePlacement): void {
    const nextItems = items.filter((item) => item !== placement.itemId);

    if (placement.previousItemId !== null) {
        const previousIndex = nextItems.indexOf(placement.previousItemId);

        if (previousIndex === -1) {
            return;
        }

        nextItems.splice(previousIndex + 1, 0, placement.itemId);
    } else if (placement.nextItemId !== null) {
        const nextIndex = nextItems.indexOf(placement.nextItemId);

        if (nextIndex === -1) {
            return;
        }

        nextItems.splice(nextIndex, 0, placement.itemId);
    } else {
        nextItems.push(placement.itemId);
    }

    const normalizedItems = normalizeItems(nextItems);

    if (normalizedItems.length === 0) {
        return;
    }

    items.splice(0, items.length, ...normalizedItems);
    localStorage.setItem(storageKey, JSON.stringify(items));
}

function normalizeItems(nextItems: readonly string[]): string[] {
    const allowedItems = new Set(defaultItems);
    const normalizedItems: string[] = [];

    for (const item of nextItems) {
        if (!allowedItems.has(item) || normalizedItems.includes(item)) {
            continue;
        }

        normalizedItems.push(item);
    }

    for (const item of defaultItems) {
        if (!normalizedItems.includes(item)) {
            normalizedItems.push(item);
        }
    }

    return normalizedItems;
}
