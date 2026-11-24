export function suppressNativeDragStart(element: HTMLElement): () => void {
  const preventNativeDrag = (event: DragEvent): void => event.preventDefault();

  element.addEventListener("dragstart", preventNativeDrag, true);
  return () =>
    element.removeEventListener("dragstart", preventNativeDrag, true);
}
