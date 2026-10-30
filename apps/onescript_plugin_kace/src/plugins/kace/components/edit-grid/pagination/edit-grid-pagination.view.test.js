import { describe, it, expect, vi } from 'vitest';
import {
  applyLocalRowVisibility,
  removePager,
  renderPager,
} from './edit-grid-pagination.view.js';
import {
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  PAGER_ITEMS_LABEL,
  PAGER_ROOT_CLASS,
  PAGER_TITLE_FIRST,
  PAGER_TITLE_NEXT,
} from './edit-grid-pagination.constants.js';

const windowOf = (overrides = {}) => ({
  page: 2,
  pageSize: 10,
  total: 25,
  totalPages: 3,
  startItem: 11,
  endItem: 20,
  ...overrides,
});

const makeRows = (n) =>
  Array.from({ length: n }, (_, i) => {
    const el = document.createElement('div');
    el.dataset.i = String(i);
    return el;
  });

describe('applyLocalRowVisibility', () => {
  it('hides rows outside the current page with display none', () => {
    const rows = makeRows(25);
    applyLocalRowVisibility(rows, 2, 10);
    expect(rows.filter((r) => !r.hidden).map((r) => r.dataset.i)).toEqual(
      Array.from({ length: 10 }, (_, i) => String(i + 10))
    );
    expect(rows[9].hidden).toBe(true);
    expect(rows[9].style.display).toBe('none');
    expect(rows[10].style.display).toBe('');
    expect(rows[20].hidden).toBe(true);
  });

  it('is a no-op on a missing list', () => {
    expect(() => applyLocalRowVisibility(null, 1, 10)).not.toThrow();
  });
});

describe('renderPager', () => {
  it('does nothing when the container is missing', () => {
    expect(
      renderPager(null, {
        window: windowOf(),
        onPageChange: () => {},
        onPageSizeChange: () => {},
      })
    ).toBeNull();
  });

  it('renders range, page size and nav without tying nav to disabled', () => {
    const root = document.createElement('div');
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    renderPager(root, {
      window: windowOf(),
      disabled: true,
      onPageChange,
      onPageSizeChange,
    });
    expect(root.querySelectorAll(`.${PAGER_ROOT_CLASS}`)).toHaveLength(1);
    expect(root.textContent).toContain(PAGER_ITEMS_LABEL);
    expect(root.textContent).toContain('11 - 20 de 25');
    expect(root.textContent).toContain('2 / 3');
    const first = root.querySelector(`[title="${PAGER_TITLE_FIRST}"]`);
    expect(first).not.toBeDisabled();
    expect(first.querySelector('i.fa')).toBeTruthy();
    expect(first.children[0].tagName).toBe('I');

    const sizeInput = root.querySelector('input[type="number"]');
    expect(sizeInput).not.toBeNull();
    expect(sizeInput.disabled).toBe(false);
    expect(sizeInput.min).toBe(String(MIN_PAGE_SIZE));
    expect(sizeInput.max).toBe(String(MAX_PAGE_SIZE));
    expect(sizeInput.value).toBe('10');
    sizeInput.value = '7';
    sizeInput.dispatchEvent(new Event('change'));
    expect(onPageSizeChange).toHaveBeenCalledWith(7);

    first.click();
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('writes the effective pageSize after change even while the input is focused', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const onPageSizeChange = (value) => {
      renderPager(root, {
        window: windowOf({
          pageSize: value > 100 ? 100 : value,
          total: 250,
          totalPages: 3,
          startItem: 1,
          endItem: value > 100 ? 100 : value,
        }),
        onPageChange: () => {},
        onPageSizeChange,
      });
    };
    renderPager(root, {
      window: windowOf({ pageSize: 10, total: 250, totalPages: 25 }),
      onPageChange: () => {},
      onPageSizeChange,
    });
    const sizeInput = root.querySelector('input[type="number"]');
    sizeInput.focus();
    sizeInput.value = '500';
    sizeInput.dispatchEvent(new Event('change'));
    expect(sizeInput.value).toBe('100');
    root.remove();
  });

  it('updates the same pager node and keeps focus on next', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    const opts = {
      window: windowOf({ page: 1, startItem: 1, endItem: 10 }),
      onPageChange: (page) => {
        renderPager(root, {
          window: windowOf({ page, startItem: 11, endItem: 20 }),
          onPageChange: opts.onPageChange,
          onPageSizeChange: () => {},
        });
      },
      onPageSizeChange: () => {},
    };
    const firstPager = renderPager(root, opts);
    const next = root.querySelector(`[title="${PAGER_TITLE_NEXT}"]`);
    next.focus();
    next.click();
    expect(root.querySelector(`.${PAGER_ROOT_CLASS}`)).toBe(firstPager);
    expect(document.activeElement).toBe(next);
    expect(root.textContent).toContain('2 / 3');
    root.remove();
  });

  it('does not remove a nested child pager', () => {
    const parent = document.createElement('div');
    const row = document.createElement('div');
    const child = document.createElement('div');
    row.appendChild(child);
    parent.appendChild(row);
    const opts = {
      window: windowOf(),
      onPageChange: () => {},
      onPageSizeChange: () => {},
    };
    renderPager(child, opts);
    renderPager(parent, opts);
    expect(child.querySelectorAll(`.${PAGER_ROOT_CLASS}`)).toHaveLength(1);
    expect(
      Array.from(parent.children).filter((el) =>
        el.classList.contains(PAGER_ROOT_CLASS)
      )
    ).toHaveLength(1);
  });

  it('hides nav when there is a single page and keeps the size input', () => {
    const root = document.createElement('div');
    renderPager(root, {
      window: windowOf({
        page: 1,
        total: 3,
        totalPages: 1,
        startItem: 1,
        endItem: 3,
      }),
      onPageChange: () => {},
      onPageSizeChange: () => {},
    });
    expect(root.querySelector('input[type="number"]')).toBeTruthy();
    expect(root.querySelector('[data-kace-pager="nav"]').hidden).toBe(true);
  });

  it('uses t() for pager copy when provided', () => {
    const root = document.createElement('div');
    renderPager(root, {
      window: windowOf(),
      t: (s) => `T:${s}`,
      onPageChange: () => {},
      onPageSizeChange: () => {},
    });
    expect(root.textContent).toContain(`T:${PAGER_ITEMS_LABEL}`);
    expect(root.querySelector(`[title="T:${PAGER_TITLE_FIRST}"]`)).toBeTruthy();
  });
});

describe('removePager', () => {
  it('removes only the direct child pager', () => {
    const root = document.createElement('div');
    const nested = document.createElement('div');
    root.appendChild(nested);
    const opts = {
      window: windowOf(),
      onPageChange: () => {},
      onPageSizeChange: () => {},
    };
    renderPager(nested, opts);
    renderPager(root, opts);
    removePager(root);
    expect(
      Array.from(root.children).some((el) =>
        el.classList.contains(PAGER_ROOT_CLASS)
      )
    ).toBe(false);
    expect(nested.querySelector(`.${PAGER_ROOT_CLASS}`)).toBeTruthy();
  });
});
