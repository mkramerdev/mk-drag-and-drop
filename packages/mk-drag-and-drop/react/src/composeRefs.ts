import type { Ref, RefCallback } from "react";

export function composeRefs<ElementType>(
  ...refs: Array<Ref<ElementType> | undefined>
): RefCallback<ElementType> {
  return (element) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }

      if (typeof ref === "function") {
        ref(element);
      } else {
        (ref as { current: ElementType | null }).current = element;
      }
    }
  };
}
