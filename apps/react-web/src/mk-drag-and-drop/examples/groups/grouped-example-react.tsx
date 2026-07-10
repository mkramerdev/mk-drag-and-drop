import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

import {
  DragProvider,
  getDistanceToRect,
  useRemeasureDropTargets,
  useDragHandle,
  useDraggable,
  useDroppable,
  useSortable,
  type DropEvent,
  type DragPoint,
  type DragRect,
  type DragState,
  type SortableDropPlacement,
  type TargetingConstraint,
  centerToCenter,
} from "@mk-drag-and-drop/react";

type ParentItem = {
  parentId: string;
  label: string;
};

type ChildItem = {
  childId: string;
  parentId: string;
  label: string;
};

type ParsedChildDropTarget =
  | {
      type: "inside";
      parentId: string;
    }
  | {
      type: "index";
      parentId: string;
      index: number;
    };

type DropTargetElementRegistrar = (
  dropTargetId: string,
  element: HTMLElement | null,
) => void;

const groupedParentGroup = "grouped-parents";
const groupedChildGroup = "grouped-children";
const groupedInsideTargetPrefix = "grouped:children:inside:";
const groupedChildTargetPrefix = "grouped:children:";
const groupedInsideTargetMaxYDistance = 0;
const groupedChildLineTargetMaxYDistance = 24;
const dragHandleText = "\u22ee\u22ee";

// Example targeting: custom rules decide which grouped drop targets are eligible.
const groupedTargetingConstraint: TargetingConstraint = ({
  overlayRect,
  dropTarget,
}) => {
  if (!overlayRect) {
    return false;
  }

  const overlayCenter = getRectCenter(overlayRect);
  const dropTargetId = dropTarget.dropTargetId;

  if (dropTargetId.startsWith(groupedInsideTargetPrefix)) {
    const distance = getDistanceToRect(
      overlayCenter,
      dropTarget.dropTargetRect,
    );

    return distance.x === 0 && distance.y <= groupedInsideTargetMaxYDistance;
  }

  const parsedTarget = parseChildDropTargetId(dropTargetId);

  if (parsedTarget?.type === "index") {
    const distance = getDistanceToRect(
      overlayCenter,
      dropTarget.dropTargetRect,
    );

    return distance.x === 0 && distance.y <= groupedChildLineTargetMaxYDistance;
  }

  if (dropTargetId.startsWith(groupedChildTargetPrefix)) {
    return false;
  }

  return true;
};

// Example state: seed data and order arrays are owned by this demo.
const initialParentsById: Record<string, ParentItem> = {
  "parent-roadmap": {
    parentId: "parent-roadmap",
    label: "Roadmap",
  },
  "parent-research": {
    parentId: "parent-research",
    label: "Research",
  },
  "parent-release": {
    parentId: "parent-release",
    label: "Release",
  },
  "parent-ops": {
    parentId: "parent-ops",
    label: "Operations",
  },
};

const initialChildrenById: Record<string, ChildItem> = {
  "child-pricing": {
    childId: "child-pricing",
    parentId: "parent-roadmap",
    label: "Pricing packaging",
  },
  "child-onboarding": {
    childId: "child-onboarding",
    parentId: "parent-roadmap",
    label: "Team onboarding",
  },
  "child-metrics": {
    childId: "child-metrics",
    parentId: "parent-research",
    label: "Metric interviews",
  },
  "child-prototype": {
    childId: "child-prototype",
    parentId: "parent-research",
    label: "Prototype review",
  },
  "child-qA": {
    childId: "child-qA",
    parentId: "parent-release",
    label: "QA checklist",
  },
  "child-notes": {
    childId: "child-notes",
    parentId: "parent-release",
    label: "Release notes",
  },
  "child-runbook": {
    childId: "child-runbook",
    parentId: "parent-ops",
    label: "Incident runbook",
  },
};

const initialParentOrder = [
  "parent-roadmap",
  "parent-research",
  "parent-release",
  "parent-ops",
];

const initialChildOrder = [
  "child-pricing",
  "child-onboarding",
  "child-metrics",
  "child-prototype",
  "child-qA",
  "child-notes",
  "child-runbook",
];

export function GroupedExample(): ReactElement {
  const rootRef = useRef<HTMLElement | null>(null);
  const dropTargetElementsRef = useRef(new Map<string, HTMLElement>());
  const activeDropTargetIdRef = useRef<string | null>(null);
  // Example state: parent/child data, expansion, and active styling are app-owned.
  const [parentsById] = useState<Record<string, ParentItem>>(
    () => initialParentsById,
  );
  const [childrenById, setChildrenById] =
    useState<Record<string, ChildItem>>(() => initialChildrenById);
  const [parentOrder, setParentOrder] = useState<string[]>(
    () => initialParentOrder,
  );
  const [childOrder, setChildOrder] = useState<string[]>(
    () => initialChildOrder,
  );
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(
    () => new Set(["parent-roadmap", "parent-release"]),
  );
  const [activeDraggedParentId, setActiveDraggedParentId] = useState<
    string | null
  >(null);

  const registerDropTargetElement = useCallback<DropTargetElementRegistrar>(
    (dropTargetId, element) => {
      const elements = dropTargetElementsRef.current;

      if (!element) {
        const previousElement = elements.get(dropTargetId);

        if (previousElement) {
          delete previousElement.dataset.groupedActiveDropTarget;
        }

        elements.delete(dropTargetId);
        return;
      }

      elements.set(dropTargetId, element);

      if (activeDropTargetIdRef.current === dropTargetId) {
        element.dataset.groupedActiveDropTarget = "true";
      } else {
        delete element.dataset.groupedActiveDropTarget;
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
        element.dataset.groupedActiveDropTarget = "true";
      } else {
        delete element.dataset.groupedActiveDropTarget;
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

  function handleDrop(event: DropEvent): void {
    // Example drop behavior: interpret package placement/drop target ids for grouped data.
    if (parentsById[event.draggableId]) {
      const placement = event.sortablePlacement;

      if (placement) {
        setParentOrder((currentOrder) =>
          reorderParentOrder(currentOrder, event.draggableId, placement),
        );
      }

      return;
    }

    const child = childrenById[event.draggableId];

    if (!child) {
      return;
    }

    const parsedTarget = parseChildDropTargetId(event.dropTargetId);

    if (!parsedTarget || !parentsById[parsedTarget.parentId]) {
      return;
    }

    const targetIndex =
      parsedTarget.type === "inside" ? 0 : parsedTarget.index;
    const targetParentChildren = getChildrenForParent({
      parentId: parsedTarget.parentId,
      childOrder,
      childrenById,
    });

    if (targetIndex < 0 || targetIndex > targetParentChildren.length) {
      return;
    }

    const nextChildOrder = moveChildInOrder({
      child,
      targetParentId: parsedTarget.parentId,
      targetIndex,
      childOrder,
      childrenById,
    });

    setChildrenById({
      ...childrenById,
      [child.childId]: {
        ...child,
        parentId: parsedTarget.parentId,
      },
    });
    setChildOrder(nextChildOrder);
  }

  return (
    // Package API: DragProvider owns drag lifecycle and runtime configuration.
    <DragProvider
      targetingAlgorithm={centerToCenter}
      targetingConstraint={groupedTargetingConstraint}
      pointerConfiguration={{ activationDelay: 100 }}
      dragOverlay={({ dragState }) => (
        <GroupedDragOverlay
          dragState={dragState}
          parentsById={parentsById}
          childrenById={childrenById}
        />
      )}
      onDragStart={({ draggableId }) => {
        clearActiveDropTargetId();
        setActiveDraggedParentId(parentsById[draggableId] ? draggableId : null);
      }}
      onDragUpdate={({ activeDropTargetId, previousDropTargetId }) => {
        updateActiveDropTargetId({
          activeDropTargetId,
          previousDropTargetId,
        });
      }}
      onDragEnd={() => {
        clearActiveDropTargetId();
        setActiveDraggedParentId(null);
      }}
      onDrop={handleDrop}
    >
      <section ref={rootRef} className="examplePanel groupedExamplePanel">
        <div className="groupedExample">
          {parentOrder.map((parentId) => {
            const parent = parentsById[parentId];

            if (!parent) {
              return null;
            }

            const children = getChildrenForParent({
              parentId,
              childOrder,
              childrenById,
            });

            return (
              <GroupedParentBlock
                key={parentId}
                parent={parent}
                children={children}
                expandedParentIds={expandedParentIds}
                setExpandedParentIds={setExpandedParentIds}
                isActivelyDragged={activeDraggedParentId === parentId}
                registerDropTargetElement={registerDropTargetElement}
              />
            );
          })}
        </div>
      </section>
    </DragProvider>
  );
}

// Example rendering: overlay markup is app-owned and derives from drag state.
function GroupedDragOverlay({
  dragState,
  parentsById,
  childrenById,
}: {
  dragState: DragState;
  parentsById: Record<string, ParentItem>;
  childrenById: Record<string, ChildItem>;
}): ReactElement {
  if (
    dragState.group !== groupedParentGroup &&
    dragState.group !== groupedChildGroup
  ) {
    return <div className="groupedDragOverlay" />;
  }

  if (dragState.group === groupedParentGroup) {
    const parent = parentsById[dragState.draggableId];

    return (
      <div className="groupedDragOverlay groupedParentDragOverlay">
        <div className="groupedDragOverlayHandle">
          {dragHandleText}
        </div>
        <span className="groupedParentLabel">{parent?.label ?? ""}</span>
      </div>
    );
  }

  const child = childrenById[dragState.draggableId];

  return (
    <div className="groupedDragOverlay groupedChildDragOverlay">
      <div className="groupedDragOverlayHandle">
        {dragHandleText}
      </div>
      <span className="groupedChildLabel">{child?.label ?? ""}</span>
    </div>
  );
}

// Example rendering: parent block markup is app-owned; hooks wire it to the package.
function GroupedParentBlock({
  parent,
  children,
  expandedParentIds,
  setExpandedParentIds,
  isActivelyDragged,
  registerDropTargetElement,
}: {
  parent: ParentItem;
  children: ChildItem[];
  expandedParentIds: Set<string>;
  setExpandedParentIds: (
    update: (currentExpandedParentIds: Set<string>) => Set<string>,
  ) => void;
  isActivelyDragged: boolean;
  registerDropTargetElement: DropTargetElementRegistrar;
}): ReactElement {
  // Package API: parent rows are sortable and also accept child drops.
  const sortable = useSortable({
    draggableId: parent.parentId,
    group: groupedParentGroup,
  });
  const dragHandle = useDragHandle<HTMLButtonElement>();
  const insideDropTargetId = getInsideDropTargetId(parent.parentId);
  const insideDroppable = useDroppable({
    dropTargetId: insideDropTargetId,
    group: groupedChildGroup,
    containerId: parent.parentId,
  });
  const remeasureDropTargets = useRemeasureDropTargets();
  const hasChildren = children.length > 0;
  const isExpanded =
    hasChildren &&
    expandedParentIds.has(parent.parentId) &&
    !isActivelyDragged;
  const { ref: sortableRef, ...sortableProps } = sortable;
  const { ref: insideDroppableRef, ...insideDroppableProps } =
    insideDroppable;
  const parentBlockRef = useCallback(
    (element: HTMLDivElement | null) => {
      sortableRef(element);
      registerDropTargetElement(parent.parentId, element);
    },
    [parent.parentId, registerDropTargetElement, sortableRef],
  );
  const insideTargetRef = useCallback(
    (element: HTMLDivElement | null) => {
      insideDroppableRef(element);
      registerDropTargetElement(insideDropTargetId, element);
    },
    [insideDroppableRef, insideDropTargetId, registerDropTargetElement],
  );

  useLayoutEffect(() => {
    if (!isActivelyDragged) {
      return;
    }

    // Package API: remeasure after demo-owned expansion changes affect targets.
    remeasureDropTargets({ group: groupedParentGroup });
    remeasureDropTargets({ group: groupedChildGroup });
  }, [isActivelyDragged, remeasureDropTargets]);

  function toggleExpanded(): void {
    setExpandedParentIds((currentExpandedParentIds) => {
      const nextExpandedParentIds = new Set(currentExpandedParentIds);

      if (nextExpandedParentIds.has(parent.parentId)) {
        nextExpandedParentIds.delete(parent.parentId);
      } else {
        nextExpandedParentIds.add(parent.parentId);
      }

      return nextExpandedParentIds;
    });

    window.requestAnimationFrame(() => {
      remeasureDropTargets({ group: groupedParentGroup });
      remeasureDropTargets({ group: groupedChildGroup });
    });
  }

  return (
    <div
      {...sortableProps}
      ref={parentBlockRef}
      className="groupedParentBlock"
      data-grouped-drop-target-id={parent.parentId}
      data-grouped-dragged={isActivelyDragged ? "true" : undefined}
    >
      <div
        {...insideDroppableProps}
        ref={insideTargetRef}
        className="groupedParentRow"
        data-grouped-drop-target-id={insideDropTargetId}
      >
        <button
          {...dragHandle}
          type="button"
          className="groupedDragHandle"
          aria-label="Drag parent"
        >
          {dragHandleText}
        </button>
        <span className="groupedParentLabel">{parent.label}</span>
        <button
          type="button"
          className="groupedParentToggle"
          onClick={toggleExpanded}
          disabled={!hasChildren}
          aria-label={isExpanded ? "Collapse parent" : "Expand parent"}
        >
          {hasChildren ? (isExpanded ? "v" : ">") : null}
        </button>
      </div>

      {isExpanded ? (
        <div className="groupedChildList">
          {children.map((child, index) => (
            <Fragment key={child.childId}>
              <GroupedChildDropzoneLine
                parentId={parent.parentId}
                index={index}
                registerDropTargetElement={registerDropTargetElement}
              />
              <GroupedChildRow child={child} />
            </Fragment>
          ))}
          <GroupedChildDropzoneLine
            parentId={parent.parentId}
            index={children.length}
            registerDropTargetElement={registerDropTargetElement}
          />
        </div>
      ) : null}
    </div>
  );
}

// Example rendering: insertion line markup is app-owned; droppable hook registers it.
function GroupedChildDropzoneLine({
  parentId,
  index,
  registerDropTargetElement,
}: {
  parentId: string;
  index: number;
  registerDropTargetElement: DropTargetElementRegistrar;
}): ReactElement {
  // Package API: registers this generated child insertion line as a drop target.
  const dropTargetId = getChildIndexDropTargetId(parentId, index);
  const droppable = useDroppable({
    dropTargetId,
    group: groupedChildGroup,
    containerId: parentId,
  });
  const { ref, ...droppableProps } = droppable;
  const lineRef = useCallback(
    (element: HTMLDivElement | null) => {
      ref(element);
      registerDropTargetElement(dropTargetId, element);
    },
    [ref, registerDropTargetElement, dropTargetId],
  );

  return (
    <div
      {...droppableProps}
      ref={lineRef}
      className="groupedChildDropzoneLine"
      data-grouped-drop-target-id={dropTargetId}
    >
      <div className="groupedChildDropzoneIndicator" />
    </div>
  );
}

// Example rendering: child row markup is app-owned; hooks wire it to the package.
function GroupedChildRow({ child }: { child: ChildItem }): ReactElement {
  // Package API: registers this rendered child row and handle as draggable.
  const draggable = useDraggable({
    draggableId: child.childId,
    group: groupedChildGroup,
  });
  const dragHandle = useDragHandle<HTMLButtonElement>();

  return (
    <div {...draggable} className="groupedChildRow">
      <button
        {...dragHandle}
        type="button"
        className="groupedDragHandle groupedChildDragHandle"
        aria-label="Drag child"
      >
        {dragHandleText}
      </button>
      <span className="groupedChildLabel">{child.label}</span>
    </div>
  );
}

function getChildrenForParent(input: {
  parentId: string;
  childOrder: string[];
  childrenById: Record<string, ChildItem>;
}): ChildItem[] {
  return input.childOrder
    .map((childId) => input.childrenById[childId])
    .filter(
      (child): child is ChildItem =>
        child !== undefined && child.parentId === input.parentId,
    );
}

// Example drop behavior: reorder parent ids from package sortable placement.
function reorderParentOrder(
  parentOrder: string[],
  draggableId: string,
  placement: SortableDropPlacement,
): string[] {
  const withoutDraggedParent = parentOrder.filter(
    (parentId) => parentId !== draggableId,
  );
  let insertIndex = withoutDraggedParent.length;

  if (placement.previousDraggableId) {
    const previousIndex = withoutDraggedParent.indexOf(
      placement.previousDraggableId,
    );

    if (previousIndex === -1) {
      return parentOrder;
    }

    insertIndex = previousIndex + 1;
  } else if (placement.nextDraggableId) {
    const nextIndex = withoutDraggedParent.indexOf(placement.nextDraggableId);

    if (nextIndex === -1) {
      return parentOrder;
    }

    insertIndex = nextIndex;
  }

  return insertIntoArray(withoutDraggedParent, insertIndex, draggableId);
}

// Example drop behavior: move child ids and parent ownership in demo data.
function moveChildInOrder(input: {
  child: ChildItem;
  targetParentId: string;
  targetIndex: number;
  childOrder: string[];
  childrenById: Record<string, ChildItem>;
}): string[] {
  const orderWithoutChild = input.childOrder.filter(
    (childId) => childId !== input.child.childId,
  );
  const targetSiblingIds = orderWithoutChild.filter(
    (childId) => input.childrenById[childId]?.parentId === input.targetParentId,
  );
  const sourceSiblingIndex = input.childOrder
    .filter(
      (childId) =>
        input.childrenById[childId]?.parentId === input.targetParentId,
    )
    .indexOf(input.child.childId);
  const adjustedTargetIndex =
    input.child.parentId === input.targetParentId &&
    sourceSiblingIndex !== -1 &&
    sourceSiblingIndex < input.targetIndex
      ? input.targetIndex - 1
      : input.targetIndex;

  if (targetSiblingIds.length === 0) {
    return [...orderWithoutChild, input.child.childId];
  }

  if (adjustedTargetIndex <= 0) {
    const firstSiblingId = targetSiblingIds[0];

    if (firstSiblingId === undefined) {
      return orderWithoutChild;
    }

    return insertBeforeSibling({
      childOrder: orderWithoutChild,
      siblingId: firstSiblingId,
      childId: input.child.childId,
    });
  }

  if (adjustedTargetIndex >= targetSiblingIds.length) {
    const lastSiblingId = targetSiblingIds[targetSiblingIds.length - 1];

    if (lastSiblingId === undefined) {
      return orderWithoutChild;
    }

    return insertAfterSibling({
      childOrder: orderWithoutChild,
      siblingId: lastSiblingId,
      childId: input.child.childId,
    });
  }

  const targetSiblingId = targetSiblingIds[adjustedTargetIndex];

  if (targetSiblingId === undefined) {
    return orderWithoutChild;
  }

  return insertBeforeSibling({
    childOrder: orderWithoutChild,
    siblingId: targetSiblingId,
    childId: input.child.childId,
  });
}

function insertBeforeSibling(input: {
  childOrder: string[];
  siblingId: string;
  childId: string;
}): string[] {
  const siblingIndex = input.childOrder.indexOf(input.siblingId);

  if (siblingIndex === -1) {
    return input.childOrder;
  }

  return insertIntoArray(input.childOrder, siblingIndex, input.childId);
}

function insertAfterSibling(input: {
  childOrder: string[];
  siblingId: string;
  childId: string;
}): string[] {
  const siblingIndex = input.childOrder.indexOf(input.siblingId);

  if (siblingIndex === -1) {
    return input.childOrder;
  }

  return insertIntoArray(input.childOrder, siblingIndex + 1, input.childId);
}

function insertIntoArray<T>(items: T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)];
}

function getRectCenter(rect: DragRect): DragPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function parseChildDropTargetId(
  dropTargetId: string,
): ParsedChildDropTarget | null {
  if (dropTargetId.startsWith(groupedInsideTargetPrefix)) {
    return {
      type: "inside",
      parentId: dropTargetId.slice(groupedInsideTargetPrefix.length),
    };
  }

  const indexMatch = /^grouped:children:([^:]+):index:(\d+)$/.exec(
    dropTargetId,
  );

  if (!indexMatch) {
    return null;
  }

  const parentId = indexMatch[1];
  const index = indexMatch[2];

  if (parentId === undefined || index === undefined) {
    return null;
  }

  return {
    type: "index",
    parentId,
    index: Number(index),
  };
}

function getInsideDropTargetId(parentId: string): string {
  return `${groupedInsideTargetPrefix}${parentId}`;
}

function getChildIndexDropTargetId(parentId: string, index: number): string {
  return `grouped:children:${parentId}:index:${index}`;
}
