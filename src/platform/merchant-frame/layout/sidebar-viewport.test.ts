import { afterEach, describe, expect, it } from 'vitest';
import { isPhoneViewport, PHONE_MAX_WIDTH } from './sidebar-viewport';

const originalWidth = window.innerWidth;

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
});

describe('isPhoneViewport', () => {
  it('treats widths below the md breakpoint (768 px) as a phone', () => {
    expect(isPhoneViewport(390)).toBe(true);
    expect(isPhoneViewport(PHONE_MAX_WIDTH)).toBe(true);
    expect(isPhoneViewport(768)).toBe(false);
    expect(isPhoneViewport(1440)).toBe(false);
  });

  it('reads the current window width by default', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    expect(isPhoneViewport()).toBe(true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    expect(isPhoneViewport()).toBe(false);
  });
});
