import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const message = document.createElement("p");

  message.textContent = "Vanilla examples are currently removed.";
  app.replaceChildren(message);
}
