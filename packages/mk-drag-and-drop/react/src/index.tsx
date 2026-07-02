import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
  type RefCallback,
} from "react";

import {
  createDragRuntime,
  type DragPoint,
  type DragRect,
  type DragRuntime,
  type TargetingAlgorithm,
  type TargetingConstraint,
} from "@mk-drag-and-drop/core";
import {
  createDomDragHandler,
  createDomDragSession,
  type DomDragControls,
  type DomDragEndEvent,
  type DomDragStartEvent,
  type DomDragSession,
  type DomDragUpdateEvent,
  type DomDropEvent,
  measureDomElement,
  removeDomDropTarget,
  setDomDropTarget,
} from "@mk-drag-and-drop/dom";

type DragDropConfiguration = {
  runtime: DragRuntime;
  session: DomDragSession;
  draggableElements: Map<string, HTMLElement>;
  subscribeDrag: (
    draggedKey: string,
    subscription: DragDropSubscription,
  ) => () => void;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
  onDragStart?: (drag: DomDragStartEvent, controls: DomDragControls) => void;
  onDragUpdate?: (drag: DomDragUpdateEvent, controls: DomDragControls) => void;
  onDragEnd?: (drag: DomDragEndEvent, controls: DomDragControls) => void;
  onDrop?: (drop: DomDropEvent, controls: DomDragControls) => void;
};

export type DragDropControls = {
  pointerPosition: DragPoint | null;
  measureDraggable: (draggedKey: string) => DragRect | null;
  recalculateTargets: (overlayRect?: DragRect | null) => void;
};

export type DragDropSubscription = {
  onDragStart?: (
    drag: DomDragStartEvent,
    controls: DragDropControls,
  ) => void;
  onDragUpdate?: (
    drag: DomDragUpdateEvent,
    controls: DragDropControls,
  ) => void;
  onDragEnd?: (drag: DomDragEndEvent, controls: DragDropControls) => void;
  onDrop?: (drop: DomDropEvent, controls: DragDropControls) => void;
};

export type DragDropProviderProps = {
  children: ReactNode;
  targetingAlgorithm?: TargetingAlgorithm;
  targetingConstraint?: TargetingConstraint;
  onDragStart?: (
    drag: DomDragStartEvent,
    controls: DragDropControls,
  ) => void;
  onDragUpdate?: (
    drag: DomDragUpdateEvent,
    controls: DragDropControls,
  ) => void;
  onDragEnd?: (drag: DomDragEndEvent, controls: DragDropControls) => void;
  onDrop?: (drop: DomDropEvent, controls: DragDropControls) => void;
};

export type UseDraggableOptions = {
  draggedKey: string;
};

export type UseDragHandleOptions = {
  draggedKey: string;
};

export type UseDropTargetOptions = {
  dropTargetKey: string;
};

export type UseDropTargetResult<ElementType extends HTMLElement = HTMLElement> = {
  ref: RefCallback<ElementType>;
  remeasure: () => void;
};

const DragDropContext = createContext<DragDropConfiguration | null>(null);

export function DragDropProvider(
  props: DragDropProviderProps,
): ReactElement {
  const {
    children,
    targetingAlgorithm,
    targetingConstraint,
    onDragStart,
    onDragUpdate,
    onDragEnd,
    onDrop,
  } = props;
  const runtime = useMemo(() => createDragRuntime(), []);
  const session = useMemo(createDomDragSession, []);
  const draggableElements = useMemo(() => new Map<string, HTMLElement>(), []);
  const dragSubscriptions = useMemo(
    () => new Map<string, Set<DragDropSubscription>>(),
    [],
  );
  const createControls = useCallback(
    (controls: DomDragControls): DragDropControls => ({
      pointerPosition: controls.pointerPosition,
      measureDraggable: (draggedKey) => {
        const element = draggableElements.get(draggedKey);

        return element ? measureDomElement(element) : null;
      },
      recalculateTargets: controls.recalculateTargets,
    }),
    [draggableElements],
  );
  const subscribeDrag = useCallback(
    (
      draggedKey: string,
      subscription: DragDropSubscription,
    ): (() => void) => {
      let subscriptions = dragSubscriptions.get(draggedKey);

      if (!subscriptions) {
        subscriptions = new Set();
        dragSubscriptions.set(draggedKey, subscriptions);
      }

      subscriptions.add(subscription);

      return () => {
        subscriptions.delete(subscription);

        if (subscriptions.size === 0) {
          dragSubscriptions.delete(draggedKey);
        }
      };
    },
    [dragSubscriptions],
  );
  const notifyDragSubscriptions = useCallback(
    (
      draggedKey: string,
      notify: (subscription: DragDropSubscription) => void,
    ): void => {
      const subscriptions = dragSubscriptions.get(draggedKey);

      if (!subscriptions) {
        return;
      }

      for (const subscription of Array.from(subscriptions)) {
        notify(subscription);
      }
    },
    [dragSubscriptions],
  );
  const configuration = useMemo<DragDropConfiguration>(
    () => ({
      runtime,
      session,
      draggableElements,
      subscribeDrag,
      targetingAlgorithm,
      targetingConstraint,
      onDragStart: (drag, controls) => {
        const dragControls = createControls(controls);

        onDragStart?.(drag, dragControls);
        notifyDragSubscriptions(drag.draggedKey, (subscription) => {
          subscription.onDragStart?.(drag, dragControls);
        });
      },
      onDragUpdate: (drag, controls) => {
        const dragControls = createControls(controls);

        onDragUpdate?.(drag, dragControls);
        notifyDragSubscriptions(drag.draggedKey, (subscription) => {
          subscription.onDragUpdate?.(drag, dragControls);
        });
      },
      onDragEnd: (drag, controls) => {
        const dragControls = createControls(controls);

        onDragEnd?.(drag, dragControls);
        notifyDragSubscriptions(drag.draggedKey, (subscription) => {
          subscription.onDragEnd?.(drag, dragControls);
        });
      },
      onDrop: (drop, controls) => {
        const dragControls = createControls(controls);

        onDrop?.(drop, dragControls);
        notifyDragSubscriptions(drop.draggedKey, (subscription) => {
          subscription.onDrop?.(drop, dragControls);
        });
      },
    }),
    [
      createControls,
      notifyDragSubscriptions,
      onDragEnd,
      onDragStart,
      onDragUpdate,
      onDrop,
      draggableElements,
      runtime,
      session,
      subscribeDrag,
      targetingAlgorithm,
      targetingConstraint,
    ],
  );

  return (
    <DragDropContext.Provider value={configuration}>
      {children}
    </DragDropContext.Provider>
  );
}

export function useDraggable<ElementType extends HTMLElement = HTMLElement>(
  options: UseDraggableOptions,
): RefCallback<ElementType> {
  const configuration = useRequiredDragDropConfiguration();
  const elementRef = useRef<ElementType | null>(null);
  const optionsRef = useRef(options);
  const configurationRef = useRef(configuration);
  const registeredDraggedKeyRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  optionsRef.current = options;
  configurationRef.current = configuration;

  const draggableRef = useCallback<RefCallback<ElementType>>((element) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    elementRef.current = element;

    if (!element) {
      return;
    }

    const initialDragKey = element.dataset.dndDragKey;
    const currentDraggedKey = optionsRef.current.draggedKey;
    element.dataset.dndDragKey = currentDraggedKey;
    configurationRef.current.draggableElements.set(currentDraggedKey, element);
    registeredDraggedKeyRef.current = currentDraggedKey;

    const handlePointerDown = (event: PointerEvent) => {
      const currentConfiguration = configurationRef.current;
      const currentOptions = optionsRef.current;
      const dragTarget = getDragStartTarget({
        rootElement: element,
        eventTarget: event.target,
        draggedKey: currentOptions.draggedKey,
      });

      if (!dragTarget) {
        return;
      }

      const dragHandler = createDomDragHandler({
        runtime: currentConfiguration.runtime,
        session: currentConfiguration.session,
        targetingAlgorithm: currentConfiguration.targetingAlgorithm,
        targetingConstraint: currentConfiguration.targetingConstraint,
        onDragStart: currentConfiguration.onDragStart,
        onDragUpdate: currentConfiguration.onDragUpdate,
        onDragEnd: currentConfiguration.onDragEnd,
        onDrop: currentConfiguration.onDrop,
      });

      dragHandler({
        target: dragTarget,
        currentTarget: null,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };

    element.addEventListener("pointerdown", handlePointerDown);

    cleanupRef.current = () => {
      element.removeEventListener("pointerdown", handlePointerDown);
      unregisterCurrentDraggableElement({
        configuration: configurationRef.current,
        draggedKey: registeredDraggedKeyRef.current,
        element,
      });
      registeredDraggedKeyRef.current = null;

      if (initialDragKey === undefined) {
        delete element.dataset.dndDragKey;
      } else {
        element.dataset.dndDragKey = initialDragKey;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const element = elementRef.current;

    if (element) {
      unregisterCurrentDraggableElement({
        configuration: configurationRef.current,
        draggedKey: registeredDraggedKeyRef.current,
        element,
      });
      element.dataset.dndDragKey = options.draggedKey;
      configurationRef.current.draggableElements.set(options.draggedKey, element);
      registeredDraggedKeyRef.current = options.draggedKey;
    }
  }, [options.draggedKey]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  return draggableRef;
}

function unregisterCurrentDraggableElement(input: {
  configuration: DragDropConfiguration;
  draggedKey: string | null;
  element: HTMLElement;
}): void {
  if (
    input.draggedKey !== null &&
    input.configuration.draggableElements.get(input.draggedKey) === input.element
  ) {
    input.configuration.draggableElements.delete(input.draggedKey);
  }
}

export function useDragHandle<ElementType extends HTMLElement = HTMLElement>(
  options: UseDragHandleOptions,
): RefCallback<ElementType> {
  const elementRef = useRef<ElementType | null>(null);
  const optionsRef = useRef(options);
  const cleanupRef = useRef<(() => void) | null>(null);

  optionsRef.current = options;

  const dragHandleRef = useCallback<RefCallback<ElementType>>((element) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    elementRef.current = element;

    if (!element) {
      return;
    }

    const initialDragKey = element.dataset.dndDragKey;
    const initialDragHandleKey = element.dataset.dndDragHandleKey;
    element.dataset.dndDragKey = optionsRef.current.draggedKey;
    element.dataset.dndDragHandleKey = optionsRef.current.draggedKey;

    cleanupRef.current = () => {
      if (initialDragKey === undefined) {
        delete element.dataset.dndDragKey;
      } else {
        element.dataset.dndDragKey = initialDragKey;
      }

      if (initialDragHandleKey === undefined) {
        delete element.dataset.dndDragHandleKey;
      } else {
        element.dataset.dndDragHandleKey = initialDragHandleKey;
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (elementRef.current) {
      elementRef.current.dataset.dndDragKey = options.draggedKey;
      elementRef.current.dataset.dndDragHandleKey = options.draggedKey;
    }
  }, [options.draggedKey]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  return dragHandleRef;
}

export function useDropTarget<ElementType extends HTMLElement = HTMLElement>(
  options: UseDropTargetOptions,
): UseDropTargetResult<ElementType> {
  const configuration = useRequiredDragDropConfiguration();
  const elementRef = useRef<ElementType | null>(null);
  const optionsRef = useRef(options);
  const configurationRef = useRef(configuration);
  const registeredDropTargetKeyRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  optionsRef.current = options;
  configurationRef.current = configuration;

  const unregisterCurrentDropTarget = useCallback(() => {
    const registeredDropTargetKey = registeredDropTargetKeyRef.current;

    if (!registeredDropTargetKey) {
      return;
    }

    removeDomDropTarget(
      configurationRef.current.session,
      registeredDropTargetKey,
    );
    registeredDropTargetKeyRef.current = null;
  }, []);

  const remeasure = useCallback(() => {
    const element = elementRef.current;
    const currentOptions = optionsRef.current;
    const currentConfiguration = configurationRef.current;

    if (!element) {
      unregisterCurrentDropTarget();
      return;
    }

    if (
      registeredDropTargetKeyRef.current !== null &&
      registeredDropTargetKeyRef.current !== currentOptions.dropTargetKey
    ) {
      removeDomDropTarget(
        currentConfiguration.session,
        registeredDropTargetKeyRef.current,
      );
    }

    setDomDropTarget(currentConfiguration.session, {
      dropTargetKey: currentOptions.dropTargetKey,
      dropTargetRect: measureDomElement(element),
    });
    registeredDropTargetKeyRef.current = currentOptions.dropTargetKey;
  }, [unregisterCurrentDropTarget]);

  const dropTargetRef = useCallback<RefCallback<ElementType>>((element) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    elementRef.current = element;

    if (!element) {
      return;
    }

    const initialDropTargetKey = element.dataset.dndDropTargetKey;
    element.dataset.dndDropTargetKey = optionsRef.current.dropTargetKey;
    remeasure();

    cleanupRef.current = () => {
      unregisterCurrentDropTarget();

      if (initialDropTargetKey === undefined) {
        delete element.dataset.dndDropTargetKey;
      } else {
        element.dataset.dndDropTargetKey = initialDropTargetKey;
      }
    };
  }, [remeasure, unregisterCurrentDropTarget]);

  useLayoutEffect(() => {
    if (elementRef.current) {
      elementRef.current.dataset.dndDropTargetKey =
        optionsRef.current.dropTargetKey;
      remeasure();
    }
  }, [options.dropTargetKey, remeasure]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  return useMemo(
    () => ({
      ref: dropTargetRef,
      remeasure,
    }),
    [dropTargetRef, remeasure],
  );
}

export function useDragDropSubscription(
  draggedKey: string,
  subscription: DragDropSubscription,
): void {
  const configuration = useRequiredDragDropConfiguration();
  const subscriptionRef = useRef(subscription);

  subscriptionRef.current = subscription;

  useLayoutEffect(
    () =>
      configuration.subscribeDrag(draggedKey, {
        onDragStart: (drag, controls) => {
          subscriptionRef.current.onDragStart?.(drag, controls);
        },
        onDragUpdate: (drag, controls) => {
          subscriptionRef.current.onDragUpdate?.(drag, controls);
        },
        onDragEnd: (drag, controls) => {
          subscriptionRef.current.onDragEnd?.(drag, controls);
        },
        onDrop: (drop, controls) => {
          subscriptionRef.current.onDrop?.(drop, controls);
        },
      }),
    [configuration, draggedKey],
  );
}

export function useRequiredDragDropConfiguration(): DragDropConfiguration {
  const configuration = useContext(DragDropContext);

  if (!configuration) {
    throw new Error("useDraggable must be used inside DragDropProvider.");
  }

  return configuration;
}

export {
  useSortable,
  type UseSortableOptions,
  type UseSortableResult,
} from "./useSortable.js";
export { composeRefs } from "./composeRefs.js";

function getDragStartTarget(input: {
  rootElement: HTMLElement;
  eventTarget: EventTarget | null;
  draggedKey: string;
}): HTMLElement | null {
  const dragHandleSelector = `[data-dnd-drag-handle-key="${CSS.escape(
    input.draggedKey,
  )}"]`;
  const hasDragHandle =
    input.rootElement.matches(dragHandleSelector) ||
    input.rootElement.querySelector(dragHandleSelector) !== null;

  if (!hasDragHandle) {
    return input.rootElement;
  }

  if (!(input.eventTarget instanceof HTMLElement)) {
    return null;
  }

  const dragHandle = input.eventTarget.closest(dragHandleSelector);

  if (!(dragHandle instanceof HTMLElement)) {
    return null;
  }

  if (
    dragHandle !== input.rootElement &&
    !input.rootElement.contains(dragHandle)
  ) {
    return null;
  }

  return dragHandle;
}
