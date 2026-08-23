export type ColumnId = "a" | "b" | "c";
export type RowId = "row-1" | "row-2" | "row-3";

export type Column = {
  id: ColumnId;
  label: string;
  width: number;
};

export type Row = {
  id: RowId;
  height: number;
  cells: Record<ColumnId, string>;
};

export type TableModel = {
  rows: Row[];
  columns: Column[];
};

export const tableRowGroup = "carrier-table-rows";
export const tableColumnGroup = "carrier-table-columns";
export const referenceRowGroup = "reference-rows";
export const referenceColumnGroup = "reference-columns";

export type CarrierExampleGroup =
  | typeof tableRowGroup
  | typeof tableColumnGroup
  | typeof referenceRowGroup
  | typeof referenceColumnGroup;

export type CarrierOverlayPresentation = {
  axis: "row" | "column";
  variant: "table-row" | "table-column" | "reference-row" | "reference-column";
};

export function getCarrierOverlayPresentation(
  group: string,
): CarrierOverlayPresentation {
  switch (group) {
    case tableRowGroup:
      return { axis: "row", variant: "table-row" };
    case tableColumnGroup:
      return { axis: "column", variant: "table-column" };
    case referenceRowGroup:
      return { axis: "row", variant: "reference-row" };
    case referenceColumnGroup:
      return { axis: "column", variant: "reference-column" };
    default:
      throw new Error(`Unknown carrier example group: ${group}`);
  }
}

export const tableModel: TableModel = {
  columns: [
    { id: "a", label: "A", width: 120 },
    { id: "b", label: "B", width: 180 },
    { id: "c", label: "C", width: 96 },
  ],
  rows: [
    {
      id: "row-1",
      height: 48,
      cells: { a: "A1", b: "B1", c: "C1" },
    },
    {
      id: "row-2",
      height: 72,
      cells: { a: "A2", b: "B2", c: "C2" },
    },
    {
      id: "row-3",
      height: 56,
      cells: { a: "A3", b: "B3", c: "C3" },
    },
  ],
};

export const initialRowOrder = tableModel.rows.map((row) => row.id);
export const initialColumnOrder = tableModel.columns.map((column) => column.id);

export function getRow(rowId: RowId): Row {
  const row = tableModel.rows.find((candidate) => candidate.id === rowId);

  if (!row) {
    throw new Error(`Unknown row: ${rowId}`);
  }

  return row;
}

export function getColumn(columnId: ColumnId): Column {
  const column = tableModel.columns.find(
    (candidate) => candidate.id === columnId,
  );

  if (!column) {
    throw new Error(`Unknown column: ${columnId}`);
  }

  return column;
}

export function isTableGroup(group: string): boolean {
  return group === tableRowGroup || group === tableColumnGroup;
}

export function isRowGroup(group: string): boolean {
  return group === tableRowGroup || group === referenceRowGroup;
}

export function isColumnGroup(group: string): boolean {
  return group === tableColumnGroup || group === referenceColumnGroup;
}
