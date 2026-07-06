import {
  createDragController,
  createDragHandle,
  createDraggable,
  createDroppable,
  createSortable,
  getDistanceToRect,
  type DragController,
  type DragControllerOverlayInput,
  type SortableDropPlacement,
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

type DragState = DragControllerOverlayInput["dragState"];

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
const groupedInsideTargetPrefix = "grouped:children:inside:";
const groupedChildTargetPrefix = "grouped:children:";
const groupedInsideTargetMaxYDistance = 0;
const groupedChildLineTargetMaxYDistance = 24;
const dragHandleText = "\u22ee\u22ee";

// Example targeting: custom constraint passed into the package controller.
const groupedTargetingConstraint: TargetingConstraint = ({
  pointerPosition,
  dropTarget,
}) => {
  const dropTargetId = dropTarget.dropTargetId;

  if (dropTargetId.startsWith(groupedInsideTargetPrefix)) {
    const distance = getDistanceToRect(
      pointerPosition,
      dropTarget.dropTargetRect,
    );

    return distance.x === 0 && distance.y <= groupedInsideTargetMaxYDistance;
  }

  const parsedTarget = parseChildDropTargetId(dropTargetId);

  if (parsedTarget?.type === "index") {
    const distance = getDistanceToRect(
      pointerPosition,
      dropTarget.dropTargetRect,
    );

    return distance.x === 0 && distance.y <= groupedChildLineTargetMaxYDistance;
  }

  if (dropTargetId.startsWith(groupedChildTargetPrefix)) {
    return false;
  }

  return true;
};

// Example state: seed grouped data owned by the app.
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

export function mountGroupedExample(): () => void;
export function mountGroupedExample(root: HTMLElement): () => void;
export function mountGroupedExample(root?: HTMLElement): () => void {
  const host =
    root ??
    document.querySelector<HTMLElement>(".examplesLayout") ??
    document.querySelector<HTMLElement>("#app") ??
    document.body;
  const ownsHost = root !== undefined;
  // Example state: the app owns item order, expansion, and active styling state.
  const parentsById = { ...initialParentsById };
  let childrenById = cloneChildrenById(initialChildrenById);
  let parentOrder = [...initialParentOrder];
  let childOrder = [...initialChildOrder];
  let expandedParentIds = new Set(["parent-roadmap", "parent-release"]);
  let activeDraggedParentId: string | null = null;
  const dropTargetElements = new Map<string, HTMLElement>();
  let activeDropTargetId: string | null = null;
  let pendingRemeasureFrameId: number | null = null;

  const panel = document.createElement("section");
  panel.className = "examplePanel groupedExamplePanel";

  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Grouped drag and drop";

  const groupedElement = document.createElement("div");
  groupedElement.className = "groupedExample";

  panel.append(title, groupedElement);
  host.append(panel);

  // Package API: creates the drag controller and wires lifecycle callbacks.
  const controller = createDragController({
    targetingConstraint: groupedTargetingConstraint,
    pointerConfiguration: { activationDelay: 100 },
    dragOverlay,
    onDragStart({ draggableId }) {
      clearActiveGroupedDropTarget();
      activeDraggedParentId = parentsById[draggableId] ? draggableId : null;

      if (activeDraggedParentId) {
        collapseActiveDraggedParentDom();
        remeasureGroupedTargets(controller);
      }
    },
    onDragUpdate({ activeDropTargetId: nextDropTarget, previousDropTargetId }) {
      updateActiveGroupedDropTarget({
        activeDropTargetId: nextDropTarget,
        previousDropTargetId,
      });
    },
    onDragEnd() {
      clearActiveGroupedDropTarget();
      activeDraggedParentId = null;
      render();
    },
    onDrop(event) {
      // Example drop behavior: interpret package targets and commit app data.
      if (parentsById[event.draggableId]) {
        const placement = event.sortablePlacement;

        if (placement) {
          parentOrder = reorderParentOrder(
            parentOrder,
            event.draggableId,
            placement,
          );
          render();
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

      childOrder = moveChildInOrder({
        child,
        targetParentId: parsedTarget.parentId,
        targetIndex,
        childOrder,
        childrenById,
      });
      childrenById = {
        ...childrenById,
        [child.childId]: {
          ...child,
          parentId: parsedTarget.parentId,
        },
      };
      render();
    },
  });

  render();

  return () => {
    clearActiveGroupedDropTarget();
    dropTargetElements.clear();

    if (pendingRemeasureFrameId !== null) {
      window.cancelAnimationFrame(pendingRemeasureFrameId);
      pendingRemeasureFrameId = null;
    }

    if (ownsHost) {
      host.replaceChildren();
    } else {
      panel.remove();
    }
  };

  // Example rendering: rebuild grouped DOM from user-owned data.
  function render(): void {
    dropTargetElements.clear();
    groupedElement.replaceChildren(
      ...parentOrder.flatMap((parentId) => {
        const parent = parentsById[parentId];

        return parent ? [createGroupedParentBlock(parent)] : [];
      }),
    );
  }

  // Example rendering: parent row markup and child container are app-owned.
  function createGroupedParentBlock(parent: ParentItem): HTMLElement {
    const children = getChildrenForParent({
      parentId: parent.parentId,
      childOrder,
      childrenById,
    });
    const hasChildren = children.length > 0;
    const isActivelyDragged = activeDraggedParentId === parent.parentId;
    const isExpanded =
      hasChildren &&
      expandedParentIds.has(parent.parentId) &&
      !isActivelyDragged;
    const insideDropTargetId = getInsideDropTargetId(parent.parentId);

    const parentBlock = document.createElement("div");
    parentBlock.className = "groupedParentBlock";
    parentBlock.setAttribute(groupedDropTargetAttribute, parent.parentId);
    if (isActivelyDragged) {
      parentBlock.dataset.groupedDragged = "true";
    }
    registerDropTargetElement(parent.parentId, parentBlock);

    // Package API: registers the parent block as a sortable item.
    createSortable({
      controller,
      element: parentBlock,
      draggableId: parent.parentId,
      group: groupedParentGroup,
    });

    const parentRow = document.createElement("div");
    parentRow.className = "groupedParentRow";
    parentRow.setAttribute(groupedDropTargetAttribute, insideDropTargetId);
    registerDropTargetElement(insideDropTargetId, parentRow);

    // Package API: registers the parent row as an inside drop target.
    createDroppable({
      controller,
      element: parentRow,
      dropTargetId: insideDropTargetId,
      group: groupedChildGroup,
      containerId: parent.parentId,
    });

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "groupedParentToggle";
    toggleButton.disabled = !hasChildren;
    toggleButton.setAttribute(
      "aria-label",
      isExpanded ? "Collapse parent" : "Expand parent",
    );
    toggleButton.textContent = hasChildren ? (isExpanded ? "v" : ">") : "";
    toggleButton.addEventListener("click", () => {
      toggleExpandedParent(parent.parentId);
    });

    const handleButton = document.createElement("button");
    handleButton.type = "button";
    handleButton.className = "groupedDragHandle";
    handleButton.setAttribute("aria-label", "Drag parent");
    handleButton.textContent = dragHandleText;
    // Package API: limits parent drag start to the handle.
    createDragHandle({ element: handleButton });

    const label = document.createElement("span");
    label.className = "groupedParentLabel";
    label.textContent = parent.label;

    const childCount = document.createElement("span");
    childCount.className = "groupedChildCount";
    childCount.textContent = formatChildCount(children.length);

    parentRow.append(toggleButton, handleButton, label, childCount);
    parentBlock.append(parentRow);

    if (isExpanded) {
      parentBlock.append(createGroupedChildList(parent.parentId, children));
    }

    return parentBlock;
  }

  // Example rendering: child list includes app-owned insertion-line markup.
  function createGroupedChildList(
    parentId: string,
    children: ChildItem[],
  ): HTMLElement {
    const childList = document.createElement("div");
    childList.className = "groupedChildList";

    children.forEach((child, index) => {
      childList.append(
        createGroupedChildDropzoneLine(parentId, index),
        createGroupedChildRow(child),
      );
    });
    childList.append(createGroupedChildDropzoneLine(parentId, children.length));

    return childList;
  }

  // Example rendering: insertion lines are DOM targets owned by the example.
  function createGroupedChildDropzoneLine(
    parentId: string,
    index: number,
  ): HTMLElement {
    const dropTargetId = getChildIndexDropTargetId(parentId, index);
    const line = document.createElement("div");
    line.className = "groupedChildDropzoneLine";
    line.setAttribute(groupedDropTargetAttribute, dropTargetId);
    registerDropTargetElement(dropTargetId, line);

    const indicator = document.createElement("div");
    indicator.className = "groupedChildDropzoneIndicator";
    line.append(indicator);

    // Package API: registers the insertion line as a child drop target.
    createDroppable({
      controller,
      element: line,
      dropTargetId,
      group: groupedChildGroup,
      containerId: parentId,
    });

    return line;
  }

  // Example rendering: child row markup is app-owned.
  function createGroupedChildRow(child: ChildItem): HTMLElement {
    const childRow = document.createElement("div");
    childRow.className = "groupedChildRow";

    // Package API: registers the child row as a draggable item.
    createDraggable({
      controller,
      element: childRow,
      draggableId: child.childId,
      group: groupedChildGroup,
    });

    const handleButton = document.createElement("button");
    handleButton.type = "button";
    handleButton.className = "groupedDragHandle groupedChildDragHandle";
    handleButton.setAttribute("aria-label", "Drag child");
    handleButton.textContent = dragHandleText;
    // Package API: limits child drag start to the handle.
    createDragHandle({ element: handleButton });

    const label = document.createElement("span");
    label.className = "groupedChildLabel";
    label.textContent = child.label;

    childRow.append(handleButton, label);

    return childRow;
  }

  function toggleExpandedParent(parentId: string): void {
    const nextExpandedParentIds = new Set(expandedParentIds);

    if (nextExpandedParentIds.has(parentId)) {
      nextExpandedParentIds.delete(parentId);
    } else {
      nextExpandedParentIds.add(parentId);
    }

    expandedParentIds = nextExpandedParentIds;
    render();
    scheduleGroupedRemeasure();
  }

  // Package API: refreshes target geometry after example-owned expansion changes.
  function scheduleGroupedRemeasure(): void {
    if (pendingRemeasureFrameId !== null) {
      window.cancelAnimationFrame(pendingRemeasureFrameId);
    }

    pendingRemeasureFrameId = window.requestAnimationFrame(() => {
      pendingRemeasureFrameId = null;
      remeasureGroupedTargets(controller);
    });
  }

  // Example styling/rendering: collapse the active parent without replacing it.
  function collapseActiveDraggedParentDom(): void {
    if (!activeDraggedParentId) {
      return;
    }

    const parentBlock = dropTargetElements.get(activeDraggedParentId);

    if (!parentBlock?.isConnected) {
      dropTargetElements.delete(activeDraggedParentId);
      return;
    }

    parentBlock.dataset.groupedDragged = "true";

    const childList =
      parentBlock.querySelector<HTMLElement>(".groupedChildList");

    if (!childList) {
      return;
    }

    childList
      .querySelectorAll<HTMLElement>(`[${groupedDropTargetAttribute}]`)
      .forEach((element) => {
        const dropTargetId = element.getAttribute(groupedDropTargetAttribute);

        if (dropTargetId) {
          dropTargetElements.delete(dropTargetId);
        }
      });

    childList.remove();
  }

  // Example rendering: overlay markup is app-owned and uses package drag state.
  function dragOverlay({
    dragState,
  }: DragControllerOverlayInput): HTMLElement | null {
    return createGroupedDragOverlay({
      dragState,
      parentsById,
      childrenById,
      childOrder,
    });
  }

  // Example styling: active target attributes drive demo CSS highlights.
  function registerDropTargetElement(
    dropTargetId: string,
    element: HTMLElement,
  ): void {
    dropTargetElements.set(dropTargetId, element);

    if (activeDropTargetId === dropTargetId) {
      element.dataset.groupedActiveDropTarget = "true";
    } else {
      delete element.dataset.groupedActiveDropTarget;
    }
  }

  function updateActiveGroupedDropTarget(input: {
    activeDropTargetId: string | null;
    previousDropTargetId: string | null;
  }): void {
    if (input.previousDropTargetId === input.activeDropTargetId) {
      return;
    }

    setActiveGroupedDropTarget(input.previousDropTargetId, false);
    setActiveGroupedDropTarget(input.activeDropTargetId, true);
    activeDropTargetId = input.activeDropTargetId;
  }

  function clearActiveGroupedDropTarget(): void {
    setActiveGroupedDropTarget(activeDropTargetId, false);
    activeDropTargetId = null;
  }

  function setActiveGroupedDropTarget(
    dropTargetId: string | null,
    isActive: boolean,
  ): void {
    if (!dropTargetId) {
      return;
    }

    const element = dropTargetElements.get(dropTargetId);

    if (!element?.isConnected) {
      dropTargetElements.delete(dropTargetId);
      return;
    }

    if (isActive) {
      element.dataset.groupedActiveDropTarget = "true";
    } else {
      delete element.dataset.groupedActiveDropTarget;
    }
  }
}

// Example rendering: overlay markup mirrors the dragged example item.
function createGroupedDragOverlay({
  dragState,
  parentsById,
  childrenById,
  childOrder,
}: {
  dragState: DragState;
  parentsById: Record<string, ParentItem>;
  childrenById: Record<string, ChildItem>;
  childOrder: string[];
}): HTMLElement | null {
  if (dragState.group === groupedParentGroup) {
    const parent = parentsById[dragState.draggableId];

    if (!parent) {
      return createEmptyGroupedOverlay();
    }

    const children = getChildrenForParent({
      parentId: parent.parentId,
      childOrder,
      childrenById,
    });
    const overlay = document.createElement("div");
    overlay.className = "groupedDragOverlay groupedParentDragOverlay";

    const handle = document.createElement("div");
    handle.className = "groupedDragOverlayHandle";
    handle.textContent = dragHandleText;

    const label = document.createElement("span");
    label.className = "groupedParentLabel";
    label.textContent = parent.label;

    const childCount = document.createElement("span");
    childCount.className = "groupedChildCount";
    childCount.textContent = formatChildCount(children.length);

    overlay.append(handle, label, childCount);
    return overlay;
  }

  if (dragState.group === groupedChildGroup) {
    const child = childrenById[dragState.draggableId];
    const overlay = document.createElement("div");
    overlay.className = "groupedDragOverlay groupedChildDragOverlay";

    const handle = document.createElement("div");
    handle.className = "groupedDragOverlayHandle";
    handle.textContent = dragHandleText;

    const label = document.createElement("span");
    label.className = "groupedChildLabel";
    label.textContent = child?.label ?? "";

    overlay.append(handle, label);
    return overlay;
  }

  if (parentsById[dragState.draggableId]) {
    return createGroupedDragOverlay({
      dragState: { ...dragState, group: groupedParentGroup },
      parentsById,
      childrenById,
      childOrder,
    });
  }

  if (childrenById[dragState.draggableId]) {
    return createGroupedDragOverlay({
      dragState: { ...dragState, group: groupedChildGroup },
      parentsById,
      childrenById,
      childOrder,
    });
  }

  return createEmptyGroupedOverlay();
}

function createEmptyGroupedOverlay(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "groupedDragOverlay";
  return overlay;
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

function getInsideDropTargetId(parentId: string): string {
  return `${groupedInsideTargetPrefix}${parentId}`;
}

function getChildIndexDropTargetId(parentId: string, index: number): string {
  return `grouped:children:${parentId}:index:${index}`;
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

// Example drop behavior: apply package placement to user-owned parent order.
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

// Example drop behavior: apply parsed child targets to user-owned child order.
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

// Package API: ask the controller to refresh measured drop target geometry.
function remeasureGroupedTargets(controller: DragController): void {
  controller.remeasureDropTargets({ group: groupedParentGroup });
  controller.remeasureDropTargets({ group: groupedChildGroup });
}

function cloneChildrenById(
  childrenById: Record<string, ChildItem>,
): Record<string, ChildItem> {
  return Object.fromEntries(
    Object.entries(childrenById).map(([childId, child]) => [
      childId,
      { ...child },
    ]),
  );
}

function formatChildCount(childCount: number): string {
  return `${childCount} ${childCount === 1 ? "child" : "children"}`;
}
