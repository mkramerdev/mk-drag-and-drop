export const domPointerDragActiveAttribute = "data-dnd-pointer-drag-active";

type DocumentPointerDragState = {
  root: HTMLElement;
  previousValue: string | null;
  owners: Set<object>;
};

const documentPointerDragStates = new WeakMap<
  Document,
  DocumentPointerDragState
>();

export function acquireDocumentPointerDragState(
  sourceDocument: Document,
): () => void {
  const owner = {};
  let state = documentPointerDragStates.get(sourceDocument);

  if (!state) {
    state = {
      root: sourceDocument.documentElement,
      previousValue: sourceDocument.documentElement.getAttribute(
        domPointerDragActiveAttribute,
      ),
      owners: new Set(),
    };
    documentPointerDragStates.set(sourceDocument, state);
  }

  state.owners.add(owner);
  state.root.setAttribute(domPointerDragActiveAttribute, "true");

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;

    if (!state?.owners.delete(owner) || state.owners.size > 0) {
      return;
    }

    documentPointerDragStates.delete(sourceDocument);

    if (state.previousValue === null) {
      state.root.removeAttribute(domPointerDragActiveAttribute);
      return;
    }

    state.root.setAttribute(domPointerDragActiveAttribute, state.previousValue);
  };
}
