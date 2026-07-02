import {
  useCallback,
  useLayoutEffect,
  useRef,
  type RefCallback,
} from "react";

import {
  moveSortablePreview,
  shouldMoveSortablePreview,
} from "@mk-drag-and-drop/sortable";

import {
  useDragDropSubscription,
  useDraggable,
  useDropTarget,
  useRequiredDragDropConfiguration,
} from "../index.js";

export type UseSortableOptions = {
  itemKey: string;
};

export type UseSortableResult<ElementType extends HTMLElement = HTMLElement> = {
  ref: RefCallback<ElementType>;
};

type SortableRegistry = {
  elements: Map<string, HTMLElement>;
  dropTargetRemeasures: Map<string, () => void>;
  snapshots: Map<string, SortableSnapshot>;
};

type SortableSnapshot = {
  element: HTMLElement;
  parent: HTMLElement;
  nextSibling: ChildNode | null;
};

const sortableRegistries = new WeakMap<object, SortableRegistry>();

export function useSortable<ElementType extends HTMLElement = HTMLElement>(
  options: UseSortableOptions,
): UseSortableResult<ElementType> {
  const configuration = useRequiredDragDropConfiguration();
  const registry = getSortableRegistry(configuration.session);
  const draggableRef = useDraggable<ElementType>({
    draggedKey: options.itemKey,
  });
  const dropTarget = useDropTarget<ElementType>({
    dropTargetKey: options.itemKey,
  });
  const elementRef = useRef<ElementType | null>(null);
  const optionsRef = useRef(options);
  const registeredItemKeyRef = useRef<string | null>(null);

  optionsRef.current = options;

  const sortableRef = useCallback<RefCallback<ElementType>>(
    (element) => {
      unregisterSortableElement({
        registry,
        itemKey: registeredItemKeyRef.current,
        element: elementRef.current,
      });
      elementRef.current = element;
      dropTarget.ref(element);
      draggableRef(element);

      if (!element) {
        registeredItemKeyRef.current = null;
        return;
      }

      registry.elements.set(optionsRef.current.itemKey, element);
      registeredItemKeyRef.current = optionsRef.current.itemKey;
    },
    [draggableRef, dropTarget.ref, registry],
  );

  useLayoutEffect(() => {
    const element = elementRef.current;

    if (!element) {
      return;
    }

    unregisterSortableElement({
      registry,
      itemKey: registeredItemKeyRef.current,
      element,
    });
    registry.elements.set(options.itemKey, element);
    registeredItemKeyRef.current = options.itemKey;
  }, [options.itemKey, registry]);

  useLayoutEffect(() => {
    registry.dropTargetRemeasures.set(options.itemKey, dropTarget.remeasure);
    dropTarget.remeasure();

    return () => {
      if (
        registry.dropTargetRemeasures.get(options.itemKey) ===
        dropTarget.remeasure
      ) {
        registry.dropTargetRemeasures.delete(options.itemKey);
      }
    };
  }, [dropTarget.remeasure, options.itemKey, registry]);

  useDragDropSubscription(options.itemKey, {
    onDragStart: (event) => {
      const element = registry.elements.get(event.draggedKey);

      if (!element?.parentElement) {
        return;
      }

      registry.snapshots.set(event.draggedKey, {
        element,
        parent: element.parentElement,
        nextSibling: element.nextSibling,
      });
    },
    onDragUpdate: (event, controls) => {
      if (
        !shouldMoveSortablePreview({
          draggedKey: event.draggedKey,
          activeDropTargetKey: event.activeDropTargetKey,
          previousDropTargetKey: event.previousDropTargetKey,
        })
      ) {
        return;
      }

      if (
        event.activeDropTargetKey === null ||
        !registry.elements.has(event.activeDropTargetKey)
      ) {
        return;
      }

      moveSortablePreview({
        draggedKey: event.draggedKey,
        activeDropTargetKey: event.activeDropTargetKey,
        getItemElement: (itemKey) => registry.elements.get(itemKey) ?? null,
      });
      remeasureSortableDropTargets(registry);
      controls.recalculateTargets();
    },
    onDragEnd: (event) => {
      if (event.dropTargetKey === null) {
        restoreSortableSnapshot(registry, event.draggedKey);
        remeasureSortableDropTargets(registry);
      }

      registry.snapshots.delete(event.draggedKey);
    },
    onDrop: (event) => {
      registry.snapshots.delete(event.draggedKey);
    },
  });

  return {
    ref: sortableRef,
  };
}

function getSortableRegistry(key: object): SortableRegistry {
  const existingRegistry = sortableRegistries.get(key);

  if (existingRegistry) {
    return existingRegistry;
  }

  const registry: SortableRegistry = {
    elements: new Map(),
    dropTargetRemeasures: new Map(),
    snapshots: new Map(),
  };

  sortableRegistries.set(key, registry);

  return registry;
}

function unregisterSortableElement(input: {
  registry: SortableRegistry;
  itemKey: string | null;
  element: HTMLElement | null;
}): void {
  if (
    input.itemKey !== null &&
    input.element !== null &&
    input.registry.elements.get(input.itemKey) === input.element
  ) {
    input.registry.elements.delete(input.itemKey);
  }
}

function remeasureSortableDropTargets(registry: SortableRegistry): void {
  for (const remeasureDropTarget of registry.dropTargetRemeasures.values()) {
    remeasureDropTarget();
  }
}

function restoreSortableSnapshot(
  registry: SortableRegistry,
  draggedKey: string,
): void {
  const snapshot = registry.snapshots.get(draggedKey);

  if (!snapshot || snapshot.element.parentElement !== snapshot.parent) {
    return;
  }

  if (snapshot.nextSibling?.parentNode === snapshot.parent) {
    snapshot.parent.insertBefore(snapshot.element, snapshot.nextSibling);
    return;
  }

  snapshot.parent.append(snapshot.element);
}
