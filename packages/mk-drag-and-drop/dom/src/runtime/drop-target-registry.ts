import type { DragPoint, DragRect } from "../geometry/rects.js";
import type { DropTarget, TargetingConstraint } from "../targeting/index.js";

import {
  documentRectToViewportRect,
  measureDocumentRect,
} from "../geometry/measurement.js";
import { emptyDragRect } from "../geometry/rects.js";

export type DragGroup = string;

export type RemeasureDropTargetsInput =
  | string
  | string[]
  | { group: string };

export type DropTargetCapabilities = {
  container: boolean;
  sortable: boolean;
};

export type DropTargetRegistration = {
  id: string;
  element: HTMLElement;
  group: DragGroup;
  containerId: string | null;
  capabilities: DropTargetCapabilities;
};

export type RemovedDropTarget = {
  id: string;
  group: DragGroup;
};

export type RegisterDropTargetOptions = {
  container?: boolean;
  containerId?: string | null;
  sortable?: boolean;
};

export type GetAvailableDropTargetsInput = {
  group: DragGroup | null;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  targetingConstraint?: TargetingConstraint;
};

export type SortablePlacement = {
  itemId: string;
  previousItemId: string | null;
  nextItemId: string | null;
};

export type DropPlacement = {
  itemId: string;
  dropTarget: string;
  sourceContainerId: string | null;
  containerId: string | null;
  previousItemId: string | null;
  nextItemId: string | null;
};

type DropTargetEntry = {
  id: string;
  elementRef: WeakRef<HTMLElement>;
  group: DragGroup;
  containerId: string | null;
  capabilities: DropTargetCapabilities;
  documentRect: DragRect;
};

type ResolvedDropTargetEntry = DropTargetEntry & {
  element: HTMLElement;
};

type AvailableDropTargetCandidate = {
  registration: ResolvedDropTargetEntry;
  viewportRect: DragRect;
};

export class DropTargetRegistry {
  private targetsByGroup = new Map<DragGroup, Map<string, DropTargetEntry>>();
  private targetElements = new WeakMap<
    HTMLElement,
    { group: DragGroup; id: string }
  >();

  register(
    id: string,
    element: HTMLElement,
    group: DragGroup,
    options: RegisterDropTargetOptions = {},
  ): RemovedDropTarget[] {
    const groupTargets = this.getOrCreateGroupTargets(group);
    const previousElementTarget = this.targetElements.get(element);
    const removedTargets: RemovedDropTarget[] = [];

    if (previousElementTarget) {
      const previousEntry = this.targetsByGroup
        .get(previousElementTarget.group)
        ?.get(previousElementTarget.id);
      const previousElement = previousEntry
        ? this.resolveEntry(previousEntry)
        : null;

      if (previousElement === element) {
        if (
          previousElementTarget.group !== group ||
          previousElementTarget.id !== id
        ) {
          removedTargets.push(
            ...this.removeTarget(
              previousElementTarget.group,
              previousElementTarget.id,
            ),
          );
        }
      } else {
        this.targetElements.delete(element);
      }
    }

    const displacedEntry = groupTargets.get(id);
    const displacedElement = displacedEntry
      ? this.resolveEntry(displacedEntry)
      : null;

    if (displacedElement && displacedElement !== element) {
      this.targetElements.delete(displacedElement);
    }

    const entry: DropTargetEntry = {
      id,
      elementRef: new WeakRef(element),
      group,
      containerId: options.containerId ?? null,
      capabilities: {
        container: options.container ?? false,
        sortable: options.sortable ?? false,
      },
      documentRect: emptyDragRect,
    };

    groupTargets.set(id, entry);
    this.targetElements.set(element, { group, id });
    this.remeasureEntry(entry);

    return removedTargets;
  }

  unregister(id: string, element?: HTMLElement): RemovedDropTarget[] {
    if (element) {
      const target = this.targetElements.get(element);

      if (!target || target.id !== id) {
        return [];
      }

      const entry = this.targetsByGroup.get(target.group)?.get(target.id);

      if (!entry || this.resolveEntry(entry) !== element) {
        this.targetElements.delete(element);
        return [];
      }

      this.targetElements.delete(element);
      return this.removeTarget(target.group, target.id);
    }

    const removedTargets: RemovedDropTarget[] = [];

    for (const group of Array.from(this.targetsByGroup.keys())) {
      removedTargets.push(...this.removeTarget(group, id));
    }

    return removedTargets;
  }

  pruneDisconnected(): RemovedDropTarget[] {
    const removedTargets: RemovedDropTarget[] = [];

    for (const [group, groupTargets] of Array.from(this.targetsByGroup)) {
      for (const [id, entry] of Array.from(groupTargets)) {
        if (this.resolveEntry(entry)) {
          continue;
        }

        groupTargets.delete(id);
        removedTargets.push({ id, group });
      }

      if (groupTargets.size === 0) {
        this.targetsByGroup.delete(group);
      }
    }

    return removedTargets;
  }

  clear(): void {
    this.targetsByGroup.clear();
    this.targetElements = new WeakMap();
  }

  remeasure(input?: RemeasureDropTargetsInput): void {
    if (input === undefined) {
      for (const groupTargets of this.targetsByGroup.values()) {
        for (const target of groupTargets.values()) {
          this.remeasureEntry(target);
        }
      }

      return;
    }

    if (typeof input === "string") {
      this.remeasureTarget(input);
      return;
    }

    if (Array.isArray(input)) {
      for (const dropTargetId of input) {
        this.remeasureTarget(dropTargetId);
      }

      return;
    }

    const groupTargets = this.targetsByGroup.get(input.group);

    if (!groupTargets) {
      return;
    }

    for (const dropTarget of groupTargets.values()) {
      this.remeasureEntry(dropTarget);
    }
  }

  getViewportRect(id: string, group?: DragGroup): DragRect | null {
    const registration = this.findRegistration(id, { group });

    return registration
      ? documentRectToViewportRect(registration.documentRect)
      : null;
  }

  getDropTargetRegistration(
    id: string,
    group?: DragGroup,
  ): DropTargetRegistration | null {
    const registration = this.findRegistration(id, { group });

    return registration ? toPublicRegistration(registration) : null;
  }

  getAvailableDropTargets(input: GetAvailableDropTargetsInput): DropTarget[] {
    const dropTargets: DropTarget[] = [];

    if (input.group === null) {
      return dropTargets;
    }

    const groupTargets = this.targetsByGroup.get(input.group);

    if (!groupTargets) {
      return dropTargets;
    }

    const candidates: AvailableDropTargetCandidate[] = [];

    for (const target of groupTargets.values()) {
      const element = this.resolveEntry(target);

      if (!element) {
        continue;
      }

      candidates.push({
        registration: {
          ...target,
          element,
        },
        viewportRect: documentRectToViewportRect(target.documentRect),
      });
    }

    for (const candidate of candidates) {
      if (
        candidate.registration.capabilities.container &&
        !shouldIncludeContainerCandidate({
          candidates,
          containerCandidate: candidate,
          pointerPosition: input.pointerPosition,
        })
      ) {
        continue;
      }

      const candidateDropTarget = {
        dropTargetKey: candidate.registration.id,
        dropTargetRect: candidate.viewportRect,
      };

      if (
        input.targetingConstraint &&
        !input.targetingConstraint({
          pointerPosition: input.pointerPosition,
          overlayRect: input.overlayRect,
          dropTarget: candidateDropTarget,
        })
      ) {
        continue;
      }

      dropTargets.push(candidateDropTarget);
    }

    return dropTargets;
  }

  getDropPlacement(input: {
    itemId: string;
    dropTargetId: string | null;
    group: DragGroup | null;
    sourceContainerId: string | null;
  }): DropPlacement | null {
    if (input.dropTargetId === null || input.group === null) {
      return null;
    }

    const dropTarget = this.findRegistration(input.dropTargetId, {
      group: input.group,
    });

    if (!dropTarget) {
      return null;
    }

    const itemRegistration = this.findRegistration(input.itemId, {
      group: input.group,
    });
    const previewContainer =
      dropTarget.id === input.itemId
        ? this.findContainerRegistrationForElement({
            element: itemRegistration?.element.parentElement ?? null,
            group: input.group,
          })
        : null;
    const containerId = previewContainer?.containerId ?? dropTarget.containerId;
    const containerElement =
      previewContainer?.element ?? getDropTargetContainerElement(dropTarget);
    const siblingPlacement = this.getSiblingPlacement({
      itemId: input.itemId,
      group: input.group,
      itemElement: itemRegistration?.element ?? null,
      dropTarget,
      containerElement,
    });

    return {
      itemId: input.itemId,
      dropTarget: dropTarget.id,
      sourceContainerId: input.sourceContainerId,
      containerId,
      previousItemId: siblingPlacement.previousItemId,
      nextItemId: siblingPlacement.nextItemId,
    };
  }

  getSortablePlacement(
    itemId: string,
    group?: DragGroup,
  ): SortablePlacement | null {
    const registration = this.findRegistration(itemId, { group });

    if (
      !registration?.capabilities.sortable ||
      !registration.element.parentElement
    ) {
      return null;
    }

    const { element } = registration;
    const itemGroup = registration.group;

    const previousItemId = this.getNearestSortableSiblingItemId(
      element.previousElementSibling,
      itemGroup,
      "previous",
    );
    const nextItemId = this.getNearestSortableSiblingItemId(
      element.nextElementSibling,
      itemGroup,
      "next",
    );

    if (previousItemId === null && nextItemId === null) {
      return null;
    }

    return {
      itemId,
      previousItemId,
      nextItemId,
    };
  }

  private getOrCreateGroupTargets(
    group: DragGroup,
  ): Map<string, DropTargetEntry> {
    let groupTargets = this.targetsByGroup.get(group);

    if (!groupTargets) {
      groupTargets = new Map();
      this.targetsByGroup.set(group, groupTargets);
    }

    return groupTargets;
  }

  private removeTarget(group: DragGroup, id: string): RemovedDropTarget[] {
    const groupTargets = this.targetsByGroup.get(group);

    if (!groupTargets?.delete(id)) {
      return [];
    }

    if (groupTargets.size === 0) {
      this.targetsByGroup.delete(group);
    }

    return [{ id, group }];
  }

  private remeasureTarget(dropTargetId: string): void {
    for (const groupTargets of this.targetsByGroup.values()) {
      const dropTarget = groupTargets.get(dropTargetId);

      if (dropTarget) {
        this.remeasureEntry(dropTarget);
      }
    }
  }

  private remeasureEntry(registration: DropTargetEntry): void {
    const element = this.resolveEntry(registration);

    if (!element) {
      return;
    }

    registration.documentRect = measureDocumentRect(element);
  }

  private findRegistration(
    id: string,
    input: {
      group?: DragGroup | null;
    } = {},
  ): ResolvedDropTargetEntry | null {
    if (input.group !== undefined) {
      const entry =
        input.group === null
          ? null
          : this.targetsByGroup.get(input.group)?.get(id) ?? null;

      return entry ? this.resolveRegistration(entry) : null;
    }

    for (const groupTargets of this.targetsByGroup.values()) {
      const entry = groupTargets.get(id);

      if (!entry) {
        continue;
      }

      const registration = this.resolveRegistration(entry);

      if (registration) {
        return registration;
      }
    }

    return null;
  }

  private resolveRegistration(
    entry: DropTargetEntry,
  ): ResolvedDropTargetEntry | null {
    const element = this.resolveEntry(entry);

    return element
      ? {
          ...entry,
          element,
        }
      : null;
  }

  private resolveEntry(entry: DropTargetEntry): HTMLElement | null {
    const element = entry.elementRef.deref();

    return element?.isConnected ? element : null;
  }

  private findContainerRegistrationForElement(input: {
    element: HTMLElement | null;
    group: DragGroup;
  }): ResolvedDropTargetEntry | null {
    if (!input.element) {
      return null;
    }

    const groupTargets = this.targetsByGroup.get(input.group);

    if (!groupTargets) {
      return null;
    }

    for (const entry of groupTargets.values()) {
      const element = this.resolveEntry(entry);

      if (
        entry.capabilities.container &&
        element &&
        element === input.element
      ) {
        return {
          ...entry,
          element,
        };
      }
    }

    return null;
  }

  private getSiblingPlacement(input: {
    itemId: string;
    group: DragGroup;
    itemElement: HTMLElement | null;
    dropTarget: ResolvedDropTargetEntry;
    containerElement: HTMLElement | null;
  }): Pick<DropPlacement, "previousItemId" | "nextItemId"> {
    if (
      input.itemElement?.parentElement &&
      input.itemElement.parentElement === input.containerElement
    ) {
      return {
        previousItemId: this.getNearestSortableSiblingItemId(
          input.itemElement.previousElementSibling,
          input.group,
          "previous",
          input.itemId,
        ),
        nextItemId: this.getNearestSortableSiblingItemId(
          input.itemElement.nextElementSibling,
          input.group,
          "next",
          input.itemId,
        ),
      };
    }

    if (input.dropTarget.capabilities.container) {
      return {
        previousItemId: this.getNearestSortableSiblingItemId(
          input.dropTarget.element.lastElementChild,
          input.group,
          "previous",
          input.itemId,
        ),
        nextItemId: null,
      };
    }

    return {
      previousItemId: this.getNearestSortableSiblingItemId(
        input.dropTarget.element.previousElementSibling,
        input.group,
        "previous",
        input.itemId,
      ),
      nextItemId: input.dropTarget.id,
    };
  }

  private getNearestSortableSiblingItemId(
    element: Element | null,
    group: DragGroup,
    direction: "previous" | "next",
    excludeItemId?: string,
  ): string | null {
    let currentElement = element;

    while (currentElement) {
      const itemId = this.getSortableItemId(currentElement, group);

      if (itemId && itemId !== excludeItemId) {
        return itemId;
      }

      currentElement =
        direction === "previous"
          ? currentElement.previousElementSibling
          : currentElement.nextElementSibling;
    }

    return null;
  }

  private getSortableItemId(element: Element, group: DragGroup): string | null {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    const target = this.targetElements.get(element);
    const entry = target
      ? this.targetsByGroup.get(group)?.get(target.id) ?? null
      : null;

    if (!entry?.capabilities.sortable || entry.group !== group) {
      return null;
    }

    return this.resolveEntry(entry) === element ? entry.id : null;
  }
}

function toPublicRegistration(
  registration: ResolvedDropTargetEntry,
): DropTargetRegistration {
  return {
    id: registration.id,
    element: registration.element,
    group: registration.group,
    containerId: registration.containerId,
    capabilities: registration.capabilities,
  };
}

function getDropTargetContainerElement(
  dropTarget: ResolvedDropTargetEntry,
): HTMLElement | null {
  return dropTarget.capabilities.container
    ? dropTarget.element
    : dropTarget.element.parentElement;
}

function shouldIncludeContainerCandidate(input: {
  candidates: AvailableDropTargetCandidate[];
  containerCandidate: AvailableDropTargetCandidate;
  pointerPosition: DragPoint;
}): boolean {
  if (
    !isPointInsideRect(input.pointerPosition, input.containerCandidate.viewportRect)
  ) {
    return false;
  }

  const hasCurrentChildTarget = input.candidates.some(
    (candidate) =>
      candidate !== input.containerCandidate &&
      candidate.registration.element.parentElement ===
        input.containerCandidate.registration.element,
  );

  return !hasCurrentChildTarget;
}

function isPointInsideRect(point: DragPoint, rect: DragRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}
