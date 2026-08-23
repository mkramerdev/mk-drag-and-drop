import {
  centerToCenter,
  createDragController,
  createDragHandle,
  createSortable,
  maxOverlayCenterDistanceToRect,
  type DragEndEvent,
  type DragUpdateEvent,
} from "@mk-drag-and-drop/dom";

import {
  getColumn,
  getCarrierOverlayPresentation,
  getRow,
  initialColumnOrder,
  initialRowOrder,
  isColumnGroup,
  isRowGroup,
  referenceColumnGroup,
  referenceRowGroup,
  tableColumnGroup,
  tableRowGroup,
  type ColumnId,
  type RowId,
} from "@repo/carrier-table-example/model";
import {
  applySortablePlacement,
  applySortablePreview,
  formatSortablePreviewAnchors,
  ordersEqual,
} from "@repo/carrier-table-example/sortable-placement";

const headerHeight = 44;
const placementBoundary = { start: 0.25, end: 0.75 } as const;
const pointerConfiguration = {
  activationDelay: 180,
  activationDistance: 6,
} as const;
const targetingConstraint = maxOverlayCenterDistanceToRect({
  maxDistance: 120,
});

type ActiveMenu = { kind: "row"; id: RowId } | { kind: "column"; id: ColumnId };

export function mountCarrierTable(root: HTMLElement): () => void {
  let canonicalRows = [...initialRowOrder];
  let canonicalColumns = [...initialColumnOrder];
  let projectedRows = [...canonicalRows];
  let projectedColumns = [...canonicalColumns];
  let referenceRows = [...initialRowOrder];
  let referenceColumns = [...initialColumnOrder];
  let rowCommitCount = 0;
  let columnCommitCount = 0;
  let activeMenu: ActiveMenu | null = null;
  let activeGroup: string | null = null;
  let activeDraggableId: string | null = null;
  let activeTargetId: string | null = null;
  let activeNormalizedTargetId: string | null = null;
  let lastPointer = { x: 0, y: 0 };
  let pendingGeometryFrame: number | null = null;
  let pendingGeometryGroup: string | null = null;
  let autoscrollFrame: number | null = null;
  let geometrySyncCount = 0;
  const rowCarriers = new Map<RowId, HTMLElement>();
  const columnCarriers = new Map<ColumnId, HTMLElement>();
  const referenceRowItems = new Map<RowId, HTMLElement>();
  const referenceColumnItems = new Map<ColumnId, HTMLElement>();

  const controller = createDragController({
    targetingAlgorithm: centerToCenter,
    targetingConstraint,
    pointerConfiguration,
    dragOverlay: ({ dragState, phase }) => {
      const presentation = getCarrierOverlayPresentation(dragState.group);
      const overlay = document.createElement("div");
      overlay.className = `carrierBlankOverlay carrierBlankOverlay--${presentation.variant}`;
      overlay.dataset.testid = "drag-overlay";
      overlay.dataset.overlayGroup = dragState.group;
      overlay.dataset.overlayAxis = presentation.axis;
      overlay.dataset.overlayVariant = presentation.variant;
      overlay.dataset.overlayPhase = phase;
      overlay.setAttribute("aria-hidden", "true");
      return overlay;
    },
    onDragStart(event) {
      activeGroup = event.group;
      activeDraggableId = event.draggableId;
      activeTargetId = null;
      activeNormalizedTargetId = null;
      lastPointer = event.pointerPosition;
      lastResult.textContent = "dragging";

      if (event.group === tableRowGroup) {
        setProjectedRows(canonicalRows);
      } else if (event.group === tableColumnGroup) {
        setProjectedColumns(canonicalColumns);
      }

      startAutoscroll();
    },
    onDragUpdate(event) {
      lastPointer = event.pointerPosition;
      activeTargetId = event.activeDropTargetId;
      activeDropTarget.textContent = activeTargetId ?? "none";
      renderLivePlacement(event);

      if (event.sortablePreview.status === "inactive") {
        return;
      }

      if (event.group === tableRowGroup) {
        setProjectedRows(
          applySortablePreview(
            canonicalRows,
            event.draggableId,
            event.sortablePreview,
          ),
        );
      } else if (event.group === tableColumnGroup) {
        setProjectedColumns(
          applySortablePreview(
            canonicalColumns,
            event.draggableId,
            event.sortablePreview,
          ),
        );
      }
    },
    onDragEnd(event) {
      lastResult.textContent = event.result;
      stopAutoscroll();
      cancelGeometrySync();

      if (event.result !== "dropped") {
        restoreProjection(event);
        cancelGeometrySync();
      }

      if (event.result !== "dropped") {
        clearActiveDrag();
      }
    },
    onDrop(event) {
      const placement = event.sortablePlacement;

      if (event.group === tableRowGroup) {
        if (placement) {
          canonicalRows = applySortablePlacement(
            canonicalRows,
            event.draggableId,
            placement,
          );
          rowCommitCount += 1;
        }
        projectedRows = [...canonicalRows];
        reorderCarrierNodes(rowLane, rowCarriers, canonicalRows);
      } else if (event.group === tableColumnGroup) {
        if (placement) {
          canonicalColumns = applySortablePlacement(
            canonicalColumns,
            event.draggableId,
            placement,
          );
          columnCommitCount += 1;
        }
        projectedColumns = [...canonicalColumns];
        reorderCarrierNodes(columnLane, columnCarriers, canonicalColumns);
      } else if (event.group === referenceRowGroup && placement) {
        referenceRows = applySortablePlacement(
          referenceRows,
          event.draggableId,
          placement,
        );
        reorderCarrierNodes(referenceRowList, referenceRowItems, referenceRows);
      } else if (event.group === referenceColumnGroup && placement) {
        referenceColumns = applySortablePlacement(
          referenceColumns,
          event.draggableId,
          placement,
        );
        reorderCarrierNodes(
          referenceColumnList,
          referenceColumnItems,
          referenceColumns,
        );
      }

      renderTable();
      renderDebugState();
      clearActiveDrag();
    },
  });

  const panel = document.createElement("section");
  panel.className = "examplePanel carrierExamplePanel";
  panel.dataset.testid = "carrier-example";

  const headingRow = document.createElement("div");
  headingRow.className = "carrierHeadingRow";
  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Carrier-backed table parity";
  const backLink = document.createElement("a");
  backLink.href = "/";
  backLink.textContent = "All examples";
  headingRow.append(title, backLink);

  const description = document.createElement("p");
  description.className = "carrierDescription";
  description.textContent =
    "Drag the thin row and column menu buttons. The table projects normalized placement while canonical data waits for drop.";

  const scrollRegion = document.createElement("div");
  scrollRegion.className = "carrierScrollRegion";
  scrollRegion.dataset.testid = "carrier-scroll-region";
  const scrollCanvas = document.createElement("div");
  scrollCanvas.className = "carrierScrollCanvas";
  const tableStage = document.createElement("div");
  tableStage.className = "carrierTableStage";
  tableStage.dataset.testid = "carrier-table";
  const table = document.createElement("table");
  table.className = "carrierVisibleTable";
  const rowLane = document.createElement("div");
  rowLane.className = "rowCarrierLane";
  rowLane.dataset.testid = "carrier-row-lane";
  const columnLane = document.createElement("div");
  columnLane.className = "columnCarrierLane";
  columnLane.dataset.testid = "carrier-column-lane";
  tableStage.append(table, rowLane, columnLane);
  scrollCanvas.append(tableStage);
  scrollRegion.append(scrollCanvas);

  const menuPanel = document.createElement("div");
  menuPanel.className = "carrierMenuPanel";
  menuPanel.dataset.testid = "active-menu";
  menuPanel.hidden = true;

  const controls = document.createElement("div");
  controls.className = "carrierControls";
  const disconnectButton = document.createElement("button");
  disconnectButton.type = "button";
  disconnectButton.dataset.testid = "disconnect-active-target";
  disconnectButton.textContent = "Disconnect active target";
  disconnectButton.addEventListener("click", disconnectActiveTarget);
  const disconnectNormalizedButton = document.createElement("button");
  disconnectNormalizedButton.type = "button";
  disconnectNormalizedButton.dataset.testid = "disconnect-normalized-target";
  disconnectNormalizedButton.textContent = "Disconnect normalized target";
  disconnectNormalizedButton.addEventListener(
    "click",
    disconnectNormalizedTarget,
  );
  const syncButton = document.createElement("button");
  syncButton.type = "button";
  syncButton.dataset.testid = "synchronize-geometry";
  syncButton.textContent = "Synchronize geometry";
  syncButton.addEventListener("click", () => {
    if (activeGroup) {
      requestGeometrySync(activeGroup);
    }
  });
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.dataset.testid = "reset-carrier-example";
  resetButton.textContent = "Reset example";
  resetButton.addEventListener("click", resetExample);
  controls.append(
    disconnectButton,
    disconnectNormalizedButton,
    syncButton,
    resetButton,
  );

  const debug = document.createElement("dl");
  debug.className = "carrierDebug";
  const canonicalRowOrder = addDebugValue(
    debug,
    "Canonical rows",
    "canonical-row-order",
  );
  const canonicalColumnOrder = addDebugValue(
    debug,
    "Canonical columns",
    "canonical-column-order",
  );
  const projectedRowOrder = addDebugValue(
    debug,
    "Projected rows",
    "projected-row-order",
  );
  const projectedColumnOrder = addDebugValue(
    debug,
    "Projected columns",
    "projected-column-order",
  );
  const rowCommitCountElement = addDebugValue(
    debug,
    "Row commits",
    "row-commit-count",
  );
  const columnCommitCountElement = addDebugValue(
    debug,
    "Column commits",
    "column-commit-count",
  );
  const lastResult = addDebugValue(debug, "Last result", "last-result");
  const liveTarget = addDebugValue(debug, "Live target", "live-target-id");
  const activeDropTarget = addDebugValue(
    debug,
    "Active drop target",
    "active-drop-target-id",
  );
  const livePreviewAnchors = addDebugValue(
    debug,
    "Live preview anchors",
    "live-preview-anchors",
  );
  const geometrySyncCountElement = addDebugValue(
    debug,
    "Geometry syncs",
    "geometry-sync-count",
  );

  const referenceSection = document.createElement("section");
  referenceSection.className = "carrierReferences";
  const referenceTitle = document.createElement("h3");
  referenceTitle.textContent = "Ordinary sortable references";
  const referenceRowViewport = document.createElement("div");
  referenceRowViewport.className = "carrierReferenceViewport";
  referenceRowViewport.dataset.referenceViewport = referenceRowGroup;
  const referenceRowList = document.createElement("div");
  referenceRowList.className = "referenceRowList";
  referenceRowList.dataset.testid = "reference-row-list";
  referenceRowViewport.append(referenceRowList);
  const referenceColumnViewport = document.createElement("div");
  referenceColumnViewport.className = "carrierReferenceViewport";
  referenceColumnViewport.dataset.referenceViewport = referenceColumnGroup;
  const referenceColumnList = document.createElement("div");
  referenceColumnList.className = "referenceColumnList";
  referenceColumnList.dataset.testid = "reference-column-list";
  referenceColumnViewport.append(referenceColumnList);
  referenceSection.append(
    referenceTitle,
    referenceRowViewport,
    referenceColumnViewport,
  );

  panel.append(
    headingRow,
    description,
    scrollRegion,
    menuPanel,
    controls,
    debug,
    referenceSection,
  );
  root.append(panel);

  createAllCarrierNodes();
  createAllReferenceNodes();
  renderTable();
  renderDebugState();
  scrollRegion.addEventListener("scroll", handleScroll, { passive: true });
  referenceRowViewport.addEventListener("scroll", handleScroll, {
    passive: true,
  });
  referenceColumnViewport.addEventListener("scroll", handleScroll, {
    passive: true,
  });
  window.addEventListener("pointermove", handleAutoscrollPointer, true);

  return () => {
    controller.cancelDrag();
    stopAutoscroll();
    cancelGeometrySync();
    window.removeEventListener("pointermove", handleAutoscrollPointer, true);
    scrollRegion.removeEventListener("scroll", handleScroll);
    referenceRowViewport.removeEventListener("scroll", handleScroll);
    referenceColumnViewport.removeEventListener("scroll", handleScroll);
    root.replaceChildren();
  };

  function createAllCarrierNodes(): void {
    for (const rowId of canonicalRows) {
      const carrier = createRowCarrier(rowId);
      rowCarriers.set(rowId, carrier);
      rowLane.append(carrier);
      registerSortable(carrier, rowId, tableRowGroup, "vertical");
    }

    for (const columnId of canonicalColumns) {
      const carrier = createColumnCarrier(columnId);
      columnCarriers.set(columnId, carrier);
      columnLane.append(carrier);
      registerSortable(carrier, columnId, tableColumnGroup, "horizontal");
    }
  }

  function createAllReferenceNodes(): void {
    for (const rowId of referenceRows) {
      const item = createReferenceRow(rowId);
      referenceRowItems.set(rowId, item);
      referenceRowList.append(item);
      registerSortable(item, rowId, referenceRowGroup, "vertical");
    }

    for (const columnId of referenceColumns) {
      const item = createReferenceColumn(columnId);
      referenceColumnItems.set(columnId, item);
      referenceColumnList.append(item);
      registerSortable(item, columnId, referenceColumnGroup, "horizontal");
    }
  }

  function registerSortable(
    element: HTMLElement,
    draggableId: string,
    group: string,
    axis: "vertical" | "horizontal",
  ): void {
    createSortable({
      controller,
      element,
      draggableId,
      group,
      axis,
      placementBoundary,
    });
  }

  function createRowCarrier(rowId: RowId): HTMLElement {
    const row = getRow(rowId);
    const carrier = document.createElement("div");
    carrier.className = "rowCarrier";
    carrier.dataset.testid = `carrier-row-${rowId}`;
    carrier.dataset.carrierRowId = rowId;
    carrier.style.height = `${row.height}px`;
    const button = createMenuButton({ kind: "row", id: rowId });
    carrier.append(button);
    return carrier;
  }

  function createColumnCarrier(columnId: ColumnId): HTMLElement {
    const column = getColumn(columnId);
    const carrier = document.createElement("div");
    carrier.className = "columnCarrier";
    carrier.dataset.testid = `carrier-column-${columnId}`;
    carrier.dataset.carrierColumnId = columnId;
    carrier.style.width = `${column.width}px`;
    const button = createMenuButton({ kind: "column", id: columnId });
    carrier.append(button);
    return carrier;
  }

  function createMenuButton(menu: ActiveMenu): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      menu.kind === "row" ? "rowCarrierButton" : "columnCarrierButton";
    button.dataset.testid =
      menu.kind === "row" ? `row-menu-${menu.id}` : `column-menu-${menu.id}`;
    button.setAttribute(
      "aria-label",
      menu.kind === "row"
        ? `Open menu for row ${menu.id}`
        : `Open menu for column ${getColumn(menu.id).label}`,
    );
    button.textContent = "⋮";
    button.addEventListener("click", () => {
      activeMenu =
        activeMenu?.kind === menu.kind && activeMenu.id === menu.id
          ? null
          : menu;
      renderMenu();
    });
    createDragHandle({ element: button });
    return button;
  }

  function createReferenceRow(rowId: RowId): HTMLElement {
    const row = getRow(rowId);
    const element = document.createElement("div");
    element.className = "referenceRowItem";
    element.dataset.testid = `reference-row-${rowId}`;
    element.dataset.referenceRowId = rowId;
    element.style.height = `${row.height}px`;
    const label = document.createElement("span");
    label.className = "referenceItemLabel";
    label.textContent = rowId;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "referenceDragHandle referenceRowHandle";
    handle.setAttribute("aria-label", `Drag ${rowId}`);
    handle.textContent = "⋮";
    createDragHandle({ element: handle });
    element.append(label, handle);
    return element;
  }

  function createReferenceColumn(columnId: ColumnId): HTMLElement {
    const column = getColumn(columnId);
    const element = document.createElement("div");
    element.className = "referenceColumnItem";
    element.dataset.testid = `reference-column-${columnId}`;
    element.dataset.referenceColumnId = columnId;
    element.style.width = `${column.width}px`;
    const label = document.createElement("span");
    label.className = "referenceItemLabel";
    label.textContent = column.label;
    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "referenceDragHandle referenceColumnHandle";
    handle.setAttribute("aria-label", `Drag column ${column.label}`);
    handle.textContent = "⋮";
    createDragHandle({ element: handle });
    element.append(label, handle);
    return element;
  }

  function renderTable(): void {
    const head = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.style.height = `${headerHeight}px`;

    for (const columnId of projectedColumns) {
      const column = getColumn(columnId);
      const cell = document.createElement("th");
      cell.dataset.columnId = columnId;
      cell.style.width = `${column.width}px`;
      cell.textContent = column.label;
      headerRow.append(cell);
    }

    head.append(headerRow);
    const body = document.createElement("tbody");

    for (const rowId of projectedRows) {
      const row = getRow(rowId);
      const rowElement = document.createElement("tr");
      rowElement.dataset.rowId = rowId;
      rowElement.style.height = `${row.height}px`;

      for (const columnId of projectedColumns) {
        const column = getColumn(columnId);
        const cell = document.createElement("td");
        cell.dataset.columnId = columnId;
        cell.style.width = `${column.width}px`;
        cell.textContent = row.cells[columnId];
        rowElement.append(cell);
      }

      body.append(rowElement);
    }

    table.replaceChildren(head, body);
  }

  function setProjectedRows(nextOrder: readonly RowId[]): void {
    if (ordersEqual(projectedRows, nextOrder)) {
      return;
    }

    projectedRows = [...nextOrder];
    renderTable();
    renderDebugState();
  }

  function setProjectedColumns(nextOrder: readonly ColumnId[]): void {
    if (ordersEqual(projectedColumns, nextOrder)) {
      return;
    }

    projectedColumns = [...nextOrder];
    renderTable();
    renderDebugState();
  }

  function restoreProjection(event: DragEndEvent): void {
    if (event.group === tableRowGroup) {
      setProjectedRows(canonicalRows);
    } else if (event.group === tableColumnGroup) {
      setProjectedColumns(canonicalColumns);
    }
  }

  function renderDebugState(): void {
    canonicalRowOrder.textContent = canonicalRows.join(",");
    canonicalColumnOrder.textContent = canonicalColumns.join(",");
    projectedRowOrder.textContent = projectedRows.join(",");
    projectedColumnOrder.textContent = projectedColumns.join(",");
    rowCommitCountElement.textContent = String(rowCommitCount);
    columnCommitCountElement.textContent = String(columnCommitCount);
    geometrySyncCountElement.textContent = String(geometrySyncCount);
  }

  function renderLivePlacement(event: DragUpdateEvent): void {
    const preview = event.sortablePreview;
    activeNormalizedTargetId =
      preview.status === "inactive"
        ? null
        : preview.placement.targetDraggableId;
    liveTarget.textContent =
      preview.status === "inactive"
        ? "inactive"
        : preview.placement.targetDraggableId ?? "none";
    liveTarget.dataset.previewStatus = preview.status;
    livePreviewAnchors.textContent = formatSortablePreviewAnchors(preview);
  }

  function renderMenu(): void {
    menuPanel.hidden = activeMenu === null;
    menuPanel.textContent = activeMenu
      ? `${activeMenu.kind} menu: ${activeMenu.id}`
      : "";
  }

  function requestGeometrySync(group: string): void {
    pendingGeometryGroup = group;

    if (pendingGeometryFrame !== null) {
      return;
    }

    pendingGeometryFrame = window.requestAnimationFrame(() => {
      pendingGeometryFrame = null;
      const groupToSync = pendingGeometryGroup;
      pendingGeometryGroup = null;

      if (!groupToSync || activeGroup !== groupToSync) {
        return;
      }

      controller.remeasureDropTargets({ group: groupToSync });
      controller.recomputeActiveDrag();
      geometrySyncCount += 1;
      renderDebugState();
    });
  }

  function cancelGeometrySync(): void {
    if (pendingGeometryFrame !== null) {
      window.cancelAnimationFrame(pendingGeometryFrame);
    }

    pendingGeometryFrame = null;
    pendingGeometryGroup = null;
  }

  function handleScroll(): void {
    if (activeGroup) {
      requestGeometrySync(activeGroup);
    }
  }

  function handleAutoscrollPointer(event: PointerEvent): void {
    if (!activeGroup) {
      return;
    }

    lastPointer = { x: event.clientX, y: event.clientY };
  }

  function startAutoscroll(): void {
    stopAutoscroll();

    const tick = (): void => {
      autoscrollFrame = null;
      const viewport = getActiveViewport();

      if (!activeGroup || !viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const edge = 28;
      const previousTop = viewport.scrollTop;
      const previousLeft = viewport.scrollLeft;

      if (isRowGroup(activeGroup)) {
        if (lastPointer.y > rect.bottom - edge) viewport.scrollTop += 12;
        if (lastPointer.y < rect.top + edge) viewport.scrollTop -= 12;
      } else if (isColumnGroup(activeGroup)) {
        if (lastPointer.x > rect.right - edge) viewport.scrollLeft += 12;
        if (lastPointer.x < rect.left + edge) viewport.scrollLeft -= 12;
      }

      if (
        viewport.scrollTop !== previousTop ||
        viewport.scrollLeft !== previousLeft
      ) {
        requestGeometrySync(activeGroup);
      }

      autoscrollFrame = window.requestAnimationFrame(tick);
    };

    autoscrollFrame = window.requestAnimationFrame(tick);
  }

  function stopAutoscroll(): void {
    if (autoscrollFrame !== null) {
      window.cancelAnimationFrame(autoscrollFrame);
      autoscrollFrame = null;
    }
  }

  function getActiveViewport(): HTMLElement | null {
    if (activeGroup === tableRowGroup || activeGroup === tableColumnGroup) {
      return scrollRegion;
    }

    if (activeGroup === referenceRowGroup) {
      return referenceRowViewport;
    }

    return activeGroup === referenceColumnGroup
      ? referenceColumnViewport
      : null;
  }

  function disconnectActiveTarget(): void {
    cancelGeometrySync();
    if (activeGroup === tableRowGroup) {
      disconnectTargets([...rowCarriers.keys()]);
    } else if (activeGroup === tableColumnGroup) {
      disconnectTargets([...columnCarriers.keys()]);
    }
  }

  function disconnectNormalizedTarget(): void {
    cancelGeometrySync();
    disconnectTargets([
      [activeNormalizedTargetId, activeTargetId].find(
        (id) => id !== null && id !== activeDraggableId,
      ) ?? null,
    ]);
  }

  function disconnectTargets(targetIds: readonly (string | null)[]): void {
    if (!activeGroup) {
      return;
    }

    for (const targetId of new Set(targetIds)) {
      if (!targetId) continue;
      if (activeGroup === tableRowGroup) {
        rowCarriers.get(targetId as RowId)?.remove();
      } else if (activeGroup === tableColumnGroup) {
        columnCarriers.get(targetId as ColumnId)?.remove();
      }
    }

    liveTarget.textContent = "disconnected";
  }

  function resetExample(): void {
    canonicalRows = [...initialRowOrder];
    canonicalColumns = [...initialColumnOrder];
    projectedRows = [...canonicalRows];
    projectedColumns = [...canonicalColumns];
    referenceRows = [...initialRowOrder];
    referenceColumns = [...initialColumnOrder];
    rowCommitCount = 0;
    columnCommitCount = 0;
    activeMenu = null;
    lastResult.textContent = "idle";
    liveTarget.textContent = "none";
    activeDropTarget.textContent = "none";
    livePreviewAnchors.textContent = "none";
    restoreMissingCarriers();
    reorderCarrierNodes(rowLane, rowCarriers, canonicalRows);
    reorderCarrierNodes(columnLane, columnCarriers, canonicalColumns);
    reorderCarrierNodes(referenceRowList, referenceRowItems, referenceRows);
    reorderCarrierNodes(
      referenceColumnList,
      referenceColumnItems,
      referenceColumns,
    );
    renderTable();
    renderMenu();
    renderDebugState();
  }

  function restoreMissingCarriers(): void {
    for (const rowId of canonicalRows) {
      if (rowCarriers.get(rowId)?.isConnected) continue;
      const carrier = createRowCarrier(rowId);
      rowCarriers.set(rowId, carrier);
      rowLane.append(carrier);
      registerSortable(carrier, rowId, tableRowGroup, "vertical");
    }

    for (const columnId of canonicalColumns) {
      if (columnCarriers.get(columnId)?.isConnected) continue;
      const carrier = createColumnCarrier(columnId);
      columnCarriers.set(columnId, carrier);
      columnLane.append(carrier);
      registerSortable(carrier, columnId, tableColumnGroup, "horizontal");
    }
  }

  function clearActiveDrag(): void {
    activeGroup = null;
    activeDraggableId = null;
    activeTargetId = null;
    activeNormalizedTargetId = null;
  }
}

function addDebugValue(
  list: HTMLDListElement,
  label: string,
  testId: string,
): HTMLElement {
  const term = document.createElement("dt");
  term.textContent = label;
  const value = document.createElement("dd");
  value.dataset.testid = testId;
  value.textContent = "idle";
  list.append(term, value);
  return value;
}

function reorderCarrierNodes<Id extends string>(
  parent: HTMLElement,
  nodes: ReadonlyMap<Id, HTMLElement>,
  order: readonly Id[],
): void {
  for (const id of order) {
    const node = nodes.get(id);
    if (node) parent.append(node);
  }
}
