export type PointerConfiguration = {
  activationDelay?: number | null;
  activationDistance?: number | null;
};

export type NormalizedPointerConfiguration = {
  activationDelay: number | null;
  activationDistance: number | null;
};

export type KeyboardCommand = string | readonly string[];

export type KeyboardConfiguration = {
  enabled?: boolean;
  start?: KeyboardCommand;
  drop?: KeyboardCommand;
  cancel?: KeyboardCommand;
  moveUp?: KeyboardCommand;
  moveDown?: KeyboardCommand;
  moveLeft?: KeyboardCommand;
  moveRight?: KeyboardCommand;
  moveDistance?: number;
};

export type NormalizedKeyboardConfiguration = {
  enabled: boolean;
  start: readonly string[];
  drop: readonly string[];
  cancel: readonly string[];
  moveUp: readonly string[];
  moveDown: readonly string[];
  moveLeft: readonly string[];
  moveRight: readonly string[];
  moveDistance: number;
};

export const defaultKeyboardConfiguration: NormalizedKeyboardConfiguration = {
  enabled: true,
  start: ["Space", "Enter"],
  drop: ["Space", "Enter"],
  cancel: ["Escape"],
  moveUp: ["ArrowUp"],
  moveDown: ["ArrowDown"],
  moveLeft: ["ArrowLeft"],
  moveRight: ["ArrowRight"],
  moveDistance: 24,
};

export function normalizePointerConfiguration(
  pointerConfiguration: PointerConfiguration | undefined,
): NormalizedPointerConfiguration {
  return {
    activationDelay: normalizePointerActivationValue(
      pointerConfiguration?.activationDelay,
    ),
    activationDistance: normalizePointerActivationValue(
      pointerConfiguration?.activationDistance,
    ),
  };
}

export function normalizeKeyboardConfiguration(
  keyboardConfiguration: KeyboardConfiguration | undefined,
): NormalizedKeyboardConfiguration {
  return {
    enabled: keyboardConfiguration?.enabled ?? defaultKeyboardConfiguration.enabled,
    start: normalizeKeyboardCommand(
      keyboardConfiguration?.start,
      defaultKeyboardConfiguration.start,
    ),
    drop: normalizeKeyboardCommand(
      keyboardConfiguration?.drop,
      defaultKeyboardConfiguration.drop,
    ),
    cancel: normalizeKeyboardCommand(
      keyboardConfiguration?.cancel,
      defaultKeyboardConfiguration.cancel,
    ),
    moveUp: normalizeKeyboardCommand(
      keyboardConfiguration?.moveUp,
      defaultKeyboardConfiguration.moveUp,
    ),
    moveDown: normalizeKeyboardCommand(
      keyboardConfiguration?.moveDown,
      defaultKeyboardConfiguration.moveDown,
    ),
    moveLeft: normalizeKeyboardCommand(
      keyboardConfiguration?.moveLeft,
      defaultKeyboardConfiguration.moveLeft,
    ),
    moveRight: normalizeKeyboardCommand(
      keyboardConfiguration?.moveRight,
      defaultKeyboardConfiguration.moveRight,
    ),
    moveDistance: normalizeKeyboardMoveDistance(
      keyboardConfiguration?.moveDistance,
    ),
  };
}

export function isKeyboardCommandMatch(
  key: string,
  command: readonly string[],
): boolean {
  return command.includes(normalizeKeyboardKey(key));
}

function normalizeKeyboardCommand(
  command: KeyboardCommand | undefined,
  defaultCommand: readonly string[],
): readonly string[] {
  const commandKeys =
    command === undefined
      ? defaultCommand
      : typeof command === "string"
        ? [command]
        : command;

  return commandKeys.map(normalizeKeyboardKey);
}

function normalizeKeyboardKey(key: string): string {
  return key === " " ? "Space" : key;
}

function normalizeKeyboardMoveDistance(
  moveDistance: number | undefined,
): number {
  return typeof moveDistance === "number" &&
    Number.isFinite(moveDistance) &&
    moveDistance > 0
    ? moveDistance
    : defaultKeyboardConfiguration.moveDistance;
}

function normalizePointerActivationValue(
  value: number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
