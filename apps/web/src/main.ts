import "./style.css";
import { mountBasicDrag } from "./vanilla/basicDrag";
import { mountSortableList } from "./vanilla/sortableList";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const shell = document.createElement("main");
  shell.className = "appShell";

  const examples = document.createElement("div");
  examples.className = "examplesLayout";

  const basicExample = document.createElement("div");
  const sortableExample = document.createElement("div");

  const cleanups = [
    mountBasicDrag(basicExample),
    mountSortableList(sortableExample),
  ];

  void cleanups;

  examples.append(basicExample, sortableExample);
  shell.append(examples);
  app.replaceChildren(shell);
}
