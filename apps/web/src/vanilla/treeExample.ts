import {
  createDragController,
  createDragHandle,
  createDraggable,
  createDroppable,
  getDistanceToRect,
  type DragController,
  type DragControllerOverlayInput,
  type DropTarget,
  type TargetingAlgorithm,
  type TargetingAlgorithmInput,
  type TargetingConstraint,
} from "@mk-drag-and-drop/dom";

type TreeItem = {
  draggableId: string;
  parentId: string | null;
  label: string;
};

type TreeState = {
  itemsById: Record<string, TreeItem>;
  orderedItemIds: string[];
};

type ProjectedTreeRow = {
  type: "row";
  item: TreeItem;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
};

type ProjectedDropzoneLine = {
  type: "line";
  targetId: string;
  depth: number;
};

type TreeRenderEntry = ProjectedTreeRow | ProjectedDropzoneLine;

type TreeProjection = {
  entries: TreeRenderEntry[];
};

type ParsedTreeDropTarget =
  | {
      type: "inside";
      draggableId: string;
    }
  | {
      type: "children";
      parentId: string | null;
      index: number;
    };

const treeGroup = "tree-example";
const rootToken = "root";
const treeDepthInsetRem = 1.5;
const treeInsideTargetMaxXDistance = 120;
const treeInsideTargetMaxYDistance = 8;
const treeLineTargetMaxXDistance = 180;
const treeLineTargetMaxYDistance = 24;
const dragHandleText = "\u2630";

// Example targeting: custom constraint passed into the package controller.
const treeTargetingConstraint: TargetingConstraint = ({
  pointerPosition,
  overlayRect,
  dropTarget,
}) => {
  const targetYPoint = overlayRect
    ? getRectCenter(overlayRect)
    : pointerPosition;

  if (isInsideTargetId(dropTarget.dropTargetKey)) {
    return (
      isPointInTargetStartXBand(
        pointerPosition.x,
        dropTarget,
        treeInsideTargetMaxXDistance,
      ) &&
      Math.abs(targetYPoint.y - getTargetVerticalCenter(dropTarget)) <=
        treeInsideTargetMaxYDistance
    );
  }

  if (isChildrenTargetId(dropTarget.dropTargetKey)) {
    const distance = getDistanceToRect(
      {
        x: pointerPosition.x,
        y: targetYPoint.y,
      },
      dropTarget.dropTargetRect,
    );

    return (
      isPointInTargetStartXBand(
        pointerPosition.x,
        dropTarget,
        treeLineTargetMaxXDistance,
      ) && distance.y <= treeLineTargetMaxYDistance
    );
  }

  return false;
};

// Example state: seed tree data owned by the app.
const seedItems: TreeItem[] = [
  { draggableId: "design", parentId: null, label: "Design" },
  { draggableId: "research", parentId: "design", label: "Research" },
  { draggableId: "components", parentId: "design", label: "Components" },
  { draggableId: "buttons", parentId: "components", label: "Buttons" },
  { draggableId: "menus", parentId: "components", label: "Menus" },
  { draggableId: "engineering", parentId: null, label: "Engineering" },
  { draggableId: "api", parentId: "engineering", label: "API" },
  { draggableId: "runtime", parentId: "engineering", label: "Runtime" },
  { draggableId: "targeting", parentId: "runtime", label: "Targeting" },
  { draggableId: "release", parentId: null, label: "Release" },
];

const initialExpandedItemIds = ["design", "components"];

// Example targeting: custom vertical algorithm passed into the package.
const treeVerticalTargeting: TargetingAlgorithm = Object.assign(
  (input: TargetingAlgorithmInput) =>
    findClosestVerticalTarget(
      input.overlayRect ? getRectCenter(input.overlayRect) : input.pointerPosition,
      input.dropTargets,
    ),
  { mode: "rect" as const },
);

export function mountTreeExample(root: HTMLElement): () => void {
  const panel = document.createElement("section");
  panel.className = "examplePanel treeExamplePanel";

  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Tree";

  const treeElement = document.createElement("div");
  treeElement.className = "treeExample";
  treeElement.setAttribute("role", "tree");

  panel.append(title, treeElement);
  root.append(panel);

  // Example state: the app owns tree data and expansion state.
  let treeState = createTreeState(seedItems);
  let expandedItemIds = new Set(initialExpandedItemIds);

  // Package API: creates the drag controller and wires tree lifecycle callbacks.
  const controller = createDragController({
    targetingAlgorithm: treeVerticalTargeting,
    targetingConstraint: treeTargetingConstraint,
    dragOverlay: createTreeDragOverlay,
    onDragStart() {
      clearActiveTreeDropTargets(panel);
    },
    onDragUpdate({ activeDropTarget, previousDropTarget }) {
      updateActiveTreeDropTarget({
        root: panel,
        activeDropTarget,
        previousDropTarget,
      });
    },
    onDragEnd() {
      clearActiveTreeDropTargets(panel);
    },
    onDrop({ draggableId, dropTarget }) {
      // Example drop behavior: translate the package target into tree data.
      const nextTreeState = moveTreeItem(treeState, draggableId, dropTarget);

      if (nextTreeState !== treeState) {
        treeState = nextTreeState;
        renderTree();
      }
    },
  });

  renderTree();

  return () => {
    controller.dispose();
    root.replaceChildren();
  };

  // Example rendering: rebuild projected tree rows and lines from app state.
  function renderTree(): void {
    const projection = createTreeProjection(treeState, expandedItemIds);
    treeElement.replaceChildren(
      ...projection.entries.map((entry) =>
        entry.type === "row"
          ? createTreeRow(controller, entry, toggleExpanded)
          : createTreeDropzoneLine(controller, entry),
      ),
    );
  }

  function toggleExpanded(draggableId: string): void {
    const nextExpandedItemIds = new Set(expandedItemIds);

    if (nextExpandedItemIds.has(draggableId)) {
      nextExpandedItemIds.delete(draggableId);
    } else {
      nextExpandedItemIds.add(draggableId);
    }

    expandedItemIds = nextExpandedItemIds;
    renderTree();
  }

  // Example rendering: overlay markup is app-owned and uses package drag state.
  function createTreeDragOverlay({
    dragState,
  }: DragControllerOverlayInput): HTMLElement | null {
    const label = getTreeItemLabel(treeState, dragState.draggableId);

    if (!label) {
      return null;
    }

    const overlay = document.createElement("div");
    overlay.className = "treeDragOverlay";

    const handle = document.createElement("div");
    handle.className = "treeDragHandle";
    handle.textContent = dragHandleText;

    const labelElement = document.createElement("span");
    labelElement.className = "treeRowLabel";
    labelElement.textContent = label;

    overlay.append(handle, labelElement);
    return overlay;
  }
}

// Example rendering: row markup and accessibility attributes are app-owned.
function createTreeRow(
  controller: DragController,
  row: ProjectedTreeRow,
  onToggleExpanded: (draggableId: string) => void,
): HTMLElement {
  const targetId = getInsideTargetId(row.item.draggableId);
  const rowElement = document.createElement("div");
  rowElement.className = "treeRow";
  rowElement.dataset.treeDropTargetId = targetId;
  rowElement.setAttribute("role", "treeitem");
  rowElement.setAttribute("aria-level", String(row.depth + 1));
  applyTreeDepthStyle(rowElement, row.depth);

  if (row.hasChildren) {
    rowElement.setAttribute("aria-expanded", String(row.isExpanded));
  }

  // Package API: registers the row as both draggable and an inside drop target.
  createDraggable({
    controller,
    element: rowElement,
    draggableId: row.item.draggableId,
    group: treeGroup,
  });
  createDroppable({
    controller,
    element: rowElement,
    targetId,
    group: treeGroup,
  });

  const handleButton = document.createElement("button");
  handleButton.type = "button";
  handleButton.className = "treeDragHandle";
  handleButton.setAttribute("aria-label", `Drag ${row.item.label}`);
  handleButton.textContent = dragHandleText;
  // Package API: limits row drag start to the handle.
  createDragHandle({ element: handleButton });

  const labelElement = document.createElement("span");
  labelElement.className = "treeRowLabel";
  labelElement.textContent = row.item.label;

  rowElement.append(handleButton, labelElement);

  if (row.hasChildren) {
    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "treeToggle";
    toggleButton.setAttribute(
      "aria-label",
      row.isExpanded
        ? `Collapse ${row.item.label}`
        : `Expand ${row.item.label}`,
    );
    toggleButton.textContent = row.isExpanded ? "v" : ">";
    toggleButton.addEventListener("click", () => {
      onToggleExpanded(row.item.draggableId);
    });
    rowElement.append(toggleButton);
  }

  return rowElement;
}

// Example rendering: insertion-line markup is owned by the example.
function createTreeDropzoneLine(
  controller: DragController,
  line: ProjectedDropzoneLine,
): HTMLElement {
  const lineElement = document.createElement("div");
  lineElement.className = "treeDropzoneLine";
  lineElement.dataset.treeDropTargetId = line.targetId;
  lineElement.setAttribute("aria-hidden", "true");
  applyTreeDepthStyle(lineElement, line.depth);

  // Package API: registers the insertion line as a drop target.
  createDroppable({
    controller,
    element: lineElement,
    targetId: line.targetId,
    group: treeGroup,
  });

  const indicator = document.createElement("div");
  indicator.className = "treeDropzoneLineIndicator";
  lineElement.append(indicator);

  return lineElement;
}

// Example state: normalize seed rows into app-owned tree state.
function createTreeState(items: readonly TreeItem[]): TreeState {
  return {
    itemsById: Object.fromEntries(
      items.map((item) => [item.draggableId, item]),
    ) as Record<string, TreeItem>,
    orderedItemIds: items.map((item) => item.draggableId),
  };
}

// Example rendering: project app data into visible rows and insertion lines.
function createTreeProjection(
  treeState: TreeState,
  expandedItemIds: ReadonlySet<string>,
): TreeProjection {
  const childrenByParentId = createChildrenByParentId(treeState);
  const entries: TreeRenderEntry[] = [];

  appendChildList(null, 0);

  return { entries };

  function appendChildList(parentId: string | null, depth: number): void {
    const children = getChildItems(childrenByParentId, parentId);

    entries.push(createDropzoneLine(parentId, 0, depth));

    children.forEach((item, index) => {
      const childItems = getChildItems(childrenByParentId, item.draggableId);
      const hasChildren = childItems.length > 0;
      const isExpanded = expandedItemIds.has(item.draggableId);

      entries.push({
        type: "row",
        item,
        depth,
        hasChildren,
        isExpanded,
      });

      if (hasChildren && isExpanded) {
        appendChildList(item.draggableId, depth + 1);
      }

      entries.push(createDropzoneLine(parentId, index + 1, depth));
    });
  }
}

function createChildrenByParentId(
  treeState: TreeState,
): Map<string | null, TreeItem[]> {
  const childrenByParentId = new Map<string | null, TreeItem[]>();

  for (const draggableId of treeState.orderedItemIds) {
    const item = treeState.itemsById[draggableId];

    if (!item) {
      continue;
    }

    const children = childrenByParentId.get(item.parentId) ?? [];
    children.push(item);
    childrenByParentId.set(item.parentId, children);
  }

  return childrenByParentId;
}

function createDropzoneLine(
  parentId: string | null,
  index: number,
  depth: number,
): ProjectedDropzoneLine {
  return {
    type: "line",
    targetId: getChildrenTargetId(parentId, index),
    depth,
  };
}

// Example drop behavior: interpret package target ids and commit tree data.
function moveTreeItem(
  treeState: TreeState,
  draggableId: string,
  dropTargetId: string,
): TreeState {
  const parsedTarget = parseTreeDropTargetId(dropTargetId);
  const draggedItem = treeState.itemsById[draggableId];

  if (!parsedTarget || !draggedItem) {
    return treeState;
  }

  if (parsedTarget.type === "inside") {
    const targetItem = treeState.itemsById[parsedTarget.draggableId];

    if (!targetItem) {
      return treeState;
    }

    return moveTreeItemToParentIndex(
      treeState,
      draggableId,
      targetItem.draggableId,
      0,
    );
  }

  if (
    parsedTarget.parentId !== null &&
    !treeState.itemsById[parsedTarget.parentId]
  ) {
    return treeState;
  }

  return moveTreeItemToParentIndex(
    treeState,
    draggableId,
    parsedTarget.parentId,
    parsedTarget.index,
  );
}

function moveTreeItemToParentIndex(
  treeState: TreeState,
  draggableId: string,
  parentId: string | null,
  index: number,
): TreeState {
  const draggedItem = treeState.itemsById[draggableId];

  if (
    !draggedItem ||
    index < 0 ||
    isSelfOrDescendantParent(treeState, draggableId, parentId)
  ) {
    return treeState;
  }

  const childrenByParentId = createChildrenByParentId(treeState);
  const currentParentChildren = getChildItems(childrenByParentId, parentId);

  if (index > currentParentChildren.length) {
    return treeState;
  }

  const currentSiblingIndex = getChildItems(
    childrenByParentId,
    draggedItem.parentId,
  ).findIndex((item) => item.draggableId === draggableId);
  let insertionIndex = index;

  if (
    draggedItem.parentId === parentId &&
    currentSiblingIndex !== -1 &&
    currentSiblingIndex < insertionIndex
  ) {
    insertionIndex -= 1;
  }

  const siblingsAfterRemoval = currentParentChildren.filter(
    (item) => item.draggableId !== draggableId,
  );

  if (insertionIndex > siblingsAfterRemoval.length) {
    return treeState;
  }

  const orderedItemIds = treeState.orderedItemIds.filter((id) => id !== draggableId);
  const beforeSibling = siblingsAfterRemoval[insertionIndex] ?? null;
  const nextOrderedItemIds = [...orderedItemIds];

  if (beforeSibling) {
    const beforeSiblingIndex = nextOrderedItemIds.indexOf(beforeSibling.draggableId);

    if (beforeSiblingIndex === -1) {
      return treeState;
    }

    nextOrderedItemIds.splice(beforeSiblingIndex, 0, draggableId);
  } else {
    nextOrderedItemIds.push(draggableId);
  }

  return {
    itemsById: {
      ...treeState.itemsById,
      [draggableId]: {
        ...draggedItem,
        parentId,
      },
    },
    orderedItemIds: nextOrderedItemIds,
  };
}

function isSelfOrDescendantParent(
  treeState: TreeState,
  draggableId: string,
  parentId: string | null,
): boolean {
  let currentParentId = parentId;

  while (currentParentId !== null) {
    if (currentParentId === draggableId) {
      return true;
    }

    const parentItem = treeState.itemsById[currentParentId];

    if (!parentItem) {
      return false;
    }

    currentParentId = parentItem.parentId;
  }

  return false;
}

function parseTreeDropTargetId(
  dropTargetId: string,
): ParsedTreeDropTarget | null {
  const insidePrefix = "tree:inside:";

  if (isInsideTargetId(dropTargetId)) {
    const draggableId = dropTargetId.slice(insidePrefix.length);

    return draggableId ? { type: "inside", draggableId } : null;
  }

  const childrenMatch = /^tree:children:([^:]+):index:(\d+)$/.exec(
    dropTargetId,
  );

  if (!childrenMatch) {
    return null;
  }

  const [, parentToken, indexValue] = childrenMatch;
  const index = Number(indexValue);

  if (!Number.isInteger(index)) {
    return null;
  }

  return {
    type: "children",
    parentId: parentToken === rootToken ? null : parentToken,
    index,
  };
}

function getChildItems(
  childrenByParentId: ReadonlyMap<string | null, TreeItem[]>,
  parentId: string | null,
): TreeItem[] {
  return childrenByParentId.get(parentId) ?? [];
}

function getTreeItemLabel(treeState: TreeState, draggableId: string): string {
  return treeState.itemsById[draggableId]?.label ?? "";
}

function getInsideTargetId(draggableId: string): string {
  return `tree:inside:${draggableId}`;
}

function getChildrenTargetId(parentId: string | null, index: number): string {
  return `tree:children:${parentId ?? rootToken}:index:${index}`;
}

function isInsideTargetId(dropTargetId: string): boolean {
  return dropTargetId.startsWith("tree:inside:");
}

function isChildrenTargetId(dropTargetId: string): boolean {
  return dropTargetId.startsWith("tree:children:");
}

// Example styling: apply app-specific indentation to rows and line targets.
function applyTreeDepthStyle(element: HTMLElement, depth: number): void {
  const inset = `${depth * treeDepthInsetRem}rem`;

  element.style.marginLeft = inset;
  element.style.width = depth === 0 ? "100%" : `calc(100% - ${inset})`;
}

// Example targeting: choose the closest target using tree-specific geometry.
function findClosestVerticalTarget(
  pointerPosition: { x: number; y: number },
  dropTargets: readonly DropTarget[],
): DropTarget | null {
  let closestTarget: DropTarget | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const candidateDropTarget of dropTargets) {
    if (!isPointerInsideTargetX(pointerPosition.x, candidateDropTarget)) {
      continue;
    }

    const distance = Math.abs(
      pointerPosition.y - getTargetVerticalCenter(candidateDropTarget),
    );

    if (distance < closestDistance) {
      closestTarget = candidateDropTarget;
      closestDistance = distance;
    }
  }

  return closestTarget;
}

function isPointerInsideTargetX(
  pointerX: number,
  dropTarget: DropTarget,
): boolean {
  const rect = dropTarget.dropTargetRect;

  return pointerX >= rect.left && pointerX <= rect.right;
}

function getTargetVerticalCenter(dropTarget: DropTarget): number {
  const rect = dropTarget.dropTargetRect;

  return rect.top + rect.height / 2;
}

function isPointInTargetStartXBand(
  pointX: number,
  dropTarget: DropTarget,
  maxDistance: number,
): boolean {
  const rect = dropTarget.dropTargetRect;
  const maxX = Math.min(rect.right, rect.left + maxDistance);

  return pointX >= rect.left && pointX <= maxX;
}

function getRectCenter(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// Example styling: toggle DOM attributes consumed by tree example CSS.
function updateActiveTreeDropTarget({
  root,
  activeDropTarget,
  previousDropTarget,
}: {
  root: ParentNode | null;
  activeDropTarget: string | null;
  previousDropTarget: string | null;
}): void {
  if (activeDropTarget === previousDropTarget) {
    return;
  }

  setTreeDropTargetActive(root, previousDropTarget, false);
  setTreeDropTargetActive(root, activeDropTarget, true);
}

function clearActiveTreeDropTargets(root: ParentNode | null): void {
  getTreeDropTargetElements(root).forEach((element) => {
    delete element.dataset.treeActiveDropTarget;
  });
}

function setTreeDropTargetActive(
  root: ParentNode | null,
  dropTargetId: string | null,
  isActive: boolean,
): void {
  if (!dropTargetId) {
    return;
  }

  getTreeDropTargetElements(root).forEach((element) => {
    if (element.dataset.treeDropTargetId !== dropTargetId) {
      return;
    }

    if (isActive) {
      element.dataset.treeActiveDropTarget = "true";
    } else {
      delete element.dataset.treeActiveDropTarget;
    }
  });
}

function getTreeDropTargetElements(
  root: ParentNode | null,
): NodeListOf<HTMLElement> {
  return (root ?? document).querySelectorAll("[data-tree-drop-target-id]");
}
