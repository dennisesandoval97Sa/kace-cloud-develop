import { describe, expect, it } from 'vitest';
import {
  isSheetContentOverflowing,
  isSheetPinnedAtBottom,
  isSheetScrollable,
  shouldLoadMoreOnWheel,
  shouldShowLoadMoreButton,
} from './eventLogSheetOverflow.js';

describe('isSheetScrollable', () => {
  it('is false when the element is missing', () => {
    expect(isSheetScrollable(null)).toBe(false);
    expect(isSheetScrollable(undefined)).toBe(false);
  });

  it('is false when content fits in the sheet (no overflow)', () => {
    expect(isSheetScrollable({ scrollHeight: 200, clientHeight: 400 })).toBe(
      false
    );
    expect(isSheetScrollable({ scrollHeight: 400, clientHeight: 400 })).toBe(
      false
    );
  });

  it('is true when content overflows the sheet', () => {
    expect(isSheetScrollable({ scrollHeight: 500, clientHeight: 400 })).toBe(
      true
    );
  });
});

describe('isSheetContentOverflowing', () => {
  it('is false when the container is missing', () => {
    expect(isSheetContentOverflowing(null, { scrollHeight: 500 })).toBe(false);
  });

  it('ignores a sibling (button) that only grows the container scrollHeight', () => {
    const container = { scrollHeight: 629, clientHeight: 600 };
    const content = { scrollHeight: 580 };
    expect(isSheetContentOverflowing(container, content)).toBe(false);
    expect(isSheetScrollable(container)).toBe(true);
  });

  it('is true when the content itself is taller than the container', () => {
    expect(
      isSheetContentOverflowing(
        { scrollHeight: 800, clientHeight: 600 },
        { scrollHeight: 750 }
      )
    ).toBe(true);
  });

  it('falls back to the container when content is missing', () => {
    expect(
      isSheetContentOverflowing({ scrollHeight: 500, clientHeight: 400 }, null)
    ).toBe(true);
  });

  it('subtracts the container padding from the available height', () => {
    const container = document.createElement('div');
    container.style.padding = '16px';
    Object.defineProperty(container, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    expect(isSheetContentOverflowing(container, { scrollHeight: 580 })).toBe(
      true
    );
    expect(isSheetContentOverflowing(container, { scrollHeight: 560 })).toBe(
      false
    );
  });
});

describe('isSheetPinnedAtBottom', () => {
  it('is false when the element is missing', () => {
    expect(isSheetPinnedAtBottom(null)).toBe(false);
  });

  it('is false when the viewport is not at the bottom', () => {
    expect(
      isSheetPinnedAtBottom({
        scrollTop: 250,
        clientHeight: 600,
        scrollHeight: 900,
      })
    ).toBe(false);
  });

  it('is true when the viewport is at the last pixel', () => {
    expect(
      isSheetPinnedAtBottom({
        scrollTop: 300,
        clientHeight: 600,
        scrollHeight: 900,
      })
    ).toBe(true);
  });
});

describe('shouldShowLoadMoreButton', () => {
  const ready = {
    hasMore: true,
    isSheetScrollable: false,
    isLoading: false,
    isLoadingMore: false,
    hasError: false,
  };

  it('shows Mostrar más when there is more history but the sheet cannot scroll', () => {
    expect(shouldShowLoadMoreButton(ready)).toBe(true);
  });

  it('hides Mostrar más when infinite scroll can run (sheet overflows)', () => {
    expect(
      shouldShowLoadMoreButton({ ...ready, isSheetScrollable: true })
    ).toBe(false);
  });

  it('hides Mostrar más when there is no further page', () => {
    expect(shouldShowLoadMoreButton({ ...ready, hasMore: false })).toBe(false);
  });

  it('hides Mostrar más while the first page or a next page is loading', () => {
    expect(shouldShowLoadMoreButton({ ...ready, isLoading: true })).toBe(false);
    expect(shouldShowLoadMoreButton({ ...ready, isLoadingMore: true })).toBe(
      false
    );
  });

  it('hides Mostrar más when the sheet has an error', () => {
    expect(shouldShowLoadMoreButton({ ...ready, hasError: true })).toBe(false);
  });
});

describe('shouldLoadMoreOnWheel', () => {
  const ready = {
    deltaY: 40,
    isSheetScrollable: false,
    hasMore: true,
    isLoading: false,
    isLoadingMore: false,
    hasError: false,
  };

  it('loads the next page on wheel-down when the sheet has no overflow', () => {
    expect(shouldLoadMoreOnWheel(ready)).toBe(true);
  });

  it('does not load on wheel-up', () => {
    expect(shouldLoadMoreOnWheel({ ...ready, deltaY: -40 })).toBe(false);
    expect(shouldLoadMoreOnWheel({ ...ready, deltaY: 0 })).toBe(false);
  });

  it('leaves overflowing sheets to onScroll (does not steal the wheel)', () => {
    expect(
      shouldLoadMoreOnWheel({
        ...ready,
        isSheetScrollable: true,
      })
    ).toBe(false);
  });

  it('does not load while busy, without more pages, or on error', () => {
    expect(shouldLoadMoreOnWheel({ ...ready, hasMore: false })).toBe(false);
    expect(shouldLoadMoreOnWheel({ ...ready, isLoading: true })).toBe(false);
    expect(shouldLoadMoreOnWheel({ ...ready, isLoadingMore: true })).toBe(
      false
    );
    expect(shouldLoadMoreOnWheel({ ...ready, hasError: true })).toBe(false);
  });
});
