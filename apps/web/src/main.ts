import "./style.css";

import { mountDropzoneLineExample } from "./custom/dropzone-line/dropzone-line-example";
import { mountSortableExample } from "./custom/sortable/sortable-example";

const app = document.querySelector<HTMLDivElement>("#app")!;

renderApp();

function renderApp(): void {
  const examplesLayout = document.createElement("div");
  const dropzoneLineExample = createExamplePanel({
    title: "Dropzone lines",
    mountId: "dropzone-line-example",
  });
  const sortableExample = createExamplePanel({
    title: "Sortable list",
    mountId: "sortable-example",
  });

  examplesLayout.className = "examplesLayout";
  examplesLayout.append(dropzoneLineExample.panel, sortableExample.panel);
  app.replaceChildren(examplesLayout);

  mountDropzoneLineExample(dropzoneLineExample.mountPoint);
  mountSortableExample(sortableExample.mountPoint);
}

function createExamplePanel(input: {
  title: string;
  mountId: string;
}): {
  panel: HTMLElement;
  mountPoint: HTMLElement;
} {
  const panel = document.createElement("section");
  const title = document.createElement("h2");
  const mountPoint = document.createElement("div");

  panel.className = "examplePanel";
  title.className = "exampleTitle";
  title.textContent = input.title;
  mountPoint.id = input.mountId;

  panel.append(title, mountPoint);

  return {
    panel,
    mountPoint,
  };
}
