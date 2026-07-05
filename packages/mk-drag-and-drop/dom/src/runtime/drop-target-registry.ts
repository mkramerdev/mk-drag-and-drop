import type { DragPoint, DragRect } from "../geometry/rects.js";
import type { SortableAxis } from "../sortable/sortable-options.js";
import type { BuiltInTargetingAlgorithmKind } from "../targeting/algorithms.js";
import type { DropTarget, TargetingConstraint } from "../targeting/types.js";

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
  sortableAxis?: SortableAxis;
};

export type GetAvailableDropTargetsInput = {
  activeDropTargetId?: string | null;
  draggingDraggableId?: string | null;
  group: DragGroup | null;
  pointerPosition: DragPoint;
  overlayRect: DragRect | null;
  sourceContainerId?: string | null;
  targetingAlgorithmKind?: BuiltInTargetingAlgorithmKind | null;
  targetingConstraint?: TargetingConstraint;
};

export type SortableItemPlacement = {
  containerId: string | null;
  previousDraggableId: string | null;
  nextDraggableId: string | null;
  exactAnchors: readonly SortablePlacementAnchor[];
};

export type SortablePlacementSide = "before" | "after";

export type SortablePlacementAnchor = {
  targetDraggableId: string;
  side: SortablePlacementSide;
};

export type SortableDropPlacement = {
  sourceContainerId: string | null;
  containerId: string | null;
  previousDraggableId: string | null;
  nextDraggableId: string | null;
  targetDraggableId: string | null;
  side: SortablePlacementSide | null;
};

type DropTargetEntry = {
  id: string;
  elementRef: WeakRef<HTMLElement>;
  group: DragGroup;
  containerId: string | null;
  capabilities: DropTargetCapabilities;
  sortableAxis: SortableAxis | null;
  documentRect: DragRect;
};

type ResolvedDropTargetEntry = DropTargetEntry & {
  element: HTMLElement;
};

type AvailableDropTargetCandidate = {
  entry: DropTargetEntry;
  element: HTMLElement;
  viewportRect: DragRect;
};

type SortableAxisCandidate = {
  id: string;
  entry: DropTargetEntry;
  element: HTMLElement;
  containerId: string | null;
  axisStart: number;
  axisEnd: number;
  axisCenter: number;
};

type SortableAxisIndex = {
  axis: SortableAxis;
  containerId: string | null;
  candidatesByCenter: SortableAxisCandidate[];
  candidatesByStart: SortableAxisCandidate[];
  candidatesById: Map<string, SortableAxisCandidate>;
  unsupported: boolean;
};

const sortableCandidateWindowRadius = 3;

export class DropTargetRegistry {
  private targetsByGroup = new Map<DragGroup, Map<string, DropTargetEntry>>();
  private targetElements = new WeakMap<
    HTMLElement,
    { group: DragGroup; id: string }
  >();
  private sortableAxisIndexes = new Map<DragGroup, SortableAxisIndex>();

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
      sortableAxis: options.sortable ? options.sortableAxis ?? null : null,
      documentRect: emptyDragRect,
    };

    groupTargets.set(id, entry);
    this.targetElements.set(element, { group, id });
    this.remeasureEntry(entry);
    this.syncSortableAxisIndexAfterRegister(group, entry, element);

    return removedTargets;
  }

  unregister(id: string, element?: HTMLElement): RemovedDropTarget[] {
    if (element) {
      const target = this.targetElements.get(element);

      if (!target || target.id !== id) {
        return [];
      }

      const entry = this.targetsByGroup.get(target.group)?.get(target.id);

      if (!entry || entry.elementRef.deref() !== element) {
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

  pruneDisconnected(group?: DragGroup): RemovedDropTarget[] {
    const removedTargets: RemovedDropTarget[] = [];

    if (group !== undefined) {
      const groupTargets = this.targetsByGroup.get(group);

      return groupTargets
        ? this.pruneDisconnectedGroup(group, groupTargets)
        : removedTargets;
    }

    for (const [targetGroup, groupTargets] of this.targetsByGroup) {
      removedTargets.push(
        ...this.pruneDisconnectedGroup(targetGroup, groupTargets),
      );
    }

    return removedTargets;
  }

  clear(): void {
    this.targetsByGroup.clear();
    this.targetElements = new WeakMap();
    this.sortableAxisIndexes.clear();
  }

  remeasure(input?: RemeasureDropTargetsInput): void {
    if (input === undefined) {
      for (const groupTargets of this.targetsByGroup.values()) {
        for (const target of groupTargets.values()) {
          this.remeasureEntry(target);
        }
      }

      this.sortableAxisIndexes.clear();
      return;
    }

    if (typeof input === "string") {
      for (const group of this.remeasureTarget(input)) {
        this.sortableAxisIndexes.delete(group);
      }
      return;
    }

    if (Array.isArray(input)) {
      const remeasuredGroups = new Set<DragGroup>();

      for (const dropTargetId of input) {
        for (const group of this.remeasureTarget(dropTargetId)) {
          remeasuredGroups.add(group);
        }
      }

      for (const group of remeasuredGroups) {
        this.sortableAxisIndexes.delete(group);
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
    this.sortableAxisIndexes.delete(input.group);
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
    if (input.group === null) {
      return [];
    }

    const groupTargets = this.targetsByGroup.get(input.group);

    if (!groupTargets) {
      return [];
    }

    const sortableCandidates = this.getNarrowedSortableDropTargetEntries(
      input,
      groupTargets,
    );

    if (sortableCandidates) {
      const dropTargets = this.getAvailableDropTargetsFromEntries(
        sortableCandidates,
        input,
      );

      if (!input.targetingConstraint || dropTargets.length > 0) {
        return dropTargets;
      }
    }

    return this.getAvailableDropTargetsFromEntries(groupTargets.values(), input);
  }

  private getAvailableDropTargetsFromEntries(
    entries: Iterable<DropTargetEntry>,
    input: GetAvailableDropTargetsInput,
  ): DropTarget[] {
    const candidates: AvailableDropTargetCandidate[] = [];
    let hasContainerCandidate = false;

    for (const target of entries) {
      const element = this.resolveEntry(target);

      if (!element) {
        continue;
      }

      if (target.capabilities.container) {
        hasContainerCandidate = true;
      }
      candidates.push({
        entry: target,
        element,
        viewportRect: documentRectToViewportRect(target.documentRect),
      });
    }

    const candidateParentElements = hasContainerCandidate
      ? getCandidateParentElements(candidates)
      : null;
    const dropTargets: DropTarget[] = [];

    for (const candidate of candidates) {
      if (
        candidate.entry.capabilities.container &&
        candidateParentElements &&
        !shouldIncludeContainerCandidate({
          candidateParentElements,
          containerCandidate: candidate,
          pointerPosition: input.pointerPosition,
        })
      ) {
        continue;
      }

      const candidateDropTarget = {
        dropTargetId: candidate.entry.id,
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

  getSortableDropPlacement(input: {
    draggableId: string;
    dropTargetId: string | null;
    group: DragGroup | null;
    sourceContainerId: string | null;
  }): SortableDropPlacement | null {
    if (input.dropTargetId === null || input.group === null) {
      return null;
    }

    const dropTarget = this.findRegistration(input.dropTargetId, {
      group: input.group,
    });

    if (!dropTarget) {
      return null;
    }

    const itemRegistration = this.findRegistration(input.draggableId, {
      group: input.group,
    });

    if (!itemRegistration?.capabilities.sortable) {
      return null;
    }

    if (
      !dropTarget.capabilities.sortable &&
      !dropTarget.capabilities.container
    ) {
      return null;
    }

    const previewContainer =
      dropTarget.id === input.draggableId
        ? this.findContainerRegistrationForElement({
            element: itemRegistration?.element.parentElement ?? null,
            group: input.group,
          })
        : null;
    const containerId = previewContainer?.containerId ?? dropTarget.containerId;
    const containerElement =
      previewContainer?.element ?? getDropTargetContainerElement(dropTarget);
    const siblingPlacement = this.getSiblingPlacement({
      draggableId: input.draggableId,
      group: input.group,
      itemElement: itemRegistration.element,
      dropTarget,
      containerElement,
    });
    const targetPlacement = this.getTargetPlacement({
      draggableId: input.draggableId,
      group: input.group,
      itemElement: itemRegistration.element,
      dropTarget,
    });

    return {
      sourceContainerId: input.sourceContainerId,
      containerId,
      previousDraggableId: siblingPlacement.previousDraggableId,
      nextDraggableId: siblingPlacement.nextDraggableId,
      targetDraggableId: targetPlacement.targetDraggableId,
      side: targetPlacement.side,
    };
  }

  getSortableItemPlacement(
    draggableId: string,
    group?: DragGroup,
  ): SortableItemPlacement | null {
    const registration = this.findRegistration(draggableId, { group });

    if (
      !registration?.capabilities.sortable ||
      !registration.element.parentElement
    ) {
      return null;
    }

    const { element } = registration;
    const itemGroup = registration.group;

    const previousDraggableId = this.getNearestSortableSiblingDraggableId(
      element.previousElementSibling,
      itemGroup,
      "previous",
    );
    const nextDraggableId = this.getNearestSortableSiblingDraggableId(
      element.nextElementSibling,
      itemGroup,
      "next",
    );

    return {
      containerId: registration.containerId,
      previousDraggableId,
      nextDraggableId,
      exactAnchors: this.getExactSortableItemAnchors(element, itemGroup),
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

    this.sortableAxisIndexes.delete(group);

    if (groupTargets.size === 0) {
      this.targetsByGroup.delete(group);
    }

    return [{ id, group }];
  }

  private pruneDisconnectedGroup(
    group: DragGroup,
    groupTargets: Map<string, DropTargetEntry>,
  ): RemovedDropTarget[] {
    const removedTargets: RemovedDropTarget[] = [];

    for (const [id, entry] of groupTargets) {
      if (this.resolveEntry(entry)) {
        continue;
      }

      groupTargets.delete(id);
      removedTargets.push({ id, group });
    }

    if (removedTargets.length > 0) {
      this.sortableAxisIndexes.delete(group);
    }

    if (groupTargets.size === 0) {
      this.targetsByGroup.delete(group);
    }

    return removedTargets;
  }

  private remeasureTarget(dropTargetId: string): DragGroup[] {
    const remeasuredGroups: DragGroup[] = [];

    for (const groupTargets of this.targetsByGroup.values()) {
      const dropTarget = groupTargets.get(dropTargetId);

      if (dropTarget) {
        this.remeasureEntry(dropTarget);
        remeasuredGroups.push(dropTarget.group);
      }
    }

    return remeasuredGroups;
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
    const entry = this.findEntry(id, input);

    return entry ? this.resolveRegistration(entry) : null;
  }

  private findEntry(
    id: string,
    input: {
      group?: DragGroup | null;
    } = {},
  ): DropTargetEntry | null {
    if (input.group !== undefined) {
      return (
        input.group === null
          ? null
          : this.targetsByGroup.get(input.group)?.get(id) ?? null
      );
    }

    for (const groupTargets of this.targetsByGroup.values()) {
      const entry = groupTargets.get(id);

      if (entry && this.resolveEntry(entry)) {
        return entry;
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

  private getNarrowedSortableDropTargetEntries(
    input: GetAvailableDropTargetsInput,
    groupTargets: Map<string, DropTargetEntry>,
  ): DropTargetEntry[] | null {
    if (
      input.group === null ||
      !input.targetingAlgorithmKind ||
      !input.draggingDraggableId
    ) {
      return null;
    }

    const index = this.getSortableAxisIndex(input.group, groupTargets);

    if (!index || index.unsupported) {
      return null;
    }

    if (!index.candidatesById.has(input.draggingDraggableId)) {
      return null;
    }

    const axisCoordinate = getSortableQueryAxisCoordinate({
      axis: index.axis,
      overlayRect: input.overlayRect,
      pointerPosition: input.pointerPosition,
      targetingAlgorithmKind: input.targetingAlgorithmKind,
    });

    if (axisCoordinate === null) {
      return null;
    }

    const candidates = new Map<string, SortableAxisCandidate>();
    const addCandidate = (candidate: SortableAxisCandidate | undefined): void => {
      if (candidate) {
        candidates.set(candidate.id, candidate);
      }
    };
    const nearestIndex = getNearestSortableAxisIndex(
      index.candidatesByCenter,
      axisCoordinate,
    );

    if (nearestIndex !== null) {
      for (
        let candidateIndex = Math.max(0, nearestIndex - sortableCandidateWindowRadius);
        candidateIndex <=
        Math.min(
          index.candidatesByCenter.length - 1,
          nearestIndex + sortableCandidateWindowRadius,
        );
        candidateIndex += 1
      ) {
        addCandidate(index.candidatesByCenter[candidateIndex]);
      }
    }

    addCandidate(
      findSortableAxisCandidateContainingCoordinate(
        index.candidatesByStart,
        axisCoordinate,
      ),
    );
    addCandidate(index.candidatesById.get(input.draggingDraggableId));
    addCandidate(
      input.activeDropTargetId
        ? index.candidatesById.get(input.activeDropTargetId)
        : undefined,
    );
    addCandidate(
      input.sourceContainerId
        ? index.candidatesById.get(input.sourceContainerId)
        : undefined,
    );

    this.addSortableDomNeighborCandidates({
      candidates,
      group: input.group,
      index,
      targetId: input.draggingDraggableId,
    });
    if (input.activeDropTargetId) {
      this.addSortableDomNeighborCandidates({
        candidates,
        group: input.group,
        index,
        targetId: input.activeDropTargetId,
      });
    }

    return Array.from(candidates.values(), (candidate) => candidate.entry);
  }

  private getSortableAxisIndex(
    group: DragGroup,
    groupTargets: Map<string, DropTargetEntry>,
  ): SortableAxisIndex | null {
    const existingIndex = this.sortableAxisIndexes.get(group);

    if (existingIndex) {
      return existingIndex;
    }

    const index = this.createSortableAxisIndex(groupTargets);

    if (index) {
      this.sortableAxisIndexes.set(group, index);
    }

    return index;
  }

  private createSortableAxisIndex(
    groupTargets: Map<string, DropTargetEntry>,
  ): SortableAxisIndex | null {
    let axis: SortableAxis | null = null;
    let containerId: string | null | undefined;
    const candidates: SortableAxisCandidate[] = [];

    for (const entry of groupTargets.values()) {
      const element = this.resolveEntry(entry);

      if (!element) {
        continue;
      }

      if (
        entry.capabilities.container ||
        !entry.capabilities.sortable ||
        entry.sortableAxis === null
      ) {
        return createUnsupportedSortableAxisIndex();
      }

      if (axis === null) {
        axis = entry.sortableAxis;
      } else if (axis !== entry.sortableAxis) {
        return createUnsupportedSortableAxisIndex();
      }

      if (containerId === undefined) {
        containerId = entry.containerId;
      } else if (containerId !== entry.containerId) {
        return createUnsupportedSortableAxisIndex();
      }

      candidates.push(createSortableAxisCandidate(entry, element, entry.sortableAxis));
    }

    if (axis === null || candidates.length === 0) {
      return null;
    }

    const candidatesByCenter = [...candidates].sort(compareAxisCenter);
    const candidatesByStart = [...candidates].sort(compareAxisStart);
    const index: SortableAxisIndex = {
      axis,
      containerId: containerId ?? null,
      candidatesByCenter,
      candidatesByStart,
      candidatesById: new Map(
        candidates.map((candidate) => [candidate.id, candidate]),
      ),
      unsupported: hasOverlappingSortableAxisRanges(candidatesByStart),
    };

    return index;
  }

  private syncSortableAxisIndexAfterRegister(
    group: DragGroup,
    entry: DropTargetEntry,
    element: HTMLElement,
  ): void {
    const index = this.sortableAxisIndexes.get(group);

    if (!index) {
      return;
    }

    if (
      index.unsupported ||
      entry.capabilities.container ||
      !entry.capabilities.sortable ||
      entry.sortableAxis !== index.axis ||
      entry.containerId !== index.containerId
    ) {
      this.sortableAxisIndexes.delete(group);
      return;
    }

    const candidate = index.candidatesById.get(entry.id);

    if (!candidate) {
      this.sortableAxisIndexes.delete(group);
      return;
    }

    const updatedCandidate = createSortableAxisCandidate(
      entry,
      element,
      index.axis,
    );

    candidate.entry = updatedCandidate.entry;
    candidate.element = updatedCandidate.element;
    candidate.containerId = updatedCandidate.containerId;
    candidate.axisStart = updatedCandidate.axisStart;
    candidate.axisEnd = updatedCandidate.axisEnd;
    candidate.axisCenter = updatedCandidate.axisCenter;
  }

  private addSortableDomNeighborCandidates(input: {
    candidates: Map<string, SortableAxisCandidate>;
    group: DragGroup;
    index: SortableAxisIndex;
    targetId: string;
  }): void {
    const registration = this.findRegistration(input.targetId, {
      group: input.group,
    });

    if (!registration) {
      return;
    }

    const previousDraggableId = this.getNearestSortableSiblingDraggableId(
      registration.element.previousElementSibling,
      input.group,
      "previous",
    );
    const nextDraggableId = this.getNearestSortableSiblingDraggableId(
      registration.element.nextElementSibling,
      input.group,
      "next",
    );

    if (previousDraggableId) {
      const previousCandidate = input.index.candidatesById.get(previousDraggableId);

      if (previousCandidate) {
        input.candidates.set(previousDraggableId, previousCandidate);
      }
    }

    if (nextDraggableId) {
      const nextCandidate = input.index.candidatesById.get(nextDraggableId);

      if (nextCandidate) {
        input.candidates.set(nextDraggableId, nextCandidate);
      }
    }
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
    draggableId: string;
    group: DragGroup;
    itemElement: HTMLElement;
    dropTarget: ResolvedDropTargetEntry;
    containerElement: HTMLElement | null;
  }): Pick<SortableDropPlacement, "previousDraggableId" | "nextDraggableId"> {
    if (
      input.itemElement.parentElement &&
      input.itemElement.parentElement === input.containerElement
    ) {
      return {
        previousDraggableId: this.getNearestSortableSiblingDraggableId(
          input.itemElement.previousElementSibling,
          input.group,
          "previous",
          input.draggableId,
        ),
        nextDraggableId: this.getNearestSortableSiblingDraggableId(
          input.itemElement.nextElementSibling,
          input.group,
          "next",
          input.draggableId,
        ),
      };
    }

    if (input.dropTarget.capabilities.container) {
      return {
        previousDraggableId: this.getNearestSortableSiblingDraggableId(
          input.dropTarget.element.lastElementChild,
          input.group,
          "previous",
          input.draggableId,
        ),
        nextDraggableId: null,
      };
    }

    return {
      previousDraggableId: this.getNearestSortableSiblingDraggableId(
        input.dropTarget.element.previousElementSibling,
        input.group,
        "previous",
        input.draggableId,
      ),
      nextDraggableId: input.dropTarget.id,
    };
  }

  private getTargetPlacement(input: {
    draggableId: string;
    group: DragGroup;
    itemElement: HTMLElement;
    dropTarget: ResolvedDropTargetEntry;
  }): Pick<SortableDropPlacement, "targetDraggableId" | "side"> {
    if (!input.dropTarget.capabilities.sortable) {
      return {
        targetDraggableId: null,
        side: null,
      };
    }

    if (input.dropTarget.id === input.draggableId) {
      return this.getPreviewDomTargetPlacement({
        draggableId: input.draggableId,
        group: input.group,
        itemElement: input.itemElement,
      });
    }

    return {
      targetDraggableId: input.dropTarget.id,
      side: getSortableTargetSide({
        itemElement: input.itemElement,
        targetElement: input.dropTarget.element,
      }),
    };
  }

  private getExactSortableItemAnchors(
    element: HTMLElement,
    group: DragGroup,
  ): SortablePlacementAnchor[] {
    const anchors: SortablePlacementAnchor[] = [];
    const previousDraggableId = this.getSortableDraggableId(
      element.previousElementSibling,
      group,
    );
    const nextDraggableId = this.getSortableDraggableId(
      element.nextElementSibling,
      group,
    );

    if (previousDraggableId) {
      anchors.push({
        targetDraggableId: previousDraggableId,
        side: "after",
      });
    }

    if (nextDraggableId) {
      anchors.push({
        targetDraggableId: nextDraggableId,
        side: "before",
      });
    }

    return anchors;
  }

  private getPreviewDomTargetPlacement(input: {
    draggableId: string;
    group: DragGroup;
    itemElement: HTMLElement;
  }): Pick<SortableDropPlacement, "targetDraggableId" | "side"> {
    const previousElement = input.itemElement.previousElementSibling;
    const nextElement = input.itemElement.nextElementSibling;
    const previousDraggableId = this.getSortableDraggableId(
      previousElement,
      input.group,
    );
    const nextDraggableId = this.getSortableDraggableId(
      nextElement,
      input.group,
    );

    if (
      this.isSkippedSortableSibling(previousElement, input.group) &&
      nextDraggableId &&
      nextDraggableId !== input.draggableId
    ) {
      return {
        targetDraggableId: nextDraggableId,
        side: "before",
      };
    }

    if (
      this.isSkippedSortableSibling(nextElement, input.group) &&
      previousDraggableId &&
      previousDraggableId !== input.draggableId
    ) {
      return {
        targetDraggableId: previousDraggableId,
        side: "after",
      };
    }

    if (previousDraggableId && previousDraggableId !== input.draggableId) {
      return {
        targetDraggableId: previousDraggableId,
        side: "after",
      };
    }

    if (nextDraggableId && nextDraggableId !== input.draggableId) {
      return {
        targetDraggableId: nextDraggableId,
        side: "before",
      };
    }

    const previousNearestDraggableId = this.getNearestSortableSiblingDraggableId(
      previousElement,
      input.group,
      "previous",
      input.draggableId,
    );

    if (previousNearestDraggableId) {
      return {
        targetDraggableId: previousNearestDraggableId,
        side: "after",
      };
    }

    const nextNearestDraggableId = this.getNearestSortableSiblingDraggableId(
      nextElement,
      input.group,
      "next",
      input.draggableId,
    );

    if (nextNearestDraggableId) {
      return {
        targetDraggableId: nextNearestDraggableId,
        side: "before",
      };
    }

    return {
      targetDraggableId: null,
      side: null,
    };
  }

  private isSkippedSortableSibling(
    element: Element | null,
    group: DragGroup,
  ): boolean {
    return (
      element instanceof HTMLElement &&
      element.dataset.dndSortableDraggable !== undefined &&
      this.getSortableDraggableId(element, group) === null
    );
  }

  private getNearestSortableSiblingDraggableId(
    element: Element | null,
    group: DragGroup,
    direction: "previous" | "next",
    excludeDraggableId?: string,
  ): string | null {
    let currentElement = element;

    while (currentElement) {
      const draggableId = this.getSortableDraggableId(currentElement, group);

      if (draggableId && draggableId !== excludeDraggableId) {
        return draggableId;
      }

      currentElement =
        direction === "previous"
          ? currentElement.previousElementSibling
          : currentElement.nextElementSibling;
    }

    return null;
  }

  private getSortableDraggableId(
    element: Element | null,
    group: DragGroup,
  ): string | null {
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

function getSortableTargetSide(input: {
  itemElement: HTMLElement;
  targetElement: HTMLElement;
}): SortablePlacementSide | null {
  if (
    input.itemElement === input.targetElement ||
    input.itemElement.parentElement !== input.targetElement.parentElement
  ) {
    return null;
  }

  const position = input.targetElement.compareDocumentPosition(input.itemElement);

  if ((position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) {
    return "after";
  }

  if ((position & Node.DOCUMENT_POSITION_PRECEDING) !== 0) {
    return "before";
  }

  return null;
}

function shouldIncludeContainerCandidate(input: {
  candidateParentElements: ReadonlySet<HTMLElement>;
  containerCandidate: AvailableDropTargetCandidate;
  pointerPosition: DragPoint;
}): boolean {
  if (
    !isPointInsideRect(input.pointerPosition, input.containerCandidate.viewportRect)
  ) {
    return false;
  }

  return !input.candidateParentElements.has(input.containerCandidate.element);
}

function getCandidateParentElements(
  candidates: AvailableDropTargetCandidate[],
): ReadonlySet<HTMLElement> {
  const parentElements = new Set<HTMLElement>();

  for (const candidate of candidates) {
    const parentElement = candidate.element.parentElement;

    if (parentElement) {
      parentElements.add(parentElement);
    }
  }

  return parentElements;
}

function createUnsupportedSortableAxisIndex(): SortableAxisIndex {
  return {
    axis: "vertical",
    containerId: null,
    candidatesByCenter: [],
    candidatesByStart: [],
    candidatesById: new Map(),
    unsupported: true,
  };
}

function createSortableAxisCandidate(
  entry: DropTargetEntry,
  element: HTMLElement,
  axis: SortableAxis,
): SortableAxisCandidate {
  const coordinates = getSortableAxisCoordinates(entry.documentRect, axis);

  return {
    id: entry.id,
    entry,
    element,
    containerId: entry.containerId,
    axisStart: coordinates.start,
    axisEnd: coordinates.end,
    axisCenter: coordinates.center,
  };
}

function getSortableAxisCoordinates(
  rect: DragRect,
  axis: SortableAxis,
): { start: number; end: number; center: number } {
  if (axis === "horizontal") {
    return {
      start: rect.left,
      end: rect.right,
      center: rect.left + rect.width / 2,
    };
  }

  return {
    start: rect.top,
    end: rect.bottom,
    center: rect.top + rect.height / 2,
  };
}

function getSortableQueryAxisCoordinate(input: {
  axis: SortableAxis;
  overlayRect: DragRect | null;
  pointerPosition: DragPoint;
  targetingAlgorithmKind: BuiltInTargetingAlgorithmKind;
}): number | null {
  if (input.targetingAlgorithmKind === "center-to-center") {
    if (!input.overlayRect) {
      return null;
    }

    const coordinates = getSortableAxisCoordinates(
      input.overlayRect,
      input.axis,
    );

    return coordinates.center + getDocumentScrollOffset(input.axis);
  }

  return (
    (input.axis === "horizontal"
      ? input.pointerPosition.x
      : input.pointerPosition.y) + getDocumentScrollOffset(input.axis)
  );
}

function getDocumentScrollOffset(axis: SortableAxis): number {
  return axis === "horizontal" ? window.scrollX : window.scrollY;
}

function getNearestSortableAxisIndex(
  candidates: readonly SortableAxisCandidate[],
  axisCoordinate: number,
): number | null {
  if (candidates.length === 0) {
    return null;
  }

  let low = 0;
  let high = candidates.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = candidates[mid];

    if (!candidate) {
      return null;
    }

    if (candidate.axisCenter < axisCoordinate) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (low <= 0) {
    return 0;
  }

  if (low >= candidates.length) {
    return candidates.length - 1;
  }

  const previous = candidates[low - 1];
  const next = candidates[low];

  if (!previous || !next) {
    return low;
  }

  return axisCoordinate - previous.axisCenter <= next.axisCenter - axisCoordinate
    ? low - 1
    : low;
}

function findSortableAxisCandidateContainingCoordinate(
  candidatesByStart: readonly SortableAxisCandidate[],
  axisCoordinate: number,
): SortableAxisCandidate | undefined {
  let low = 0;
  let high = candidatesByStart.length - 1;
  let lastStartBeforeCoordinate = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = candidatesByStart[mid];

    if (!candidate) {
      return undefined;
    }

    if (candidate.axisStart <= axisCoordinate) {
      lastStartBeforeCoordinate = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (lastStartBeforeCoordinate === -1) {
    return undefined;
  }

  const candidate = candidatesByStart[lastStartBeforeCoordinate];

  return candidate && candidate.axisEnd >= axisCoordinate ? candidate : undefined;
}

function hasOverlappingSortableAxisRanges(
  candidatesByStart: readonly SortableAxisCandidate[],
): boolean {
  let previousAxisEnd = Number.NEGATIVE_INFINITY;

  for (const candidate of candidatesByStart) {
    if (candidate.axisStart < previousAxisEnd) {
      return true;
    }

    previousAxisEnd = Math.max(previousAxisEnd, candidate.axisEnd);
  }

  return false;
}

function compareAxisCenter(
  a: SortableAxisCandidate,
  b: SortableAxisCandidate,
): number {
  return a.axisCenter - b.axisCenter;
}

function compareAxisStart(
  a: SortableAxisCandidate,
  b: SortableAxisCandidate,
): number {
  return a.axisStart - b.axisStart;
}

function isPointInsideRect(point: DragPoint, rect: DragRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.right &&
    point.y >= rect.top &&
    point.y <= rect.bottom
  );
}
