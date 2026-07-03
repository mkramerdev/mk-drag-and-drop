import type {
  DragPoint,
  DragRect,
  DropTarget,
  TargetingConstraint,
} from "@mk-drag-and-drop/core";

import {
  documentRectToViewportRect,
  emptyDragRect,
  measureDocumentRect,
} from "../geometry.js";

export type DragGroup = string;

export type RemeasureDropTargetsInput =
  | string
  | string[]
  | { group: string };

export type DropTargetRegistration = {
  element: HTMLElement;
  group: DragGroup;
  documentRect: DragRect;
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

export class DropTargetRegistry {
  private dropTargets = new Map<string, DropTargetRegistration>();
  private dropTargetElements = new WeakMap<HTMLElement, string>();

  register(id: string, element: HTMLElement, group: DragGroup): void {
    const previousTarget = this.dropTargets.get(id);

    if (previousTarget && previousTarget.element !== element) {
      this.dropTargetElements.delete(previousTarget.element);
    }

    const registration = {
      element,
      group,
      documentRect: emptyDragRect,
    };

    this.dropTargets.set(id, registration);
    this.dropTargetElements.set(element, id);
    this.remeasureRegistration(registration);
  }

  unregister(id: string): void {
    const target = this.dropTargets.get(id);

    if (target) {
      this.dropTargetElements.delete(target.element);
    }

    this.dropTargets.delete(id);
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

  getViewportRect(id: string): DragRect | null {
    const registration = this.dropTargets.get(id);

    return registration
      ? documentRectToViewportRect(registration.documentRect)
      : null;
  }

  getAvailableDropTargets(input: GetAvailableDropTargetsInput): DropTarget[] {
    const dropTargets: DropTarget[] = [];

    if (input.group === null) {
      return dropTargets;
    }

    for (const [dropTargetKey, dropTarget] of this.dropTargets) {
      if (dropTarget.group !== input.group) {
        continue;
      }

      const candidateDropTarget = {
        dropTargetKey,
        dropTargetRect: documentRectToViewportRect(dropTarget.documentRect),
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

  getSortablePlacement(itemId: string): SortablePlacement | null {
    const registration = this.dropTargets.get(itemId);

    if (!registration?.element.parentElement) {
      return null;
    }

    const { element, group } = registration;

    return {
      itemId,
      previousItemId: this.getNearestSortableSiblingItemId(
        element.previousElementSibling,
        group,
        "previous",
      ),
      nextItemId: this.getNearestSortableSiblingItemId(
        element.nextElementSibling,
        group,
        "next",
      ),
    };
  }

  private remeasureTarget(dropTargetId: string): void {
    const dropTarget = this.dropTargets.get(dropTargetId);

    if (!dropTarget) {
      return;
    }

    this.remeasureRegistration(dropTarget);
  }

  private remeasureRegistration(
    registration: DropTargetRegistration,
  ): void {
    registration.documentRect = this.measureRegistration(registration);
  }

  private measureRegistration(
    registration: DropTargetRegistration,
  ): DragRect {
    return measureDocumentRect(registration.element);
  }

  private getNearestSortableSiblingItemId(
    element: Element | null,
    group: DragGroup,
    direction: "previous" | "next",
  ): string | null {
    let currentElement = element;

    while (currentElement) {
      const itemId = this.getSortableItemId(currentElement, group);

      if (itemId) {
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

    const itemId = this.dropTargetElements.get(element);
    const registration = itemId ? this.dropTargets.get(itemId) : null;

    if (!registration || registration.group !== group) {
      return null;
    }

    return itemId ?? null;
  }
}
