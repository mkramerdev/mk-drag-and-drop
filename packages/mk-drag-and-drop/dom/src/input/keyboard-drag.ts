import {
  isKeyboardCommandMatch,
  type NormalizedKeyboardConfiguration,
} from "./config.js";

export type KeyboardMoveDirection = "up" | "down" | "left" | "right";

export type KeyboardDragActiveInput = "pointer" | "keyboard";

export type KeyboardDragStartInput = {
  itemId: string;
  group: string;
  element: HTMLElement;
};

export type SourceKeyboardDragKeyDownInput = KeyboardDragStartInput & {
  key: string;
};

export type KeyboardDragControllerOptions = {
  getConfiguration: () => NormalizedKeyboardConfiguration;
  isDragging: () => boolean;
  getActiveInput: () => KeyboardDragActiveInput | null;
  start: (input: KeyboardDragStartInput) => void;
  move: (direction: KeyboardMoveDirection) => void;
  drop: () => void;
  cancel: () => void;
};

export class KeyboardDragController {
  constructor(private options: KeyboardDragControllerOptions) {}

  isEnabled(): boolean {
    return this.options.getConfiguration().enabled;
  }

  handleSourceKeyDown(input: SourceKeyboardDragKeyDownInput): boolean {
    const configuration = this.options.getConfiguration();

    if (!configuration.enabled) {
      return false;
    }

    if (!this.options.isDragging()) {
      if (!isKeyboardCommandMatch(input.key, configuration.start)) {
        return false;
      }

      this.options.start({
        itemId: input.itemId,
        group: input.group,
        element: input.element,
      });
      return true;
    }

    if (this.options.getActiveInput() !== "keyboard") {
      return false;
    }

    return this.handleActiveKeyDown(input.key);
  }

  handleActiveKeyDown(key: string): boolean {
    const configuration = this.options.getConfiguration();

    if (isKeyboardCommandMatch(key, configuration.moveUp)) {
      this.options.move("up");
      return true;
    }

    if (isKeyboardCommandMatch(key, configuration.moveDown)) {
      this.options.move("down");
      return true;
    }

    if (isKeyboardCommandMatch(key, configuration.moveLeft)) {
      this.options.move("left");
      return true;
    }

    if (isKeyboardCommandMatch(key, configuration.moveRight)) {
      this.options.move("right");
      return true;
    }

    if (isKeyboardCommandMatch(key, configuration.drop)) {
      this.options.drop();
      return true;
    }

    if (isKeyboardCommandMatch(key, configuration.cancel)) {
      this.options.cancel();
      return true;
    }

    return false;
  }

  bindWindowListeners(): () => void {
    let isCleanedUp = false;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!this.handleActiveKeyDown(event.key)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      if (isCleanedUp) {
        return;
      }

      isCleanedUp = true;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }
}
