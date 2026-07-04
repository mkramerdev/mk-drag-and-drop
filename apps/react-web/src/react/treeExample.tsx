import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";
import { ChevronDown, ChevronRight, Menu } from "lucide-react";

import {
  DragProvider,
  composeRefs,
  getDistanceToRect,
  useDragHandle,
  useDraggable,
  useDroppable,
  type DropTarget,
  type TargetingAlgorithm,
  type TargetingAlgorithmInput,
  type TargetingConstraint,
} from "@mk-drag-and-drop/react";

const treeGroup = "tree-example";
const rootToken = "root";
const treeDepthInsetRem = 1.5;
const treeInsideTargetMaxXDistance = 120;
const treeInsideTargetMaxYDistance = 8;
const treeLineTargetMaxXDistance = 180;
const treeLineTargetMaxYDistance = 24;
// Example targeting: custom tree rules are passed into the package runtime.
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

// Example state: seed tree data is user-owned and mutated on drop.
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

export function TreeExample(): ReactElement {
  const rootRef = useRef<HTMLElement | null>(null);
  // Example state: tree data and expansion state live outside the package runtime.
  const [treeState, setTreeState] = useState<TreeState>(() =>
    createTreeState(seedItems),
  );
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    () => new Set(initialExpandedItemIds),
  );
  const projection = useMemo(
    () => createTreeProjection(treeState, expandedItemIds),
    [expandedItemIds, treeState],
  );

  function toggleExpanded(draggableId: string): void {
    setExpandedItemIds((currentExpandedItemIds) => {
      const nextExpandedItemIds = new Set(currentExpandedItemIds);

      if (nextExpandedItemIds.has(draggableId)) {
        nextExpandedItemIds.delete(draggableId);
      } else {
        nextExpandedItemIds.add(draggableId);
      }

      return nextExpandedItemIds;
    });
  }

  return (
    // Package API: DragProvider owns drag lifecycle and runtime configuration.
    <DragProvider
      targetingAlgorithm={treeVerticalTargeting}
      targetingConstraint={treeTargetingConstraint}
      dragOverlay={({ dragState }) => (
        <TreeDragOverlay
          label={getTreeItemLabel(treeState, dragState.draggableId)}
        />
      )}
      onDragStart={() => {
        clearActiveTreeDropTargets(rootRef.current);
      }}
      onDragUpdate={({ activeDropTarget, previousDropTarget }) => {
        updateActiveTreeDropTarget({
          root: rootRef.current,
          activeDropTarget,
          previousDropTarget,
        });
      }}
      onDragEnd={() => {
        clearActiveTreeDropTargets(rootRef.current);
      }}
      onDrop={({ draggableId, dropTarget }) => {
        // Example drop behavior: interpret package drop target ids for tree data.
        setTreeState((currentTreeState) =>
          moveTreeItem(currentTreeState, draggableId, dropTarget),
        );
      }}
    >
      <section ref={rootRef} className="examplePanel treeExamplePanel">
        <h2 className="exampleTitle">Tree</h2>
        <div className="treeExample" role="tree">
          {projection.entries.map((entry) =>
            entry.type === "row" ? (
              <TreeRow
                key={`row:${entry.item.draggableId}`}
                row={entry}
                onToggleExpanded={toggleExpanded}
              />
            ) : (
              <TreeDropzoneLine key={entry.targetId} line={entry} />
            ),
          )}
        </div>
      </section>
    </DragProvider>
  );
}

// Example rendering: row markup is app-owned; hooks wire it to the package.
function TreeRow({
  row,
  onToggleExpanded,
}: {
  row: ProjectedTreeRow;
  onToggleExpanded: (draggableId: string) => void;
}): ReactElement {
  const targetId = getInsideTargetId(row.item.draggableId);
  // Package API: each tree row is draggable and also an inside drop target.
  const draggable = useDraggable({
    draggableId: row.item.draggableId,
    group: treeGroup,
  });
  const droppable = useDroppable({
    targetId,
    group: treeGroup,
  });
  const dragHandle = useDragHandle<HTMLButtonElement>();
  const { ref: draggableRef, ...draggableProps } = draggable;
  const { ref: droppableRef, ...droppableProps } = droppable;
  const rowRef = useMemo(
    () => composeRefs(draggableRef, droppableRef),
    [draggableRef, droppableRef],
  );

  return (
    <div
      {...draggableProps}
      {...droppableProps}
      ref={rowRef}
      className="treeRow"
      style={getTreeDepthStyle(row.depth)}
      data-tree-drop-target-id={targetId}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.hasChildren ? row.isExpanded : undefined}
    >
      <button
        type="button"
        {...dragHandle}
        className="treeDragHandle"
        aria-label={`Drag ${row.item.label}`}
      >
        <Menu />
      </button>
      <span className="treeRowLabel">{row.item.label}</span>
      {row.hasChildren ? (
        <button
          type="button"
          className="treeToggle"
          aria-label={
            row.isExpanded
              ? `Collapse ${row.item.label}`
              : `Expand ${row.item.label}`
          }
          onClick={() => onToggleExpanded(row.item.draggableId)}
        >
          {row.isExpanded ? <ChevronDown /> : <ChevronRight />}
        </button>
      ) : null}
    </div>
  );
}

// Example rendering: generated line markup is app-owned; droppable hook registers it.
function TreeDropzoneLine({
  line,
}: {
  line: ProjectedDropzoneLine;
}): ReactElement {
  // Package API: registers this generated insertion line as a drop target.
  const droppable = useDroppable({
    targetId: line.targetId,
    group: treeGroup,
  });

  return (
    <div
      {...droppable}
      className="treeDropzoneLine"
      style={getTreeDepthStyle(line.depth)}
      data-tree-drop-target-id={line.targetId}
      aria-hidden="true"
    >
      <div className="treeDropzoneLineIndicator" />
    </div>
  );
}

// Example rendering: overlay markup is app-owned and derives from drag state.
function TreeDragOverlay({ label }: { label: string }): ReactElement {
  return (
    <div className="treeDragOverlay">
      <div className="treeDragHandle">
        <Menu />
      </div>
      <span className="treeRowLabel">{label}</span>
    </div>
  );
}

function createTreeState(items: readonly TreeItem[]): TreeState {
  return {
    itemsById: Object.fromEntries(
      items.map((item) => [item.draggableId, item]),
    ) as Record<string, TreeItem>,
    orderedItemIds: items.map((item) => item.draggableId),
  };
}

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

// Example drop behavior: apply tree-specific target interpretation to app data.
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

// Example drop behavior: preserve descendants while moving one tree item.
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

function getTreeDepthStyle(depth: number): CSSProperties {
  const inset = `${depth * treeDepthInsetRem}rem`;

  return {
    marginLeft: inset,
    width: depth === 0 ? "100%" : `calc(100% - ${inset})`,
  };
}

const treeVerticalTargeting: TargetingAlgorithm = Object.assign(
  (input: TargetingAlgorithmInput) =>
    findClosestVerticalTarget(
      input.overlayRect ? getRectCenter(input.overlayRect) : input.pointerPosition,
      input.dropTargets,
    ),
  { mode: "rect" as const },
);

// Example targeting: vertical nearest-target matching for tree rows and lines.
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

function getRectCenter(rect: { left: number; top: number; width: number; height: number }): {
  x: number;
  y: number;
} {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// Example styling: active target attributes drive demo CSS highlights.
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
