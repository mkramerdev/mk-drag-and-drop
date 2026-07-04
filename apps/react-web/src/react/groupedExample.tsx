import {
  Fragment,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";

import {
  DragProvider,
  useRemeasureDropTargets,
  type DragState,
  type SortablePlacement,
} from "@mk-drag-and-drop/react/drag-provider";
import { useDragHandle } from "@mk-drag-and-drop/react/use-drag-handle";
import { useDraggable } from "@mk-drag-and-drop/react/use-draggable";
import { useDroppable } from "@mk-drag-and-drop/react/use-droppable";
import { useSortable } from "@mk-drag-and-drop/react/use-sortable";
import {
  getDistanceToRect,
  type TargetingConstraint,
} from "@mk-drag-and-drop/dom";

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

const groupedParentGroup = "grouped-parents";
const groupedChildGroup = "grouped-children";
const groupedDropTargetAttribute = "data-grouped-drop-target-id";
const groupedActiveDropTargetAttribute = "data-grouped-active-drop-target";
const groupedInsideTargetPrefix = "grouped:children:inside:";
const groupedChildTargetPrefix = "grouped:children:";
const groupedInsideTargetMaxYDistance = 0;
const groupedChildLineTargetMaxYDistance = 24;

// Example targeting: custom rules decide which grouped drop targets are eligible.
const groupedTargetingConstraint: TargetingConstraint = ({
  pointerPosition,
  dropTarget,
}) => {
  const targetId = dropTarget.dropTargetKey;

  if (targetId.startsWith(groupedInsideTargetPrefix)) {
    const distance = getDistanceToRect(
      pointerPosition,
      dropTarget.dropTargetRect,
    );

    return distance.x === 0 && distance.y <= groupedInsideTargetMaxYDistance;
  }

  const parsedTarget = parseChildDropTargetId(targetId);

  if (parsedTarget?.type === "index") {
    const distance = getDistanceToRect(
      pointerPosition,
      dropTarget.dropTargetRect,
    );

    return distance.x === 0 && distance.y <= groupedChildLineTargetMaxYDistance;
  }

  if (targetId.startsWith(groupedChildTargetPrefix)) {
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

  function handleDrop(
    event: { itemId: string; dropTarget: string },
    helpers: {
      getSortablePlacement: (itemId: string) => SortablePlacement | null;
    },
  ): void {
    // Example drop behavior: interpret package placement/target ids for grouped data.
    if (parentsById[event.itemId]) {
      const placement = helpers.getSortablePlacement(event.itemId);

      if (placement) {
        setParentOrder((currentOrder) =>
          reorderParentOrder(currentOrder, placement),
        );
      }

      return;
    }

    if (!childrenById[event.itemId]) {
      return;
    }

    const parsedTarget = parseChildDropTargetId(event.dropTarget);

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

    const child = childrenById[event.itemId];
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
      targetingConstraint={groupedTargetingConstraint}
      pointerConfiguration={{ activationDelay: 100 }}
      dragOverlay={({ dragState }) => (
        <GroupedDragOverlay
          dragState={dragState}
          parentsById={parentsById}
          childrenById={childrenById}
          childOrder={childOrder}
        />
      )}
      onDragStart={({ itemId }) => {
        clearActiveGroupedDropTargets(rootRef.current);
        setActiveDraggedParentId(parentsById[itemId] ? itemId : null);
      }}
      onDragUpdate={({ activeDropTarget, previousDropTarget }) => {
        updateActiveGroupedDropTarget({
          root: rootRef.current,
          activeDropTarget,
          previousDropTarget,
        });
      }}
      onDragEnd={() => {
        clearActiveGroupedDropTargets(rootRef.current);
        setActiveDraggedParentId(null);
      }}
      onDrop={handleDrop}
    >
      <section ref={rootRef} className="examplePanel groupedExamplePanel">
        <h2 className="exampleTitle">Grouped drag and drop</h2>
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
  childOrder,
}: {
  dragState: DragState;
  parentsById: Record<string, ParentItem>;
  childrenById: Record<string, ChildItem>;
  childOrder: string[];
}): ReactElement {
  if (
    dragState.group !== groupedParentGroup &&
    dragState.group !== groupedChildGroup
  ) {
    return <div className="groupedDragOverlay" />;
  }

  if (dragState.group === groupedParentGroup) {
    const parent = parentsById[dragState.itemId];
    const children = parent
      ? getChildrenForParent({
          parentId: parent.parentId,
          childOrder,
          childrenById,
        })
      : [];

    return (
      <div className="groupedDragOverlay groupedParentDragOverlay">
        <div className="groupedDragOverlayHandle">
          <GripVertical aria-hidden />
        </div>
        <span className="groupedParentLabel">{parent?.label ?? ""}</span>
        <span className="groupedChildCount">
          {children.length} {children.length === 1 ? "child" : "children"}
        </span>
      </div>
    );
  }

  const child = childrenById[dragState.itemId];

  return (
    <div className="groupedDragOverlay groupedChildDragOverlay">
      <div className="groupedDragOverlayHandle">
        <GripVertical aria-hidden />
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
}: {
  parent: ParentItem;
  children: ChildItem[];
  expandedParentIds: Set<string>;
  setExpandedParentIds: (
    update: (currentExpandedParentIds: Set<string>) => Set<string>,
  ) => void;
  isActivelyDragged: boolean;
}): ReactElement {
  // Package API: parent rows are sortable and also accept child drops.
  const sortable = useSortable({
    itemId: parent.parentId,
    group: groupedParentGroup,
  });
  const dragHandle = useDragHandle<HTMLButtonElement>();
  const insideTargetId = getInsideTargetId(parent.parentId);
  const insideDroppable = useDroppable({
    targetId: insideTargetId,
    group: groupedChildGroup,
    containerId: parent.parentId,
  });
  const remeasureDropTargets = useRemeasureDropTargets();
  const hasChildren = children.length > 0;
  const isExpanded =
    hasChildren &&
    expandedParentIds.has(parent.parentId) &&
    !isActivelyDragged;

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
      {...sortable}
      className="groupedParentBlock"
      data-grouped-drop-target-id={parent.parentId}
      data-grouped-dragged={isActivelyDragged ? "true" : undefined}
    >
      <div
        {...insideDroppable}
        className="groupedParentRow"
        data-grouped-drop-target-id={insideTargetId}
      >
        <button
          type="button"
          className="groupedParentToggle"
          onClick={toggleExpanded}
          disabled={!hasChildren}
          aria-label={isExpanded ? "Collapse parent" : "Expand parent"}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown aria-hidden />
            ) : (
              <ChevronRight aria-hidden />
            )
          ) : null}
        </button>
        <button
          {...dragHandle}
          type="button"
          className="groupedDragHandle"
          aria-label="Drag parent"
        >
          <GripVertical aria-hidden />
        </button>
        <span className="groupedParentLabel">{parent.label}</span>
        <span className="groupedChildCount">
          {children.length} {children.length === 1 ? "child" : "children"}
        </span>
      </div>

      {isExpanded ? (
        <div className="groupedChildList">
          {children.map((child, index) => (
            <Fragment key={child.childId}>
              <GroupedChildDropzoneLine
                parentId={parent.parentId}
                index={index}
              />
              <GroupedChildRow child={child} />
            </Fragment>
          ))}
          <GroupedChildDropzoneLine
            parentId={parent.parentId}
            index={children.length}
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
}: {
  parentId: string;
  index: number;
}): ReactElement {
  // Package API: registers this generated child insertion line as a drop target.
  const targetId = getChildIndexTargetId(parentId, index);
  const droppable = useDroppable({
    targetId,
    group: groupedChildGroup,
    containerId: parentId,
  });

  return (
    <div
      {...droppable}
      className="groupedChildDropzoneLine"
      data-grouped-drop-target-id={targetId}
    >
      <div className="groupedChildDropzoneIndicator" />
    </div>
  );
}

// Example rendering: child row markup is app-owned; hooks wire it to the package.
function GroupedChildRow({ child }: { child: ChildItem }): ReactElement {
  // Package API: registers this rendered child row and handle as draggable.
  const draggable = useDraggable({
    itemId: child.childId,
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
        <GripVertical aria-hidden />
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
  placement: SortablePlacement,
): string[] {
  const withoutDraggedParent = parentOrder.filter(
    (parentId) => parentId !== placement.itemId,
  );
  let insertIndex = withoutDraggedParent.length;

  if (placement.previousItemId) {
    const previousIndex = withoutDraggedParent.indexOf(
      placement.previousItemId,
    );

    if (previousIndex === -1) {
      return parentOrder;
    }

    insertIndex = previousIndex + 1;
  } else if (placement.nextItemId) {
    const nextIndex = withoutDraggedParent.indexOf(placement.nextItemId);

    if (nextIndex === -1) {
      return parentOrder;
    }

    insertIndex = nextIndex;
  }

  return insertIntoArray(withoutDraggedParent, insertIndex, placement.itemId);
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
    return insertBeforeSibling({
      childOrder: orderWithoutChild,
      siblingId: targetSiblingIds[0],
      childId: input.child.childId,
    });
  }

  if (adjustedTargetIndex >= targetSiblingIds.length) {
    return insertAfterSibling({
      childOrder: orderWithoutChild,
      siblingId: targetSiblingIds[targetSiblingIds.length - 1],
      childId: input.child.childId,
    });
  }

  return insertBeforeSibling({
    childOrder: orderWithoutChild,
    siblingId: targetSiblingIds[adjustedTargetIndex],
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

  return {
    type: "index",
    parentId: indexMatch[1],
    index: Number(indexMatch[2]),
  };
}

function getInsideTargetId(parentId: string): string {
  return `${groupedInsideTargetPrefix}${parentId}`;
}

function getChildIndexTargetId(parentId: string, index: number): string {
  return `grouped:children:${parentId}:index:${index}`;
}

// Example styling: active target attributes drive demo CSS highlights.
function clearActiveGroupedDropTargets(root: ParentNode | null): void {
  for (const element of Array.from(
    (root ?? document).querySelectorAll<HTMLElement>(
      `[${groupedDropTargetAttribute}][${groupedActiveDropTargetAttribute}="true"]`,
    ),
  )) {
    delete element.dataset.groupedActiveDropTarget;
  }
}

function updateActiveGroupedDropTarget(input: {
  root: ParentNode | null;
  activeDropTarget: string | null;
  previousDropTarget: string | null;
}): void {
  if (input.previousDropTarget === input.activeDropTarget) {
    return;
  }

  if (input.previousDropTarget) {
    const previousElement = getGroupedDropTargetElement(
      input.root,
      input.previousDropTarget,
    );

    if (previousElement) {
      delete previousElement.dataset.groupedActiveDropTarget;
    }
  }

  if (!input.activeDropTarget) {
    return;
  }

  const activeElement = getGroupedDropTargetElement(
    input.root,
    input.activeDropTarget,
  );

  if (activeElement) {
    activeElement.dataset.groupedActiveDropTarget = "true";
  }
}

function getGroupedDropTargetElement(
  root: ParentNode | null,
  dropTargetId: string,
): HTMLElement | null {
  return (root ?? document).querySelector<HTMLElement>(
    `[${groupedDropTargetAttribute}="${CSS.escape(dropTargetId)}"]`,
  );
}
