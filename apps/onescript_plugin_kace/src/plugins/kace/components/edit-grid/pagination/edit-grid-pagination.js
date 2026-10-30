import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from './edit-grid-pagination.constants.js';

export function normalizePageSize(value, previous = DEFAULT_PAGE_SIZE) {
  const fallback = normalizeFallback(previous);
  const n = Number(value);
  if (!Number.isFinite(n) || n < MIN_PAGE_SIZE) return fallback;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

function normalizeFallback(previous) {
  const n = Number(previous);
  if (!Number.isFinite(n) || n < MIN_PAGE_SIZE) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

export function clampPage(page, total, pageSize) {
  const size = normalizePageSize(pageSize);
  const safeTotal =
    typeof total === 'number' && Number.isFinite(total) && total > 0
      ? Math.floor(total)
      : 0;
  const totalPages = safeTotal === 0 ? 1 : Math.ceil(safeTotal / size);
  const raw = Number.isInteger(page) && page >= 1 ? page : 1;
  return Math.min(raw, totalPages);
}

export function pageWindow({ total, page, pageSize }) {
  const size = normalizePageSize(pageSize);
  const safeTotal =
    typeof total === 'number' && Number.isFinite(total) && total > 0
      ? Math.floor(total)
      : 0;
  const safePage = clampPage(page, safeTotal, size);
  const totalPages = safeTotal === 0 ? 1 : Math.ceil(safeTotal / size);
  const startIndex = (safePage - 1) * size;
  const endIndex = Math.min(startIndex + size, safeTotal);
  return {
    page: safePage,
    pageSize: size,
    total: safeTotal,
    totalPages,
    startIndex,
    endIndex,
    startItem: safeTotal === 0 ? 0 : startIndex + 1,
    endItem: endIndex,
  };
}

export function isIndexInPage(index, page, pageSize) {
  const size = normalizePageSize(pageSize);
  const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
  const start = (safePage - 1) * size;
  return index >= start && index < start + size;
}

export function pageForIndex(index, pageSize) {
  const size = normalizePageSize(pageSize);
  if (!Number.isInteger(index) || index < 0) return 1;
  return Math.floor(index / size) + 1;
}
