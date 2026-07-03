import "./style.css";
import { mountBasicDrag } from "./vanilla/basicDrag";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const message = document.createElement("p");
  const basicExample = document.createElement("div");
  mountBasicDrag(basicExample);

  message.textContent = "Vanilla basic drag example";
  app.replaceChildren(message, basicExample);
}
