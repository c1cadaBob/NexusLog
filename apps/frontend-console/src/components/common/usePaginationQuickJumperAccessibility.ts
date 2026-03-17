import { useLayoutEffect, useRef } from 'react';

const QUICK_JUMPER_SELECTOR = '.ant-pagination-options-quick-jumper input';

export function usePaginationQuickJumperAccessibility(prefix: string) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const resolveInputs = () => {
      const container = containerRef.current;
      if (container) {
        const scopedInputs = container.querySelectorAll<HTMLInputElement>(QUICK_JUMPER_SELECTOR);
        if (scopedInputs.length > 0) {
          return Array.from(scopedInputs);
        }
      }
      return Array.from(document.querySelectorAll<HTMLInputElement>(QUICK_JUMPER_SELECTOR));
    };

    const applyAccessibilityAttributes = () => {
      const inputs = resolveInputs();
      inputs.forEach((input, index) => {
        const suffix = index === 0 ? '' : `-${index + 1}`;
        if (!input.id) {
          input.id = `${prefix}-page-jumper${suffix}`;
        }
        if (!input.name) {
          input.name = `${prefix}PageJumper${index === 0 ? '' : index + 1}`;
        }
        input.autocomplete = 'off';
      });
    };

    applyAccessibilityAttributes();

    const animationFrameID = window.requestAnimationFrame(() => {
      applyAccessibilityAttributes();
    });
    const timeoutID = window.setTimeout(() => {
      applyAccessibilityAttributes();
    }, 0);

    const observer = new MutationObserver(() => {
      applyAccessibilityAttributes();
    });

    observer.observe(containerRef.current ?? document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameID);
      window.clearTimeout(timeoutID);
    };
  }, [prefix]);

  return containerRef;
}
