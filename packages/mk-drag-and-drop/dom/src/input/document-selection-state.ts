type InlineStylePropertySnapshot = {
  name: string;
  present: boolean;
  value: string;
  priority: string;
};

type ElementSelectionSnapshot = {
  element: HTMLElement;
  properties: readonly InlineStylePropertySnapshot[];
};

type DocumentSelectionState = {
  owners: Set<object>;
  snapshots: readonly ElementSelectionSnapshot[];
  handleSelectStart: (event: Event) => void;
};

const selectionPropertyNames = ["user-select", "-webkit-user-select"] as const;

const documentSelectionStates = new WeakMap<Document, DocumentSelectionState>();

export function acquireDocumentSelectionSuppression(
  sourceDocument: Document,
): () => void {
  const owner = {};
  let state = documentSelectionStates.get(sourceDocument);

  if (!state) {
    const elements = [
      sourceDocument.documentElement,
      ...(sourceDocument.body ? [sourceDocument.body] : []),
    ];
    const snapshots = elements.map(createElementSelectionSnapshot);
    const handleSelectStart = (event: Event): void => {
      event.preventDefault();
    };

    state = {
      owners: new Set(),
      snapshots,
      handleSelectStart,
    };
    documentSelectionStates.set(sourceDocument, state);

    for (const element of elements) {
      for (const propertyName of selectionPropertyNames) {
        setSelectionProperty(element.style, propertyName, "none");
      }
    }

    sourceDocument.addEventListener("selectstart", handleSelectStart, true);
  }

  state.owners.add(owner);
  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;

    if (!state?.owners.delete(owner) || state.owners.size > 0) {
      return;
    }

    documentSelectionStates.delete(sourceDocument);
    sourceDocument.removeEventListener(
      "selectstart",
      state.handleSelectStart,
      true,
    );

    for (const snapshot of state.snapshots) {
      restoreElementSelectionSnapshot(snapshot);
    }
  };
}

function createElementSelectionSnapshot(
  element: HTMLElement,
): ElementSelectionSnapshot {
  return {
    element,
    properties: selectionPropertyNames.map((name) => ({
      name,
      present:
        hasInlineProperty(element.style, name) ||
        getSelectionProperty(element.style, name) !== "",
      value: getSelectionProperty(element.style, name),
      priority: element.style.getPropertyPriority(name),
    })),
  };
}

function restoreElementSelectionSnapshot(
  snapshot: ElementSelectionSnapshot,
): void {
  for (const property of snapshot.properties) {
    if (property.present) {
      setSelectionProperty(
        snapshot.element.style,
        property.name,
        property.value,
        property.priority,
      );
    } else {
      snapshot.element.style.removeProperty(property.name);

      if (property.name === "-webkit-user-select") {
        snapshot.element.style.webkitUserSelect = "";
      }
    }
  }
}

function getSelectionProperty(
  style: CSSStyleDeclaration,
  name: string,
): string {
  const cssValue = style.getPropertyValue(name);

  return name === "-webkit-user-select" && cssValue === ""
    ? style.webkitUserSelect ?? ""
    : cssValue;
}

function setSelectionProperty(
  style: CSSStyleDeclaration,
  name: string,
  value: string,
  priority = "",
): void {
  style.setProperty(name, value, priority);

  if (name === "-webkit-user-select" && style.webkitUserSelect !== value) {
    style.webkitUserSelect = value;
  }
}

function hasInlineProperty(style: CSSStyleDeclaration, name: string): boolean {
  for (let index = 0; index < style.length; index += 1) {
    if (style.item(index) === name) {
      return true;
    }
  }

  return false;
}
