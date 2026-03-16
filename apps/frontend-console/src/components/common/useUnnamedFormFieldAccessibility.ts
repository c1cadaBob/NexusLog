import { useLayoutEffect, useRef } from 'react';

const FIELD_SELECTOR = 'input, textarea, select';

export function useUnnamedFormFieldAccessibility(prefix: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const applyFieldNames = () => {
      const fields = Array.from(container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(FIELD_SELECTOR));
      let unnamedIndex = 0;

      fields.forEach((field) => {
        if (field.disabled || field.getAttribute('type') === 'hidden') {
          return;
        }
        if (field.id || field.name) {
          return;
        }
        unnamedIndex += 1;
        field.name = `${prefix}-field-${unnamedIndex}`;
      });
    };

    applyFieldNames();

    const observer = new MutationObserver(() => {
      applyFieldNames();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'name', 'type', 'disabled'],
    });

    return () => observer.disconnect();
  }, [prefix]);

  return containerRef;
}
