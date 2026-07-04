import "./style.css";
import { mountBasicDrag } from "./vanilla/basicDrag";
import { mountDropzoneList } from "./vanilla/dropzoneList";
import { mountSortableList } from "./vanilla/sortableList";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const shell = document.createElement("main");
  shell.className = "appShell";

  const examples = document.createElement("div");
  examples.className = "examplesLayout";

  const basicExample = document.createElement("div");
  const sortableExample = document.createElement("div");
  const dropzoneExample = document.createElement("div");

  const cleanups = [
    mountBasicDrag(basicExample),
    mountSortableList(sortableExample),
    mountDropzoneList(dropzoneExample),
  ];

  void cleanups;

  examples.append(basicExample, sortableExample, dropzoneExample);
  shell.append(examples);
  app.replaceChildren(shell);
}
