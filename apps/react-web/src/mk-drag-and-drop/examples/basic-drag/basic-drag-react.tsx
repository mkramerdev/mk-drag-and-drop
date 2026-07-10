import {
  DragProvider,
  maxPointerDistanceToRect,
  pointerToRectDistance,
  useDragHandle,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react";
import {
  useCallback,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

const dragHandleText = "\u22ee\u22ee";

const draggableItem = {
  draggableId: "draggable",
  label: "Item",
};

const rootContainer = {
  dropTargetId: "droppable-root",
  label: "Drop Back Here",
};

const droppableContainer = {
  dropTargetId: "droppable",
  label: "Drop Here",
};
// Example targeting: package helpers are configured with this demo's distance limit.
const basicTargetingConstraint = maxPointerDistanceToRect({ maxDistance: 96 });

type DraggableItemModel = typeof draggableItem;

type DropTargetElementRegistrar = (
  dropTargetId: string,
  element: HTMLElement | null,
) => void;

export function BasicDrag(): ReactElement {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dropTargetElementsRef = useRef(new Map<string, HTMLElement>());
  const activeDropTargetIdRef = useRef<string | null>(null);
  // Example state: the app owns item location.
  const [itemContainer, setItemContainer] = useState(
    rootContainer.dropTargetId,
  );

  const registerDropTargetElement = useCallback<DropTargetElementRegistrar>(
    (dropTargetId, element) => {
      const elements = dropTargetElementsRef.current;

      if (!element) {
        const previousElement = elements.get(dropTargetId);

        if (previousElement) {
          delete previousElement.dataset.basicActiveDropTarget;
        }

        elements.delete(dropTargetId);
        return;
      }

      elements.set(dropTargetId, element);

      if (activeDropTargetIdRef.current === dropTargetId) {
        element.dataset.basicActiveDropTarget = "true";
      } else {
        delete element.dataset.basicActiveDropTarget;
      }
    },
    [],
  );

  const setActiveDropTargetId = useCallback(
    (dropTargetId: string | null, isActive: boolean): void => {
      if (!dropTargetId) {
        return;
      }

      const element = dropTargetElementsRef.current.get(dropTargetId);

      if (!element) {
        return;
      }

      if (isActive) {
        element.dataset.basicActiveDropTarget = "true";
      } else {
        delete element.dataset.basicActiveDropTarget;
      }
    },
    [],
  );

  const updateActiveDropTargetId = useCallback(
    ({
      activeDropTargetId,
      previousDropTargetId,
    }: {
      activeDropTargetId: string | null;
      previousDropTargetId: string | null;
    }): void => {
      if (activeDropTargetId === previousDropTargetId) {
        return;
      }

      setActiveDropTargetId(previousDropTargetId, false);
      setActiveDropTargetId(activeDropTargetId, true);
      activeDropTargetIdRef.current = activeDropTargetId;
    },
    [setActiveDropTargetId],
  );

  const clearActiveDropTargetId = useCallback((): void => {
    setActiveDropTargetId(activeDropTargetIdRef.current, false);
    activeDropTargetIdRef.current = null;
  }, [setActiveDropTargetId]);

  return (
    // Package API: DragProvider owns drag lifecycle and runtime configuration.
    <DragProvider
      targetingAlgorithm={pointerToRectDistance}
      targetingConstraint={basicTargetingConstraint}
      dragOverlay={(input) => (
        <BasicDragOverlay draggableId={input.dragState.draggableId} />
      )}
      onDragStart={() => {
        clearActiveDropTargetId();
      }}
      onDragUpdate={({ activeDropTargetId, previousDropTargetId }) => {
        updateActiveDropTargetId({
          activeDropTargetId,
          previousDropTargetId,
        });
      }}
      onDragEnd={() => {
        clearActiveDropTargetId();
      }}
      onDrop={({ draggableId, dropTargetId }) => {
        // Example drop behavior: commit the package drop result into app state.
        if (
          draggableId !== draggableItem.draggableId ||
          !isKnownDropTarget(dropTargetId)
        ) {
          return;
        }

        if (dropTargetId === itemContainer) {
          return;
        }

        setItemContainer(dropTargetId);
      }}
    >
      <div ref={rootRef} className="draggableItemContainer">
        <DroppableContainer
          dropTargetId={rootContainer.dropTargetId}
          registerDropTargetElement={registerDropTargetElement}
        >
          <span>{rootContainer.label}</span>
          {itemContainer === rootContainer.dropTargetId ? (
            <DraggableItem item={draggableItem} />
          ) : null}
        </DroppableContainer>
        <DroppableContainer
          dropTargetId={droppableContainer.dropTargetId}
          registerDropTargetElement={registerDropTargetElement}
        >
          <span>{droppableContainer.label}</span>
          {itemContainer === droppableContainer.dropTargetId ? (
            <DraggableItem item={draggableItem} />
          ) : null}
        </DroppableContainer>
      </div>
    </DragProvider>
  );
}

// Example rendering: overlay markup is app-owned.
function BasicDragOverlay({
  draggableId,
}: {
  draggableId: string;
}): ReactElement {
  return (
    <div className="sortableOverlay">
      <div className="dragListHandle">{dragHandleText}</div>
      <span>{getDraggableItemLabel(draggableId)}</span>
    </div>
  );
}

// Example rendering: this item UI is replaceable; hooks wire it to the package.
function DraggableItem({ item }: { item: DraggableItemModel }): ReactElement {
  // Package API: registers this rendered element and handle as draggable.
  const draggable = useDraggable({
    draggableId: item.draggableId,
    group: "basic",
  });
  const dragHandle = useDragHandle();

  return (
    <div {...draggable} className="sortableItem">
      <div {...dragHandle} className="dragListHandle">
        {dragHandleText}
      </div>
      <span>{item.label}</span>
    </div>
  );
}

function isKnownDropTarget(dropTargetId: string): boolean {
  return (
    dropTargetId === rootContainer.dropTargetId ||
    dropTargetId === droppableContainer.dropTargetId
  );
}

function DroppableContainer({
  dropTargetId,
  children,
  registerDropTargetElement,
}: {
  dropTargetId: string;
  children: ReactNode;
  registerDropTargetElement: DropTargetElementRegistrar;
}): ReactElement {
  // Package API: registers this rendered container as a drop target.
  const droppable = useDroppable({
    dropTargetId,
    group: "basic",
  });
  const { ref, ...droppableProps } = droppable;
  const elementRef = useCallback(
    (element: HTMLDivElement | null) => {
      ref(element);
      registerDropTargetElement(dropTargetId, element);
    },
    [ref, registerDropTargetElement, dropTargetId],
  );

  return (
    <div
      {...droppableProps}
      ref={elementRef}
      className="droppableContainer"
      data-basic-drop-target-id={dropTargetId}
    >
      {children}
    </div>
  );
}

function getDraggableItemLabel(draggableId: string): string {
  return draggableId === draggableItem.draggableId ? draggableItem.label : "";
}
