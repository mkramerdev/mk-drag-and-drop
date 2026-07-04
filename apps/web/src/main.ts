import "./style.css";
import { mountBasicDrag } from "./vanilla/basicDrag";
import { mountDropzoneList } from "./vanilla/dropzoneList";
import { mountGroupedExample } from "./vanilla/groupedExample";
import { mountKanbanExample } from "./vanilla/kanbanExample";
import { mountSortableList } from "./vanilla/sortableList";
import { mountTreeExample } from "./vanilla/treeExample";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const shell = document.createElement("main");
  shell.className = "appShell";

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

  void cleanups;

  examples.append(
    sortableExample,
    basicExample,
    dropzoneExample,
    kanbanExample,
    groupedExample,
    treeExample,
  );
  shell.append(examples);
  app.replaceChildren(shell);
}
