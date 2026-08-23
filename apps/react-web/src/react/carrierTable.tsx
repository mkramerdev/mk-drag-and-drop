import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  centerToCenter,
  DragProvider,
  maxOverlayCenterDistanceToRect,
  useDragHandle,
  useRemeasureDropTargets,
  useRecomputeActiveDrag,
  useSortable,
  type DragEndEvent,
  type DragUpdateEvent,
} from "@mk-drag-and-drop/react";
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

const placementBoundary = { start: 0.25, end: 0.75 } as const;
const pointerConfiguration = {
  activationDelay: 180,
  activationDistance: 6,
} as const;
const targetingConstraint = maxOverlayCenterDistanceToRect({
  maxDistance: 120,
});

type ActiveMenu = { kind: "row"; id: RowId } | { kind: "column"; id: ColumnId };

export function CarrierTable(): ReactElement {
  const [canonicalRows, setCanonicalRows] = useState(initialRowOrder);
  const [canonicalColumns, setCanonicalColumns] = useState(initialColumnOrder);
  const [projectedRows, setProjectedRows] = useState(initialRowOrder);
  const [projectedColumns, setProjectedColumns] = useState(initialColumnOrder);
  const [referenceRows, setReferenceRows] = useState(initialRowOrder);
  const [referenceColumns, setReferenceColumns] = useState(initialColumnOrder);
  const [rowCommitCount, setRowCommitCount] = useState(0);
  const [columnCommitCount, setColumnCommitCount] = useState(0);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [activeDraggableId, setActiveDraggableId] = useState<string | null>(
    null,
  );
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [activeNormalizedTargetId, setActiveNormalizedTargetId] = useState<
    string | null
  >(null);
  const [disabledRows, setDisabledRows] = useState<ReadonlySet<RowId>>(
    () => new Set(),
  );
  const [disabledColumns, setDisabledColumns] = useState<ReadonlySet<ColumnId>>(
    () => new Set(),
  );
  const [lastResult, setLastResult] = useState("idle");
  const [liveTarget, setLiveTarget] = useState("none");
  const [livePreviewAnchors, setLivePreviewAnchors] = useState("none");

  const openMenu = useCallback((menu: ActiveMenu): void => {
    setActiveMenu((current) =>
      current?.kind === menu.kind && current.id === menu.id ? null : menu,
    );
  }, []);

  const handleDragUpdate = useCallback(
    (event: DragUpdateEvent): void => {
      setActiveTargetId(event.activeDropTargetId);
      setActiveNormalizedTargetId(
        event.sortablePreview.status === "inactive"
          ? null
          : event.sortablePreview.placement.targetDraggableId,
      );
      setLiveTarget(
        event.sortablePreview.status === "inactive"
          ? "inactive"
          : event.sortablePreview.placement.targetDraggableId ?? "none",
      );
      setLivePreviewAnchors(
        formatSortablePreviewAnchors(event.sortablePreview),
      );

      if (event.sortablePreview.status === "inactive") {
        return;
      }

      if (event.group === tableRowGroup) {
        const nextOrder = applySortablePreview(
          canonicalRows,
          event.draggableId,
          event.sortablePreview,
        );
        setProjectedRows((current) =>
          ordersEqual(current, nextOrder) ? current : nextOrder,
        );
      } else if (event.group === tableColumnGroup) {
        const nextOrder = applySortablePreview(
          canonicalColumns,
          event.draggableId,
          event.sortablePreview,
        );
        setProjectedColumns((current) =>
          ordersEqual(current, nextOrder) ? current : nextOrder,
        );
      }
    },
    [canonicalColumns, canonicalRows],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent): void => {
      setLastResult(event.result);

      if (event.result !== "dropped") {
        if (event.group === tableRowGroup) {
          setProjectedRows(canonicalRows);
        } else if (event.group === tableColumnGroup) {
          setProjectedColumns(canonicalColumns);
        }

        setActiveGroup(null);
        setActiveDraggableId(null);
        setActiveTargetId(null);
      }

      if (event.result === "invalid-target") {
        setDisabledRows(new Set());
        setDisabledColumns(new Set());
      }
    },
    [canonicalColumns, canonicalRows],
  );

  const resetExample = useCallback((): void => {
    setCanonicalRows(initialRowOrder);
    setCanonicalColumns(initialColumnOrder);
    setProjectedRows(initialRowOrder);
    setProjectedColumns(initialColumnOrder);
    setReferenceRows(initialRowOrder);
    setReferenceColumns(initialColumnOrder);
    setRowCommitCount(0);
    setColumnCommitCount(0);
    setActiveMenu(null);
    setActiveGroup(null);
    setActiveDraggableId(null);
    setActiveTargetId(null);
    setActiveNormalizedTargetId(null);
    setDisabledRows(new Set());
    setDisabledColumns(new Set());
    setLastResult("idle");
    setLiveTarget("none");
    setLivePreviewAnchors("none");
  }, []);

  return (
    <DragProvider
      targetingAlgorithm={centerToCenter}
      targetingConstraint={targetingConstraint}
      pointerConfiguration={pointerConfiguration}
      onDragStart={(event) => {
        setActiveGroup(event.group);
        setActiveDraggableId(event.draggableId);
        setActiveTargetId(null);
        setActiveNormalizedTargetId(null);
        setLastResult("dragging");

        if (event.group === tableRowGroup) {
          setProjectedRows(canonicalRows);
        } else if (event.group === tableColumnGroup) {
          setProjectedColumns(canonicalColumns);
        }
      }}
      onDragUpdate={handleDragUpdate}
      onDragEnd={handleDragEnd}
      onDrop={(event) => {
        const placement = event.sortablePlacement;

        if (event.group === tableRowGroup) {
          const nextRows = placement
            ? applySortablePlacement(
                canonicalRows,
                event.draggableId,
                placement,
              )
            : [...canonicalRows];

          if (placement) {
            setCanonicalRows(nextRows);
            setRowCommitCount((count) => count + 1);
          }
          setProjectedRows(nextRows);
        } else if (event.group === tableColumnGroup) {
          const nextColumns = placement
            ? applySortablePlacement(
                canonicalColumns,
                event.draggableId,
                placement,
              )
            : [...canonicalColumns];

          if (placement) {
            setCanonicalColumns(nextColumns);
            setColumnCommitCount((count) => count + 1);
          }
          setProjectedColumns(nextColumns);
        } else if (event.group === referenceRowGroup && placement) {
          const nextRows = applySortablePlacement(
            referenceRows,
            event.draggableId,
            placement,
          );
          setReferenceRows(nextRows);
        } else if (event.group === referenceColumnGroup && placement) {
          const nextColumns = applySortablePlacement(
            referenceColumns,
            event.draggableId,
            placement,
          );
          setReferenceColumns(nextColumns);
        }

        setActiveGroup(null);
        setActiveDraggableId(null);
        setActiveTargetId(null);
      }}
      dragOverlay={({ dragState, phase }) => {
        const presentation = getCarrierOverlayPresentation(dragState.group);

        return (
          <div
            className={`carrierBlankOverlay carrierBlankOverlay--${presentation.variant}`}
            data-testid="drag-overlay"
            data-overlay-group={dragState.group}
            data-overlay-axis={presentation.axis}
            data-overlay-variant={presentation.variant}
            data-overlay-phase={phase}
            aria-hidden="true"
          />
        );
      }}
    >
      <CarrierTableContent
        canonicalRows={canonicalRows}
        canonicalColumns={canonicalColumns}
        projectedRows={projectedRows}
        projectedColumns={projectedColumns}
        referenceRows={referenceRows}
        referenceColumns={referenceColumns}
        rowCommitCount={rowCommitCount}
        columnCommitCount={columnCommitCount}
        activeGroup={activeGroup}
        activeDraggableId={activeDraggableId}
        activeTargetId={activeTargetId}
        activeNormalizedTargetId={activeNormalizedTargetId}
        activeMenu={activeMenu}
        disabledRows={disabledRows}
        disabledColumns={disabledColumns}
        lastResult={lastResult}
        liveTarget={liveTarget}
        livePreviewAnchors={livePreviewAnchors}
        onOpenMenu={openMenu}
        onDisableRow={(rowId) =>
          setDisabledRows((current) => new Set(current).add(rowId))
        }
        onDisableColumn={(columnId) =>
          setDisabledColumns((current) => new Set(current).add(columnId))
        }
        onMarkTargetDisconnected={() => setLiveTarget("disconnected")}
        onReset={resetExample}
      />
    </DragProvider>
  );
}

type CarrierTableContentProps = {
  canonicalRows: readonly RowId[];
  canonicalColumns: readonly ColumnId[];
  projectedRows: readonly RowId[];
  projectedColumns: readonly ColumnId[];
  referenceRows: readonly RowId[];
  referenceColumns: readonly ColumnId[];
  rowCommitCount: number;
  columnCommitCount: number;
  activeGroup: string | null;
  activeDraggableId: string | null;
  activeTargetId: string | null;
  activeNormalizedTargetId: string | null;
  activeMenu: ActiveMenu | null;
  disabledRows: ReadonlySet<RowId>;
  disabledColumns: ReadonlySet<ColumnId>;
  lastResult: string;
  liveTarget: string;
  livePreviewAnchors: string;
  onOpenMenu: (menu: ActiveMenu) => void;
  onDisableRow: (rowId: RowId) => void;
  onDisableColumn: (columnId: ColumnId) => void;
  onMarkTargetDisconnected: () => void;
  onReset: () => void;
};

function CarrierTableContent({
  canonicalRows,
  canonicalColumns,
  projectedRows,
  projectedColumns,
  referenceRows,
  referenceColumns,
  rowCommitCount,
  columnCommitCount,
  activeGroup,
  activeDraggableId,
  activeTargetId,
  activeNormalizedTargetId,
  activeMenu,
  disabledRows,
  disabledColumns,
  lastResult,
  liveTarget,
  livePreviewAnchors,
  onOpenMenu,
  onDisableRow,
  onDisableColumn,
  onMarkTargetDisconnected,
  onReset,
}: CarrierTableContentProps): ReactElement {
  const remeasureDropTargets = useRemeasureDropTargets();
  const recomputeActiveDrag = useRecomputeActiveDrag();
  const tableViewportRef = useRef<HTMLDivElement | null>(null);
  const referenceRowViewportRef = useRef<HTMLDivElement | null>(null);
  const referenceColumnViewportRef = useRef<HTMLDivElement | null>(null);
  const pendingFrameRef = useRef<number | null>(null);
  const pendingGroupRef = useRef<string | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [geometrySyncCount, setGeometrySyncCount] = useState(0);

  const cancelGeometrySync = useCallback((): void => {
    if (pendingFrameRef.current !== null) {
      window.cancelAnimationFrame(pendingFrameRef.current);
    }
    pendingFrameRef.current = null;
    pendingGroupRef.current = null;
  }, []);

  const requestGeometrySync = useCallback(
    (group: string): void => {
      pendingGroupRef.current = group;

      if (pendingFrameRef.current !== null) {
        return;
      }

      pendingFrameRef.current = window.requestAnimationFrame(() => {
        pendingFrameRef.current = null;
        const groupToSync = pendingGroupRef.current;
        pendingGroupRef.current = null;

        if (!groupToSync) {
          return;
        }

        remeasureDropTargets({ group: groupToSync });
        recomputeActiveDrag();
        setGeometrySyncCount((count) => count + 1);
      });
    },
    [remeasureDropTargets, recomputeActiveDrag],
  );

  useEffect(() => {
    if (!activeGroup) {
      cancelGeometrySync();
      return;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
    };
    const getViewport = (): HTMLElement | null => {
      if (activeGroup === tableRowGroup || activeGroup === tableColumnGroup) {
        return tableViewportRef.current;
      }
      if (activeGroup === referenceRowGroup) {
        return referenceRowViewportRef.current;
      }
      return activeGroup === referenceColumnGroup
        ? referenceColumnViewportRef.current
        : null;
    };
    let autoscrollFrame: number | null = null;
    const tick = (): void => {
      const viewport = getViewport();

      if (!viewport) {
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const pointer = lastPointerRef.current;
      const previousTop = viewport.scrollTop;
      const previousLeft = viewport.scrollLeft;
      const edge = 28;

      if (isRowGroup(activeGroup)) {
        if (pointer.y > rect.bottom - edge) viewport.scrollTop += 12;
        if (pointer.y < rect.top + edge) viewport.scrollTop -= 12;
      } else if (isColumnGroup(activeGroup)) {
        if (pointer.x > rect.right - edge) viewport.scrollLeft += 12;
        if (pointer.x < rect.left + edge) viewport.scrollLeft -= 12;
      }

      if (
        viewport.scrollTop !== previousTop ||
        viewport.scrollLeft !== previousLeft
      ) {
        requestGeometrySync(activeGroup);
      }

      autoscrollFrame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    autoscrollFrame = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      if (autoscrollFrame !== null) {
        window.cancelAnimationFrame(autoscrollFrame);
      }
      cancelGeometrySync();
    };
  }, [activeGroup, cancelGeometrySync, requestGeometrySync]);

  const handleScroll = (): void => {
    if (activeGroup) {
      requestGeometrySync(activeGroup);
    }
  };

  const disconnectActiveTarget = (): void => {
    cancelGeometrySync();
    if (activeGroup === tableRowGroup) {
      disconnectTargets(initialRowOrder);
    } else if (activeGroup === tableColumnGroup) {
      disconnectTargets(initialColumnOrder);
    }
  };

  const disconnectNormalizedTarget = (): void => {
    cancelGeometrySync();
    disconnectTargets([
      [activeNormalizedTargetId, activeTargetId].find(
        (id) => id !== null && id !== activeDraggableId,
      ) ?? null,
    ]);
  };

  const disconnectTargets = (targetIds: readonly (string | null)[]): void => {
    for (const targetId of new Set(targetIds)) {
      if (!targetId) continue;
      if (activeGroup === tableRowGroup) {
        onDisableRow(targetId as RowId);
      } else if (activeGroup === tableColumnGroup) {
        onDisableColumn(targetId as ColumnId);
      }
    }

    onMarkTargetDisconnected();
  };

  return (
    <section
      className="examplePanel carrierExamplePanel"
      data-testid="carrier-example"
    >
      <div className="carrierHeadingRow">
        <h2 className="exampleTitle">Carrier-backed table parity</h2>
        <a href="/">All examples</a>
      </div>
      <p className="carrierDescription">
        Drag the thin row and column menu buttons. The table projects normalized
        placement while canonical data waits for drop.
      </p>

      <div
        ref={tableViewportRef}
        className="carrierScrollRegion"
        data-testid="carrier-scroll-region"
        onScroll={handleScroll}
      >
        <div className="carrierScrollCanvas">
          <div className="carrierTableStage" data-testid="carrier-table">
            <VisibleTable rows={projectedRows} columns={projectedColumns} />
            <RowCarrierLane
              order={canonicalRows}
              disabled={disabledRows}
              onOpenMenu={onOpenMenu}
            />
            <ColumnCarrierLane
              order={canonicalColumns}
              disabled={disabledColumns}
              onOpenMenu={onOpenMenu}
            />
          </div>
        </div>
      </div>

      {activeMenu ? (
        <div className="carrierMenuPanel" data-testid="active-menu">
          {activeMenu.kind} menu: {activeMenu.id}
        </div>
      ) : null}

      <div className="carrierControls">
        <button
          type="button"
          data-testid="disconnect-active-target"
          onClick={disconnectActiveTarget}
        >
          Disconnect active target
        </button>
        <button
          type="button"
          data-testid="disconnect-normalized-target"
          onClick={disconnectNormalizedTarget}
        >
          Disconnect normalized target
        </button>
        <button
          type="button"
          data-testid="synchronize-geometry"
          onClick={() => activeGroup && requestGeometrySync(activeGroup)}
        >
          Synchronize geometry
        </button>
        <button
          type="button"
          data-testid="reset-carrier-example"
          onClick={onReset}
        >
          Reset example
        </button>
      </div>

      <dl className="carrierDebug">
        <DebugValue label="Canonical rows" testId="canonical-row-order">
          {canonicalRows.join(",")}
        </DebugValue>
        <DebugValue label="Canonical columns" testId="canonical-column-order">
          {canonicalColumns.join(",")}
        </DebugValue>
        <DebugValue label="Projected rows" testId="projected-row-order">
          {projectedRows.join(",")}
        </DebugValue>
        <DebugValue label="Projected columns" testId="projected-column-order">
          {projectedColumns.join(",")}
        </DebugValue>
        <DebugValue label="Row commits" testId="row-commit-count">
          {rowCommitCount}
        </DebugValue>
        <DebugValue label="Column commits" testId="column-commit-count">
          {columnCommitCount}
        </DebugValue>
        <DebugValue label="Last result" testId="last-result">
          {lastResult}
        </DebugValue>
        <DebugValue label="Live target" testId="live-target-id">
          {liveTarget}
        </DebugValue>
        <DebugValue label="Active drop target" testId="active-drop-target-id">
          {activeTargetId ?? "none"}
        </DebugValue>
        <DebugValue label="Live preview anchors" testId="live-preview-anchors">
          {livePreviewAnchors}
        </DebugValue>
        <DebugValue label="Geometry syncs" testId="geometry-sync-count">
          {geometrySyncCount}
        </DebugValue>
      </dl>

      <section className="carrierReferences">
        <h3>Ordinary sortable references</h3>
        <div
          ref={referenceRowViewportRef}
          className="carrierReferenceViewport"
          data-reference-viewport={referenceRowGroup}
          onScroll={handleScroll}
        >
          <ReferenceRowList order={referenceRows} />
        </div>
        <div
          ref={referenceColumnViewportRef}
          className="carrierReferenceViewport"
          data-reference-viewport={referenceColumnGroup}
          onScroll={handleScroll}
        >
          <ReferenceColumnList order={referenceColumns} />
        </div>
      </section>
    </section>
  );
}

const RowCarrierLane = memo(function RowCarrierLane({
  order,
  disabled,
  onOpenMenu,
}: {
  order: readonly RowId[];
  disabled: ReadonlySet<RowId>;
  onOpenMenu: (menu: ActiveMenu) => void;
}): ReactElement {
  return (
    <div className="rowCarrierLane" data-testid="carrier-row-lane">
      {order.map((rowId) =>
        disabled.has(rowId) ? null : (
          <RowCarrier key={rowId} rowId={rowId} onOpenMenu={onOpenMenu} />
        ),
      )}
    </div>
  );
});

const ColumnCarrierLane = memo(function ColumnCarrierLane({
  order,
  disabled,
  onOpenMenu,
}: {
  order: readonly ColumnId[];
  disabled: ReadonlySet<ColumnId>;
  onOpenMenu: (menu: ActiveMenu) => void;
}): ReactElement {
  return (
    <div className="columnCarrierLane" data-testid="carrier-column-lane">
      {order.map((columnId) =>
        disabled.has(columnId) ? null : (
          <ColumnCarrier
            key={columnId}
            columnId={columnId}
            onOpenMenu={onOpenMenu}
          />
        ),
      )}
    </div>
  );
});

function RowCarrier({
  rowId,
  onOpenMenu,
}: {
  rowId: RowId;
  onOpenMenu: (menu: ActiveMenu) => void;
}): ReactElement {
  const sortable = useSortable<HTMLDivElement>({
    draggableId: rowId,
    group: tableRowGroup,
    axis: "vertical",
    placementBoundary,
  });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <div
      {...sortable}
      className="rowCarrier"
      data-testid={`carrier-row-${rowId}`}
      data-carrier-row-id={rowId}
      style={{ height: getRow(rowId).height }}
    >
      <button
        {...handle}
        type="button"
        className="rowCarrierButton"
        data-testid={`row-menu-${rowId}`}
        aria-label={`Open menu for row ${rowId}`}
        onClick={() => onOpenMenu({ kind: "row", id: rowId })}
      >
        ⋮
      </button>
    </div>
  );
}

function ColumnCarrier({
  columnId,
  onOpenMenu,
}: {
  columnId: ColumnId;
  onOpenMenu: (menu: ActiveMenu) => void;
}): ReactElement {
  const sortable = useSortable<HTMLDivElement>({
    draggableId: columnId,
    group: tableColumnGroup,
    axis: "horizontal",
    placementBoundary,
  });
  const handle = useDragHandle<HTMLButtonElement>();

  return (
    <div
      {...sortable}
      className="columnCarrier"
      data-testid={`carrier-column-${columnId}`}
      data-carrier-column-id={columnId}
      style={{ width: getColumn(columnId).width }}
    >
      <button
        {...handle}
        type="button"
        className="columnCarrierButton"
        data-testid={`column-menu-${columnId}`}
        aria-label={`Open menu for column ${getColumn(columnId).label}`}
        onClick={() => onOpenMenu({ kind: "column", id: columnId })}
      >
        ⋮
      </button>
    </div>
  );
}

const ReferenceRowList = memo(function ReferenceRowList({
  order,
}: {
  order: readonly RowId[];
}): ReactElement {
  return (
    <div className="referenceRowList" data-testid="reference-row-list">
      {order.map((rowId) => (
        <ReferenceRow key={rowId} rowId={rowId} />
      ))}
    </div>
  );
});

function ReferenceRow({ rowId }: { rowId: RowId }): ReactElement {
  const sortable = useSortable<HTMLDivElement>({
    draggableId: rowId,
    group: referenceRowGroup,
    axis: "vertical",
    placementBoundary,
  });
  const handle = useDragHandle<HTMLButtonElement>();
  return (
    <div
      {...sortable}
      className="referenceRowItem"
      data-testid={`reference-row-${rowId}`}
      data-reference-row-id={rowId}
      style={{ height: getRow(rowId).height }}
    >
      <span className="referenceItemLabel">{rowId}</span>
      <button
        {...handle}
        type="button"
        className="referenceDragHandle referenceRowHandle"
        aria-label={`Drag ${rowId}`}
      >
        ⋮
      </button>
    </div>
  );
}

const ReferenceColumnList = memo(function ReferenceColumnList({
  order,
}: {
  order: readonly ColumnId[];
}): ReactElement {
  return (
    <div className="referenceColumnList" data-testid="reference-column-list">
      {order.map((columnId) => (
        <ReferenceColumn key={columnId} columnId={columnId} />
      ))}
    </div>
  );
});

function ReferenceColumn({ columnId }: { columnId: ColumnId }): ReactElement {
  const sortable = useSortable<HTMLDivElement>({
    draggableId: columnId,
    group: referenceColumnGroup,
    axis: "horizontal",
    placementBoundary,
  });
  const handle = useDragHandle<HTMLButtonElement>();
  return (
    <div
      {...sortable}
      className="referenceColumnItem"
      data-testid={`reference-column-${columnId}`}
      data-reference-column-id={columnId}
      style={{ width: getColumn(columnId).width }}
    >
      <span className="referenceItemLabel">{getColumn(columnId).label}</span>
      <button
        {...handle}
        type="button"
        className="referenceDragHandle referenceColumnHandle"
        aria-label={`Drag column ${getColumn(columnId).label}`}
      >
        ⋮
      </button>
    </div>
  );
}

function VisibleTable({
  rows,
  columns,
}: {
  rows: readonly RowId[];
  columns: readonly ColumnId[];
}): ReactElement {
  return (
    <table className="carrierVisibleTable">
      <thead>
        <tr style={{ height: 44 }}>
          {columns.map((columnId) => (
            <th
              key={columnId}
              data-column-id={columnId}
              style={{ width: getColumn(columnId).width }}
            >
              {getColumn(columnId).label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((rowId) => (
          <tr
            key={rowId}
            data-row-id={rowId}
            style={{ height: getRow(rowId).height }}
          >
            {columns.map((columnId) => (
              <td
                key={columnId}
                data-column-id={columnId}
                style={{ width: getColumn(columnId).width }}
              >
                {getRow(rowId).cells[columnId]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DebugValue({
  label,
  testId,
  children,
}: {
  label: string;
  testId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <>
      <dt>{label}</dt>
      <dd data-testid={testId}>{children}</dd>
    </>
  );
}
