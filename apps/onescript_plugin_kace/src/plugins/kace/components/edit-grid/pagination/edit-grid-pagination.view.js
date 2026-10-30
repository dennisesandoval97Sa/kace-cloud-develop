import {
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  PAGER_ITEMS_LABEL,
  PAGER_ROOT_CLASS,
  PAGER_TITLE_FIRST,
  PAGER_TITLE_LAST,
  PAGER_TITLE_NEXT,
  PAGER_TITLE_PREV,
  formatPagerRange,
} from './edit-grid-pagination.constants.js';
import { isIndexInPage } from './edit-grid-pagination.js';

export function applyLocalRowVisibility(rowElements, page, pageSize) {
  if (!rowElements) return;
  Array.from(rowElements).forEach((el, index) => {
    if (!el) return;
    const visible = isIndexInPage(index, page, pageSize);
    el.hidden = !visible;
    el.style.display = visible ? '' : 'none';
  });
}

function findOwnPager(container) {
  if (!container?.children) return null;
  for (const child of container.children) {
    if (child.classList?.contains(PAGER_ROOT_CLASS)) return child;
  }
  return null;
}

export function removePager(container) {
  findOwnPager(container)?.remove();
}

export function renderPager(container, opts) {
  if (!container) return null;
  let pager = findOwnPager(container);
  if (!pager) pager = buildPagerSkeleton(container);
  updatePager(pager, opts);
  return pager;
}

function translate(t, text) {
  return typeof t === 'function' ? t(text) : text;
}

function buildPagerSkeleton(container) {
  const pager = document.createElement('div');
  pager.className = `${PAGER_ROOT_CLASS} d-flex justify-content-between align-items-center mt-3`;

  const left = document.createElement('div');
  left.className = 'd-flex align-items-center gap-3';
  const sizeWrap = document.createElement('div');
  sizeWrap.className = 'd-flex align-items-center gap-2';
  const label = document.createElement('span');
  label.className = 'text-muted small';
  label.dataset.kacePager = 'label';
  const sizeInput = document.createElement('input');
  sizeInput.type = 'number';
  sizeInput.min = String(MIN_PAGE_SIZE);
  sizeInput.max = String(MAX_PAGE_SIZE);
  sizeInput.step = '1';
  sizeInput.className = 'form-control form-control-sm';
  sizeInput.style.width = '4.5rem';
  sizeInput.dataset.kacePager = 'size';
  sizeInput.addEventListener('change', () => {
    pager._kaceSizeCommitted = true;
    pager._onPageSizeChange?.(Number(sizeInput.value));
  });
  sizeWrap.append(label, sizeInput);
  const range = document.createElement('span');
  range.className = 'text-muted small';
  range.dataset.kacePager = 'range';
  left.append(sizeWrap, range);

  const nav = document.createElement('div');
  nav.className = 'd-flex gap-1';
  nav.dataset.kacePager = 'nav';
  const mkBtn = (navKey, icon) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm btn-outline-secondary';
    btn.dataset.kaceNav = navKey;
    const i = document.createElement('i');
    i.className = `fa ${icon}`;
    i.setAttribute('aria-hidden', 'true');
    btn.appendChild(i);
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      pager._onPageChange?.(Number(btn.dataset.kaceGoTo));
    });
    return btn;
  };
  const pageLabel = document.createElement('span');
  pageLabel.className = 'btn btn-sm btn-outline-secondary';
  pageLabel.style.cursor = 'default';
  pageLabel.dataset.kacePager = 'page';
  nav.append(
    mkBtn('first', 'fa-angle-double-left'),
    mkBtn('prev', 'fa-angle-left'),
    pageLabel,
    mkBtn('next', 'fa-angle-right'),
    mkBtn('last', 'fa-angle-double-right')
  );

  pager.append(left, nav);
  container.appendChild(pager);
  return pager;
}

function updatePager(pager, { window: w, onPageChange, onPageSizeChange, t }) {
  pager._onPageChange = onPageChange;
  pager._onPageSizeChange = onPageSizeChange;
  pager.querySelector('[data-kace-pager="label"]').textContent = translate(
    t,
    PAGER_ITEMS_LABEL
  );
  const sizeInput = pager.querySelector('[data-kace-pager="size"]');
  sizeInput.min = String(MIN_PAGE_SIZE);
  sizeInput.max = String(MAX_PAGE_SIZE);
  sizeInput.disabled = false;
  if (document.activeElement !== sizeInput || pager._kaceSizeCommitted) {
    pager._kaceSizeCommitted = false;
    sizeInput.value = String(w.pageSize);
  }
  pager.querySelector('[data-kace-pager="range"]').textContent =
    formatPagerRange(w.startItem, w.endItem, w.total);
  pager.querySelector('[data-kace-pager="page"]').textContent =
    `${w.page} / ${w.totalPages}`;

  const atFirst = w.page <= 1;
  const atLast = w.page >= w.totalPages;
  const setNav = (key, title, goTo, isDisabled) => {
    const btn = pager.querySelector(`[data-kace-nav="${key}"]`);
    btn.title = translate(t, title);
    btn.dataset.kaceGoTo = String(goTo);
    btn.disabled = !!isDisabled;
  };
  setNav('first', PAGER_TITLE_FIRST, 1, atFirst);
  setNav('prev', PAGER_TITLE_PREV, w.page - 1, atFirst);
  setNav('next', PAGER_TITLE_NEXT, w.page + 1, atLast);
  setNav('last', PAGER_TITLE_LAST, w.totalPages, atLast);
  pager.querySelector('[data-kace-pager="nav"]').hidden = w.totalPages <= 1;
}
