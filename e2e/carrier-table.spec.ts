import { expect, test, type Locator, type Page } from "@playwright/test";

const initialRows = ["row-1", "row-2", "row-3"];
const initialColumns = ["a", "b", "c"];
const browserErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`page: ${error.message}`);
  });
  await page.addInitScript(() => {
    window.addEventListener(
      "pointerdown",
      (event) => {
        document.documentElement.dataset.lastPointerId = String(
          event.pointerId,
        );
      },
      true,
    );
    window.addEventListener(
      "pointermove",
      (event) => {
        document.documentElement.dataset.lastPointerX = String(event.clientX);
        document.documentElement.dataset.lastPointerY = String(event.clientY);
      },
      true,
    );
  });
  await page.goto("/carrier-table");
  await expect(page.getByTestId("carrier-table")).toBeVisible();
  await waitForApplicationLayout(page);
});

test.afterEach(async ({ page }) => {
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test("publishes active pointer state for consumer cursor styling", async ({
  page,
}) => {
  await page.addStyleTag({
    content: `
      .cursorProbe { cursor: text !important; }
      :root[data-dnd-pointer-drag-active="true"],
      :root[data-dnd-pointer-drag-active="true"] *,
      :root[data-dnd-pointer-drag-active="true"] *::before,
      :root[data-dnd-pointer-drag-active="true"] *::after {
        cursor: grabbing !important;
      }
    `,
  });
  await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.className = "cursorProbe";
    probe.dataset.testid = "cursor-probe";
    Object.assign(probe.style, {
      position: "fixed",
      left: "8px",
      top: "8px",
      width: "40px",
      height: "40px",
      zIndex: "10000",
    });
    document.body.append(probe);
  });

  const handle = page.getByTestId("row-menu-row-1");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(
    (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2,
    (handleBox?.y ?? 0) + (handleBox?.height ?? 0) / 2,
  );
  await page.mouse.down();

  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.getAttribute("data-dnd-pointer-drag-active"),
      ),
    )
    .toBe("true");
  await expect
    .poll(() =>
      handle.evaluate((element) => {
        const pointerId = Number(
          document.documentElement.dataset.lastPointerId ?? "-1",
        );
        return element.hasPointerCapture(pointerId);
      }),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.style.webkitUserSelect ?? "",
      ),
    )
    .toBe("none");

  const probe = page.getByTestId("cursor-probe");
  const probeBox = await probe.boundingBox();
  expect(probeBox).not.toBeNull();
  await page.mouse.move(
    (probeBox?.x ?? 0) + (probeBox?.width ?? 0) / 2,
    (probeBox?.y ?? 0) + (probeBox?.height ?? 0) / 2,
  );
  await expect
    .poll(() => probe.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("grabbing");

  await page.mouse.up();
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.getAttribute("data-dnd-pointer-drag-active"),
      ),
    )
    .toBeNull();
  await expect
    .poll(() => probe.evaluate((element) => getComputedStyle(element).cursor))
    .toBe("text");
  await expect
    .poll(() =>
      handle.evaluate((element) => {
        const pointerId = Number(
          document.documentElement.dataset.lastPointerId ?? "-1",
        );
        return element.hasPointerCapture(pointerId);
      }),
    )
    .toBe(false);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.style.webkitUserSelect ?? "",
      ),
    )
    .toBe("");
});

test("establishes touch ownership only on dedicated drag handles", async ({
  page,
}) => {
  const handle = page.getByTestId("row-menu-row-1");
  const outsideHandle = page.getByTestId("carrier-table");

  await expect
    .poll(() =>
      handle.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          touchAction: style.touchAction,
          userSelect: style.userSelect || style.webkitUserSelect,
          webkitUserSelect: style.webkitUserSelect,
        };
      }),
    )
    .toEqual({
      touchAction: "none",
      userSelect: "none",
      webkitUserSelect: "none",
    });
  await expect
    .poll(() =>
      outsideHandle.evaluate(
        (element) => getComputedStyle(element).touchAction,
      ),
    )
    .toBe("auto");
});

test("starts with equivalent unequal carrier and reference geometry", async ({
  page,
}) => {
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expectOrderText(page, "projected-row-order", initialRows);
  await expectOrderText(page, "canonical-column-order", initialColumns);
  await expectOrderText(page, "projected-column-order", initialColumns);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  await expect(page.getByTestId("column-commit-count")).toHaveText("0");
  expect(await readTableRowOrder(page)).toEqual(initialRows);
  expect(await readHeaderOrder(page)).toEqual(initialColumns);

  for (const rowId of initialRows) {
    const carrier = page.getByTestId(`carrier-row-${rowId}`);
    const row = page.locator(`tr[data-row-id="${rowId}"]`);
    const reference = page.getByTestId(`reference-row-${rowId}`);
    await expectMatchingAxisSize(carrier, row, "vertical");
    await expectMatchingAxisSize(carrier, reference, "vertical");
    await expect(carrier.getByTestId(`row-menu-${rowId}`)).toHaveAttribute(
      "aria-label",
      new RegExp(rowId),
    );
    expect(
      await carrier.evaluate(
        (element, testId) =>
          element.contains(document.querySelector(`[data-testid="${testId}"]`)),
        `row-menu-${rowId}`,
      ),
    ).toBe(true);
  }

  for (const columnId of initialColumns) {
    const carrier = page.getByTestId(`carrier-column-${columnId}`);
    const header = page.locator(`th[data-column-id="${columnId}"]`);
    const reference = page.getByTestId(`reference-column-${columnId}`);
    await expectMatchingAxisSize(carrier, header, "horizontal");
    await expectMatchingAxisSize(carrier, reference, "horizontal");
    expect(
      await carrier.evaluate(
        (element, testId) =>
          element.contains(document.querySelector(`[data-testid="${testId}"]`)),
        `column-menu-${columnId}`,
      ),
    ).toBe(true);
  }

  const rowHeights = await getSizes(
    page,
    initialRows.map((id) => `[data-testid="carrier-row-${id}"]`),
    "height",
  );
  const columnWidths = await getSizes(
    page,
    initialColumns.map((id) => `[data-testid="carrier-column-${id}"]`),
    "width",
  );
  expect(new Set(rowHeights).size).toBe(3);
  expect(new Set(columnWidths).size).toBe(3);
});

test("projects and commits a complete row exactly once", async ({ page }) => {
  await beginDrag(
    page,
    page.getByTestId("row-menu-row-1"),
    page.getByTestId("carrier-row-row-2"),
    "vertical",
    0.65,
  );
  const projected = ["row-2", "row-1", "row-3"];
  await expectTableRows(page, projected);
  await expectGeometricOrder(page, "tr[data-row-id]", "data-row-id", [
    "row-2",
    "row-1",
    "row-3",
  ]);
  await expectRowCells(page, "row-1", ["A1", "B1", "C1"]);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  await expectOrderText(page, "projected-column-order", initialColumns);

  const liveOrder = await readTableRowOrder(page);
  const livePositions = await readElementPositions(
    page,
    "tr[data-row-id]",
    "data-row-id",
  );
  await page.mouse.up();
  await expectOrderText(page, "canonical-row-order", liveOrder);
  await expectTableRows(page, liveOrder);
  await expect(page.getByTestId("row-commit-count")).toHaveText("1");
  await expect(page.getByTestId("column-commit-count")).toHaveText("0");
  await expectPositionMapsClose(
    readElementPositions(page, "tr[data-row-id]", "data-row-id"),
    livePositions,
  );
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.getByTestId("row-commit-count")).toHaveText("1");
  await expectPositionMapsClose(
    readElementPositions(page, "tr[data-row-id]", "data-row-id"),
    livePositions,
  );
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
});

test("projects and commits a complete logical column exactly once", async ({
  page,
}) => {
  await beginDrag(
    page,
    page.getByTestId("column-menu-b"),
    page.getByTestId("carrier-column-c"),
    "horizontal",
    0.65,
  );
  const projected = ["a", "c", "b"];
  await expectTableColumns(page, projected);
  await expectGeometricOrder(
    page,
    "thead [data-column-id]",
    "data-column-id",
    projected,
  );
  await expectOrderText(page, "canonical-column-order", initialColumns);
  await expect(page.getByTestId("column-commit-count")).toHaveText("0");
  await expectOrderText(page, "projected-row-order", initialRows);

  const liveOrder = await readHeaderOrder(page);
  const livePositions = await readTableCellPositions(page);
  await page.mouse.up();
  await expectOrderText(page, "canonical-column-order", liveOrder);
  await expectTableColumns(page, liveOrder);
  await expect(page.getByTestId("column-commit-count")).toHaveText("1");
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  await expectPositionMapsClose(readTableCellPositions(page), livePositions);
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.getByTestId("column-commit-count")).toHaveText("1");
  await expectPositionMapsClose(readTableCellPositions(page), livePositions);
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
});

test("overlapping row and column lanes remain isolated by group", async ({
  page,
}) => {
  await activatePointerDrag(
    page,
    page.getByTestId("row-menu-row-1"),
    "vertical",
  );
  const columnBox = await measuredBox(page.getByTestId("carrier-column-b"));
  await page.mouse.move(centerX(columnBox), centerY(columnBox), { steps: 12 });
  await waitForPresentation(page);
  await expectOrderText(page, "canonical-column-order", initialColumns);
  await expectOrderText(page, "projected-column-order", initialColumns);
  await expect(page.getByTestId("column-commit-count")).toHaveText("0");
  expectPreviewAnchorsInGroup(await readPreviewAnchors(page), initialRows);
  await dispatchPointerCancel(page);
  await page.mouse.up();

  await reset(page);
  await activatePointerDrag(
    page,
    page.getByTestId("column-menu-b"),
    "horizontal",
  );
  const rowBox = await measuredBox(page.getByTestId("carrier-row-row-2"));
  await page.mouse.move(centerX(rowBox), centerY(rowBox), { steps: 12 });
  await waitForPresentation(page);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expectOrderText(page, "projected-row-order", initialRows);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  expectPreviewAnchorsInGroup(await readPreviewAnchors(page), initialColumns);
  await dispatchPointerCancel(page);
  await page.mouse.up();
});

test("ordinary references expose their package-owned live preview", async ({
  page,
}) => {
  const referenceSource = page.getByTestId("reference-row-row-1");
  const referenceSourceBox = await requiredBox(referenceSource);
  expect(
    await page.evaluate(
      ({ x, y }) =>
        document
          .elementFromPoint(x, y)
          ?.closest("[data-testid]")
          ?.getAttribute("data-testid"),
      { x: centerX(referenceSourceBox), y: centerY(referenceSourceBox) },
    ),
  ).toBe("reference-row-row-1");
  await beginDrag(
    page,
    referenceSource,
    page.getByTestId("reference-row-row-2"),
    "vertical",
    0.65,
  );
  await expect
    .poll(() => readReferenceOrder(page, "row"))
    .toEqual(["row-2", "row-1", "row-3"]);
  await dispatchPointerCancel(page);
  await page.mouse.up();
});

test("carrier and ordinary references match at live row and column checkpoints", async ({
  page,
}) => {
  for (const ratio of [0.2, 0.5, 0.95]) {
    const rowTargetId = ratio === 0.95 ? "row-3" : "row-2";
    const carrierRows = await previewThenCancel(
      page,
      "row-menu-row-1",
      `carrier-row-${rowTargetId}`,
      "vertical",
      ratio,
      () => readTableRowOrder(page),
      0.2,
    );
    await reset(page);
    const referenceRows = await previewThenCancel(
      page,
      "reference-row-row-1",
      `reference-row-${rowTargetId}`,
      "vertical",
      ratio,
      () => readReferenceOrder(page, "row"),
      0.2,
    );
    expect(carrierRows, `row checkpoint ratio ${ratio}`).toEqual(referenceRows);
    await reset(page);

    const carrierColumns = await previewThenCancel(
      page,
      "column-menu-b",
      "carrier-column-c",
      "horizontal",
      ratio,
      () => readHeaderOrder(page),
      0.2,
    );
    await reset(page);
    const referenceColumns = await previewThenCancel(
      page,
      "reference-column-b",
      "reference-column-c",
      "horizontal",
      ratio,
      () => readReferenceOrder(page, "column"),
      0.2,
    );
    expect(carrierColumns, `column checkpoint ratio ${ratio}`).toEqual(
      referenceColumns,
    );
    await reset(page);
  }

  const backwardCarrier = await previewThenCancel(
    page,
    "row-menu-row-3",
    "carrier-row-row-2",
    "vertical",
    0.35,
    () => readTableRowOrder(page),
    0.8,
  );
  await reset(page);
  const backwardReference = await previewThenCancel(
    page,
    "reference-row-row-3",
    "reference-row-row-2",
    "vertical",
    0.35,
    () => readReferenceOrder(page, "row"),
    0.8,
  );
  expect(backwardCarrier).toEqual(backwardReference);
});

test("reversal hysteresis and repeated positions have carrier/reference parity", async ({
  page,
}) => {
  const carrierRows = await collectReversalOrders(
    page,
    "row-menu-row-1",
    "carrier-row-row-3",
    "vertical",
    () => readTableRowOrder(page),
  );
  await reset(page);
  const referenceRows = await collectReversalOrders(
    page,
    "reference-row-row-1",
    "reference-row-row-3",
    "vertical",
    () => readReferenceOrder(page, "row"),
  );
  expect(carrierRows).toEqual(referenceRows);
  expect(carrierRows[1]).toEqual(carrierRows[2]);
  expect(carrierRows[3]).not.toEqual(carrierRows[2]);

  await reset(page);
  const carrierColumns = await collectReversalOrders(
    page,
    "column-menu-b",
    "carrier-column-c",
    "horizontal",
    () => readHeaderOrder(page),
  );
  await reset(page);
  const referenceColumns = await collectReversalOrders(
    page,
    "reference-column-b",
    "reference-column-c",
    "horizontal",
    () => readReferenceOrder(page, "column"),
  );
  expect(carrierColumns).toEqual(referenceColumns);
  expect(carrierColumns[1]).toEqual(carrierColumns[2]);
  expect(carrierColumns[3]).not.toEqual(carrierColumns[2]);
});

test("continuous row and column trajectories retain native-sortable parity", async ({
  page,
}) => {
  const carrierRows = await collectContinuousTrajectory(page, {
    axis: "vertical",
    kind: "row",
    sourceTestId: "row-menu-row-1",
    targetTestId: "carrier-row-row-2",
    carrier: true,
  });
  await reset(page);
  const referenceRows = await collectContinuousTrajectory(page, {
    axis: "vertical",
    kind: "row",
    sourceTestId: "reference-row-row-1",
    targetTestId: "reference-row-row-2",
    carrier: false,
  });
  expect(carrierRows.orders).toEqual(referenceRows.orders);
  expect(carrierRows.repeated).toEqual(carrierRows.forward);
  expect(carrierRows.smallReverse).toEqual(carrierRows.forward);
  expect(carrierRows.outside).toEqual(carrierRows.smallReverse);
  expect(carrierRows.reentered).toEqual(carrierRows.forward);
  expect(carrierRows.returnedSource).toEqual(initialRows);
  expect(carrierRows.forwardAgain).not.toEqual(initialRows);

  await reset(page);
  const carrierColumns = await collectContinuousTrajectory(page, {
    axis: "horizontal",
    kind: "column",
    sourceTestId: "column-menu-b",
    targetTestId: "carrier-column-c",
    carrier: true,
  });
  await reset(page);
  const referenceColumns = await collectContinuousTrajectory(page, {
    axis: "horizontal",
    kind: "column",
    sourceTestId: "reference-column-b",
    targetTestId: "reference-column-c",
    carrier: false,
  });
  expect(carrierColumns.orders).toEqual(referenceColumns.orders);
  expect(carrierColumns.repeated).toEqual(carrierColumns.forward);
  expect(carrierColumns.smallReverse).toEqual(carrierColumns.forward);
  expect(carrierColumns.outside).toEqual(carrierColumns.smallReverse);
  expect(carrierColumns.reentered).toEqual(carrierColumns.forward);
  expect(carrierColumns.returnedSource).toEqual(initialColumns);
  expect(carrierColumns.forwardAgain).not.toEqual(initialColumns);
});

test("retains projection outside targets and restores on pointer cancellation", async ({
  page,
}) => {
  await beginDrag(
    page,
    page.getByTestId("row-menu-row-1"),
    page.getByTestId("carrier-row-row-2"),
    "vertical",
    0.65,
  );
  await expectTableRows(page, ["row-2", "row-1", "row-3"]);
  const activeOverlayBox = await requiredBox(page.getByTestId("drag-overlay"));
  await page.mouse.move(900, centerY(activeOverlayBox), { steps: 8 });
  await expectTableRows(page, ["row-2", "row-1", "row-3"]);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await dispatchPointerCancel(page);
  await page.mouse.up();
  await expectTableRows(page, initialRows);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
  await expect(page.locator("[data-dnd-dragged]")).toHaveCount(0);

  await page.getByTestId("row-menu-row-1").click();
  await expect(page.getByTestId("active-menu")).toContainText("row-1");

  await reset(page);
  await beginDrag(
    page,
    page.getByTestId("reference-row-row-1"),
    page.getByTestId("reference-row-row-2"),
    "vertical",
    0.65,
  );
  await expect
    .poll(() => readReferenceOrder(page, "row"))
    .toEqual(["row-2", "row-1", "row-3"]);
  const referenceOverlayBox = await requiredBox(
    page.getByTestId("drag-overlay"),
  );
  await page.mouse.move(900, centerY(referenceOverlayBox), { steps: 8 });
  await expect
    .poll(() => readReferenceOrder(page, "row"))
    .toEqual(["row-2", "row-1", "row-3"]);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await dispatchPointerCancel(page);
  await page.mouse.up();
  await expect.poll(() => readReferenceOrder(page, "row")).toEqual(initialRows);
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
  await expect(page.locator("[data-dnd-dragged]")).toHaveCount(0);
});

test("no-op and disconnected-target releases do not commit", async ({
  page,
}) => {
  const source = page.getByTestId("row-menu-row-1");
  const sourceBox = await requiredBox(source);
  await page.mouse.move(centerX(sourceBox), centerY(sourceBox));
  await page.mouse.down();
  await page.waitForTimeout(220);
  await expect(page.getByTestId("drag-overlay")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  await expectOrderText(page, "canonical-row-order", initialRows);

  await beginDrag(
    page,
    page.getByTestId("row-menu-row-1"),
    page.getByTestId("carrier-row-row-2"),
    "vertical",
    0.65,
  );
  await expectTableRows(page, ["row-2", "row-1", "row-3"]);
  await moveToTargetRatio(
    page,
    page.getByTestId("carrier-row-row-2"),
    "vertical",
    0.65,
  );
  await expect(page.getByTestId("active-drop-target-id")).toHaveText("row-2");
  await page.getByTestId("disconnect-active-target").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect(page.getByTestId("live-target-id")).toHaveText("disconnected");
  await page.mouse.up();
  await expect(page.getByTestId("last-result")).toHaveText("invalid-target");
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expectTableRows(page, initialRows);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
});

test("recomputes surviving normalized anchors after target disconnection", async ({
  page,
}) => {
  await beginDrag(
    page,
    page.getByTestId("row-menu-row-1"),
    page.getByTestId("carrier-row-row-2"),
    "vertical",
    0.65,
  );
  await expectTableRows(page, ["row-2", "row-1", "row-3"]);
  await page.getByTestId("disconnect-normalized-target").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await page.getByTestId("synchronize-geometry").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });

  await expect
    .poll(async () => JSON.stringify(await readPreviewAnchors(page)))
    .not.toContain("row-2");
  const anchors = await readPreviewAnchors(page);
  expect(anchors.status).toBe("projected");
  expect(anchors.targetDraggableId).not.toBe("row-2");
  expect(anchors.previousDraggableId).not.toBe("row-2");
  expect(anchors.nextDraggableId).not.toBe("row-2");
  await expectTableRows(page, ["row-2", "row-3", "row-1"]);
  await expectGeometricOrder(page, "tr[data-row-id]", "data-row-id", [
    "row-2",
    "row-3",
    "row-1",
  ]);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");

  await dispatchPointerCancel(page);
  await page.mouse.up();
  await expect(page.getByTestId("last-result")).toHaveText("canceled");
  await expectTableRows(page, initialRows);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
});

test("remeasure and recompute change placement without pointer movement", async ({
  page,
}) => {
  const carrierOrder = await recomputeAfterGeometryChange(page, {
    axis: "vertical",
    kind: "row",
    sourceTestId: "row-menu-row-1",
    targetTestId: "carrier-row-row-2",
    carrier: true,
  });
  await reset(page);
  const referenceOrder = await recomputeAfterGeometryChange(page, {
    axis: "vertical",
    kind: "row",
    sourceTestId: "reference-row-row-1",
    targetTestId: "reference-row-row-2",
    carrier: false,
  });
  expect(carrierOrder).toEqual(referenceOrder);
});

test("row and column edge autoscroll retain carrier/reference parity", async ({
  page,
}) => {
  for (const input of [
    {
      axis: "vertical" as const,
      kind: "row" as const,
      carrierSource: "row-menu-row-1",
      carrierTarget: "carrier-row-row-3",
      referenceSource: "reference-row-row-1",
      referenceTarget: "reference-row-row-3",
    },
    {
      axis: "horizontal" as const,
      kind: "column" as const,
      carrierSource: "column-menu-b",
      carrierTarget: "carrier-column-c",
      referenceSource: "reference-column-b",
      referenceTarget: "reference-column-c",
    },
  ]) {
    const carrierOrder = await collectAutoscrollOrder(page, {
      axis: input.axis,
      kind: input.kind,
      sourceTestId: input.carrierSource,
      targetTestId: input.carrierTarget,
      carrier: true,
    });
    await reset(page);
    const referenceOrder = await collectAutoscrollOrder(page, {
      axis: input.axis,
      kind: input.kind,
      sourceTestId: input.referenceSource,
      targetTestId: input.referenceTarget,
      carrier: false,
    });
    expect(carrierOrder).toEqual(referenceOrder);
    await reset(page);
  }
});

test("menu buttons preserve clicks and keyboard activation around dragging", async ({
  page,
}) => {
  const rowButton = page.getByTestId("row-menu-row-1");
  await rowButton.click();
  await expect(page.getByTestId("active-menu")).toContainText("row-1");
  await rowButton.click();
  await expect(page.getByTestId("active-menu")).not.toBeVisible();

  const box = await requiredBox(rowButton);
  await page.mouse.move(centerX(box), centerY(box));
  await page.mouse.down();
  await page.waitForTimeout(220);
  await expect(page.getByTestId("drag-overlay")).toBeVisible();
  await page.mouse.up();
  await expect(page.getByTestId("active-menu")).not.toBeVisible();
  await rowButton.click();
  await expect(page.getByTestId("active-menu")).toContainText("row-1");

  await rowButton.press("Space");
  await expect(page.getByTestId("active-menu")).not.toBeVisible();
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
  await rowButton.press("Enter");
  await expect(page.getByTestId("active-menu")).toContainText("row-1");
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);

  const columnButton = page.getByTestId("column-menu-b");
  await columnButton.click();
  await expect(page.getByTestId("active-menu")).toContainText("column menu: b");
  await columnButton.press("Space");
  await expect(page.getByTestId("active-menu")).not.toBeVisible();
  await columnButton.press("Enter");
  await expect(page.getByTestId("active-menu")).toContainText("column menu: b");
});

test("group-specific blank overlays match every carrier and reference source", async ({
  page,
}) => {
  const cases = [
    {
      source: "row-menu-row-2",
      target: "carrier-row-row-2",
      sourceRect: "carrier-row-row-2",
      group: "carrier-table-rows",
      axis: "row",
      variant: "table-row",
      movementAxis: "vertical" as const,
    },
    {
      source: "column-menu-b",
      target: "carrier-column-b",
      sourceRect: "carrier-column-b",
      group: "carrier-table-columns",
      axis: "column",
      variant: "table-column",
      movementAxis: "horizontal" as const,
    },
    {
      source: "reference-row-row-2",
      target: "reference-row-row-2",
      sourceRect: "reference-row-row-2",
      group: "reference-rows",
      axis: "row",
      variant: "reference-row",
      movementAxis: "vertical" as const,
    },
    {
      source: "reference-column-b",
      target: "reference-column-b",
      sourceRect: "reference-column-b",
      group: "reference-columns",
      axis: "column",
      variant: "reference-column",
      movementAxis: "horizontal" as const,
    },
  ];

  for (const overlayCase of cases) {
    const sourceRect = page.getByTestId(overlayCase.sourceRect);
    await beginDrag(
      page,
      page.getByTestId(overlayCase.source),
      page.getByTestId(overlayCase.target),
      overlayCase.movementAxis,
      0.5,
    );
    const sourceBox = await requiredBox(sourceRect);
    const overlay = page.getByTestId("drag-overlay");
    const overlayBox = await requiredBox(overlay);
    expectClose(overlayBox.width, sourceBox.width);
    expectClose(overlayBox.height, sourceBox.height);
    await expect(overlay).toHaveAttribute(
      "data-overlay-group",
      overlayCase.group,
    );
    await expect(overlay).toHaveAttribute(
      "data-overlay-axis",
      overlayCase.axis,
    );
    await expect(overlay).toHaveAttribute(
      "data-overlay-variant",
      overlayCase.variant,
    );
    await expect(overlay).toHaveClass(
      new RegExp(`carrierBlankOverlay--${overlayCase.variant}`),
    );
    expect(
      await overlay.evaluate(
        (element) => getComputedStyle(element).pointerEvents,
      ),
    ).toBe("none");
    await dispatchPointerCancel(page);
    await page.mouse.up();
    await expect(overlay).toHaveCount(0);
    await reset(page);
  }
});

type SortableAxis = "vertical" | "horizontal";
type SortableKind = "row" | "column";

type TrajectoryInput = {
  axis: SortableAxis;
  kind: SortableKind;
  sourceTestId: string;
  targetTestId: string;
  carrier: boolean;
};

type TrajectoryResult = {
  orders: string[][];
  forward: string[];
  repeated: string[];
  smallReverse: string[];
  outside: string[];
  reentered: string[];
  returnedSource: string[];
  forwardAgain: string[];
};

type PreviewAnchors = {
  status: "inactive" | "source" | "projected";
  containerId?: string | null;
  previousDraggableId?: string | null;
  nextDraggableId?: string | null;
  targetDraggableId?: string | null;
  side?: "before" | "after" | null;
};

async function collectContinuousTrajectory(
  page: Page,
  input: TrajectoryInput,
): Promise<TrajectoryResult> {
  const target = page.getByTestId(input.targetTestId);
  await beginDrag(
    page,
    page.getByTestId(input.sourceTestId),
    target,
    input.axis,
    0.2,
  );

  const orders: string[][] = [];
  const capture = async (): Promise<string[]> => {
    const order = await readStableOrder(page, () =>
      readVisibleOrder(page, input.kind, input.carrier),
    );
    await assertActivePresentation(page, input, order);
    orders.push(order);
    return order;
  };

  await capture();
  await moveToTargetRatio(page, target, input.axis, 0.5);
  await capture();
  await moveToTargetRatio(page, target, input.axis, 0.8);
  const forward = await capture();
  await moveToTargetRatio(page, target, input.axis, 0.8);
  const repeated = await capture();
  await moveToTargetRatio(page, target, input.axis, 0.76);
  const smallReverse = await capture();

  const lastPointer = await page.evaluate(() => ({
    x: Number(document.documentElement.dataset.lastPointerX),
    y: Number(document.documentElement.dataset.lastPointerY),
  }));
  await page.mouse.move(
    input.axis === "vertical" ? 1000 : lastPointer.x,
    input.axis === "horizontal" ? 5 : lastPointer.y,
    { steps: 10 },
  );
  const outside = await capture();
  await moveToTargetRatio(page, target, input.axis, 0.8);
  const reentered = await capture();
  const draggedItem = page.getByTestId(
    input.kind === "row"
      ? input.carrier
        ? "carrier-row-row-1"
        : "reference-row-row-1"
      : input.carrier
        ? "carrier-column-b"
        : "reference-column-b",
  );
  await moveToTargetRatio(page, draggedItem, input.axis, 0.5, 6);
  await capture();
  await moveToTargetRatio(page, target, input.axis, 0.5, 12);
  const returnedSource = await capture();
  await moveToTargetRatio(page, target, input.axis, 0.8);
  const forwardAgain = await capture();

  await dispatchPointerCancel(page);
  await page.mouse.up();
  await expectRestoredPresentation(page, input);

  return {
    orders,
    forward,
    repeated,
    smallReverse,
    outside,
    reentered,
    returnedSource,
    forwardAgain,
  };
}

async function recomputeAfterGeometryChange(
  page: Page,
  input: TrajectoryInput,
): Promise<string[]> {
  const target = page.getByTestId(input.targetTestId);
  await beginDrag(
    page,
    page.getByTestId(input.sourceTestId),
    target,
    input.axis,
    0.65,
  );
  const before = await readStableOrder(page, () =>
    readVisibleOrder(page, input.kind, input.carrier),
  );
  const syncsBefore = await readNumber(page, "geometry-sync-count");
  const chosen = page.getByTestId(
    input.carrier ? "carrier-row-row-3" : "reference-row-row-3",
  );
  const other = page.getByTestId(
    input.carrier ? "carrier-row-row-2" : "reference-row-row-2",
  );
  const overlayBox = await requiredBox(page.getByTestId("drag-overlay"));
  const chosenBox = await requiredBox(chosen);
  const chosenStyle = await chosen.getAttribute("style");
  const otherStyle = await other.getAttribute("style");
  await chosen.evaluate(
    (element, rect) => {
      const targetElement = element as HTMLElement;
      targetElement.style.position = "fixed";
      targetElement.style.left = `${rect.left}px`;
      targetElement.style.top = `${rect.top}px`;
      targetElement.style.width = `${rect.width}px`;
      targetElement.style.height = `${rect.height}px`;
    },
    {
      left: chosenBox.x,
      top: overlayBox.y + overlayBox.height / 2 - chosenBox.height * 0.9,
      width: chosenBox.width,
      height: chosenBox.height,
    },
  );
  await other.evaluate((element) => {
    const targetElement = element as HTMLElement;
    targetElement.style.position = "fixed";
    targetElement.style.top = "1000px";
  });

  await page.getByTestId("synchronize-geometry").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect
    .poll(() => readVisibleOrder(page, input.kind, input.carrier))
    .toEqual(["row-2", "row-3", "row-1"]);
  await expect
    .poll(() => readNumber(page, "geometry-sync-count"))
    .toBeGreaterThan(syncsBefore);
  await chosen.evaluate(
    (element, style) =>
      style === null
        ? element.removeAttribute("style")
        : element.setAttribute("style", style),
    chosenStyle,
  );
  await other.evaluate(
    (element, style) =>
      style === null
        ? element.removeAttribute("style")
        : element.setAttribute("style", style),
    otherStyle,
  );
  const after = await readStableOrder(page, () =>
    readVisibleOrder(page, input.kind, input.carrier),
  );
  await assertActivePresentation(page, input, after);

  await dispatchPointerCancel(page);
  await page.mouse.up();
  await expectRestoredPresentation(page, input);
  return after;
}

async function collectAutoscrollOrder(
  page: Page,
  input: TrajectoryInput,
): Promise<string[]> {
  await beginDrag(
    page,
    page.getByTestId(input.sourceTestId),
    page.getByTestId(input.targetTestId),
    input.axis,
    0.8,
  );
  const group = input.carrier
    ? input.kind === "row"
      ? "carrier-table-rows"
      : "carrier-table-columns"
    : input.kind === "row"
      ? "reference-rows"
      : "reference-columns";
  const viewport = input.carrier
    ? page.getByTestId("carrier-scroll-region")
    : page.locator(`[data-reference-viewport="${group}"]`);
  const viewportBox = await requiredBox(viewport);
  const syncsBefore = await readNumber(page, "geometry-sync-count");
  const scrollBefore = await viewport.evaluate(
    (element, axis) =>
      axis === "vertical" ? element.scrollTop : element.scrollLeft,
    input.axis,
  );

  await page.mouse.move(
    input.axis === "horizontal"
      ? viewportBox.x + viewportBox.width - 3
      : centerX(viewportBox),
    input.axis === "vertical"
      ? viewportBox.y + viewportBox.height - 3
      : centerY(viewportBox),
  );
  await expect
    .poll(() =>
      viewport.evaluate(
        (element, axis) =>
          axis === "vertical" ? element.scrollTop : element.scrollLeft,
        input.axis,
      ),
    )
    .toBeGreaterThan(scrollBefore + 20);
  await expect
    .poll(() => readNumber(page, "geometry-sync-count"))
    .toBeGreaterThan(syncsBefore);

  await page.mouse.move(centerX(viewportBox), centerY(viewportBox));
  const normalizedSyncsBefore = await readNumber(page, "geometry-sync-count");
  await viewport.evaluate((element, axis) => {
    if (axis === "vertical") element.scrollTop = 24;
    else element.scrollLeft = 24;
    element.dispatchEvent(new Event("scroll"));
  }, input.axis);
  await expect
    .poll(() => readNumber(page, "geometry-sync-count"))
    .toBeGreaterThan(normalizedSyncsBefore);

  const sourcePlacementTargetTestId =
    input.kind === "row"
      ? input.carrier
        ? "carrier-row-row-2"
        : "reference-row-row-2"
      : input.carrier
        ? "carrier-column-c"
        : "reference-column-c";
  await moveToTargetRatio(
    page,
    page.getByTestId(sourcePlacementTargetTestId),
    input.axis,
    0.35,
  );
  await expect
    .poll(() => readVisibleOrder(page, input.kind, input.carrier))
    .toEqual(input.kind === "row" ? initialRows : initialColumns);
  await moveToTargetRatio(
    page,
    page.getByTestId(input.targetTestId),
    input.axis,
    0.95,
  );
  const finalSyncsBefore = await readNumber(page, "geometry-sync-count");
  await page.getByTestId("synchronize-geometry").evaluate((button) => {
    (button as HTMLButtonElement).click();
  });
  await expect
    .poll(() => readNumber(page, "geometry-sync-count"))
    .toBeGreaterThan(finalSyncsBefore);
  const order = await readStableOrder(page, () =>
    readVisibleOrder(page, input.kind, input.carrier),
  );
  await assertActivePresentation(page, input, order);
  await dispatchPointerCancel(page);
  await page.mouse.up();
  await expectRestoredPresentation(page, input);
  return order;
}

async function assertActivePresentation(
  page: Page,
  input: TrajectoryInput,
  order: string[],
): Promise<void> {
  const canonical = input.kind === "row" ? initialRows : initialColumns;
  const commitTestId =
    input.kind === "row" ? "row-commit-count" : "column-commit-count";
  await expectOrderText(
    page,
    input.kind === "row" ? "canonical-row-order" : "canonical-column-order",
    canonical,
  );
  await expect(page.getByTestId(commitTestId)).toHaveText("0");

  if (input.carrier) {
    await expectOrderText(
      page,
      input.kind === "row" ? "projected-row-order" : "projected-column-order",
      order,
    );
    if (input.kind === "row") {
      await expectTableRows(page, order);
      await expectGeometricOrder(page, "tr[data-row-id]", "data-row-id", order);
    } else {
      await expectTableColumns(page, order);
    }
    return;
  }

  await expectGeometricOrder(
    page,
    input.kind === "row"
      ? "[data-reference-row-id]"
      : "[data-reference-column-id]",
    input.kind === "row" ? "data-reference-row-id" : "data-reference-column-id",
    order,
  );
}

async function expectRestoredPresentation(
  page: Page,
  input: TrajectoryInput,
): Promise<void> {
  const expected = input.kind === "row" ? initialRows : initialColumns;
  await expect
    .poll(() => readVisibleOrder(page, input.kind, input.carrier))
    .toEqual(expected);
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
  await expect(page.locator("[data-dnd-dragged]")).toHaveCount(0);
}

async function readVisibleOrder(
  page: Page,
  kind: SortableKind,
  carrier: boolean,
): Promise<string[]> {
  if (carrier) {
    return kind === "row" ? readTableRowOrder(page) : readHeaderOrder(page);
  }
  return readReferenceOrder(page, kind);
}

async function moveToTargetRatio(
  page: Page,
  target: Locator,
  axis: SortableAxis,
  ratio: number,
  steps = 1,
): Promise<void> {
  const box = await measuredBox(target);
  await page.mouse.move(
    axis === "horizontal" ? box.x + box.width * ratio : box.x + box.width / 2,
    axis === "vertical" ? box.y + box.height * ratio : box.y + box.height / 2,
    { steps },
  );
}

async function activatePointerDrag(
  page: Page,
  source: Locator,
  axis: SortableAxis,
): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  const box = await measuredBox(await pointerSource(source));
  const x = centerX(box);
  const y = centerY(box);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(
    x + (axis === "horizontal" ? 8 : 0),
    y + (axis === "vertical" ? 8 : 0),
    {
      steps: 2,
    },
  );
  await expect(page.getByTestId("drag-overlay")).toBeVisible();
}

async function readPreviewAnchors(page: Page): Promise<PreviewAnchors> {
  return JSON.parse(
    (await page.getByTestId("live-preview-anchors").textContent()) ?? "{}",
  ) as PreviewAnchors;
}

function expectPreviewAnchorsInGroup(
  anchors: PreviewAnchors,
  validIds: readonly string[],
): void {
  for (const id of [
    anchors.previousDraggableId,
    anchors.nextDraggableId,
    anchors.targetDraggableId,
  ]) {
    if (id !== undefined && id !== null) {
      expect(validIds).toContain(id);
    }
  }
}

async function readNumber(page: Page, testId: string): Promise<number> {
  return Number(await page.getByTestId(testId).textContent());
}

async function beginDrag(
  page: Page,
  source: Locator,
  target: Locator,
  axis: "vertical" | "horizontal",
  targetRatio: number,
): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await measuredBox(await pointerSource(source));
  const sourcePoint = { x: centerX(sourceBox), y: centerY(sourceBox) };

  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(
    sourcePoint.x + (axis === "horizontal" ? 8 : 0),
    sourcePoint.y + (axis === "vertical" ? 8 : 0),
    { steps: 2 },
  );
  await expect(page.getByTestId("drag-overlay")).toBeVisible();
  await waitForPresentation(page);
  await moveToTargetRatio(page, target, axis, targetRatio);
}

async function pointerSource(source: Locator): Promise<Locator> {
  const handle = source.locator("[data-dnd-drag-handle]").first();
  return (await handle.count()) === 1 ? handle : source;
}

async function previewThenCancel(
  page: Page,
  sourceTestId: string,
  targetTestId: string,
  axis: "vertical" | "horizontal",
  ratio: number,
  readOrder: () => Promise<string[]>,
  entryRatio = ratio,
): Promise<string[]> {
  await beginDrag(
    page,
    page.getByTestId(sourceTestId),
    page.getByTestId(targetTestId),
    axis,
    entryRatio,
  );
  if (entryRatio !== ratio) {
    await readStableOrder(page, readOrder);
    await moveToTargetRatio(page, page.getByTestId(targetTestId), axis, ratio);
  }
  const order = await readStableOrder(page, readOrder);
  await dispatchPointerCancel(page);
  await page.mouse.up();
  return order;
}

async function collectReversalOrders(
  page: Page,
  sourceTestId: string,
  targetTestId: string,
  axis: "vertical" | "horizontal",
  readOrder: () => Promise<string[]>,
): Promise<string[][]> {
  const target = page.getByTestId(targetTestId);
  await beginDrag(page, page.getByTestId(sourceTestId), target, axis, 0.8);
  await waitForPresentation(page);
  const orders = [await readOrder()];
  const pointer = await page.evaluate(() => ({
    x: Number(document.documentElement.dataset.lastPointerX),
    y: Number(document.documentElement.dataset.lastPointerY),
  }));
  await page.mouse.move(pointer.x, pointer.y);
  await waitForPresentation(page);
  orders.push(await readOrder());
  await page.mouse.move(
    pointer.x - (axis === "horizontal" ? 2 : 0),
    pointer.y - (axis === "vertical" ? 2 : 0),
  );
  await waitForPresentation(page);
  orders.push(await readOrder());
  await moveToTargetRatio(page, target, axis, 0.2);
  await waitForPresentation(page);
  orders.push(await readOrder());
  await dispatchPointerCancel(page);
  await page.mouse.up();
  return orders;
}

async function dispatchPointerCancel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const pointerId = Number(
      document.documentElement.dataset.lastPointerId ?? "1",
    );
    window.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
      }),
    );
  });
}

async function reset(page: Page): Promise<void> {
  await page.goto("/carrier-table");
  await expect(page.getByTestId("carrier-table")).toBeVisible();
  await waitForApplicationLayout(page);
  await expectOrderText(page, "canonical-row-order", initialRows);
  await expectOrderText(page, "canonical-column-order", initialColumns);
}

async function waitForApplicationLayout(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

async function readTableRowOrder(page: Page): Promise<string[]> {
  return page
    .locator("tbody tr[data-row-id]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-row-id") ?? ""),
    );
}

async function readHeaderOrder(page: Page): Promise<string[]> {
  return page
    .locator("thead [data-column-id]")
    .evaluateAll((cells) =>
      cells.map((cell) => cell.getAttribute("data-column-id") ?? ""),
    );
}

async function readReferenceOrder(
  page: Page,
  axis: "row" | "column",
): Promise<string[]> {
  const attribute = `data-reference-${axis}-id`;
  return page
    .locator(`[${attribute}]`)
    .evaluateAll(
      (elements, attributeName) =>
        elements.map((element) => element.getAttribute(attributeName) ?? ""),
      attribute,
    );
}

async function expectTableRows(page: Page, expected: string[]): Promise<void> {
  await expect.poll(() => readTableRowOrder(page)).toEqual(expected);
}

async function expectTableColumns(
  page: Page,
  expected: string[],
): Promise<void> {
  await expect.poll(() => readHeaderOrder(page)).toEqual(expected);

  for (const rowId of initialRows) {
    await expect
      .poll(() =>
        page
          .locator(`tr[data-row-id="${rowId}"] [data-column-id]`)
          .evaluateAll((cells) =>
            cells.map((cell) => cell.getAttribute("data-column-id") ?? ""),
          ),
      )
      .toEqual(expected);
    await expectGeometricOrder(
      page,
      `tr[data-row-id="${rowId}"] [data-column-id]`,
      "data-column-id",
      expected,
    );
  }
}

type ElementPosition = { x: number; y: number };
type ElementPositions = Record<string, ElementPosition>;

async function readElementPositions(
  page: Page,
  selector: string,
  attribute: string,
): Promise<ElementPositions> {
  return page.locator(selector).evaluateAll(
    (elements, attributeName) =>
      Object.fromEntries(
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return [
            element.getAttribute(attributeName) ?? "",
            { x: rect.x, y: rect.y },
          ];
        }),
      ),
    attribute,
  );
}

async function readTableCellPositions(page: Page): Promise<ElementPositions> {
  return page.locator("[data-column-id]").evaluateAll((elements) =>
    Object.fromEntries(
      elements.map((element) => {
        const row = element
          .closest("tr[data-row-id]")
          ?.getAttribute("data-row-id");
        const column = element.getAttribute("data-column-id") ?? "";
        const rect = element.getBoundingClientRect();
        return [`${row ?? "header"}:${column}`, { x: rect.x, y: rect.y }];
      }),
    ),
  );
}

async function expectPositionMapsClose(
  actualPromise: Promise<ElementPositions>,
  expected: ElementPositions,
): Promise<void> {
  const actual = await actualPromise;
  expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());

  for (const [id, expectedPosition] of Object.entries(expected)) {
    const actualPosition = actual[id];
    expect(actualPosition, `missing position for ${id}`).toBeDefined();
    if (!actualPosition) continue;
    expectClose(actualPosition.x, expectedPosition.x);
    expectClose(actualPosition.y, expectedPosition.y);
  }
}

async function expectOrderText(
  page: Page,
  testId: string,
  expected: readonly string[],
): Promise<void> {
  await expect(page.getByTestId(testId)).toHaveText(expected.join(","));
}

async function expectRowCells(
  page: Page,
  rowId: string,
  expected: string[],
): Promise<void> {
  await expect(page.locator(`tr[data-row-id="${rowId}"] td`)).toHaveText(
    expected,
  );
}

async function expectGeometricOrder(
  page: Page,
  selector: string,
  attribute: string,
  expected: string[],
): Promise<void> {
  const geometricOrder = await page.locator(selector).evaluateAll(
    (elements, attributeName) =>
      elements
        .map((element) => ({
          id: element.getAttribute(attributeName) ?? "",
          rect: element.getBoundingClientRect(),
        }))
        .sort((first, second) => {
          const verticalDelta = first.rect.top - second.rect.top;
          return Math.abs(verticalDelta) > 1
            ? verticalDelta
            : first.rect.left - second.rect.left;
        })
        .map(({ id }) => id),
    attribute,
  );
  expect(geometricOrder).toEqual(expected);
}

async function expectMatchingAxisSize(
  first: Locator,
  second: Locator,
  axis: "vertical" | "horizontal",
): Promise<void> {
  const firstBox = await requiredBox(first);
  const secondBox = await requiredBox(second);
  expectClose(
    axis === "vertical" ? firstBox.height : firstBox.width,
    axis === "vertical" ? secondBox.height : secondBox.width,
  );
}

async function getSizes(
  page: Page,
  selectors: string[],
  dimension: "width" | "height",
): Promise<number[]> {
  const sizes: number[] = [];
  for (const selector of selectors) {
    const box = await requiredBox(page.locator(selector));
    sizes.push(Math.round(box[dimension]));
  }
  return sizes;
}

async function requiredBox(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  return measuredBox(locator);
}

async function measuredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error("Expected a measurable element");
  return box;
}

function centerX(box: { x: number; width: number }): number {
  return box.x + box.width / 2;
}

function centerY(box: { y: number; height: number }): number {
  return box.y + box.height / 2;
}

function expectClose(actual: number, expected: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

async function waitForPresentation(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function readStableOrder(
  page: Page,
  readOrder: () => Promise<string[]>,
): Promise<string[]> {
  let previous: string[] | null = null;
  let equalSamples = 0;

  for (let sample = 0; sample < 12; sample += 1) {
    await waitForPresentation(page);
    const current = await readOrder();

    if (
      previous !== null &&
      current.length === previous.length &&
      current.every((id, index) => id === previous?.[index])
    ) {
      equalSamples += 1;
      if (equalSamples === 2) return current;
    } else {
      equalSamples = 0;
    }

    previous = current;
  }

  throw new Error("sortable presentation did not stabilize");
}
