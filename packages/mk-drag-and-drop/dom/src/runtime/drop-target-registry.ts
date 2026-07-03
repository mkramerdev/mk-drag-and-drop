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

export type DropTargetRegistrationKind = "item" | "container";

export type DropTargetRegistration = {
  id: string;
  element: HTMLElement;
  group: DragGroup;
  containerId: string | null;
  kind: DropTargetRegistrationKind;
};

export type RegisterDropTargetOptions = {
  containerId?: string | null;
  kind?: DropTargetRegistrationKind;
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

type MeasuredDropTargetRegistration = DropTargetRegistration & {
  documentRect: DragRect;
};

type AvailableDropTargetCandidate = {
  registration: MeasuredDropTargetRegistration;
  viewportRect: DragRect;
};

export class DropTargetRegistry {
  private dropTargets = new Map<string, MeasuredDropTargetRegistration>();
  private dropTargetElements = new WeakMap<HTMLElement, string>();

  register(
    id: string,
    element: HTMLElement,
    group: DragGroup,
    options: RegisterDropTargetOptions = {},
  ): void {
    const kind = options.kind ?? "item";
    const key = createRegistrationKey({ id, group, kind });
    const previousTarget = this.dropTargets.get(key);
    const previousElementTargetId = this.dropTargetElements.get(element);

    if (previousTarget && previousTarget.element !== element) {
      this.dropTargetElements.delete(previousTarget.element);
    }

    if (previousElementTargetId && previousElementTargetId !== key) {
      this.dropTargets.delete(previousElementTargetId);
    }

    const registration = {
      id,
      element,
      group,
      containerId: options.containerId ?? null,
      kind,
      documentRect: emptyDragRect,
    };

    this.dropTargets.set(key, registration);
    this.dropTargetElements.set(element, key);
    this.remeasureRegistration(registration);
  }

  unregister(
    id: string,
    element?: HTMLElement,
    kind?: DropTargetRegistrationKind,
  ): DropTargetRegistration[] {
    const removedRegistrations: DropTargetRegistration[] = [];

    if (element) {
      const registrationKey = this.dropTargetElements.get(element);
      const target = registrationKey
        ? this.dropTargets.get(registrationKey)
        : null;

      if (
        !registrationKey ||
        !target ||
        target.id !== id ||
        (kind && target.kind !== kind)
      ) {
        return removedRegistrations;
      }

      this.dropTargetElements.delete(target.element);
      this.dropTargets.delete(registrationKey);
      removedRegistrations.push(toPublicRegistration(target));
      return removedRegistrations;
    }

    for (const [registrationKey, target] of Array.from(this.dropTargets)) {
      if (target.id !== id || (kind && target.kind !== kind)) {
        continue;
      }

      if (this.dropTargetElements.get(target.element) === registrationKey) {
        this.dropTargetElements.delete(target.element);
      }

      this.dropTargets.delete(registrationKey);
      removedRegistrations.push(toPublicRegistration(target));
    }

    return removedRegistrations;
  }

  clear(): void {
    this.dropTargets.clear();
    this.dropTargetElements = new WeakMap<HTMLElement, string>();
  }

  remeasure(input?: RemeasureDropTargetsInput): void {
    if (input === undefined) {
      for (const dropTarget of this.dropTargets.values()) {
        this.remeasureRegistration(dropTarget);
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

    for (const dropTarget of this.dropTargets.values()) {
      if (dropTarget.group === input.group) {
        this.remeasureRegistration(dropTarget);
      }
    }
  }

  getViewportRect(
    id: string,
    group?: DragGroup,
    kind?: DropTargetRegistrationKind,
  ): DragRect | null {
    const registration = this.findRegistration(id, { group, kind });

    return registration
      ? documentRectToViewportRect(registration.documentRect)
      : null;
  }

  getDropTargetRegistration(
    id: string,
    group?: DragGroup,
    kind?: DropTargetRegistrationKind,
  ): DropTargetRegistration | null {
    const registration = this.findRegistration(id, { group, kind });

    return registration ? toPublicRegistration(registration) : null;
  }

  getAvailableDropTargets(input: GetAvailableDropTargetsInput): DropTarget[] {
    const dropTargets: DropTarget[] = [];

    if (input.group === null) {
      return dropTargets;
    }

    const candidates: AvailableDropTargetCandidate[] = [];

    for (const dropTarget of this.dropTargets.values()) {
      if (dropTarget.group !== input.group) {
        continue;
      }

      candidates.push({
        registration: dropTarget,
        viewportRect: documentRectToViewportRect(dropTarget.documentRect),
      });
    }

    const itemCandidates = candidates.filter(
      (candidate) => candidate.registration.kind === "item",
    );

    for (const candidate of candidates) {
      if (
        candidate.registration.kind === "container" &&
        !shouldIncludeContainerCandidate({
          containerCandidate: candidate,
          itemCandidates,
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
      kind: "item",
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
    const registration = this.findRegistration(itemId, {
      group,
      kind: "item",
    });

    if (!registration?.element.parentElement) {
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

  private remeasureTarget(dropTargetId: string): void {
    const dropTarget = this.findRegistration(dropTargetId);

    if (!dropTarget) {
      return;
    }

    this.remeasureRegistration(dropTarget);
  }

  private remeasureRegistration(
    registration: MeasuredDropTargetRegistration,
  ): void {
    registration.documentRect = this.measureRegistration(registration);
  }

  private measureRegistration(
    registration: MeasuredDropTargetRegistration,
  ): DragRect {
    return measureDocumentRect(registration.element);
  }

  private findRegistration(
    id: string,
    input: {
      group?: DragGroup | null;
      kind?: DropTargetRegistrationKind;
    } = {},
  ): MeasuredDropTargetRegistration | null {
    for (const registration of this.dropTargets.values()) {
      if (registration.id !== id) {
        continue;
      }

      if (input.group !== undefined && registration.group !== input.group) {
        continue;
      }

      if (input.kind && registration.kind !== input.kind) {
        continue;
      }

      return registration;
    }

    return null;
  }

  private findContainerRegistrationForElement(input: {
    element: HTMLElement | null;
    group: DragGroup;
  }): MeasuredDropTargetRegistration | null {
    if (!input.element) {
      return null;
    }

    for (const registration of this.dropTargets.values()) {
      if (
        registration.kind === "container" &&
        registration.group === input.group &&
        registration.element === input.element
      ) {
        return registration;
      }
    }

    return null;
  }

  private getSiblingPlacement(input: {
    itemId: string;
    group: DragGroup;
    itemElement: HTMLElement | null;
    dropTarget: MeasuredDropTargetRegistration;
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

    if (input.dropTarget.kind === "container") {
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

    const registrationKey = this.dropTargetElements.get(element);
    const registration = registrationKey
      ? this.dropTargets.get(registrationKey)
      : null;

    if (
      !registration ||
      registration.group !== group ||
      registration.kind !== "item"
    ) {
      return null;
    }

    return registration.id;
  }
}

function createRegistrationKey(input: {
  id: string;
  group: DragGroup;
  kind: DropTargetRegistrationKind;
}): string {
  return `${input.kind}\u0000${input.group}\u0000${input.id}`;
}

function toPublicRegistration(
  registration: MeasuredDropTargetRegistration,
): DropTargetRegistration {
  return {
    id: registration.id,
    element: registration.element,
    group: registration.group,
    containerId: registration.containerId,
    kind: registration.kind,
  };
}

function getDropTargetContainerElement(
  dropTarget: MeasuredDropTargetRegistration,
): HTMLElement | null {
  return dropTarget.kind === "container"
    ? dropTarget.element
    : dropTarget.element.parentElement;
}

function shouldIncludeContainerCandidate(input: {
  containerCandidate: AvailableDropTargetCandidate;
  itemCandidates: AvailableDropTargetCandidate[];
  pointerPosition: DragPoint;
}): boolean {
  if (
    !isPointInsideRect(input.pointerPosition, input.containerCandidate.viewportRect)
  ) {
    return false;
  }

  const childItemCandidates = input.itemCandidates.filter(
    (itemCandidate) =>
      itemCandidate.registration.containerId ===
      input.containerCandidate.registration.id,
  );

  return childItemCandidates.length === 0;
}

function isPointInsideRect(point: DragPoint, rect: DragRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}
