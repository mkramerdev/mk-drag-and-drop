export function setDragListItemGhosted(
  itemId: string,
  isGhosted: boolean,
): void {
  const itemElement = document.getElementById(itemId);

  if (!itemElement) {
    return;
  }

  itemElement.classList.toggle("dragListItemGhosted", isGhosted);
}
