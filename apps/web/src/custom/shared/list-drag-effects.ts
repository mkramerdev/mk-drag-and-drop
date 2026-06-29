export function setDragListItemGhosted(input: {
  itemId: string,
  isGhosted: boolean,
  getItemElement: (itemId: string) => HTMLElement | null,
}): void {
  const itemElement = input.getItemElement(input.itemId);

  if (!itemElement) {
    return;
  }

  itemElement.classList.toggle("dragListItemGhosted", input.isGhosted);
}
