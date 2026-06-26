export function renderDropTarget(options: {
  dropTargetId: string;
}): string {
  return `
    <div
      id="${options.dropTargetId}"
      class="dropTarget"
      data-dnd-drop-target-id="${options.dropTargetId}"
    >
      <div class="dropTargetLine" aria-hidden="true"></div>
    </div>
  `;
}
