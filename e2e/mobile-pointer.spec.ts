import { expect, test, type Locator, type Page } from "@playwright/test";

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
  });
  await page.goto("/carrier-table");
  await expect(page.getByTestId("carrier-table")).toBeVisible();
  await waitForPresentation(page);
});

test.afterEach(async ({ page }) => {
  await page.mouse.up();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  expect(browserErrors.get(page) ?? []).toEqual([]);
});

test("keeps mobile touch ownership scoped to dedicated handles", async ({
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
    .not.toBe("none");

  const scrollResult = await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "200vh";
    document.body.append(spacer);
    const before = window.scrollY;
    window.scrollBy(0, 80);
    return { before, after: window.scrollY };
  });
  expect(scrollResult.after).toBeGreaterThan(scrollResult.before);
});

test("survives page scroll, suppresses selection, and completes the drop", async ({
  page,
}) => {
  const source = page.getByTestId("row-menu-row-1");
  const target = page.getByTestId("carrier-row-row-2");

  await activatePointerDrag(page, source);
  await expect(page.locator(":root")).toHaveAttribute(
    "data-dnd-pointer-drag-active",
    "true",
  );

  const selectionWasPrevented = await page.evaluate(() => {
    window.scrollBy(0, 1);
    window.dispatchEvent(new Event("scroll"));
    return !document.dispatchEvent(
      new Event("selectstart", { bubbles: true, cancelable: true }),
    );
  });
  expect(selectionWasPrevented).toBe(true);
  await expect(page.locator(":root")).toHaveAttribute(
    "data-dnd-pointer-drag-active",
    "true",
  );

  await moveToTarget(page, target, 0.65);
  expect(
    await page.evaluate(() => document.getSelection()?.toString() ?? ""),
  ).toBe("");
  await page.mouse.up();

  await expect(page.getByTestId("row-commit-count")).toHaveText("1");
  await expect(page.locator(":root")).not.toHaveAttribute(
    "data-dnd-pointer-drag-active",
  );
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        userSelect: document.documentElement.style.userSelect ?? "",
        webkitUserSelect: document.documentElement.style.webkitUserSelect ?? "",
      })),
    )
    .toEqual({ userSelect: "", webkitUserSelect: "" });
});

test("an intentional pointercancel cancels and restores mobile state", async ({
  page,
}) => {
  await activatePointerDrag(page, page.getByTestId("row-menu-row-1"));

  await page.evaluate(() => {
    window.dispatchEvent(
      new PointerEvent("pointercancel", {
        bubbles: true,
        isPrimary: true,
        pointerId: Number(
          document.documentElement.dataset.lastPointerId ?? "1",
        ),
        pointerType: "mouse",
      }),
    );
  });

  await expect(page.locator(":root")).not.toHaveAttribute(
    "data-dnd-pointer-drag-active",
  );
  await expect(page.getByTestId("drag-overlay")).toHaveCount(0);
  await expect(page.getByTestId("row-commit-count")).toHaveText("0");
  expect(
    await page.evaluate(() =>
      document.dispatchEvent(
        new Event("selectstart", { bubbles: true, cancelable: true }),
      ),
    ),
  ).toBe(true);
});

async function activatePointerDrag(page: Page, source: Locator): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await requiredBox(source);
  const x = sourceBox.x + sourceBox.width / 2;
  const y = sourceBox.y + sourceBox.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 8, { steps: 2 });
  await expect(page.getByTestId("drag-overlay")).toBeVisible();
}

async function moveToTarget(
  page: Page,
  target: Locator,
  ratio: number,
): Promise<void> {
  const box = await requiredBox(target);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * ratio, {
    steps: 4,
  });
  await waitForPresentation(page);
}

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function waitForPresentation(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}
