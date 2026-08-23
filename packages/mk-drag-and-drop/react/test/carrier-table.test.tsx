import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CarrierTable } from "../../../../apps/react-web/src/react/carrierTable.js";
import {
  createRect,
  dispatchPointerCancel,
  dispatchPointerDown,
  dispatchPointerMove,
  dispatchPointerUp,
  installMockRaf,
  stubBoundingClientRect,
} from "./test-utils.js";

describe("React carrier table integration", () => {
  it("keeps carrier registrations mounted through StrictMode state rerenders", () => {
    render(
      <StrictMode>
        <CarrierTable />
      </StrictMode>,
    );
    const carrierBefore = screen.getByTestId("carrier-row-row-1");

    expect(screen.getAllByTestId(/^carrier-row-row-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^carrier-column-[abc]$/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^reference-row-row-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^reference-column-[abc]$/)).toHaveLength(3);

    fireEvent.click(screen.getByTestId("row-menu-row-1"));
    expect(screen.getByTestId("active-menu")).toHaveTextContent("row-1");
    expect(screen.getByTestId("carrier-row-row-1")).toBe(carrierBefore);

    fireEvent.click(screen.getByTestId("row-menu-row-1"));
    expect(screen.queryByTestId("active-menu")).not.toBeInTheDocument();
    expect(screen.getByTestId("carrier-row-row-1")).toBe(carrierBefore);
  });

  it("cancels pending synchronization frames when unmounted during a drag", () => {
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockReturnValue(41);
    const cancelAnimationFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});
    const { unmount } = render(<CarrierTable />);
    const carrier = screen.getByTestId("carrier-row-row-1");
    const button = screen.getByTestId("row-menu-row-1");
    stubBoundingClientRect(
      carrier,
      createRect({ left: 0, top: 44, width: 396, height: 48 }),
    );

    act(() => {
      dispatchPointerDown(button, {
        pointerId: 1,
        clientX: 390,
        clientY: 68,
      });
      dispatchPointerMove(window, {
        pointerId: 1,
        clientX: 390,
        clientY: 76,
      });
    });

    expect(requestAnimationFrame).toHaveBeenCalled();
    act(() => unmount());
    expect(cancelAnimationFrame).toHaveBeenCalledWith(41);
  });

  it("projects rows without replacing carriers and commits exactly once on drop", () => {
    const raf = installMockRaf();
    render(<CarrierTable />);
    stubRowCarrierGeometry();
    const carrierBefore = screen.getByTestId("carrier-row-row-1");

    act(() => {
      dispatchPointerDown(screen.getByTestId("row-menu-row-1"), {
        pointerId: 1,
        clientX: 390,
        clientY: 68,
      });
      dispatchPointerMove(window, {
        pointerId: 1,
        clientX: 390,
        clientY: 150,
      });
      raf.flush();
    });

    expect(screen.getByTestId("canonical-row-order")).toHaveTextContent(
      "row-1,row-2,row-3",
    );
    expect(screen.getByTestId("projected-row-order")).toHaveTextContent(
      "row-2,row-1,row-3",
    );
    expect(readRenderedRows()).toEqual(["row-2", "row-1", "row-3"]);
    expect(screen.getByTestId("row-commit-count")).toHaveTextContent("0");
    expect(screen.getByTestId("carrier-row-row-1")).toBe(carrierBefore);

    act(() => {
      dispatchPointerUp(window, { pointerId: 1, clientX: 390, clientY: 150 });
    });

    expect(screen.getByTestId("canonical-row-order")).toHaveTextContent(
      "row-2,row-1,row-3",
    );
    expect(screen.getByTestId("projected-row-order")).toHaveTextContent(
      "row-2,row-1,row-3",
    );
    expect(readRenderedRows()).toEqual(["row-2", "row-1", "row-3"]);
    expect(screen.getByTestId("row-commit-count")).toHaveTextContent("1");
    expect(screen.getByTestId("carrier-row-row-1")).toBe(carrierBefore);
    raf.flush();
    expect(screen.getByTestId("row-commit-count")).toHaveTextContent("1");
    raf.restore();
  });

  it("restores a projected row without a drop when canceled", () => {
    const raf = installMockRaf();
    render(<CarrierTable />);
    stubRowCarrierGeometry();

    act(() => {
      dispatchPointerDown(screen.getByTestId("row-menu-row-1"), {
        pointerId: 1,
        clientX: 390,
        clientY: 68,
      });
      dispatchPointerMove(window, {
        pointerId: 1,
        clientX: 390,
        clientY: 150,
      });
      raf.flush();
    });
    expect(readRenderedRows()).toEqual(["row-2", "row-1", "row-3"]);

    act(() => dispatchPointerCancel(window, { pointerId: 1 }));

    expect(screen.getByTestId("canonical-row-order")).toHaveTextContent(
      "row-1,row-2,row-3",
    );
    expect(screen.getByTestId("projected-row-order")).toHaveTextContent(
      "row-1,row-2,row-3",
    );
    expect(readRenderedRows()).toEqual(["row-1", "row-2", "row-3"]);
    expect(screen.getByTestId("row-commit-count")).toHaveTextContent("0");
    expect(screen.queryByTestId("drag-overlay")).not.toBeInTheDocument();
    raf.restore();
  });

  it.each([
    { expectedResult: "no-target", disconnect: false },
    { expectedResult: "invalid-target", disconnect: true },
  ])(
    "restores projection without a drop for $expectedResult",
    ({ expectedResult, disconnect }) => {
      const raf = installMockRaf();
      render(<CarrierTable />);
      stubRowCarrierGeometry();

      act(() => {
        dispatchPointerDown(screen.getByTestId("row-menu-row-1"), {
          pointerId: 1,
          clientX: 390,
          clientY: 68,
        });
        dispatchPointerMove(window, {
          pointerId: 1,
          clientX: 390,
          clientY: 150,
        });
        raf.flush();
      });
      expect(readRenderedRows()).toEqual(["row-2", "row-1", "row-3"]);

      if (disconnect) {
        act(() => {
          screen.getByTestId("disconnect-active-target").click();
        });
        act(() => {
          dispatchPointerUp(window, {
            pointerId: 1,
            clientX: 390,
            clientY: 150,
          });
        });
      } else {
        act(() => {
          dispatchPointerMove(window, {
            pointerId: 1,
            clientX: 900,
            clientY: 150,
          });
          dispatchPointerUp(window, {
            pointerId: 1,
            clientX: 900,
            clientY: 150,
          });
        });
      }

      expect(screen.getByTestId("last-result")).toHaveTextContent(
        expectedResult,
      );
      expect(screen.getByTestId("canonical-row-order")).toHaveTextContent(
        "row-1,row-2,row-3",
      );
      expect(screen.getByTestId("projected-row-order")).toHaveTextContent(
        "row-1,row-2,row-3",
      );
      expect(readRenderedRows()).toEqual(["row-1", "row-2", "row-3"]);
      expect(screen.getByTestId("row-commit-count")).toHaveTextContent("0");
      raf.restore();
    },
  );

  it("selects row and column overlay presentation from the captured group", () => {
    const raf = installMockRaf();
    render(<CarrierTable />);
    stubRowCarrierGeometry();
    stubBoundingClientRect(
      screen.getByTestId("carrier-column-b"),
      createRect({ left: 120, top: 0, width: 180, height: 220 }),
    );

    act(() => {
      dispatchPointerDown(screen.getByTestId("row-menu-row-1"), {
        pointerId: 1,
        clientX: 390,
        clientY: 68,
      });
      dispatchPointerMove(window, { pointerId: 1, clientX: 390, clientY: 76 });
      raf.flush();
    });
    expect(screen.getByTestId("drag-overlay")).toHaveAttribute(
      "data-overlay-variant",
      "table-row",
    );
    expect(screen.getByTestId("drag-overlay")).toHaveAttribute(
      "data-overlay-axis",
      "row",
    );
    act(() => dispatchPointerCancel(window, { pointerId: 1 }));

    act(() => {
      dispatchPointerDown(screen.getByTestId("column-menu-b"), {
        pointerId: 2,
        clientX: 210,
        clientY: 10,
      });
      dispatchPointerMove(window, { pointerId: 2, clientX: 218, clientY: 10 });
      raf.flush();
    });
    expect(screen.getByTestId("drag-overlay")).toHaveAttribute(
      "data-overlay-variant",
      "table-column",
    );
    expect(screen.getByTestId("drag-overlay")).toHaveAttribute(
      "data-overlay-axis",
      "column",
    );
    act(() => dispatchPointerCancel(window, { pointerId: 2 }));
    raf.restore();
  });
});

function stubRowCarrierGeometry(): void {
  stubBoundingClientRect(
    screen.getByTestId("carrier-row-row-1"),
    createRect({ left: 0, top: 44, width: 396, height: 48 }),
  );
  stubBoundingClientRect(
    screen.getByTestId("carrier-row-row-2"),
    createRect({ left: 0, top: 92, width: 396, height: 72 }),
  );
  stubBoundingClientRect(
    screen.getByTestId("carrier-row-row-3"),
    createRect({ left: 0, top: 164, width: 396, height: 56 }),
  );
}

function readRenderedRows(): string[] {
  return Array.from(
    document.querySelectorAll("tbody tr[data-row-id]"),
    (row) => row.getAttribute("data-row-id") ?? "",
  );
}
