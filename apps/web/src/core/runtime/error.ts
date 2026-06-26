export class DragAlreadyActiveError extends Error {
  constructor() {
    super("Cannot start a drag while another drag is active.");
    this.name = "DragAlreadyActiveError";
  }
}