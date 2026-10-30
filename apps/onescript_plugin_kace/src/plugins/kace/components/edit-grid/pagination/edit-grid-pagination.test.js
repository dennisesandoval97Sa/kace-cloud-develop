import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from './edit-grid-pagination.constants.js';
import {
  clampPage,
  isIndexInPage,
  normalizePageSize,
  pageForIndex,
  pageWindow,
} from './edit-grid-pagination.js';

describe('normalizePageSize', () => {
  it('keeps any positive integer and floors decimals', () => {
    expect(normalizePageSize(15)).toBe(15);
    expect(normalizePageSize('7')).toBe(7);
    expect(normalizePageSize(25.9)).toBe(25);
    expect(normalizePageSize(1)).toBe(1);
  });

  it('falls back to 10 when the value is not a positive number', () => {
    expect(normalizePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(0)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(-3)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize(NaN)).toBe(DEFAULT_PAGE_SIZE);
    expect(normalizePageSize('')).toBe(DEFAULT_PAGE_SIZE);
  });

  it('caps at MAX_PAGE_SIZE', () => {
    expect(normalizePageSize(100000)).toBe(MAX_PAGE_SIZE);
    expect(normalizePageSize(MAX_PAGE_SIZE + 1)).toBe(MAX_PAGE_SIZE);
  });

  it('keeps the previous valid size when the next value is invalid', () => {
    expect(normalizePageSize('', 25)).toBe(25);
    expect(normalizePageSize(0, 7)).toBe(7);
    expect(normalizePageSize('abc', 15)).toBe(15);
  });
});

describe('pageWindow', () => {
  it('slices a full middle page', () => {
    expect(pageWindow({ total: 25, page: 2, pageSize: 10 })).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
      startIndex: 10,
      endIndex: 20,
      startItem: 11,
      endItem: 20,
    });
  });

  it('shortens the last page', () => {
    const w = pageWindow({ total: 25, page: 3, pageSize: 10 });
    expect(w.startItem).toBe(21);
    expect(w.endItem).toBe(25);
    expect(w.totalPages).toBe(3);
  });

  it('uses 0-0 of 0 and one page when empty', () => {
    expect(pageWindow({ total: 0, page: 1, pageSize: 10 })).toEqual({
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      startItem: 0,
      endItem: 0,
    });
  });

  it('clamps an out-of-range page and keeps a custom page size', () => {
    const w = pageWindow({ total: 10, page: 9, pageSize: 7 });
    expect(w.pageSize).toBe(7);
    expect(w.page).toBe(2);
    expect(w.totalPages).toBe(2);
  });

  it('falls back to page size 10 when the size is invalid', () => {
    const w = pageWindow({ total: 10, page: 1, pageSize: 0 });
    expect(w.pageSize).toBe(10);
    expect(w.totalPages).toBe(1);
  });
});

describe('isIndexInPage', () => {
  it('maps global indices to the current window', () => {
    expect(isIndexInPage(10, 2, 10)).toBe(true);
    expect(isIndexInPage(19, 2, 10)).toBe(true);
    expect(isIndexInPage(9, 2, 10)).toBe(false);
    expect(isIndexInPage(20, 2, 10)).toBe(false);
  });
});

describe('pageForIndex', () => {
  it('maps a row index to its 1-based page', () => {
    expect(pageForIndex(0, 10)).toBe(1);
    expect(pageForIndex(9, 10)).toBe(1);
    expect(pageForIndex(10, 10)).toBe(2);
    expect(pageForIndex(20, 10)).toBe(3);
  });
});

describe('clampPage', () => {
  it('stays at 1 when empty and drops to the last valid page', () => {
    expect(clampPage(4, 0, 10)).toBe(1);
    expect(clampPage(4, 25, 10)).toBe(3);
    expect(clampPage(0, 25, 10)).toBe(1);
  });
});
