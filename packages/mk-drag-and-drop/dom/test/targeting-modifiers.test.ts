import { describe, expect, it, vi } from "vitest";

import {
  applyDragModifiers,
  centerToCenter,
  createActiveDragModifiers,
  createDragController,
  createDragRuntime,
  lockToXAxis,
  lockToYAxis,
  maxDistanceToRect,
  pointerToCenter,
  pointerToRectDistance,
  restrictToContainer,
  type DropTarget,
} from "../src/index.js";
import { createRect, stubBoundingClientRect } from "./test-utils.js";

describe("targeting", () => {
  const targets: DropTarget[] = [
    {
      dropTargetKey: "near",
      dropTargetRect: createRect({ left: 0, top: 0, width: 20, height: 20 }),
    },
    {
      dropTargetKey: "far",
      dropTargetRect: createRect({ left: 100, top: 0, width: 20, height: 20 }),
    },
  ];

  it("pointerToCenter chooses the closest target center", () => {
    expect(
      pointerToCenter({
        pointerPosition: { x: 105, y: 10 },
        overlayRect: null,
        dropTargets: targets,
      })?.dropTargetKey,
    ).toBe("far");
  });

  it("centerToCenter uses overlay center and requires an overlay rect", () => {
    expect(
      centerToCenter({
        pointerPosition: { x: 0, y: 0 },
        overlayRect: null,
        dropTargets: targets,
      }),
    ).toBeNull();
    expect(
      centerToCenter({
        pointerPosition: { x: 0, y: 0 },
        overlayRect: createRect({ left: 95, top: 0, width: 20, height: 20 }),
        dropTargets: targets,
      })?.dropTargetKey,
    ).toBe("far");
  });

  it("pointerToRectDistance chooses the closest rectangle", () => {
    expect(
      pointerToRectDistance({
        pointerPosition: { x: 80, y: 10 },
        overlayRect: null,
        dropTargets: targets,
      })?.dropTargetKey,
    ).toBe("far");
  });

  it("maxDistanceToRect filters by pointer distance to rect", () => {
    const constraint = maxDistanceToRect({ maxDistance: 8 });

    expect(
      constraint({
        pointerPosition: { x: 24, y: 10 },
        overlayRect: null,
        dropTarget: targets[0],
      }),
    ).toBe(true);
    expect(
      constraint({
        pointerPosition: { x: 40, y: 10 },
        overlayRect: null,
        dropTarget: targets[0],
      }),
    ).toBe(false);
  });
});

describe("modifiers", () => {
  const setupInput = {
    itemId: "item-1",
    group: "items",
    sourceRect: createRect({ width: 20, height: 20 }),
    initialPointerPosition: { x: 10, y: 10 },
  };
  const transformInput = {
    itemId: "item-1",
    group: "items",
    sourceRect: createRect({ width: 20, height: 20 }),
    initialPointerPosition: { x: 10, y: 10 },
    rawPointerPosition: { x: 50, y: 60 },
    pointerPosition: { x: 50, y: 60 },
    overlayRect: createRect({ left: 40, top: 50, width: 20, height: 20 }),
    state: undefined,
  };

  it("lockToXAxis and lockToYAxis constrain one axis", () => {
    expect(lockToXAxis().transform(transformInput)).toEqual({ x: 50, y: 10 });
    expect(lockToYAxis().transform(transformInput)).toEqual({ x: 10, y: 60 });
  });

  it("restrictToContainer clamps the overlay into a resolved container", () => {
    const container = document.createElement("div");
    stubBoundingClientRect(
      container,
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    const modifier = restrictToContainer(() => container);
    const state = modifier.setup?.(setupInput) ?? null;

    expect(
      modifier.transform({
        ...transformInput,
        pointerPosition: { x: 120, y: 120 },
        overlayRect: createRect({ left: 110, top: 110, width: 20, height: 20 }),
        state,
      }),
    ).toEqual({ x: 90, y: 90 });
  });

  it("restrictToContainer can conditionally no-op by returning null", () => {
    const container = document.createElement("div");
    stubBoundingClientRect(
      container,
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    const modifier = restrictToContainer(({ group }) =>
      group === "cards" ? container : null,
    );
    const state = modifier.setup?.(setupInput) ?? null;

    expect(state).toBeNull();
    expect(
      modifier.transform({
        ...transformInput,
        pointerPosition: { x: 120, y: 120 },
        overlayRect: createRect({ left: 110, top: 110, width: 20, height: 20 }),
        state,
      }),
    ).toEqual({ x: 120, y: 120 });
  });

  it("restrictToContainer resolver can choose containers by item and group", () => {
    const cardContainer = document.createElement("div");
    const specialContainer = document.createElement("div");
    stubBoundingClientRect(
      cardContainer,
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    stubBoundingClientRect(
      specialContainer,
      createRect({ left: 25, top: 25, width: 50, height: 50 }),
    );
    const resolver = vi.fn((input: typeof setupInput) => {
      if (input.group === "cards") {
        return cardContainer;
      }

      if (input.itemId === "special") {
        return specialContainer;
      }

      return null;
    });
    const modifier = restrictToContainer(resolver);
    const cardSetupInput = {
      ...setupInput,
      group: "cards",
    };
    const specialSetupInput = {
      ...setupInput,
      itemId: "special",
      group: "items",
    };

    expect(modifier.setup?.(cardSetupInput)).toEqual(
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    expect(modifier.setup?.(specialSetupInput)).toEqual(
      createRect({ left: 25, top: 25, width: 50, height: 50 }),
    );
    expect(resolver).toHaveBeenCalledWith(cardSetupInput);
    expect(resolver).toHaveBeenCalledWith(specialSetupInput);
  });

  it("restrictToContainer measures the resolved container once during setup", () => {
    const container = document.createElement("div");
    const getBoundingClientRect = vi
      .spyOn(container, "getBoundingClientRect")
      .mockReturnValue(
        createRect({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect,
      );
    const modifier = restrictToContainer(() => container);
    const state = modifier.setup?.(setupInput) ?? null;

    modifier.transform({
      ...transformInput,
      pointerPosition: { x: 120, y: 120 },
      overlayRect: createRect({ left: 110, top: 110, width: 20, height: 20 }),
      state,
    });
    modifier.transform({
      ...transformInput,
      pointerPosition: { x: 130, y: 130 },
      overlayRect: createRect({ left: 120, top: 120, width: 20, height: 20 }),
      state,
    });

    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it("createDragController applies restrictToContainer modifiers", () => {
    const container = document.createElement("div");
    const source = document.createElement("div");
    document.body.append(container, source);
    const cleanupContainerRect = stubBoundingClientRect(
      container,
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    const cleanupSourceRect = stubBoundingClientRect(
      source,
      createRect({ left: 110, top: 110, width: 20, height: 20 }),
    );
    const controller = createDragController({
      modifiers: [
        restrictToContainer(({ group }) =>
          group === "items" ? container : null,
        ),
      ],
    });

    try {
      controller.runtime.requestDragStart({
        itemId: "item-1",
        group: "items",
        element: source,
        pointerId: 1,
        pointerPosition: { x: 120, y: 120 },
      });

      expect(controller.runtime.pointerPosition).toEqual({ x: 90, y: 90 });
    } finally {
      controller.dispose();
      cleanupSourceRect();
      cleanupContainerRect();
      source.remove();
      container.remove();
    }
  });

  it("restrictToContainer reclamps when the measured overlay differs from the source", () => {
    const container = document.createElement("div");
    const source = document.createElement("div");
    document.body.append(container, source);
    const cleanupContainerRect = stubBoundingClientRect(
      container,
      createRect({ left: 0, top: 0, width: 100, height: 100 }),
    );
    const cleanupSourceRect = stubBoundingClientRect(
      source,
      createRect({ left: 80, top: 0, width: 10, height: 10 }),
    );
    const runtime = createDragRuntime({ hasDragOverlay: true });
    runtime.configure({
      targetingAlgorithm: pointerToCenter,
      targetingConstraint: undefined,
      hasDragOverlay: true,
      keepOverlayOnDrop: false,
      lifecycleCallbacks: {},
      modifiers: [restrictToContainer(() => container)],
      keyboardConfiguration: undefined,
      pointerConfiguration: undefined,
    });

    try {
      runtime.requestDragStart({
        itemId: "item-1",
        group: "items",
        element: source,
        pointerId: 1,
        pointerPosition: { x: 85, y: 5 },
      });

      expect(runtime.pointerPosition).toEqual({ x: 85, y: 5 });

      runtime.setOverlayRect(
        createRect({ left: 80, top: 0, width: 40, height: 10 }),
      );

      expect(runtime.pointerPosition).toEqual({ x: 65, y: 5 });
      expect(runtime.getCurrentDragRect()).toEqual(
        createRect({ left: 60, top: 0, width: 40, height: 10 }),
      );
    } finally {
      runtime.dispose();
      cleanupSourceRect();
      cleanupContainerRect();
      source.remove();
      container.remove();
    }
  });

  it("custom modifier setup runs once and transforms run in order", () => {
    const setup = vi.fn(() => ({ offset: 1 }));
    const first = {
      setup,
      transform: vi.fn((input) => ({
        x: input.pointerPosition.x + input.state.offset,
        y: input.pointerPosition.y,
      })),
    };
    const second = {
      transform: vi.fn((input) => ({
        x: input.pointerPosition.x * 2,
        y: input.pointerPosition.y,
      })),
    };
    const setupInput = {
      itemId: "item-1",
      group: "items",
      sourceRect: createRect({ width: 10, height: 10 }),
      initialPointerPosition: { x: 0, y: 0 },
    };

    const activeModifiers = createActiveDragModifiers({
      modifiers: [first, second],
      setupInput,
    });
    const pointerPosition = applyDragModifiers({
      activeModifiers,
      ...setupInput,
      rawPointerPosition: { x: 10, y: 0 },
    });

    expect(setup).toHaveBeenCalledTimes(1);
    expect(first.transform.mock.invocationCallOrder[0]).toBeLessThan(
      second.transform.mock.invocationCallOrder[0],
    );
    expect(pointerPosition).toEqual({ x: 22, y: 0 });
  });
});
