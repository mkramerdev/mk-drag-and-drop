export type DragListItem = {
  orderKey: string;
  content: string;
};

export type DragListItemPayload = {
  content: string;
};

export type DragListDropTarget = {
  beforeItemId: string | null;
};
