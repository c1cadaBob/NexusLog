import { useLayoutEffect, useRef } from 'react';

const QUICK_JUMPER_SELECTOR = '.ant-pagination-options-quick-jumper input';

export function usePaginationQuickJumperAccessibility(prefix: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    const applyAccessibilityAttributes = () => {
      const inputs = container.querySelectorAll<HTMLInputElement>(QUICK_JUMPER_SELECTOR);
      inputs.forEach((input, index) => {
        const suffix = index === 0 ? '' : `-${index + 1}`;
        if (!input.id) {
          input.id = `${prefix}-page-jumper${suffix}`;
        }
        if (!input.name) {
          input.name = `${prefix}PageJumper${index === 0 ? '' : index + 1}`;
        }
      });
    };

    applyAccessibilityAttributes();

    const observer = new MutationObserver(() => {
      applyAccessibilityAttributes();
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [prefix]);

  return containerRef;
}
