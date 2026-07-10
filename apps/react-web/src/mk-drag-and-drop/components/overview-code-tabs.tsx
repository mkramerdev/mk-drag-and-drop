"use client"

import { CodeTabs } from "./quickstart/example-tabs"

const overviewDomCode = `import {
  createDragController,
  createDraggable,
  createDroppable,
} from "@mk-drag-and-drop/dom";

// HTML: <div id="task-demo"></div>
type ColumnId = "todo" | "done";

const root = document.querySelector<HTMLElement>("#task-demo");

if (!root) {
  throw new Error("Missing #task-demo root");
}

const columns: Record<ColumnId, HTMLElement> = {
  todo: createColumn("todo"),
  done: createColumn("done"),
};

const task = document.createElement("article");
task.textContent = "Write overview page";

const state = {
  column: "todo" as ColumnId,
};

root.replaceChildren(columns.todo, columns.done);
render();

const controller = createDragController({
  onDrop({ draggableId, dropTargetId }) {
    if (draggableId === "task-1" && isColumnId(dropTargetId)) {
      state.column = dropTargetId;
      render();
    }
  },
});

createDraggable({
  controller,
  element: task,
  draggableId: "task-1",
  group: "tasks",
});

createDroppable({
  controller,
  element: columns.todo,
  dropTargetId: "todo",
  group: "tasks",
});

createDroppable({
  controller,
  element: columns.done,
  dropTargetId: "done",
  group: "tasks",
});

function render() {
  columns[state.column].append(task);
}

function createColumn(columnId: ColumnId) {
  const element = document.createElement("section");
  const heading = document.createElement("h2");

  heading.textContent = columnId === "todo" ? "To do" : "Done";
  element.append(heading);

  return element;
}

function isColumnId(value: string): value is ColumnId {
  return value === "todo" || value === "done";
}`

const overviewReactCode = `import { useState, type ReactNode } from "react";
import {
  DragProvider,
  useDraggable,
  useDroppable,
} from "@mk-drag-and-drop/react";

type ColumnId = "todo" | "done";

export function TaskMoveExample() {
  const [column, setColumn] = useState<ColumnId>("todo");

  return (
    <DragProvider
      onDrop={({ draggableId, dropTargetId }) => {
        if (
          draggableId === "task-1" &&
          (dropTargetId === "todo" || dropTargetId === "done")
        ) {
          setColumn(dropTargetId);
        }
      }}
    >
      <div className="columns">
        <Column id="todo">
          {column === "todo" ? <TaskCard /> : null}
        </Column>
        <Column id="done">
          {column === "done" ? <TaskCard /> : null}
        </Column>
      </div>
    </DragProvider>
  );
}

function TaskCard() {
  const draggable = useDraggable({
    draggableId: "task-1",
    group: "tasks",
  });

  return <article {...draggable}>Write overview page</article>;
}

function Column({
  id,
  children,
}: {
  id: ColumnId;
  children: ReactNode;
}) {
  const droppable = useDroppable({
    dropTargetId: id,
    group: "tasks",
  });

  return <section {...droppable}>{children}</section>;
}`

export function OverviewMoveCodeTabs() {
  return <CodeTabs domCode={overviewDomCode} reactCode={overviewReactCode} />
}