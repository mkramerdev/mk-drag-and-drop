import "./style.css";
import { mountBasicDrag } from "./vanilla/basicDrag";
import { mountDropzoneList } from "./vanilla/dropzoneList";
import { mountGroupedExample } from "./vanilla/groupedExample";
import { mountKanbanExample } from "./vanilla/kanbanExample";
import { mountSortableList } from "./vanilla/sortableList";
import { mountSortablePerformanceExample } from "./vanilla/sortablePerformanceExample";
import { mountTreeExample } from "./vanilla/treeExample";

const app = document.querySelector<HTMLDivElement>("#app");

type ExampleRoute = "examples" | "sortable-10k" | "not-found";

if (app) {
  const shell = document.createElement("main");
  shell.className = "appShell";

  const page = document.createElement("div");

  const route = getCurrentRoute();

  if (route === "sortable-10k") {
    mountSortablePerformanceExample(page);
  } else if (route === "examples") {
    mountExamplesPage(page);
  } else {
    mountNotFoundPage(page);
  }

  shell.append(page);
  app.replaceChildren(shell);
}

function getCurrentRoute(): ExampleRoute {
  if (window.location.pathname === "/" || window.location.pathname === "") {
    return "examples";
  }

  if (window.location.pathname === "/sortable-10k") {
    return "sortable-10k";
  }

  return "not-found";
}

function mountNotFoundPage(root: HTMLElement): () => void {
  const panel = document.createElement("section");
  panel.className = "examplePanel";

  const title = document.createElement("h2");
  title.className = "exampleTitle";
  title.textContent = "Not found";

  panel.append(title);
  root.append(panel);

  return () => {
    root.replaceChildren();
  };
}

function mountExamplesPage(root: HTMLElement): () => void {
  const examples = document.createElement("div");
  examples.className = "examplesLayout";

  const basicExample = document.createElement("div");
  const sortableExample = document.createElement("div");
  const dropzoneExample = document.createElement("div");
  const kanbanExample = document.createElement("div");
  const groupedExample = document.createElement("div");
  const treeExample = document.createElement("div");

  const cleanups = [
    mountSortableList(sortableExample),
    mountBasicDrag(basicExample),
    mountDropzoneList(dropzoneExample),
    mountKanbanExample(kanbanExample),
    mountGroupedExample(groupedExample),
    mountTreeExample(treeExample),
  ];

  examples.append(
    sortableExample,
    basicExample,
    dropzoneExample,
    kanbanExample,
    groupedExample,
    treeExample,
  );
  root.append(examples);

  return () => {
    for (const cleanup of [...cleanups].reverse()) {
      cleanup();
    }

    root.replaceChildren();
  };
}
