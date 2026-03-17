/* @vitest-environment jsdom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { usePaginationQuickJumperAccessibility } from '../src/components/common/usePaginationQuickJumperAccessibility';

function ScopedQuickJumper() {
  const ref = usePaginationQuickJumperAccessibility('scoped');
  return (
    <div ref={ref}>
      <div className="ant-pagination-options-quick-jumper">
        <input aria-label="scoped-jumper" />
      </div>
    </div>
  );
}

function DocumentFallbackQuickJumper() {
  const ref = usePaginationQuickJumperAccessibility('fallback');

  React.useEffect(() => {
    const host = document.createElement('div');
    host.innerHTML = '<div class="ant-pagination-options-quick-jumper"><input aria-label="fallback-jumper" /></div>';
    document.body.appendChild(host);
    return () => {
      document.body.removeChild(host);
    };
  }, []);

  return <div ref={ref} />;
}

describe('usePaginationQuickJumperAccessibility', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'requestAnimationFrame', {
      writable: true,
      value: vi.fn().mockImplementation((callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0)),
    });
    Object.defineProperty(window, 'cancelAnimationFrame', {
      writable: true,
      value: vi.fn().mockImplementation((id: number) => window.clearTimeout(id)),
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('applies accessibility attributes to scoped quick jumper inputs', async () => {
    const { container } = render(<ScopedQuickJumper />);

    await waitFor(() => {
      const input = container.querySelector<HTMLInputElement>('.ant-pagination-options-quick-jumper input');
      expect(input?.id).toBe('scoped-page-jumper');
      expect(input?.name).toBe('scopedPageJumper');
      expect(input?.autocomplete).toBe('off');
    });
  });

  it('falls back to document quick jumper inputs when pagination renders outside the container', async () => {
    render(<DocumentFallbackQuickJumper />);

    await waitFor(() => {
      const input = document.querySelector<HTMLInputElement>('.ant-pagination-options-quick-jumper input[aria-label="fallback-jumper"]');
      expect(input?.id).toBe('fallback-page-jumper');
      expect(input?.name).toBe('fallbackPageJumper');
      expect(input?.autocomplete).toBe('off');
    });
  });
});
